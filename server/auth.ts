import passport from "passport";
import { Strategy as GitHubStrategy } from "passport-github2";
import { Request, Response, NextFunction } from "express";
import session from "express-session";
import { db } from "./db";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";
import type { Application } from "express";
import type { Profile } from "passport-github2";
import { generateWallet } from "./tatum";
import { blockchain } from "./blockchain";
import { log } from './utils';
import { getWalletSecret, storeWalletSecret } from "./aws";
import { createZohoLead } from "./zoho";
import { config } from "./config";
import { DatabaseStorage } from "./storage";
import crypto from "crypto";

// Initialize the database storage to get the session store
const storage = new DatabaseStorage();

// Extend session with returnTo property and CSRF token
declare module 'express-session' {
  interface SessionData {
    returnTo?: string;
    csrfToken?: string;
  }
}

declare global {
  namespace Express {
    interface User {
      id: number;
      githubId: string;
      username: string;
      name: string | null;
      email: string | null;
      avatarUrl: string | null;
      role: "contributor" | "poolmanager" | null;
      githubUsername: string;
      isProfileComplete: boolean | null;
      xdcWalletAddress: string | null;
      walletReferenceId: string | null;
      githubAccessToken: string;
    }
  }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!req.user.githubAccessToken) {
    return res.status(401).json({ error: "GitHub token not available" });
  }
  next();
};

// Generate a CSRF token
function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// CSRF protection middleware
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  // Skip CSRF check for authentication routes
  if (req.path.startsWith('/api/auth/github')) {
    return next();
  }
  
  // For API requests that modify data, check the CSRF token
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const sessionToken = req.session.csrfToken;
    const requestToken = req.headers['x-csrf-token'] as string || 
                         req.body._csrf as string;
    
    if (!sessionToken || !requestToken || sessionToken !== requestToken) {
      log(`CSRF token validation failed: ${req.method} ${req.path}`, 'auth');
      return res.status(403).json({ error: 'CSRF validation failed' });
    }
  }
  
  next();
}

export function setupAuth(app: Application) {
  // Session middleware
  app.use(
    session({
      secret: config.sessionSecret as string,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: true, // Always use secure cookies for HTTPS
        sameSite: 'none', // More secure default for non-production
        maxAge: 24 * 60 * 60 * 1000, // Reduced to 24 hours from 7 days for better security
        httpOnly: true,
        domain: config.cookieDomain, // Use the domain from config
        path: '/',
      },
      proxy: true, // Trust proxy in production
      store: storage.sessionStore, // Use PostgreSQL session store instead of MemoryStore
    })
  );

  // Initialize passport and session
  app.use(passport.initialize());
  app.use(passport.session());

  // Passport serialization
  passport.serializeUser((user: Express.User, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await db.query.users.findFirst({
        where: eq(users.id, id),
      });
      if (!user) {
        return done(new Error("User not found"));
      }
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  // GitHub strategy
  passport.use(
    new GitHubStrategy(
      {
        clientID: config.githubClientId!,
        clientSecret: config.githubClientSecret!,
        callbackURL: config.githubCallbackUrl!,
      },
      async (
        accessToken: string,
        refreshToken: string,
        profile: Profile,
        done: (error: any, user?: Express.User | false) => void
      ) => {
        try {
          // Get user email from GitHub API if not available in profile
          let email = profile.emails?.[0]?.value || null;
          
          // If email is null, fetch it directly from GitHub API
          if (!email) {
            try {
              log('Email not found in profile, fetching from GitHub API', 'auth');
              const response = await fetch('https://api.github.com/user/emails', {
                headers: {
                  'Authorization': `token ${accessToken}`,
                  'Accept': 'application/json'
                }
              });
              
              if (response.ok) {
                const emails = await response.json();
                // Find the primary email
                const primaryEmail = emails.find((e: any) => e.primary);
                if (primaryEmail) {
                  email = primaryEmail.email;
                  log(`Found primary email from GitHub API: ${email}`, 'auth');
                } else if (emails.length > 0) {
                  email = emails[0].email;
                  log(`Using first email from GitHub API: ${email}`, 'auth');
                }
              } else {
                log(`Failed to fetch emails from GitHub API: ${response.status}`, 'auth');
              }
            } catch (emailError) {
              log(`Error fetching emails from GitHub API: ${emailError}`, 'auth');
              // Continue without email if API call fails
            }
          }
          
          // Find or create user
          const existingUser = await db.query.users.findFirst({
            where: eq(users.githubId, profile.id),
          });

          if (existingUser) {
            // Update access token and profile info
            const [updatedUser] = await db
              .update(users)
              .set({
                githubAccessToken: accessToken,
                name: profile.displayName || null,
                email: email,
                avatarUrl: profile.photos?.[0]?.value || null,
              })
              .where(eq(users.githubId, profile.id))
              .returning();

            return done(null, updatedUser);
          }

          // Create new user
          const [newUser] = await db
            .insert(users)
            .values({
              githubId: profile.id,
              username: profile.username || profile.displayName || "user",
              name: profile.displayName || null,
              email: email,
              avatarUrl: profile.photos?.[0]?.value || null,
              githubUsername: profile.username || "",
              githubAccessToken: accessToken,
              isProfileComplete: false,
              role: null,
            })
            .returning();

          return done(null, newUser);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  // Auth routes
  app.get("/api/auth/github", (req, res, next) => {
    const returnTo = req.query.returnTo as string;
    if (returnTo) {
      // Enhanced validation to prevent open redirects
      // First normalize the returnTo URL
      const normalizedReturnTo = returnTo.startsWith('/') ? returnTo : `/${returnTo}`;
      
      // Validate that it's not an absolute URL or protocol-relative URL that could lead to external sites
      if (normalizedReturnTo.includes('://') || normalizedReturnTo.startsWith('//')) {
        log(`Rejected potentially malicious returnTo URL: ${normalizedReturnTo}`, 'auth');
        req.session.returnTo = '/repos'; // Default to safe path
      } else {
        req.session.returnTo = normalizedReturnTo;
        log(`GitHub auth initiated with return URL: ${normalizedReturnTo}`, 'auth');
      }
    } else {
      req.session.returnTo = '/repos';
      log('GitHub auth initiated with default return URL: /repos', 'auth');
    }
    
    log(`GitHub auth config: clientID=${config.githubClientId}, callbackURL=${config.githubCallbackUrl}, BASE_URL=${config.baseUrl}`, 'auth');
    log(`Full GitHub callback URL: ${config.githubCallbackUrl}`, 'auth');
    log(`Request origin: ${req.headers.origin || 'unknown'}`, 'auth');
    log(`Request referer: ${req.headers.referer || 'unknown'}`, 'auth');
    
    passport.authenticate("github", { 
      scope: ["user:email", "public_repo", "read:org"]
    })(req, res, next);
  });

  // CSRF token endpoint - provides a token for the client
  app.get('/api/auth/csrf-token', (req, res) => {
    if (!req.session.csrfToken) {
      req.session.csrfToken = generateCsrfToken();
    }
    
    res.json({ csrfToken: req.session.csrfToken });
  });

  app.get(
    "/api/auth/callback/github",
    passport.authenticate("github", { 
      failureRedirect: `${config.frontendUrl}/auth`,
      failureMessage: true
    }),
    (req, res) => {
      // Get and validate returnTo URL
      let returnTo = req.session.returnTo || '/repos';
      delete req.session.returnTo;

      log(`GitHub callback received. Return URL from session: ${returnTo}`, 'auth');
      log(`User authenticated: ${req.user ? 'Yes' : 'No'}`, 'auth');
      log(`Session ID: ${req.sessionID}`, 'auth');
      log(`Cookie settings: ${JSON.stringify(req.session.cookie)}`, 'auth');
      log(`Origin: ${req.headers.origin}`, 'auth');

      // Enhanced validation for the returnTo path
      if (!returnTo.startsWith('/')) {
        returnTo = `/${returnTo}`;
      }
      
      // Additional validation to ensure it's not trying to redirect to an external site
      if (returnTo.includes('://') || returnTo.startsWith('//')) {
        log(`Blocked potentially malicious redirect: ${returnTo}`, 'auth');
        returnTo = '/repos'; // Default to safe path
      }

      // Check if user needs to complete registration
      if (req.user && !req.user.isProfileComplete) {
        const redirectUrl = "/auth?registration=true";
        log(`Redirecting to registration: ${config.frontendUrl}${redirectUrl}`, 'auth');
        return res.redirect(`${config.frontendUrl}${redirectUrl}`);
      }
      
      // Construct final redirect URL - ensure we're redirecting to the frontend URL
      const finalRedirectUrl = `${config.frontendUrl}${returnTo}`;
      log(`Redirecting to: ${finalRedirectUrl}`, 'auth');
      log(`Debug - frontendUrl: ${config.frontendUrl}, baseUrl: ${config.baseUrl}`, 'auth');
      // Set an authentication cookie to help with session persistence
      res.cookie('connect.sid.check', 'authenticated', {
        secure: true,
        sameSite: 'none',
        domain: config.cookieDomain,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        httpOnly: false, // Allow JavaScript access for checking
      });
      
      // Ensure the session is saved before redirecting
      req.session.save((err) => {
        if (err) {
          log(`Error saving session: ${err}`, 'auth');
        }
        
        // Set an additional cookie to help with debugging
        res.cookie('auth_success', 'true', {
          secure: true,
          sameSite: 'none',
          domain: config.cookieDomain,
          maxAge: 60 * 60 * 1000, // 1 hour
        });
        
        // Generate a new CSRF token for the authenticated session
        req.session.csrfToken = generateCsrfToken();
        
        res.redirect(finalRedirectUrl);
      });
    }
  );

  // Sanitize user data to remove sensitive information
  function sanitizeUserData(user: any) {
    if (!user) return null;
    
    // Create a copy of the user object without sensitive fields
    const { xdcWalletMnemonic, xdcPrivateKey, encryptedPrivateKey, encryptedMnemonic, githubAccessToken, ...sanitizedUser } = user;
    
    return sanitizedUser;
  }

  app.get("/api/auth/user", (req: Request, res: Response) => {
    // Set a cookie header to ensure the browser accepts our cookies
    res.cookie('session_test', 'true', {
      secure: true,
      sameSite: 'none',
      domain: config.cookieDomain,
      maxAge: 60 * 60 * 1000, // 1 hour
    });
    
    log(`Auth user request - Session ID: ${req.sessionID || 'none'}`, 'auth');
    log(`Auth user request - User: ${req.user ? 'authenticated' : 'not authenticated'}`, 'auth');
    log(`Auth user request - Cookies: ${JSON.stringify(req.cookies)}`, 'auth');
    log(`Auth user request - Origin: ${req.headers.origin}`, 'auth');
    log(`Auth user request - CORS headers: ${JSON.stringify({
      'Access-Control-Allow-Origin': res.getHeader('Access-Control-Allow-Origin'),
      'Access-Control-Allow-Credentials': res.getHeader('Access-Control-Allow-Credentials'),
    })}`, 'auth');
    
    res.json(sanitizeUserData(req.user) || null);
  });

  // Debug endpoint to check session status
  app.get("/api/auth/session", (req: Request, res: Response) => {
    log(`Session debug - Session ID: ${req.sessionID || 'none'}`, 'auth');
    log(`Session debug - User: ${req.user ? 'authenticated' : 'not authenticated'}`, 'auth');
    log(`Session debug - Cookies: ${JSON.stringify(req.cookies)}`, 'auth');
    
    res.json({
      sessionId: req.sessionID || null,
      isAuthenticated: !!req.user,
      cookies: req.cookies,
    });
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.logout(() => {
      res.json({ success: true });
    });
  });

  // Add registration endpoint
  app.post("/api/auth/register", requireAuth, async (req, res) => {
    try {
      const { role, email: submittedEmail } = req.body;
      
      // Validate required fields
      if (!role || !["contributor", "poolmanager"].includes(role)) {
        return res.status(400).json({ error: "Invalid role" });
      }
      
      // Use the email from the request or from the user's profile if already available
      const email = submittedEmail || req.user?.email;
      
      // Validate email
      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return res.status(400).json({ error: "Valid email address is required" });
      }

      // Check if user already has a wallet
      if (req.user && req.user.xdcWalletAddress) {
        return res.status(400).json({ 
          error: "User already has a wallet",
          address: req.user.xdcWalletAddress
        });
      }

      log("Creating XDC wallet for user...", "auth");
      let wallet;
      try {
        wallet = await generateWallet();
        log("Wallet created successfully", "auth");
      } catch (walletError: any) {
        log(`Failed to create wallet: ${walletError.message}`, "auth");
        return res.status(500).json({ 
          error: "Failed to create wallet",
          details: walletError.message 
        });
      }

      // Register user on the blockchain
      log("Registering user on blockchain...", "auth");
      try {
        if (req.user) {
          await blockchain.registerUser(
            req.user.githubUsername,
            parseInt(req.user.githubId),
            role,
            wallet.address
          );
        }
        log("User registered on blockchain successfully", "auth");
      } catch (blockchainError: any) {
        log(`Blockchain registration failed: ${blockchainError.message}`, "auth");
        return res.status(500).json({ 
          error: "Failed to register on blockchain",
          details: blockchainError.message 
        });
      }

      // Update user with role, email, and wallet details
      try {
        if (req.user) {
          const [updatedUser] = await db
            .update(users)
            .set({
              role,
              email,  // Save the validated email
              xdcWalletAddress: wallet.address,
              walletReferenceId: wallet.referenceId,
              isProfileComplete: true,
            })
            .where(eq(users.id, req.user.id))
            .returning();

          // Update session user
          req.user.role = role;
          req.user.email = email;  // Update session with email
          req.user.isProfileComplete = true;
          req.user.xdcWalletAddress = wallet.address;
          req.user.walletReferenceId = wallet.referenceId;

          // Ensure wallet data is properly stored in the database
          // This will move any data from the temporary cache to the user record
          try {
            const walletData = await getWalletSecret(wallet.referenceId);
            if (walletData) {
              await storeWalletSecret(wallet.referenceId, walletData);
              log("Wallet data properly stored in user record", "auth");
            }
          } catch (walletStorageError) {
            log(`Warning: Failed to ensure wallet data storage: ${walletStorageError}`, "auth");
            // Continue anyway as this is just an extra precaution
          }

          log("User registration completed successfully with email: " + email, "auth");
          
          // Create lead in Zoho CRM (non-blocking)
          try {
            createZohoLead({
              username: req.user.username,
              name: req.user.name,
              email: email,
              githubId: req.user.githubId,
              role: role,
              xdcWalletAddress: wallet.address
            }).catch(error => {
              log(`Error sending user data to Zoho CRM: ${error}`, "auth");
              // Non-critical error, continue with registration process
            });
          } catch (error) {
            log(`Failed to initialize Zoho lead creation: ${error}`, "auth");
            // Non-critical error, continue with registration process
          }
          
          res.json({
            success: true,
            user: {
              ...req.user,
              role,
              email,
              isProfileComplete: true,
              xdcWalletAddress: wallet.address,
              walletReferenceId: wallet.referenceId,
            },
          });
        }
      } catch (dbError: any) {
        log(`Database update failed: ${dbError.message}`, "auth");
        // If DB update fails, we should probably try to revert the blockchain registration
        // but that's not implemented yet
        return res.status(500).json({
          error: "Failed to update user data",
          details: dbError.message
        });
      }
    } catch (error: any) {
      log(`Registration error: ${error.message}`, "auth");
      res.status(500).json({
        error: "Registration failed",
        details: error.message,
      });
    }
  });
}