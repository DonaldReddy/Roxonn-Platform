-- Create users table if it doesn't exist
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    github_id TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    name TEXT,
    email TEXT,
    avatar_url TEXT,
    bio TEXT,
    location TEXT,
    website TEXT,
    github_username TEXT NOT NULL,
    github_access_token TEXT NOT NULL,
    is_profile_complete BOOLEAN DEFAULT FALSE,
    role TEXT CHECK (role IN ('contributor', 'poolmanager')),
    xdc_wallet_address TEXT,
    encrypted_private_key TEXT,
    encrypted_mnemonic TEXT,
    wallet_reference_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
