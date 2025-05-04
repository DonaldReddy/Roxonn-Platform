import { resolve } from 'path';
import { config as dotenvConfig } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import helmet from 'helmet';

// Get directory path in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Always use server/.env regardless of environment
const envPath = resolve(process.cwd(), 'server/.env');

dotenvConfig({ path: envPath });

import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "./routes";
import { setupVite } from "./vite";
import { serveStatic, log } from "./utils";
import { setupAuth, requireAuth } from './auth';
import { generateWallet } from './tatum';
import { db, users } from './db';
import { eq } from 'drizzle-orm';
import { createServer } from 'http';
import { walletService } from './walletService';
import cookieParser from 'cookie-parser';
import { config, initializeConfig, validateConfig } from './config';
import rateLimit from 'express-rate-limit';

// Initialize the app but don't start it yet
const app = express();
const server = createServer(app);

// Trust proxy - needed for X-Forwarded-For headers when behind Nginx
app.set('trust proxy', true);

// Add helmet middleware with CSP configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "connect-src": ["'self'", "https://api.roxonn.com", "https://salesiq.zohopublic.in"], // Allow self, API, and Zoho SalesIQ connections
      // Allow GTM, inline scripts, and Zoho scripts
      "script-src": ["'self'", "'unsafe-inline'", "https://www.googletagmanager.com", "https://salesiq.zohopublic.in", "https://js.zohocdn.com"],
      // Allow inline styles, Google Fonts, and Zoho styles
      "style-src": ["'self'", "https://fonts.googleapis.com", "'unsafe-inline'", "https://css.zohocdn.com"],
      "font-src": ["'self'", "https://fonts.gstatic.com", "https://css.zohocdn.com"], // Allow Google Fonts and Zoho fonts
      // Allow images from self, data URLs, and GitHub avatars
      "img-src": ["'self'", "data:", "https://avatars.githubusercontent.com", "https://images.pexels.com"]
    }
  }
}));

// Enhanced header debugging middleware
app.use((req, res, next) => {
  // Log headers before any CORS processing
  log(`[BEFORE] Request to ${req.method} ${req.path} from origin: ${req.headers.origin}`, 'cors-debug');
  
  // Override setHeader method to capture all header setting
  const originalSetHeader = res.setHeader;
  res.setHeader = function(name, value) {
    if (name.toLowerCase().startsWith('access-control')) {
      log(`Setting header: ${name}=${value}, in ${new Error().stack}`, 'cors-debug');
    }
    return originalSetHeader.call(this, name, value);
  };
  
  // Original end override
  const originalEnd = res.end;
  // @ts-ignore - Overriding the end method to log headers
  res.end = function(chunk, encoding, callback) {
    // Log all headers before sending response
    const headers = res.getHeaders();
    log(`[FINAL] Response headers for ${req.method} ${req.path}: ${JSON.stringify(headers)}`, 'cors-debug');
    
    if (headers['access-control-allow-origin']) {
      log(`CORS Origin header value: ${headers['access-control-allow-origin']}`, 'cors-debug');
    }
    
    return originalEnd.call(this, chunk, encoding, callback);
  };
  
  next();
});

// Add middleware to prevent duplicate CORS headers
app.use((req, res, next) => {
  const originalSetHeader = res.setHeader;
  
  // @ts-ignore - Overriding the setHeader method to prevent duplicate CORS headers
  res.setHeader = function(name, value) {
    const lowerCaseName = name.toLowerCase();
    
    // If it's a CORS header and it's already set, don't set it again
    if (lowerCaseName.startsWith('access-control-') && res.getHeader(name)) {
      log(`BLOCKED duplicate CORS header: ${name} = ${value}`, 'cors-debug');
      log(`Existing value: ${res.getHeader(name)}`, 'cors-debug');
      return this;
    }
    
    return originalSetHeader.call(this, name, value);
  };
  
  next();
});

// Configure Express
app.use(cors({
  origin: 'https://app.roxonn.com',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Hub-Signature', 'X-Hub-Signature-256', 'X-CSRF-Token', 'Origin', 'Accept'],
  maxAge: 86400 // Cache preflight requests for 1 day
}));

// Use cookie-parser middleware
app.use(cookieParser());

// Add CORS debugging middleware
app.use((req, res, next) => {
  // Log CORS-related headers
  const corsDebug = {
    origin: req.headers.origin,
    method: req.method,
    path: req.path,
    corsHeaders: {
      'Access-Control-Allow-Origin': res.getHeader('Access-Control-Allow-Origin'),
      'Access-Control-Allow-Credentials': res.getHeader('Access-Control-Allow-Credentials'),
      'Access-Control-Allow-Methods': res.getHeader('Access-Control-Allow-Methods'),
      'Access-Control-Allow-Headers': res.getHeader('Access-Control-Allow-Headers')
    }
  };
  
  log(`CORS Debug: ${JSON.stringify(corsDebug)}`, 'cors');
  
  // Continue with the request
  next();
});

// Handle webhook routes before any body parsing
app.use((req, res, next) => {
  if (req.path.includes('/webhook')) {
    return next();
  }
  express.json()(req, res, next);
});

app.use(express.urlencoded({ extended: true }));

// Add cookie debugging middleware
app.use((req, res, next) => {
  log(`Request path: ${req.path}`, 'cookies');
  log(`Request cookies: ${JSON.stringify(req.cookies)}`, 'cookies');
  log(`Request session ID: ${req.sessionID || 'none'}`, 'cookies');
  log(`Request user: ${req.user ? 'authenticated' : 'not authenticated'}`, 'cookies');
  
  next();
});

// Setup auth (must be after express.json and cors)
// setupAuth(app);  // Will be called after config initialization

// Logging middleware for API routes
app.use("/api", (req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
    if (capturedJsonResponse) {
      logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
    }

    if (logLine.length > 80) {
      logLine = logLine.slice(0, 79) + "…";
    }

    log(logLine);
  });

  next();
});

// Protected API routes middleware
app.use('/api/profile', requireAuth);
// NOTE: Registration route is handled in auth.ts with proper middleware

// Configure rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 50 requests per window
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: 'Too many requests from this IP, please try again after 15 minutes',
  skip: (req) => config.nodeEnv === 'development', // Skip rate limiting in development
  keyGenerator: (req) => req.ip as string, // Use req.ip with 'trust proxy'
});

// Apply rate limiting to auth endpoints
app.use('/api/auth/', authLimiter);

// Stricter rate limiting for blockchain operations
const blockchainLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 200, // Limit each IP to 20 blockchain requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many blockchain operations, please try again after 5 minutes',
  skip: (req) => config.nodeEnv === 'development', // Skip rate limiting in development
  keyGenerator: (req) => req.ip as string, // Use req.ip with 'trust proxy'
});

// Apply blockchain rate limiting
app.use('/api/blockchain/', blockchainLimiter);

// Health check endpoint for ALB
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Register API routes
// registerRoutes(app);  // Will be called after config initialization

// Configure Vite middleware for development if not in production
// ... existing code ...

// Start the server asynchronously to allow for config initialization
async function startServer() {
  try {
    // Initialize configuration from Parameter Store
    await initializeConfig();
    
    // Validate configuration if using environment variables
    validateConfig();
    
    // Log configuration info
    log(`Using AWS region: ${config.awsRegion || 'not set'}`, 'server');
    log(`Environment: ${config.nodeEnv}`, 'server');
    
    // Setup authentication with the initialized config
    setupAuth(app);
    
    // Register API routes
    registerRoutes(app);
    
    // Configure Vite or static file serving
    if (config.nodeEnv !== 'production') {
      // Set up Vite middleware for development
      await setupVite(app, server);
    } else {
      // Serve static files in production
      serveStatic(app);
    }
    
    // Start listening on port
    const PORT = config.port;
    server.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
      log(`Server listening on port ${PORT}`, 'server');
      log(`Base URL: ${config.baseUrl}`, 'server');
      log(`Frontend URL: ${config.frontendUrl}`, 'server');
    });
    
    // Handle graceful shutdown
    setupShutdownHandlers();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Call the async function to start the server
startServer();

// Setup shutdown handlers
function setupShutdownHandlers() {
  // ... existing shutdown code ...
  
  // Handle shutdown signals
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// Graceful shutdown function
async function shutdown(signal: string) {
  log(`Received ${signal}. Shutting down gracefully...`);
  
  // Close the HTTP server
  server.close(() => {
    log('HTTP server closed.');
  });
  
  try {
    // Close any database connections or other resources
    await walletService.destroy();
    log('Resources closed.');
    
    // Exit the process
    process.exit(0);
  } catch (error) {
    log(`Error during shutdown: ${error}`);
    process.exit(1);
  }
}
