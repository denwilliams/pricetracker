-- Initialize the price tracker database
-- This file is run automatically when the PostgreSQL container starts

-- Create database if it doesn't exist
SELECT 'CREATE DATABASE pricetracker'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'pricetracker')\gexec

-- Connect to pricetracker database
\c pricetracker;

-- Create extensions if they don't exist
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Set timezone
SET timezone = 'Australia/Sydney';

-- Create indexes for better performance (these will be created by Drizzle migrations)
-- We'll let Drizzle handle the schema creation, but we can add performance optimizations here

-- Note: The actual table creation will be handled by Drizzle migrations
-- This file is mainly for database initialization and configuration