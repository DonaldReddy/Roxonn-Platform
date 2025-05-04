import type { Express, Request, Response, NextFunction } from "express";
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { setupAuth, requireAuth, csrfProtection } from "./auth";
import { storage } from "./storage";
import { updateProfileSchema, allocateRewardSchema, type BlockchainError } from "@shared/schema";
import { registeredRepositories } from "../shared/schema";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { getOrgRepos, getRepoDetails, verifyRepoExists, verifyUserIsRepoAdmin, getUserAdminRepos, handlePullRequestMerged, handleIssueClosed, getInstallationAccessToken, getGitHubApiHeaders, GITHUB_API_BASE, findAppInstallationByName } from "./github";
import { blockchain } from "./blockchain";
import { ethers } from "ethers";
import { log } from './utils';
import { IncomingMessage } from 'http';
import { config } from './config';
import { Webhooks } from "@octokit/webhooks";
import axios from 'axios';
import { exchangeCodeForRefreshToken, getZohoAuthUrl, isZohoConfigured } from './zoho';
import { checkRepositoryFundingLimit, recordRepositoryFunding, getRepositoryFundingStatus, REPOSITORY_FUNDING_DAILY_LIMIT } from './funding-limits';
import { transferLimits, DAILY_TRANSFER_LIMIT } from './transfer-limits';
import { useAuth } from '@/hooks/use-auth';

// Get current file path in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Extend IncomingMessage to include body property
interface ExtendedIncomingMessage extends IncomingMessage {
  body?: any;
}

// Sanitize user data to remove sensitive information
function sanitizeUserData(user: any) {
  if (!user) return null;
  
  // Create a copy of the user object without sensitive fields
  const { xdcWalletMnemonic, xdcPrivateKey, encryptedPrivateKey, encryptedMnemonic, githubAccessToken, ...sanitizedUser } = user;
  
  return sanitizedUser;
}

// --- Webhook Middleware (Keep existing one for now, maybe rename later?) ---
const webhookMiddleware = express.raw({ 
  type: ['application/json', 'application/x-www-form-urlencoded'],
  verify: (req: ExtendedIncomingMessage, _res, buf) => {
    // Store raw body for signature verification
    if (buf && buf.length) {
      req.body = buf;
    }
  }
});

// --- GitHub App Webhook Handler ---
async function handleGitHubAppWebhook(req: Request, res: Response) {
  log('GitHub App Webhook request received', 'webhook-app');
  const event = req.headers['x-github-event'] as string;
  const signature = req.headers['x-hub-signature-256'] as string;
  const delivery = req.headers['x-github-delivery'] as string;
  
  log(`Event: ${event}, Delivery: ${delivery}`, 'webhook-app');

  if (!signature) {
    log('Missing app webhook signature', 'webhook-app');
    return res.status(401).json({ error: 'Missing signature' });
  }

  // Initialize Octokit Webhooks for App verification
  const appWebhooks = new Webhooks({
    secret: config.githubAppWebhookSecret! // Use the App specific secret
  });

  // Verify signature using App secret
  const isValid = await appWebhooks.verify(req.body.toString('utf8'), signature);
  if (!isValid) {
      log('Invalid app webhook signature', 'webhook-app');
      return res.status(401).json({ error: 'Invalid signature' });
  }
  log('App webhook signature verified successfully', 'webhook-app');

  // Parse payload AFTER verification
  const payload = JSON.parse(req.body.toString('utf8'));
  const installationId = String(payload.installation?.id);

  if (!installationId) {
      log('App webhook ignored: Missing installation ID', 'webhook-app');
      return res.status(400).json({ error: 'Missing installation ID' });
  }

  log(`Processing event '${event}'...`, 'webhook-app');

  try {
    // --- Handle Installation Events ---
    if (event === 'installation' || event === 'installation_repositories') {
      // ... logic to call storage.upsert/remove ...
      return res.status(200).json({ message: 'Installation event processed.' });
    
    // --- Handle Issue Closed for Payout --- 
    } else if (event === 'issues' && payload.action === 'closed') {
      log(`Processing App issue closed event for #${payload.issue?.number}`, 'webhook-app');
      setImmediate(() => {
          // Pass payload ONLY for now. Handler will generate token.
          handleIssueClosed(payload, installationId).catch(err => {
             log(`Error in background App Issue Closed handler: ${err?.message || err}`, 'webhook-app');
          });
      });
      return res.status(202).json({ message: 'Webhook received and Issue Closed processing initiated.' }); 

    // --- Ignore Other Events ---
    } else {
      log(`Ignoring App event ${event} with action ${payload.action}`, 'webhook-app');
      return res.status(200).json({ message: 'Event ignored' });
    }
  } catch (error: any) {
     log(`App Webhook processing error: ${error?.message || error}`, 'webhook-app');
     if (!res.headersSent) {
         return res.status(500).json({ error: 'App webhook processing failed' });
     }
  }
}

export async function registerRoutes(app: Express) {
  // Authentication is already initialized in index.ts
  // Don't call setupAuth(app) again to avoid double registration

  // Health check endpoint for AWS ALB
  app.get("/health", (req, res) => {
    res.status(200).json({ status: "healthy" });
  });
  
  // Zoho CRM Integration Routes
  app.get("/api/zoho/auth", (req, res) => {
    if (!isZohoConfigured()) {
      return res.status(500).json({ error: "Zoho CRM is not configured" });
    }
    
    // Redirect to Zoho authorization page
    const authUrl = getZohoAuthUrl();
    res.redirect(authUrl);
  });
  
  // Zoho OAuth callback handler
  app.get("/api/zoho/auth/callback", async (req, res) => {
    const { code } = req.query;
    
    if (!code) {
      return res.status(400).json({ error: "Authorization code not provided" });
    }
    
    try {
      // Exchange code for refresh token
      const refreshToken = await exchangeCodeForRefreshToken(code.toString());
      
      // Display the refresh token to save in environment variables
      res.send(`
        <h1>Zoho Authorization Complete</h1>
        <p>Please save this refresh token in your environment variables:</p>
        <pre>ZOHO_REFRESH_TOKEN="${refreshToken}"</pre>
        <p>You can now close this window and restart your application.</p>
      `);
    } catch (error) {
      console.error("Error getting Zoho refresh token:", error);
      res.status(500).json({ error: "Failed to get refresh token" });
    }
  });

  // Debug middleware to log only blockchain operations
  app.use("/api/blockchain", (req: Request, res: Response, next: NextFunction) => {
    log(`${req.method} ${req.path}`, 'blockchain');
    next();
  });

  // Public GitHub API routes
  app.get("/api/github/repos", getOrgRepos);
  app.get("/api/github/repos/:owner/:name", getRepoDetails);

  // New route to get repositories the authenticated user admins
  app.get("/api/github/user/repos", requireAuth, getUserAdminRepos);

  // Public routes
  app.get("/api/auth/user", (req, res) => {
    // Sanitize user data before sending to client
    res.json(sanitizeUserData(req.user) || null);
  });

  // --- Repository Registration Routes ---
  // This is now handled by GitHub App installation webhooks
  app.post("/api/repositories/register", requireAuth, csrfProtection, async (req: Request, res: Response) => {
    // Input validation (basic)
    const { githubRepoId, githubRepoFullName, installationId } = req.body;
    if (!githubRepoId || !githubRepoFullName) {
      return res.status(400).json({ error: 'Missing repository ID or name' });
    }

    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      // Check if already registered by this user
      const existing = await storage.findRegisteredRepository(req.user.id, githubRepoId);
      if (existing) {
        return res.status(200).json({ message: 'Repository already registered by you.', registration: existing });
      }
      
      // If installation ID is provided directly from frontend (after GitHub App installation)
      if (installationId) {
        log(`Using provided installation ID ${installationId} for ${githubRepoFullName}`, 'routes');
        
        // Register the repository with the provided installation ID
        const result = await storage.registerRepositoryDirectly(
          req.user.id, 
          githubRepoId, 
          githubRepoFullName,
          installationId
        );
        
        return res.status(201).json({ 
          success: true, 
          message: 'Repository registered successfully with provided installation ID',
          repoId: githubRepoId
        });
      }
      
      // Extract owner and repo from the full name
      const [owner, repo] = githubRepoFullName.split('/');
      if (!owner || !repo) {
        return res.status(400).json({ error: 'Invalid repository name format' });
      }
      
      // Check for GitHub App installation
      try {
        // First try repository-specific installation
        try {
          const repoResponse = await axios.get(
            `https://api.github.com/repos/${owner}/${repo}/installation`,
            {
              headers: {
                Authorization: `token ${req.user.githubAccessToken}`,
                Accept: 'application/vnd.github.v3+json'
              }
            }
          );
          
          // If we got here, app is installed for this specific repo
          const installationId = repoResponse.data.id.toString();
          log(`GitHub App installed for ${githubRepoFullName}, installation ID: ${installationId}`, 'routes');
          
          // Register the repository with the installation ID
          const result = await storage.registerRepositoryDirectly(
            req.user.id, 
            githubRepoId, 
            githubRepoFullName,
            installationId
          );
          
          // Return success
          return res.status(201).json({ 
            success: true, 
            message: 'Repository registered successfully',
            repoId: githubRepoId
          });
        } catch (repoError) {
          // Repository-specific installation not found, check user installations
          log(`Repository-specific installation not found for ${githubRepoFullName}, checking user installations`, 'routes');
          
          try {
            // Check if the app is installed for the user/organization
            const userInstallationsResponse = await axios.get(
              `https://api.github.com/user/installations`,
              {
                headers: {
                  Authorization: `token ${req.user.githubAccessToken}`,
                  Accept: 'application/vnd.github.v3+json'
                }
              }
            );
            
            // Log the raw response for debugging
            log(`User installations raw response: ${JSON.stringify(userInstallationsResponse.data)}`, 'routes');
            
            // Extract installations more safely
            const installations = userInstallationsResponse.data && 
                                  userInstallationsResponse.data.installations ? 
                                  userInstallationsResponse.data.installations : [];
            
            log(`Found ${installations.length} installations for user`, 'routes');
            
            // Log each installation in detail
            if (installations.length > 0) {
              installations.forEach((inst: any, idx: number) => {
                const slug = inst.app_slug || 'unknown';
                const id = inst.id || 'unknown';
                const name = inst.app_name || 'N/A';
                log(`Installation ${idx}: app_slug="${slug}", id=${id}, app_name="${name}"`, 'routes');
              });
            }
            
            // Use the new helper function to find our app installation by name
            const matchingInstallation = await findAppInstallationByName(installations);
            
            if (matchingInstallation) {
              // App is installed at the user/org level
              const installationId = matchingInstallation.id.toString();
              log(`GitHub App found via user installations, ID: ${installationId}`, 'routes');
              
              // Register the repository with the installation ID
              const result = await storage.registerRepositoryDirectly(
                req.user.id, 
                githubRepoId, 
                githubRepoFullName,
                installationId
              );
              
              // Return success
              return res.status(201).json({ 
                success: true, 
                message: 'Repository registered successfully via user installation',
                repoId: githubRepoId
              });
            }
          } catch (userInstallError: any) {
            log(`Error checking user installations: ${userInstallError.message || userInstallError}`, 'routes');
            // Continue to the redirect flow below
          }
          
          // If we got here, the app is not installed for the user or the repo
          throw new Error("GitHub App not installed for user or repository");
        }
      } catch (error) {
        // GitHub App not installed
        log(`GitHub App not installed for ${githubRepoFullName}, redirecting to installation`, 'routes');
        
        return res.status(400).json({
          success: false,
          error: "GitHub App not installed",
          // Use the config variable for the app name
          installUrl: `https://github.com/apps/${config.githubAppName}/installations/new?state=${githubRepoId}`
        });
      }
    } catch (error) {
      log(`Error registering repository: ${error}`, 'routes');
      res.status(500).json({ error: 'Failed to register repository' });
    }
  });

  // Get repos registered by current user (Keep this for UI)
  app.get("/api/repositories/registered", requireAuth, async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    try {
      const registrations = await storage.getRegisteredRepositoriesByUser(req.user.id);
      res.json({ repositories: registrations });
    } catch (error) {
      log(`Error fetching registered repositories: ${error}`, 'routes');
      res.status(500).json({ error: 'Failed to fetch registered repositories' });
    }
  });

  // Get all publicly visible registered repos
  app.get("/api/repositories/public", async (_req: Request, res: Response) => {
    try {
      const repositories = await storage.getAllPublicRepositories();
      // TODO: Consider fetching additional info like bounty counts or pool balances here if needed for display
      res.json({ repositories: repositories });
    } catch (error) {
      log(`Error fetching public repositories: ${error}`, 'routes');
      res.status(500).json({ error: 'Failed to fetch public repositories' });
    }
  });

  // NEW: Endpoint to get details for a repo based on owner/name (for URL mapping)
  app.get("/api/repos/details", async (req: Request, res: Response) => {
    const { owner, repo } = req.query;

    if (!owner || !repo || typeof owner !== 'string' || typeof repo !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid owner/repo query parameters' });
    }

    const fullRepoName = `${owner}/${repo}`;
    log(`Fetching details for ${fullRepoName} via /api/repos/details`, 'routes');

    try {
      // TODO: Need a function in storage like findRegisteredRepositoryByName(owner, repo)
      // Placeholder: Querying directly for now (adjust table/column names if needed)
      const registrations = await db.select()
        .from(registeredRepositories)
        .where(sql`${registeredRepositories.githubRepoFullName} = ${fullRepoName}`)
        .limit(1);

      const registration = registrations[0];

      if (registration) {
        log(`Repository ${fullRepoName} found in Roxonn DB (ID: ${registration.githubRepoId})`, 'routes');
        // Repo is managed on Roxonn
        // TODO: Fetch relevant Roxonn data (pool balance, tasks, managers etc.)
        // This might involve calling blockchain.getRepository(registration.githubRepoId)
        // and potentially other DB lookups.
        const roxonnData = {
          githubRepoId: registration.githubRepoId,
          githubRepoFullName: registration.githubRepoFullName,
          registeredAt: registration.registeredAt, // Fixed: Use registeredAt instead of createdAt
          // Placeholder for actual data
          poolBalance: '0', // Example: await blockchain.getRepositoryPoolBalance(...)
          managers: [], // Example: await storage.getPoolManagers(...)
          tasks: [], // Example: await storage.getOpenTasks(...)
        };
        return res.json({ status: 'managed', data: roxonnData });
      } else {
        log(`Repository ${fullRepoName} not found in Roxonn DB`, 'routes');
        // Repo is not managed on Roxonn
        // TODO: Optionally fetch basic info from GitHub API
        let githubInfo = null;
        try {
          // Example: Reuse existing helper if suitable or create a new one
          // Need to handle auth carefully - maybe unauthenticated or use app token
          // githubInfo = await getBasicRepoInfo(owner, repo); // Hypothetical function
          githubInfo = { name: repo, owner: owner, description: 'Basic info from GitHub (placeholder)', stars: 0 };
        } catch (githubError: any) {
           log(`Failed to fetch basic GitHub info for ${fullRepoName}: ${githubError.message}`, 'routes');
        }
        return res.json({ status: 'not_managed', github_info: githubInfo });
      }
    } catch (error: any) {
      log(`Error fetching repository details for ${fullRepoName}: ${error.message}`, 'routes');
      res.status(500).json({ error: 'Failed to fetch repository details' });
    }
  });
  // --- End Platform Repository Routes ---

  // --- GitHub App Routes ---
  app.get("/api/github/app/install-url", requireAuth, (_req: Request, res: Response) => {
    // Construct the installation URL for the GitHub App
    // Use the config variable
    const installUrl = `https://github.com/apps/${config.githubAppName}/installations/new`;
    // Optionally, could add ?target_id=... or ?repository_id=... if needed
    res.json({ installUrl });
  });
  
  // NEW: Endpoint called by frontend after user redirects back from GitHub installation
  app.post("/api/github/app/finalize-installation", requireAuth, csrfProtection, async (req: Request, res: Response) => {
    const { installationId } = req.body;
    const userId = req.user!.id; // requireAuth ensures user exists

    if (!installationId || typeof installationId !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid installation ID' });
    }
    log(`Finalizing installation ID ${installationId} for user ID ${userId}`, 'github-app');

    try {
        // 1. Get an installation access token
        const token = await getInstallationAccessToken(installationId);
        if (!token) { throw new Error('Could not generate installation token'); }
        const headers = getGitHubApiHeaders(token);

        // 2. Fetch repositories associated with this installation ID from GitHub
        interface InstallationReposResponse {
            total_count: number;
            repositories: any[]; // Use specific type if known, else any[]
        }
        const repoResponse = await axios.get<InstallationReposResponse>(
            `${GITHUB_API_BASE}/installation/repositories`,
            { headers: headers }
        );

        // Check response structure before accessing .repositories
        if (!repoResponse.data || !Array.isArray(repoResponse.data.repositories)) {
            throw new Error('Could not fetch repositories for installation - invalid response structure');
        }

        const repositories = repoResponse.data.repositories;
        log(`Found ${repositories.length} repositories for installation ${installationId}`, 'github-app');

        // 3. Update DB for each repository
        let finalResults = [];
        let successfulAssociations = 0;
        for (const repo of repositories) {
            const githubRepoId = String(repo.id);
            const githubRepoFullName = repo.full_name;
            if (!githubRepoId || !githubRepoFullName) {
                log(`Warning: Skipping repo with missing ID or full name from installation ${installationId}: ${JSON.stringify(repo)}`, 'github-app');
                continue; // Skip this repo
            }

            try {
                // Check if the repository already exists in our DB
                const existingRepo = await storage.findRegisteredRepositoryByGithubId(githubRepoId);

                if (!existingRepo) {
                    // Repository doesn't exist, create it first and link to installation
                    log(`Repository ${githubRepoFullName} (ID: ${githubRepoId}) not found in DB. Creating...`, 'github-app');
                    await storage.addOrUpdateInstallationRepo(installationId, githubRepoId, githubRepoFullName);
                    log(`Repository ${githubRepoFullName} created and linked to installation ${installationId}.`, 'github-app');
                    // Now associate the user
                    await storage.associateUserToInstallationRepo(userId, githubRepoId, installationId);
                    log(`User ${userId} associated with new repository ${githubRepoFullName}.`, 'github-app');
                } else {
                    // Repository exists, just associate the user (this also updates installation ID)
                    log(`Repository ${githubRepoFullName} (ID: ${githubRepoId}) found in DB. Associating user...`, 'github-app');
                    await storage.associateUserToInstallationRepo(userId, githubRepoId, installationId);
                    log(`User ${userId} associated with existing repository ${githubRepoFullName}.`, 'github-app');
                }
                successfulAssociations++;
            } catch (dbError: any) {
                // Log the specific error for this repo but continue with others
                log(`Error associating repo ${githubRepoFullName} (ID: ${githubRepoId}) for user ${userId}: ${dbError.message}`, 'github-app');
                // Optionally add to a list of failed associations to return to the user
            }
        }

        log(`Successfully processed ${repositories.length} repositories, associated ${successfulAssociations} for user ${userId}`, 'github-app');
        // Return success even if some individual associations failed (they were logged)
        res.json({ success: true, count: successfulAssociations }); // Update count to reflect actual successes

    } catch (error: any) {
        // This catches errors like token generation or the initial repo fetch
        log(`Error finalizing installation ${installationId} for user ${userId}: ${error.message}`, 'github-app');
        res.status(500).json({ error: 'Failed to finalize installation' });
    }
  });

  // Protected profile routes
  app.patch("/api/profile", requireAuth, csrfProtection, async (req, res) => {
    const result = updateProfileSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid profile data" });
    }

    try {
      // Since this route uses requireAuth middleware, we know req.user exists
      const updatedUser = await storage.updateProfile(req.user!.id, result.data);
      // Sanitize user data before sending to client
      res.json(sanitizeUserData(updatedUser));
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(400).json({ error: "Failed to update profile" });
    }
  });

  // Get wallet info
  app.get('/api/wallet/info', requireAuth, csrfProtection, async (req, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // Get wallet info from blockchain service
      const walletInfo = await blockchain.getWalletInfo(user.id);
      
      // Mask address for logging to reduce sensitive data exposure
      const maskedAddress = walletInfo.address ? 
        `${walletInfo.address.substring(0, 6)}...${walletInfo.address.substring(walletInfo.address.length - 4)}` : 
        'none';
      log(`Wallet info retrieved for user ${user.id}, Address=${maskedAddress}`, 'routes');
      
      // Add cache control headers to prevent caching sensitive data
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      // Format BigInt values as strings for JSON response
      res.json({
        address: walletInfo.address,
        balance: walletInfo.balance.toString(),
        tokenBalance: walletInfo.tokenBalance.toString()
      });
    } catch (error) {
      console.error('Error fetching wallet info:', error);
      res.status(500).json({ error: 'Failed to fetch wallet information' });
    }
  });
  
  // Get transfer limits for user wallet
  app.get('/api/wallet/limits', requireAuth, csrfProtection, async (req, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      
      // Get transfer limits from service
      const transferStatus = transferLimits.getUserTransferStatus(user.id.toString());
      
      // Format the response
      const response = {
        usedAmount: transferStatus.usedAmount,
        remainingLimit: transferStatus.remainingLimit,
        dailyLimit: DAILY_TRANSFER_LIMIT,
        resetTime: transferStatus.resetTimestamp
      };
      
      // Add cache control headers
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      res.json(response);
    } catch (error) {
      console.error('Error fetching transfer limits:', error);
      res.status(500).json({ error: 'Failed to fetch transfer limits' });
    }
  });
  
  // Get recent transactions for user wallet
  app.get('/api/wallet/transactions', requireAuth, csrfProtection, async (req, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      
      // Get limit from query parameters or use default
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      
      // Get recent transactions from blockchain service
      const transactions = await blockchain.getRecentTransactions(user.id, limit);
      
      // Add cache control headers
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      res.json({ transactions });
    } catch (error) {
      console.error('Error fetching transactions:', error);
      res.status(500).json({ error: 'Failed to fetch transaction history' });
    }
  });
  
  // Send XDC from user wallet to external address
  app.post('/api/wallet/send', requireAuth, csrfProtection, async (req, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      
      // Extract parameters from request body
      const { to, amount } = req.body;
      
      // Basic validation
      if (!to || !amount) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }
      
      // Validate recipient address
      let recipientAddress = to;
      
      // Make sure the address has the xdc prefix
      if (!recipientAddress.startsWith('xdc')) {
        if (recipientAddress.startsWith('0x')) {
          recipientAddress = 'xdc' + recipientAddress.substring(2);
        } else {
          recipientAddress = 'xdc' + recipientAddress;
        }
      }
      
      try {
        // Check if it's a valid address format using ethers (normalize for validation)
        const normalizedAddress = '0x' + recipientAddress.substring(3);
        if (!ethers.isAddress(normalizedAddress)) {
          return res.status(400).json({ error: 'Invalid recipient address' });
        }
      } catch (error) {
        return res.status(400).json({ error: 'Invalid recipient address format' });
      }
      
      // Parse and validate amount
      const amountValue = parseFloat(amount);
      if (isNaN(amountValue) || amountValue <= 0) {
        return res.status(400).json({ error: 'Invalid amount' });
      }
      
      // Set minimum amount to 0.1 XDC
      const MIN_AMOUNT = 1.0;
      if (amountValue < MIN_AMOUNT) {
        return res.status(400).json({ 
          error: `Minimum transfer amount is ${MIN_AMOUNT} XDC` 
        });
      }
      
      // Check daily transfer limit
      const transferLimitCheck = transferLimits.checkTransferLimit(user.id.toString(), amountValue);
      
      if (!transferLimitCheck.allowed) {
        return res.status(400).json({
          error: 'Daily transfer limit exceeded',
          reason: transferLimitCheck.reason,
          status: transferLimitCheck.status,
          details: {
            usedToday: transferLimitCheck.status?.usedAmount.toFixed(2),
            dailyLimit: 1000,
            remaining: transferLimitCheck.status?.remainingLimit.toFixed(2),
            resetTime: transferLimitCheck.status?.resetTimestamp
          }
        });
      }
      
      // Convert amount to wei
      const amountWei = ethers.parseEther(amount.toString());
      
      // Check if user has sufficient balance including gas
      const walletInfo = await blockchain.getWalletInfo(user.id);
      const GAS_RESERVE = ethers.parseEther('0.1'); // Reserve 0.1 XDC for gas
      
      if (walletInfo.balance < (amountWei + GAS_RESERVE)) {
        return res.status(400).json({ 
          error: 'Insufficient balance (including gas reserve)',
          details: {
            balance: ethers.formatEther(walletInfo.balance),
            requiredWithGas: ethers.formatEther(amountWei + GAS_RESERVE)
          }
        });
      }
      
      // Get user's address
      const userAddress = walletInfo.address;
      if (!userAddress) {
        return res.status(500).json({ error: 'User wallet not found' });
      }
      
      // Log the transfer intent (for audit purposes)
      log(
        `Transfer initiated: ${user.username} (${user.id}) sending ${amount} XDC ` +
        `from ${userAddress.substring(0, 6)}...${userAddress.substring(userAddress.length - 4)} ` +
        `to ${recipientAddress.substring(0, 6)}...${recipientAddress.substring(recipientAddress.length - 4)}`,
        'routes'
      );
      
      // Perform the transfer using blockchain service
      const txResult = await blockchain.sendFunds(user.id, recipientAddress, amountWei);
      
      // Record the transfer for daily limit tracking
      transferLimits.recordTransfer(user.id.toString(), amountValue);
      
      // Log successful transaction
      log(
        `Transfer successful: ${amount} XDC sent from user ${user.id} to ` +
        `${recipientAddress.substring(0, 6)}...${recipientAddress.substring(recipientAddress.length - 4)}. ` +
        `Transaction hash: ${txResult.hash}`,
        'routes'
      );
      
      // Return success response
      res.json({
        success: true,
        message: 'Transaction submitted successfully',
        hash: txResult.hash,
        recipient: recipientAddress,
        amount: amount
      });
      
    } catch (error: any) {
      console.error('Error processing wallet transfer:', error);
      
      // Provide more detailed error message to client
      if (error.code && error.reason) {
        // If it's an Ethereum error with code and reason
        res.status(400).json({
          error: 'Transaction failed',
          details: {
            code: error.code,
            reason: error.reason
          }
        });
      } else {
        res.status(500).json({ error: error.message || 'Failed to send funds' });
      }
    }
  });

  // Blockchain routes
  app.get('/api/blockchain/repository/:repoId', async (req, res) => {
    try {
      const repoId = parseInt(req.params.repoId);

      // Get repository info from blockchain (no authentication required)
      const repository = await blockchain.getRepository(repoId);
      res.json(repository); // Already formatted in blockchain service
    } catch (error) {
      console.error('Error fetching repository:', error);
      const blockchainError: BlockchainError = {
        error: 'Failed to fetch repository',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
      res.status(500).json(blockchainError);
    }
  });

  // Get repository funding status
  app.get('/api/blockchain/repository/:repoId/funding-status', requireAuth, async (req, res) => {
    try {
      const repoIdString = req.params.repoId;
      const repoIdNumber = parseInt(repoIdString, 10);
      
      if (isNaN(repoIdNumber)) {
        return res.status(400).json({ error: 'Invalid repository ID format.' });
      }
      
      // Get current funding status for this repository
      const fundingStatus = getRepositoryFundingStatus(repoIdNumber);
      
      return res.json({
        dailyLimit: REPOSITORY_FUNDING_DAILY_LIMIT,
        currentTotal: fundingStatus.currentTotal,
        remainingLimit: fundingStatus.remainingLimit,
        windowStartTime: fundingStatus.windowStartTime.toISOString(),
        windowEndTime: fundingStatus.windowEndTime.toISOString()
      });
    } catch (error) {
      console.error('Error getting repository funding status:', error);
      res.status(500).json({ error: 'Failed to get repository funding status' });
    }
  });

  // Modified funding route with stricter checks
  app.post('/api/blockchain/repository/:repoId/fund', requireAuth, csrfProtection, async (req, res) => {
    try {
      // Validate input: repoId from URL param, amountXdc and repositoryFullName from body
      const repoIdString = req.params.repoId; // repoId from GitHub, treat as string for consistency
      const { amountXdc, repositoryFullName } = req.body;

      // Explicit check for req.user after requireAuth for type safety / linter
      if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated despite middleware check.' });
      }

      if (!repoIdString || !amountXdc || !repositoryFullName || typeof amountXdc !== 'string' || typeof repositoryFullName !== 'string') {
         return res.status(400).json({ error: 'Missing or invalid parameters (repoId, amountXdc, repositoryFullName)' });
      }

      // Validate amount format
      try {
        ethers.parseEther(amountXdc);
      } catch (error) {
        return res.status(400).json({ error: 'Invalid amount format for XDC' });
      }

      // Check user authentication and role (req.user is now guaranteed to exist)
      if (req.user.role !== 'poolmanager' || !req.user.githubAccessToken || !req.user.walletReferenceId) {
        return res.status(403).json({ error: 'Forbidden: User must be an authenticated Pool Manager with a connected wallet and GitHub token.' });
      }

      // Verify repository registration in our database for this user
      const registration = await storage.findRegisteredRepository(req.user.id, repoIdString);
      if (!registration) {
        return res.status(403).json({ error: 'Forbidden: Repository not registered by this user.' });
      }
      // Optionally check if registration.githubRepoFullName matches repositoryFullName from body for consistency
      if (registration.githubRepoFullName !== repositoryFullName) {
         log(`Warning: Full name mismatch during funding. DB: ${registration.githubRepoFullName}, Request: ${repositoryFullName}`, 'routes');
         // Decide whether to error out or proceed
         // return res.status(400).json({ error: 'Repository name mismatch.' });
      }

      // Extract owner/name for GitHub admin check
      const [owner, name] = repositoryFullName.split('/');
      if (!owner || !name) {
        return res.status(400).json({ error: 'Invalid repository name format in request body.' });
      }

      // Strictly verify admin permissions on GitHub
      log(`Verifying admin permissions for ${req.user.id} on ${repositoryFullName}`, 'routes');
      const isAdmin = await verifyUserIsRepoAdmin(req.user.githubAccessToken, owner, name);
      if (!isAdmin) {
        // If they were admin when registering but not now, forbid funding
        return res.status(403).json({ error: 'Forbidden: User no longer has admin rights on the GitHub repository.' });
      }

      // Log funding action with XDC
      log(`User ${req.user.id} funding registered repository ${repoIdString} with ${amountXdc} XDC`, 'routes');

      // Call blockchain service (passing repoId as number, amountXdc as string)
      const repoIdNumber = parseInt(repoIdString, 10);
      if (isNaN(repoIdNumber)) {
          return res.status(400).json({ error: 'Invalid repository ID format.'});
      }
      
      // Check daily funding limit for this repository
      const amountXdcNumber = parseFloat(amountXdc);
      const fundingCheck = checkRepositoryFundingLimit(repoIdNumber, amountXdcNumber);
      
      if (!fundingCheck.allowed) {
        const resetTimeStr = fundingCheck.limitResetTime ? fundingCheck.limitResetTime.toISOString() : 'unknown';
        log(`Funding rejected: Repository ${repoIdNumber} has reached daily limit of ${REPOSITORY_FUNDING_DAILY_LIMIT} XDC`, 'routes');
        return res.status(429).json({
          error: `Daily funding limit reached for this repository.`,
          details: {
            remainingLimit: fundingCheck.remainingLimit,
            dailyLimit: REPOSITORY_FUNDING_DAILY_LIMIT,
            limitResetTime: resetTimeStr
          }
        });
      }

      const txResponse = await blockchain.addFundToRepository(
        repoIdNumber, // Pass as number
        amountXdc,    // Pass XDC amount string
        req.user.id
      );
      
      // Record the successful funding transaction
      recordRepositoryFunding(repoIdNumber, amountXdcNumber);

      // Respond with transaction details using the correct 'res' object
      return res.json({ // Added return here
          message: 'Funding transaction submitted successfully.',
          transactionHash: txResponse.hash
      });

    } catch (error: any) {
      log(`Error funding repository ${req.params.repoId}: ${error}`, 'routes');
      // Provide more specific error messages if possible (e.g., from blockchain service)
      const errorMessage = error.message || 'Failed to fund repository';
      const status = errorMessage.includes('Insufficient') ? 400 : 500; // Basic error mapping
      res.status(status).json({ error: errorMessage });
    }
  });

  // Endpoint to approve token spending - Less relevant now for funding
  app.post('/api/blockchain/token/approve', requireAuth, csrfProtection, async (req, res) => {
    try {
      const { amount } = req.body;

      if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      if (!req.user.walletReferenceId) {
        return res.status(400).json({ error: 'User wallet not found' });
      }

      // Approve tokens for contract
      const result = await blockchain.approveTokensForContract(
        amount,
        req.user.id
      );

      res.json(result);
    } catch (error) {
      const blockchainError: BlockchainError = {
        error: 'Failed to approve tokens',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
      res.status(500).json(blockchainError);
    }
  });

  app.post('/api/blockchain/repository/:repoId/issue/:issueId/reward', requireAuth, csrfProtection, async (req, res) => {
    try {
      const repoId = parseInt(req.params.repoId);
      const issueId = parseInt(req.params.issueId);
      const { reward } = req.body;

      // Validate request body
      const validation = allocateRewardSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: 'Invalid reward data' });
      }

      if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      if (!req.user.walletReferenceId) {
        return res.status(400).json({ error: 'User wallet not found' });
      }

      if (req.user.role !== 'poolmanager') {
        return res.status(403).json({ error: 'Only pool managers can allocate rewards' });
      }

      // Validate reward amount
      try {
        ethers.parseUnits(reward, 'ether');
      } catch (error) {
        return res.status(400).json({ error: 'Invalid reward amount' });
      }

      // Allocate reward to issue - NOW AWAIT the result
      const result = await blockchain.allocateIssueReward(
        repoId,
        issueId,
        reward, // Keep passing reward as string
        req.user.id
      );
      
      // Get repository and issue details for notification -> Now get details from req.body
      try {
        // REMOVED: Database lookup and GitHub API call for issue details
        // const repoInfo = await blockchain.getRepository(repoId);
        // const repoRegistrations = await db.select()...
        // const repository = repoRegistrations[0];
        // if (repository && repository.installationId) { ... }
        //   const headers = await getGitHubApiHeaders...
        //   const issueResponse = await axios.get...
        //   if (issueResponse.data) { ... }
        //     const issueData = issueResponse.data;

        // Directly use data from req.body for notification
        const { githubRepoFullName, issueTitle, issueUrl } = req.body;

        // Basic validation for required fields from body
        if (githubRepoFullName && issueTitle && issueUrl) {
            log(`Attempting to send bounty notification for ${githubRepoFullName}#${issueId}`, 'zoho');
            // Send notification to Zoho CRM in a non-blocking way
            import('./zoho.js').then(zoho => {
              zoho.sendBountyNotification(
                githubRepoFullName, // Use from req.body
                issueId,
                issueTitle,         // Use from req.body
                reward,
                issueUrl            // Use from req.body
              ).catch(err => {
                // Just log errors, don't block the main flow
                log(`Failed to send bounty notification: ${err.message}`, 'zoho');
              });
            }).catch(err => {
              log(`Error importing zoho module: ${err.message}`, 'zoho');
            });
        } else {
            log(`Skipping Zoho notification due to missing data in request body (githubRepoFullName, issueTitle, issueUrl) for issue ${issueId}`, 'zoho');
        }
        // REMOVED: Closing braces for removed if/if blocks
        //   } // end if (issueResponse.data)
        // } // end if (repository && repository.installationId)
      } catch (error) {
        // Catch block might still catch import errors or other unexpected issues, log them.
        log(`Error preparing/sending bounty notification: ${error instanceof Error ? error.message : 'Unknown error'}`, 'zoho');
      }

      // Respond immediately after the transaction is sent - CHANGED TO RESPOND WITH HASH
      res.json({
        message: 'Reward allocation transaction submitted successfully',
        transactionHash: result.transactionHash // Include the hash in the response
      });
    } catch (error) {
      const blockchainError: BlockchainError = {
        error: 'Failed to allocate reward',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
      // Log the error on the server
      log(`Error allocating reward for ${req.params.repoId}/${req.params.issueId}: ${blockchainError.details}`, "blockchain"); 
      // Send error response to client
      res.status(500).json(blockchainError);
    }
  });

  app.get('/api/blockchain/repository/:repoId/issue/:issueId/reward', async (req, res) => {
    try {
      const repoId = parseInt(req.params.repoId);
      const issueId = parseInt(req.params.issueId);

      // Get issue rewards (no authentication check)
      const rewards = await blockchain.getIssueRewards(repoId, [issueId]);
      
      res.json({
        reward: rewards[0] || '0'
      });
    } catch (error) {
      console.error('Error fetching issue reward:', error);

      // ADDED: Helper to safely stringify potential BigInts in the error
      const replacer = (key: string, value: any) => typeof value === 'bigint' ? value.toString() : value;
      const errorDetails = error instanceof Error ? error.message : JSON.stringify(error, replacer);

      const blockchainError: BlockchainError = {
        error: 'Failed to fetch issue reward',
        details: errorDetails
      };
      res.status(500).json(blockchainError);
    }
  });

  // Apply CSRF protection to allocation endpoint
  app.post('/api/blockchain/repository/:repoId/issue/:issueId/allocate', requireAuth, csrfProtection, async (req, res) => {
    try {
      const repoId = parseInt(req.params.repoId);
      const issueId = parseInt(req.params.issueId);
      
      // ... existing code ...
    } catch (error) {
      // ... existing code ...
    }
  });

  // Apply CSRF protection to distribution endpoint
  app.post('/api/blockchain/repository/:repoId/issue/:issueId/distribute', requireAuth, csrfProtection, async (req, res) => {
    try {
      const repoId = parseInt(req.params.repoId);
      const issueId = parseInt(req.params.issueId);
      
      // ... existing code ...
    } catch (error) {
      // ... existing code ...
    }
  });

  // Add endpoint to get rewards for multiple repositories
  app.post('/api/blockchain/repository-rewards', express.json(), async (req, res) => {
    try {
      const { repoIds } = req.body;
      
      if (!Array.isArray(repoIds) || repoIds.length === 0) {
        return res.status(400).json({ error: 'Invalid or empty repoIds array' });
      }
      
      // Get rewards for all repositories
      const rewards = await blockchain.getRepositoryRewards(repoIds);
      
      // Format and return the rewards
      const formattedRewards = repoIds.map((repoId, index) => ({
        repoId,
        totalRewards: rewards[index]?.toString() || '0'
      }));
      
      res.json({ rewards: formattedRewards });
    } catch (error) {
      console.error('Error fetching repository rewards:', error);
      const blockchainError: BlockchainError = {
        error: 'Failed to fetch repository rewards',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
      res.status(500).json(blockchainError);
    }
  });

  // --- Webhook Routes ---
  // Old user webhook (Commented out)
  // app.post('/webhook/github', webhookMiddleware, handleGitHubWebhook);
  // New GitHub App webhook endpoint
  app.post('/webhook/github/app', express.raw({ type: 'application/json' }), handleGitHubAppWebhook);

  // Token-specific endpoints
  app.get("/api/token/balance", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user;
      if (!user || !user.xdcWalletAddress) {
        return res.status(400).json({ error: 'Wallet address not found' });
      }
      
      const userAddress = user.xdcWalletAddress;
      const balance = await blockchain.getTokenBalance(userAddress);
      res.json({ balance: balance.toString() });
    } catch (error) {
      log(`Error fetching token balance: ${error}`, 'blockchain');
      res.status(500).json({ error: 'Failed to fetch token balance' });
    }
  });

  // --- Social Engagement Routes ---
  
  // Get social verification status
  app.get("/api/social/status", requireAuth, async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
      const verification = await storage.getSocialVerification(req.user.id);
      
      if (!verification) {
        return res.json({
          success: true,
          verified: false,
          platforms: {
            youtube: false,
            twitter: false,
            discord: false,
            telegram: false
          },
          allClicked: false,
          rewardSent: false
        });
      }
      
      res.json({
        success: true,
        verified: verification.allClicked,
        platforms: {
          youtube: verification.youtubeClicked,
          twitter: verification.twitterClicked,
          discord: verification.discordClicked,
          telegram: verification.telegramClicked
        },
        allClicked: verification.allClicked,
        rewardSent: verification.rewardSent,
        transactionHash: verification.transactionHash
      });
    } catch (error) {
      log(`Error fetching social verification status: ${error}`, 'routes');
      res.status(500).json({ error: 'Failed to fetch social verification status' });
    }
  });
  
  // Update platform click status
  app.post("/api/social/click", requireAuth, csrfProtection, async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const { platform } = req.body;
    
    if (!platform || !['youtube', 'twitter', 'discord', 'telegram'].includes(platform)) {
      return res.status(400).json({ error: 'Invalid platform' });
    }
    
    try {
      // Update the click status
      await storage.updateSocialClick(req.user.id, platform as 'youtube' | 'twitter' | 'discord' | 'telegram', true);
      
      // Get updated verification status
      const verification = await storage.getSocialVerification(req.user.id);
      
      res.json({
        success: true,
        platforms: {
          youtube: verification.youtubeClicked,
          twitter: verification.twitterClicked,
          discord: verification.discordClicked,
          telegram: verification.telegramClicked
        },
        allClicked: verification.allClicked,
        rewardSent: verification.rewardSent
      });
    } catch (error) {
      log(`Error updating platform click status: ${error}`, 'routes');
      res.status(500).json({ error: 'Failed to update platform click status' });
    }
  });
  
  // Claim social reward
  app.post("/api/social/claim-reward", requireAuth, csrfProtection, async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
      // Check if user is eligible for reward
      const verification = await storage.getSocialVerification(req.user.id);
      
      if (!verification) {
        return res.status(400).json({ 
          error: 'You need to follow all social platforms first'
        });
      }
      
      if (!verification.allClicked) {
        return res.status(400).json({ 
          error: 'You need to follow all social platforms first',
          platforms: {
            youtube: verification.youtubeClicked,
            twitter: verification.twitterClicked,
            discord: verification.discordClicked,
            telegram: verification.telegramClicked
          }
        });
      }
      
      if (verification.rewardSent) {
        return res.status(400).json({ 
          error: 'Reward already claimed',
          transactionHash: verification.transactionHash 
        });
      }
      
      // Send the reward
      const txHash = await blockchain.sendSocialReward(req.user.id);
      
      // Record the transaction in the database
      await storage.recordSocialReward(req.user.id, txHash);
      
      res.json({
        success: true,
        message: '1 XDC reward has been sent to your wallet!',
        transactionHash: txHash
      });
    } catch (error) {
      log(`Error claiming social reward: ${error}`, 'routes');
      res.status(500).json({ error: 'Failed to send reward. Please try again later.' });
    }
  });

  // --- End Social Engagement Routes ---

  // Catch-all route for client-side routing
  app.get("*", (req, res, next) => {
    // Skip API routes
    if (req.path.startsWith("/api")) {
      return next();
    }
    
    // In development, let Vite handle it
    if (config.nodeEnv !== "production") {
      return next();
    }
    
    // In production, serve the index.html
    res.sendFile(resolve(__dirname, "../dist/public/index.html"));
  });
}
