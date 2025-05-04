import { ethers } from 'ethers';
import { STAGING_API_URL } from '../config';
import { invalidateWalletInfo } from './queryClient';
import csrfService from './csrf';

export interface BlockchainUser {
    username: string;
    githubId: number;
    wallet: string;
}

export interface Repository {
    poolManagers: string[];
    contributors: string[];
    poolRewards: string;
    issues: {
        issueId: string;
        rewardAmount: string;
        status: string;
    }[];
}

export interface TokenInfo {
    balance: string;
}

class BlockchainApi {
    async getRepository(repoId: number): Promise<Repository> {
        const response = await fetch(`${STAGING_API_URL}/api/blockchain/repository/${repoId}`);
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to fetch repository');
        }

        const result = await response.json();
        
        return result;
    }
    
    async getRepositoryFundingStatus(repoId: number): Promise<{
        dailyLimit: number;
        currentTotal: number;
        remainingLimit: number;
        windowStartTime: string;
        windowEndTime: string;
    }> {
        const response = await fetch(`${STAGING_API_URL}/api/blockchain/repository/${repoId}/funding-status`, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to fetch repository funding status');
        }
        
        return await response.json();
    }

    async addFundToRepository(repoId: number, amountXdc: string, repositoryFullName: string) {
        // Get CSRF token
        const csrfToken = await csrfService.getToken();
        
        const response = await fetch(`${STAGING_API_URL}/api/blockchain/repository/${repoId}/fund`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({ 
                amountXdc,
                repositoryFullName, // Include repository full name (owner/repo format)
                _csrf: csrfToken // Include in body as well
            })
        });

        if (!response.ok) {
            const error = await response.json();
            if (response.status === 429 && error.details) {
                // Special handling for funding limit errors
                throw new Error(`Daily funding limit reached. Remaining: ${error.details.remainingLimit} XDC. Limit resets at ${new Date(error.details.limitResetTime).toLocaleString()}`);
            }
            throw new Error(error.error || 'Failed to add fund to repository');
        }

        // Invalidate wallet info cache to reflect the new balance
        invalidateWalletInfo();
        
        return await response.json();
    }
    
    /**
     * Approve the ROXN contract to spend tokens on behalf of the user
     * This is NO LONGER required for the native XDC funding flow.
     */
    async approveTokens(amount: string) {
        // Get CSRF token
        const csrfToken = await csrfService.getToken();
        
        const response = await fetch(`${STAGING_API_URL}/api/blockchain/token/approve`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({ 
                amount,
                _csrf: csrfToken
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to approve tokens');
        }
        
        return await response.json();
    }
    
    async getTokenBalance(): Promise<string> {
        const response = await fetch(`${STAGING_API_URL}/api/token/balance`, {
            credentials: 'include',
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to fetch token balance');
        }
        
        const result = await response.json();
        return result.balance;
    }
    
    async allocateIssueReward(
        repoId: number, 
        issueId: number | string, 
        rewardXdc: string,
        // Add parameters for Zoho notification data
        githubRepoFullName: string,
        issueTitle: string,
        issueUrl: string 
    ) {
        // Get CSRF token
        const csrfToken = await csrfService.getToken();
        
        try {
            // Set timeout to 15 seconds to avoid long-running requests
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);
            
            const response = await fetch(`${STAGING_API_URL}/api/blockchain/repository/${repoId}/issue/${issueId}/reward`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken
                },
                body: JSON.stringify({
                    reward: rewardXdc,
                    // Add fields for Zoho notification
                    githubRepoFullName: githubRepoFullName,
                    issueTitle: issueTitle,
                    issueUrl: issueUrl,
                    _csrf: csrfToken // Include in body as well
                }),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to allocate reward');
            }

            return response.json();
        } catch (error: any) {
            if (error.name === 'AbortError') {
                // If the request timed out, assume it's still processing
                
                return { status: 'pending', message: 'Reward allocation submitted but not yet confirmed' };
            }
            throw error;
        }
    }

    async getIssueReward(repoId: number, issueId: number | string) {
        const response = await fetch(`${STAGING_API_URL}/api/blockchain/repository/${repoId}/issue/${issueId}/reward`);

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to get issue reward');
        }

        return response.json();
    }

    async registerUser(username: string, githubId: number, typeOfUser: string) {
        // Get CSRF token
        const csrfToken = await csrfService.getToken();
        
        const response = await fetch(`${STAGING_API_URL}/api/auth/register`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({
                username,
                githubId,
                role: typeOfUser,
                _csrf: csrfToken // Include in body as well
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to register user');
        }

        // Invalidate wallet info after registration
        invalidateWalletInfo();
        return response.json();
    }

    async addPoolManager(repoId: number, walletAddress: string, username: string, githubId: number) {
        // Get CSRF token
        const csrfToken = await csrfService.getToken();
        
        const response = await fetch(`${STAGING_API_URL}/api/blockchain/repository/${repoId}/manager`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({
                walletAddress,
                username,
                githubId,
                _csrf: csrfToken // Include in body as well
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to add pool manager');
        }

        return response.json();
    }

    async distributeReward(repoId: number, issueId: number, contributorAddress: string) {
        // Get CSRF token
        const csrfToken = await csrfService.getToken();
        
        const response = await fetch(`${STAGING_API_URL}/api/blockchain/repository/${repoId}/issue/${issueId}/distribute`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({
                contributorAddress,
                _csrf: csrfToken // Include in body as well
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to distribute reward');
        }

        return response.json();
    }

    async getUserType(address: string): Promise<{ userType: string; address: string }> {
        const response = await fetch(`${STAGING_API_URL}/api/blockchain/user/${address}/type`, {
            credentials: 'include'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to get user type');
        }

        return response.json();
    }

    async getUserWallet(username: string): Promise<{ wallet: string }> {
        const response = await fetch(`${STAGING_API_URL}/api/blockchain/user/${username}/wallet`, {
            credentials: 'include'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to get user wallet');
        }

        return response.json();
    }

    async getRepositoryRewards(repoIds: number[]): Promise<{ rewards: { repoId: number; totalRewards: string }[] }> {
        const response = await fetch(`${STAGING_API_URL}/api/blockchain/repository-rewards`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ repoIds })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to fetch repository rewards');
        }

        return response.json();
    }
}

export const blockchainApi = new BlockchainApi();
