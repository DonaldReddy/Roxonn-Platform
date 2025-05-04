-- Create social_verifications table for tracking social media platform engagement
CREATE TABLE IF NOT EXISTS "social_verifications" (
  "id" SERIAL PRIMARY KEY NOT NULL,
  "user_id" INTEGER NOT NULL,
  "youtube_clicked" BOOLEAN DEFAULT FALSE,
  "twitter_clicked" BOOLEAN DEFAULT FALSE,
  "discord_clicked" BOOLEAN DEFAULT FALSE,
  "telegram_clicked" BOOLEAN DEFAULT FALSE,
  "all_clicked" BOOLEAN DEFAULT FALSE,
  "reward_sent" BOOLEAN DEFAULT FALSE,
  "transaction_hash" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "verified_at" TIMESTAMP WITH TIME ZONE,
  CONSTRAINT "social_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "social_verifications_user_id_unique" UNIQUE("user_id")
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS "social_verifications_user_id_idx" ON "social_verifications"("user_id"); 