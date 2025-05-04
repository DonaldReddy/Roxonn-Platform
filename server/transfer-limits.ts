import { log } from './utils';

// Daily limit for user transfers (1000 XDC)
// Export the daily limit constant for reference in other modules
export const DAILY_TRANSFER_LIMIT = 1000;

// In-memory storage for transfer records
// In production, this should be moved to a persistent database
interface TransferRecord {
  userId: string;
  amount: number;
  timestamp: number;
}

interface UserTransferStatus {
  userId: string;
  usedAmount: number;
  remainingLimit: number;
  recentTransfers: TransferRecord[];
  resetTimestamp: number | null;
}

class TransferLimitsService {
  private transferRecords: TransferRecord[] = [];

  /**
   * Check if a user can transfer the specified amount based on daily limits
   * @param userId User ID attempting to transfer funds
   * @param amount Amount in XDC to transfer
   * @returns Object with allowed status and details
   */
  public checkTransferLimit(userId: string, amount: number): { allowed: boolean; reason?: string; status?: UserTransferStatus } {
    const status = this.getUserTransferStatus(userId);
    
    // If amount exceeds remaining limit
    if (amount > status.remainingLimit) {
      return {
        allowed: false,
        reason: `Exceeds daily transfer limit. Remaining limit: ${status.remainingLimit.toFixed(2)} XDC`,
        status
      };
    }
    
    return { allowed: true, status };
  }

  /**
   * Get the current transfer status for a user
   * @param userId User ID to check status for
   * @returns Object with used amount, remaining limit, and reset time
   */
  public getUserTransferStatus(userId: string): UserTransferStatus {
    // Get current timestamp
    const now = Date.now();
    
    // Filter for transfers by this user in the last 24 hours
    const recentTransfers = this.transferRecords.filter(
      record => record.userId === userId && (now - record.timestamp) < 24 * 60 * 60 * 1000
    );
    
    // Calculate total amount transferred in the last 24 hours
    const usedAmount = recentTransfers.reduce((sum, record) => sum + record.amount, 0);
    
    // Calculate remaining limit
    const remainingLimit = Math.max(0, DAILY_TRANSFER_LIMIT - usedAmount);
    
    // Find earliest transfer to calculate when the limit will reset
    let resetTimestamp: number | null = null;
    if (recentTransfers.length > 0) {
      // Find earliest transfer in the last 24 hours
      const earliestTransfer = recentTransfers.reduce(
        (earliest, current) => current.timestamp < earliest.timestamp ? current : earliest,
        recentTransfers[0]
      );
      
      // Calculate when the 24-hour window from the earliest transfer will end
      resetTimestamp = earliestTransfer.timestamp + 24 * 60 * 60 * 1000;
    }
    
    return {
      userId,
      usedAmount,
      remainingLimit,
      recentTransfers,
      resetTimestamp
    };
  }

  /**
   * Record a new transfer for a user
   * @param userId User ID making the transfer
   * @param amount Amount in XDC transferred
   */
  public recordTransfer(userId: string, amount: number): void {
    this.transferRecords.push({
      userId,
      amount,
      timestamp: Date.now()
    });
    
    // Log the transfer
    log(`Recorded transfer of ${amount} XDC for user ${userId}. ` +
        `Daily limit usage: ${this.getUserTransferStatus(userId).usedAmount.toFixed(2)}/${DAILY_TRANSFER_LIMIT} XDC`, 
        'transfer-limits');
    
    // Clean up old records (older than 24 hours)
    this.cleanupOldRecords();
  }

  /**
   * Remove transfer records older than 24 hours to prevent memory leaks
   */
  private cleanupOldRecords(): void {
    const now = Date.now();
    const dayInMs = 24 * 60 * 60 * 1000;
    
    // Filter out records older than 24 hours
    this.transferRecords = this.transferRecords.filter(
      record => (now - record.timestamp) < dayInMs
    );
  }
}

// Create and export a singleton instance of the service
export const transferLimits = new TransferLimitsService();
