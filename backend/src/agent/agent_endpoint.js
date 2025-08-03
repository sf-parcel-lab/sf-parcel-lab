const express = require('express');
const ParcelAgent = require('./parcel_agent');

const router = express.Router();
const agent = new ParcelAgent();

// Intelligent Agent Query endpoint
router.post('/agent/query', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    console.log(`🤖 Agent received query: "${message}"`);

    // Process query through intelligent agent
    const agentResponse = await agent.processQuery(message);
    
    // Get the raw data for map display (we'll need to extract this from the agent's analysis)
    // For now, we'll use the original query system to get the data
    const { ChatOpenAI } = require('@langchain/openai');
    const { HumanMessage, SystemMessage } = require('@langchain/core/messages');
    const { MongoClient } = require('mongodb');

    const llm = new ChatOpenAI({
      modelName: "gpt-3.5-turbo",
      temperature: 0,
      openAIApiKey: process.env.OPENAI_API_KEY
    });

    const SYSTEM_PROMPT = `
You are a helpful assistant for a San Francisco city parcel explorer.

Your job is to extract **structured MongoDB query filters** from user input.
The user will ask natural-language questions about land parcels in San Francisco, such as:
- Zoning type
- Neighborhood or district
- Use case (residential, mixed-use, commercial)
- Supervisor district
- Block or street

Extract only relevant filters. Output a Python dict with keys and values directly usable in MongoDB queries.

Available fields in the database:
- zoning_code: Zoning classification (e.g., "RH-1", "RH-2", "RM-1", "C-1", "M-1")
- planning_district: Planning district name (e.g., "Outer Sunset", "South of Market", "Mission")
- analysis_neighborhood: Neighborhood name (e.g., "Sunset/Parkside")
- police_district: Police district name (e.g., "TARAVAL")
- supervisor_district: Supervisor district number (e.g., "4")
- active: Boolean field indicating if parcel is active (true/false)
- in_asr_secured_roll: Boolean field indicating if parcel is in secured roll (true/false)

Query mapping rules:
- "residential" → {"zoning_code": {"$regex": "^RH|^RM", "$options": "i"}}
- "commercial" → {"zoning_code": {"$regex": "^C", "$options": "i"}}
- "mixed use" → {"zoning_code": {"$regex": "^M", "$options": "i"}}
- "two-family home" → {"zoning_code": "RH-2"}
- "Ingleside" → {"planning_district": "Ingleside"}
- "South of Market" → {"planning_district": "South of Market"}
- "Mission" → {"planning_district": "Mission"}
- "Sunset" → {"planning_district": {"$regex": "Sunset", "$options": "i"}}
- "active properties" → {"active": true}
- "secured roll" → {"in_asr_secured_roll": true}

Examples:
- "Show me residential properties" → {"zoning_code": {"$regex": "^RH|^RM", "$options": "i"}}
- "Find properties in Sunset" → {"planning_district": {"$regex": "Sunset", "$options": "i"}}
- "Commercial properties in South of Market" → {"zoning_code": {"$regex": "^C", "$options": "i"}, "planning_district": "South of Market"}
- "Active residential properties" → {"zoning_code": {"$regex": "^RH|^RM", "$options": "i"}, "active": true}

Only output JSON, no extra text.
`;

    const messages = [
      new SystemMessage(SYSTEM_PROMPT),
      new HumanMessage(message)
    ];
    
    const response = await llm.invoke(messages);
    const mongoQuery = JSON.parse(response.content);
    
    // Execute MongoDB query to get data for map
    const client = new MongoClient(process.env.MONGODB_URI);
    const db = client.db('sf_parcels');
    const collection = db.collection('parcels_merged');
    
    await client.connect();
    const results = await collection.find(mongoQuery, { projection: { _id: 0 } }).limit(200).toArray();
    await client.close();

    res.json({
      agent_response: agentResponse,
      data: results,
      query_used: mongoQuery,
      message: message
    });
    
  } catch (error) {
    console.error('Agent endpoint error:', error);
    res.status(500).json({ 
      error: 'Agent query failed', 
      details: error.message 
    });
  }
});

// Get agent conversation context
router.get('/agent/context', (req, res) => {
  try {
    const context = agent.getContext();
    res.json({ context });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get context' });
  }
});

// Clear agent conversation context
router.post('/agent/clear-context', (req, res) => {
  try {
    agent.clearContext();
    res.json({ message: 'Context cleared successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear context' });
  }
});

module.exports = router; 