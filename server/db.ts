import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../shared/schema';
import { config } from './config';
import fs from 'fs';

const connectionString = config.databaseUrl;

if (!connectionString) {
  throw new Error('DATABASE_URL is not defined');
}

// Configure PostgreSQL client with SSL options
const postgresOptions = {
  ssl: {
    // For AWS RDS connections, we need to disable certificate verification
    // while still maintaining encryption. AWS RDS certificates often have
    // self-signed certificates in their chain, causing connection issues.
    rejectUnauthorized: false
  }
};

// Get schema from config
const dbSchema = 'public'; // Explicitly set to 'public'

const client = postgres(connectionString, postgresOptions);

// Set the search path to use the specified schema
client.unsafe(`SET search_path TO ${dbSchema};`);

export const db = drizzle(client, { schema });

export const { users } = schema;
