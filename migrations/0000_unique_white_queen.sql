CREATE TABLE "registered_repositories" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" serial NOT NULL,
	"github_repo_id" text NOT NULL,
	"github_repo_full_name" text NOT NULL,
	"registered_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"github_id" text NOT NULL,
	"username" text NOT NULL,
	"name" text,
	"email" text,
	"avatar_url" text,
	"bio" text,
	"location" text,
	"website" text,
	"github_username" text NOT NULL,
	"github_access_token" text NOT NULL,
	"is_profile_complete" boolean DEFAULT false,
	"role" text,
	"xdc_wallet_address" text,
	"wallet_reference_id" text,
	"encrypted_private_key" text,
	"encrypted_mnemonic" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_github_id_unique" UNIQUE("github_id"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "registered_repositories" ADD CONSTRAINT "registered_repositories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;