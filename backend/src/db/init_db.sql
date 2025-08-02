-- Création de la base (à lancer avec un superuser, sinon commenter la ligne CREATE DATABASE)
-- CREATE DATABASE sf_parcels;
\c sf_parcels;

-- Activer PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- Table principale pour les parcelles fusionnées
DROP TABLE IF EXISTS parcels_merged;
CREATE TABLE parcels_merged (
    id SERIAL PRIMARY KEY,
    parcel_id VARCHAR(64) UNIQUE,
    properties JSONB,
    geometry GEOMETRY(Polygon, 4326),
    updated_at TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS parcels_merged_geom_gix ON parcels_merged USING GIST(geometry);
