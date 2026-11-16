-- PostgreSQL + PostGIS Spatial Schema (WGS 84 / EPSG:4326)
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS parcels (
  id VARCHAR(64) PRIMARY KEY,
  parcel_code VARCHAR(64) UNIQUE NOT NULL,
  district VARCHAR(128) NOT NULL,
  geom GEOMETRY(Polygon, 4326) NOT NULL,
  spatial_hash VARCHAR(66) NOT NULL,
  owner_address VARCHAR(42),
  token_id INTEGER,
  status VARCHAR(32) NOT NULL DEFAULT 'REGISTERED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parcels_geom ON parcels USING GIST (geom);

-- Component 1 Verification Query (0.5m overlap tolerance buffer):
-- SELECT existing.id, existing.parcel_code
-- FROM parcels existing
-- WHERE existing.id != $1
--   AND existing.status != 'REVOKED_REVERTED'
--   AND ST_Intersects(
--         ST_Buffer(ST_GeomFromGeoJSON($2)::geography, 0.5)::geometry,
--         existing.geom
--       );
