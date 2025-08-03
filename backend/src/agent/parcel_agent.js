const { ChatOpenAI } = require('@langchain/openai');
const { HumanMessage, SystemMessage } = require('@langchain/core/messages');
const { MongoClient } = require('mongodb');

// Agent Configuration
const AGENT_CONFIG = {
  maxQueryRetries: 3,
  maxResultsPerQuery: 200,
  maxContextExchanges: 10,
  maxKnowledgeQueries: 3,
  maxRefinementAttempts: 5,
  maxErrorRetries: 2
};

// Knowledge Base for SF Insights
const SF_KNOWLEDGE = {
  neighborhoods: {
    "Sunset/Parkside": {
      description: "Family-friendly neighborhood with foggy weather, great schools, and Golden Gate Park access",
      highlights: ["Excellent public transit", "Safe residential area", "Good for families"],
      considerations: ["Foggy weather", "Further from downtown"]
    },
    "Mission": {
      description: "Vibrant, diverse neighborhood with great food, culture, and transit",
      highlights: ["Amazing restaurants", "Cultural diversity", "BART access"],
      considerations: ["Higher crime rates", "Gentrification concerns"]
    },
    "South of Market": {
      description: "Tech hub with modern developments and proximity to downtown",
      highlights: ["Close to downtown", "Modern amenities", "Tech companies"],
      considerations: ["Higher prices", "Less residential feel"]
    }
  },
  zoningCodes: {
    "RH-1": {
      description: "Single-family residential",
      benefits: ["Quiet neighborhood", "Good for families", "Stable value"],
      restrictions: ["No multi-family units", "Limited commercial use"]
    },
    "RH-2": {
      description: "Two-family residential",
      benefits: ["Rental income potential", "Good investment", "Flexible use"],
      restrictions: ["Maximum 2 units", "Residential only"]
    },
    "RM-1": {
      description: "Multi-family residential (low density)",
      benefits: ["Multiple units", "Higher rental income", "Investment potential"],
      restrictions: ["Height limits", "Density restrictions"]
    },
    "C-1": {
      description: "Commercial neighborhood",
      benefits: ["Business opportunities", "Mixed-use potential", "High foot traffic"],
      restrictions: ["Residential restrictions", "Zoning compliance needed"]
    }
  }
};

class ParcelAgent {
  constructor() {
    this.llm = new ChatOpenAI({
      modelName: "gpt-3.5-turbo",
      temperature: 0.7, // Slightly higher for more human-like responses
      openAIApiKey: process.env.OPENAI_API_KEY
    });
    
    this.conversationContext = [];
    this.queryAttempts = 0;
  }

  // Main agent entry point
  async processQuery(userMessage) {
    try {
      console.log(`🤖 Agent processing: "${userMessage}"`);
      
      // Step 1: Parse Intent
      const intent = await this.parseIntent(userMessage);
      console.log(`📋 Intent:`, intent);
      
      // Step 2: Build and Execute Query with Optimization Loop
      const queryResult = await this.queryOptimizationLoop(intent);
      
      if (!queryResult.success) {
        return this.generateNoResultsResponse(intent, queryResult.suggestions);
      }
      
      // Step 3: Analyze Results
      const analysis = await this.analyzeResults(queryResult.results, intent);
      
      // Step 4: Generate Recommendations
      const recommendations = await this.generateRecommendations(analysis, intent);
      
      // Step 5: Generate Human-like Response
      const response = await this.generateResponse(intent, analysis, recommendations, queryResult.attempts);
      
      // Step 6: Update Context
      this.updateContext(userMessage, response);
      
      return response;
      
    } catch (error) {
      console.error('Agent error:', error);
      return this.generateErrorResponse(error);
    }
  }

  // Step 1: Parse User Intent
  async parseIntent(userMessage) {
    const systemPrompt = `
You are an intent parser for a San Francisco real estate agent. Extract the user's intent and preferences from their message.

Extract:
- Property type (residential, commercial, mixed-use)
- Location preferences (neighborhood, district)
- Specific requirements (zoning, features)
- User's goal (buy, invest, research)

Output JSON with these fields:
{
  "propertyType": "residential|commercial|mixed-use|any",
  "location": "specific neighborhood or district",
  "zoning": "specific zoning code or pattern",
  "goal": "buy|invest|research",
  "specificRequirements": ["list", "of", "requirements"],
  "originalQuery": "original user message"
}
`;

    const messages = [
      new SystemMessage(systemPrompt),
      new HumanMessage(userMessage)
    ];

    const response = await this.llm.invoke(messages);
    return JSON.parse(response.content);
  }

  // Step 2: Query Optimization Loop
  async queryOptimizationLoop(intent) {
    let attempt = 0;
    let results = [];
    
    while (attempt < AGENT_CONFIG.maxQueryRetries && results.length < 1) {
      attempt++;
      console.log(`🔍 Query attempt ${attempt}/${AGENT_CONFIG.maxQueryRetries}`);
      
      const refinedQuery = this.refineQuery(intent, attempt);
      results = await this.executeQuery(refinedQuery);
      
      if (results.length >= 1) {
        console.log(`✅ Success! Found ${results.length} results on attempt ${attempt}`);
        break;
      }
    }
    
    if (results.length < 1) {
      return {
        success: false,
        suggestions: this.generateAlternatives(intent)
      };
    }
    
    return {
      success: true,
      results: results,
      attempts: attempt
    };
  }

  // Refine query based on attempt number
  refineQuery(intent, attempt) {
    const baseQuery = this.buildBaseQuery(intent);
    
    switch(attempt) {
      case 1:
        return baseQuery; // Exact match
      case 2:
        return this.broadenLocation(baseQuery); // Broaden location
      case 3:
        return this.removeConstraints(baseQuery); // Remove constraints
      default:
        return baseQuery;
    }
  }

  // Build base MongoDB query
  buildBaseQuery(intent) {
    const query = {};
    
    // Add property type filter
    if (intent.propertyType && intent.propertyType !== 'any') {
      switch(intent.propertyType) {
        case 'residential':
          query.zoning_code = { $regex: '^RH|^RM', $options: 'i' };
          break;
        case 'commercial':
          query.zoning_code = { $regex: '^C', $options: 'i' };
          break;
        case 'mixed-use':
          query.zoning_code = { $regex: '^M', $options: 'i' };
          break;
      }
    }
    
    // Add location filter
    if (intent.location) {
      query.planning_district = { $regex: intent.location, $options: 'i' };
    }
    
    // Add specific zoning filter
    if (intent.zoning) {
      query.zoning_code = intent.zoning;
    }
    
    return query;
  }

  // Broaden location search
  broadenLocation(query) {
    if (query.planning_district) {
      // Remove exact location constraint, search broader area
      delete query.planning_district;
    }
    return query;
  }

  // Remove constraints for broader search
  removeConstraints(query) {
    // Keep only basic filters, remove specific constraints
    const minimalQuery = {};
    if (query.zoning_code && typeof query.zoning_code === 'string') {
      // Keep only basic zoning pattern
      minimalQuery.zoning_code = { $regex: '^RH|^RM|^C|^M', $options: 'i' };
    }
    return minimalQuery;
  }

  // Execute MongoDB query
  async executeQuery(query) {
    const client = new MongoClient(process.env.MONGODB_URI);
    const db = client.db('sf_parcels');
    const collection = db.collection('parcels_merged');
    
    try {
      await client.connect();
      const results = await collection.find(query, { projection: { _id: 0 } })
        .limit(AGENT_CONFIG.maxResultsPerQuery)
        .toArray();
      return results;
    } finally {
      await client.close();
    }
  }

  // Step 3: Analyze Results
  async analyzeResults(parcels, intent) {
    const analysis = {
      totalParcels: parcels.length,
      zoningDistribution: {},
      locationDistribution: {},
      uniqueFeatures: [],
      investmentPotential: [],
      familyFriendly: [],
      hiddenGems: []
    };

    // Analyze zoning distribution
    parcels.forEach(parcel => {
      const zoning = parcel.zoning_code;
      analysis.zoningDistribution[zoning] = (analysis.zoningDistribution[zoning] || 0) + 1;
    });

    // Identify unique features
    const uniqueZonings = Object.keys(analysis.zoningDistribution);
    if (uniqueZonings.length > 1) {
      analysis.uniqueFeatures.push(`Diverse zoning options: ${uniqueZonings.join(', ')}`);
    }

    // Identify investment potential (RH-2, RM-1)
    const investmentZonings = parcels.filter(p => ['RH-2', 'RM-1', 'RM-2'].includes(p.zoning_code));
    if (investmentZonings.length > 0) {
      analysis.investmentPotential = investmentZonings.slice(0, 3);
    }

    // Identify family-friendly options (RH-1)
    const familyZonings = parcels.filter(p => p.zoning_code === 'RH-1');
    if (familyZonings.length > 0) {
      analysis.familyFriendly = familyZonings.slice(0, 3);
    }

    // Identify hidden gems (less common zoning in good locations)
    const hiddenGems = parcels.filter(p => 
      ['RM-1', 'RM-2'].includes(p.zoning_code) && 
      ['Sunset/Parkside', 'Richmond'].includes(p.analysis_neighborhood)
    );
    if (hiddenGems.length > 0) {
      analysis.hiddenGems = hiddenGems.slice(0, 2);
    }

    return analysis;
  }

  // Step 4: Generate Recommendations
  async generateRecommendations(analysis, intent) {
    const recommendations = {
      topPicks: [],
      investmentOpportunities: [],
      familyOptions: [],
      hiddenGems: []
    };

    // Select top picks based on user intent
    if (intent.goal === 'invest' && analysis.investmentPotential.length > 0) {
      recommendations.topPicks = analysis.investmentPotential;
    } else if (intent.goal === 'buy' && analysis.familyFriendly.length > 0) {
      recommendations.topPicks = analysis.familyFriendly;
    } else {
      // Default: mix of options
      recommendations.topPicks = analysis.investmentPotential.concat(analysis.familyFriendly).slice(0, 3);
    }

    recommendations.investmentOpportunities = analysis.investmentPotential;
    recommendations.familyOptions = analysis.familyFriendly;
    recommendations.hiddenGems = analysis.hiddenGems;

    return recommendations;
  }

  // Step 5: Generate Human-like Response
  async generateResponse(intent, analysis, recommendations, attempts) {
    const systemPrompt = `
You are a professional San Francisco real estate analyst. Create a structured, professional response following this exact format:

**Top Picks**
- Address: [Street Address] — Zoning: [Zoning Code] — Neighborhood: [Neighborhood Name]
- Address: [Street Address] — Zoning: [Zoning Code] — Neighborhood: [Neighborhood Name]

<details>
<summary>Neighborhood Insights</summary>

[Professional analysis of the neighborhood, including market trends, demographics, and key considerations]

</details>

<details>
<summary>Zoning Breakdown</summary>

- [Zoning Code]: [Description and implications]
- [Zoning Code]: [Description and implications]

</details>

<details>
<summary>Investment Opportunities</summary>

[Professional analysis of investment potential, market conditions, and strategic recommendations]

</details>

Guidelines:
1. Use ONLY the exact format above with proper markdown
2. NO emojis - maintain professional tone
3. Include specific property addresses when available
4. Provide actionable insights in each section
5. Keep neighborhood insights factual and data-driven
6. Explain zoning implications clearly
7. Focus on investment potential and market analysis
8. If search was broadened, mention this briefly in neighborhood insights
`;

         // Format top picks with actual addresses
     const topPicksFormatted = recommendations.topPicks.map(parcel => {
       const fromAddr = parcel.from_address_num || '';
       const toAddr = parcel.to_address_num || '';
       const streetName = parcel.street_name || '';
       const streetType = parcel.street_type || '';
       
       let address = 'Address not available';
       if (streetName && streetType) {
         if (fromAddr && toAddr && fromAddr !== toAddr) {
           address = `${fromAddr}-${toAddr} ${streetName} ${streetType}`;
         } else if (fromAddr) {
           address = `${fromAddr} ${streetName} ${streetType}`;
         } else {
           address = `${streetName} ${streetType}`;
         }
       }
       
       return {
         address: address,
         zoning: parcel.zoning_code || 'Unknown',
         neighborhood: parcel.analysis_neighborhood || parcel.planning_district || 'Unknown'
       };
     });

     const responseData = {
       intent: intent,
       analysis: analysis,
       recommendations: recommendations,
       topPicksFormatted: topPicksFormatted,
       attempts: attempts,
       knowledge: SF_KNOWLEDGE
     };

         const messages = [
       new SystemMessage(systemPrompt),
       new HumanMessage(`Generate a response using this data: ${JSON.stringify(responseData)}

Use the topPicksFormatted array to create the Top Picks section with actual addresses. Each item has address, zoning, and neighborhood properties.`)
     ];

    const response = await this.llm.invoke(messages);
    return response.content;
  }

  // Generate alternatives when no results found
  generateAlternatives(intent) {
    const alternatives = [];
    
    if (intent.location) {
      alternatives.push(`Try searching in nearby neighborhoods instead of ${intent.location}`);
    }
    
    if (intent.propertyType === 'residential') {
      alternatives.push('Consider mixed-use properties that allow residential use');
    }
    
    alternatives.push('Broaden your search criteria to include more property types');
    alternatives.push('Check different planning districts in the area');
    
    return alternatives;
  }

  // Generate no results response
  async generateNoResultsResponse(intent, suggestions) {
    return `**No Results Found**

No properties were found matching your criteria for ${intent.propertyType || 'properties'} in ${intent.location || 'the specified area'}.

<details>
<summary>Search Suggestions</summary>

${suggestions.map(s => `- ${s}`).join('\n')}

</details>

<details>
<summary>Alternative Search Options</summary>

- Search in a broader geographic area
- Consider different property types
- Explore popular neighborhoods with similar characteristics
- Adjust zoning requirements

</details>`;
  }

  // Generate error response
  generateErrorResponse(error) {
    return `**Search Error**

An error occurred while processing your property search request.

<details>
<summary>Error Details</summary>

Error: ${error.message}

</details>

<details>
<summary>Troubleshooting Options</summary>

- Rephrase your search query
- Try a simpler search with fewer constraints
- Check your internet connection
- Contact support if the issue persists

</details>`;
  }

  // Update conversation context
  updateContext(userMessage, response) {
    this.conversationContext.push({
      user: userMessage,
      agent: response,
      timestamp: new Date()
    });

    // Keep only last N exchanges
    if (this.conversationContext.length > AGENT_CONFIG.maxContextExchanges) {
      this.conversationContext = this.conversationContext.slice(-AGENT_CONFIG.maxContextExchanges);
    }
  }

  // Get conversation context
  getContext() {
    return this.conversationContext;
  }

  // Clear conversation context
  clearContext() {
    this.conversationContext = [];
  }
}

module.exports = ParcelAgent; 