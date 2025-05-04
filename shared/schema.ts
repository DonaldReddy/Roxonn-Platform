import { pgTable, text, serial, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  githubId: text("github_id").notNull().unique(),
  username: text("username").notNull().unique(),
  name: text("name"),
  email: text("email"),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  location: text("location"),
  website: text("website"),
  githubUsername: text("github_username").notNull(),
  githubAccessToken: text("github_access_token").notNull(),
  isProfileComplete: boolean("is_profile_complete").default(false),
  role: text("role", { enum: ["contributor", "poolmanager"] }),
  xdcWalletAddress: text("xdc_wallet_address"),
  walletReferenceId: text("wallet_reference_id"),
  encryptedPrivateKey: text("encrypted_private_key"),
  encryptedMnemonic: text("encrypted_mnemonic"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// New table for registered repositories
export const registeredRepositories = pgTable("registered_repositories", {
  id: serial("id").primaryKey(),
  // Allow userId to be null initially, set by setup flow
  userId: serial("user_id").references(() => users.id, { onDelete: 'cascade' }), 
  githubRepoId: text("github_repo_id").notNull().unique(), // Add unique constraint on githubRepoId
  githubRepoFullName: text("github_repo_full_name").notNull(),
  installationId: text("installation_id"), // Store the GitHub App Installation ID (nullable)
  registeredAt: timestamp("registered_at").defaultNow(),
});

// Create a schema for updating profile information
export const updateProfileSchema = createInsertSchema(users)
  .pick({
    bio: true,
    location: true,
    website: true,
    avatarUrl: true,
  })
  .partial();

export type UpdateProfile = z.infer<typeof updateProfileSchema>;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// Blockchain Types
export interface IssueReward {
    issueId: string;
    rewardAmount: string;
    status: string;
    rewardInEther?: string;
}

export interface Repository {
    poolManagers: string[];
    contributors: string[];
    poolRewards: string;
    issues: IssueReward[];
}

export interface BlockchainError {
    error: string;
    details?: string;
}

export interface AllocateRewardResponse {
    transactionHash: string;
    blockNumber: number;
}

export interface IssueRewardResponse {
    reward: string;
}

// Validation schemas
export const allocateRewardSchema = z.object({
    reward: z.string()
        .min(1)
        .refine(
            (val) => {
                try {
                    // Parse the string to a number and check if it's at least 1
                    return parseFloat(val) >= 1;
                } catch (e) {
                    return false;
                }
            },
            { message: "Minimum bounty amount must be at least 1 XDC" }
        )
});

export type AllocateRewardInput = z.infer<typeof allocateRewardSchema>;

export const socialVerifications = pgTable("social_verifications", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  youtubeClicked: boolean("youtube_clicked").default(false),
  twitterClicked: boolean("twitter_clicked").default(false),
  discordClicked: boolean("discord_clicked").default(false),
  telegramClicked: boolean("telegram_clicked").default(false),
  allClicked: boolean("all_clicked").default(false),
  rewardSent: boolean("reward_sent").default(false),
  transactionHash: text("transaction_hash"),
  createdAt: timestamp("created_at").defaultNow(),
  verifiedAt: timestamp("verified_at")
});