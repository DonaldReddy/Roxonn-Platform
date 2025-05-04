-- Remove sensitive wallet fields from users table
ALTER TABLE users DROP COLUMN IF EXISTS xdc_wallet_mnemonic;
ALTER TABLE users DROP COLUMN IF EXISTS xdc_private_key;

-- Add a new column for wallet reference ID (for future secure storage)
ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_reference_id TEXT; 