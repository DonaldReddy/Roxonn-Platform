import { log } from './utils';

/**
 * Interface to track repository funding limits
 */
interface RepoFundingLimit {
  repoId: number;
  totalAmount: number;     // Total XDC in the current window
  windowStartTime: number; // Timestamp of first transaction in current window
}

// Daily funding limit in XDC
const DAILY_REPO_FUNDING_LIMIT = 1000;

// 24 hours in milliseconds
const DAY_IN_MS = 24 * 60 * 60 * 1000;

// In-memory store for repository funding limits
// In a production environment, this should be replaced with a database storage
const repoFundingLimits: Map<number, RepoFundingLimit> = new Map();

/**
 * Check if a repository funding transaction would exceed daily limits
 * @param repoId Repository ID to check
 * @param amount Amount of XDC to add
 * @returns Object with boolean indicating if transaction is allowed and remaining limit
 */
export function checkRepositoryFundingLimit(repoId: number, amount: number): { 
  allowed: boolean; 
  remainingLimit: number;
  limitResetTime?: Date; 
} {
  const now = Date.now();
  
  // Get current limit info for the repository
  let limitInfo = repoFundingLimits.get(repoId);
  
  // If no existing limit or window has expired, create fresh window
  if (!limitInfo || (now - limitInfo.windowStartTime) > DAY_IN_MS) {
    limitInfo = {
      repoId,
      totalAmount: 0,
      windowStartTime: now
    };
  }
  
  const amountNumber = parseFloat(amount.toString());
  const currentTotal = limitInfo.totalAmount;
  const remainingLimit = DAILY_REPO_FUNDING_LIMIT - currentTotal;
  
  // If amount would exceed limit, reject
  if (currentTotal + amountNumber > DAILY_REPO_FUNDING_LIMIT) {
    const limitResetTime = new Date(limitInfo.windowStartTime + DAY_IN_MS);
    log(`Repository ${repoId} funding of ${amountNumber} XDC rejected: exceeds daily limit`, "funding-limits");
    
    return {
      allowed: false,
      remainingLimit,
      limitResetTime
    };
  }
  
  // Update limits and allow transaction
  log(`Repository ${repoId} funding of ${amountNumber} XDC accepted: within daily limit`, "funding-limits");
  return { allowed: true, remainingLimit: remainingLimit - amountNumber };
}

/**
 * Record a successful funding transaction
 * @param repoId Repository ID
 * @param amount Amount of XDC added
 */
export function recordRepositoryFunding(repoId: number, amount: number): void {
  const now = Date.now();
  const amountNumber = parseFloat(amount.toString());
  
  // Get current limit info
  let limitInfo = repoFundingLimits.get(repoId);
  
  // If no existing limit or window has expired, create fresh window
  if (!limitInfo || (now - limitInfo.windowStartTime) > DAY_IN_MS) {
    limitInfo = {
      repoId,
      totalAmount: amountNumber,
      windowStartTime: now
    };
  } else {
    // Update existing limit info
    limitInfo.totalAmount += amountNumber;
  }
  
  // Save updated limit info
  repoFundingLimits.set(repoId, limitInfo);
  
  log(`Repository ${repoId} funding recorded: ${amountNumber} XDC, total in window: ${limitInfo.totalAmount} XDC`, "funding-limits");
}

/**
 * Get current funding status for a repository
 * @param repoId Repository ID
 * @returns Current funding status information
 */
export function getRepositoryFundingStatus(repoId: number): { 
  currentTotal: number;
  remainingLimit: number;
  windowStartTime: Date;
  windowEndTime: Date;
} {
  const now = Date.now();
  
  // Get current limit info
  let limitInfo = repoFundingLimits.get(repoId);
  
  // If no existing limit or window has expired, create fresh window
  if (!limitInfo || (now - limitInfo.windowStartTime) > DAY_IN_MS) {
    limitInfo = {
      repoId,
      totalAmount: 0,
      windowStartTime: now
    };
    repoFundingLimits.set(repoId, limitInfo);
  }
  
  return {
    currentTotal: limitInfo.totalAmount,
    remainingLimit: DAILY_REPO_FUNDING_LIMIT - limitInfo.totalAmount,
    windowStartTime: new Date(limitInfo.windowStartTime),
    windowEndTime: new Date(limitInfo.windowStartTime + DAY_IN_MS)
  };
}

/**
 * Reset a repository's funding limit (for testing or administrative use)
 * @param repoId Repository ID
 */
export function resetRepositoryFundingLimit(repoId: number): void {
  repoFundingLimits.delete(repoId);
  log(`Repository ${repoId} funding limit reset`, "funding-limits");
}

// Export daily limit constant for reference in other modules
export const REPOSITORY_FUNDING_DAILY_LIMIT = DAILY_REPO_FUNDING_LIMIT;
