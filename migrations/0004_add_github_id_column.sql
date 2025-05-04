-- Add github_id column to users table if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS github_id TEXT UNIQUE NOT NULL;
