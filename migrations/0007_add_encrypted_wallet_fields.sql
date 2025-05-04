-- Add encrypted wallet fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS encrypted_private_key TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS encrypted_mnemonic TEXT;

-- Add indexes for improved query performance
CREATE INDEX IF NOT EXISTS idx_wallet_reference_id ON users(wallet_reference_id); 