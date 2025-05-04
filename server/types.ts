import { Request } from 'express';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
      body: any;
      user?: {
        id: number;
        githubId: string;
        username: string;
        githubAccessToken?: string;
        walletReferenceId?: string;
        xdcWalletAddress?: string;
        role?: string;
      };
    }
  }
}

export {}; 