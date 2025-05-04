import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { blockchainApi } from '../lib/blockchain';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';
import { Label } from './ui/label';
import { useToast } from '../hooks/use-toast';
import { ethers } from 'ethers';
import { Loader2, AlertCircle, Info, ArrowRight } from 'lucide-react';
import { useWallet } from '../hooks/use-wallet';
import { 
    Tooltip, 
    TooltipContent, 
    TooltipProvider, 
    TooltipTrigger 
} from './ui/tooltip';

interface Issue {
    issueId: string;
    rewardAmount: string;
    status: string;
}

interface RepoRewardsProps {
    repoId: number;
    issueId?: number;
    isPoolManager: boolean;
    repositoryFullName?: string; // GitHub repository in format 'owner/repo'
}

export function RepoRewards({ repoId, issueId, isPoolManager, repositoryFullName }: RepoRewardsProps) {
    const [amountXdc, setAmountXdc] = useState('');
    const [rewardXdc, setRewardXdc] = useState('');
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { data: walletInfo, isLoading: walletLoading } = useWallet();
    const [showFundingInfo, setShowFundingInfo] = useState(false);
    
    // Fee rates in basis points (1/100 of a percent)
    const PLATFORM_FEE_RATE = 50; // 0.5%
    const CONTRIBUTOR_FEE_RATE = 50; // 0.5%
    
    // Calculate safe max amount (leave 0.5 XDC for gas)
    const GAS_RESERVE = 0.1;
    const maxSafeAmount = walletInfo?.balance 
        ? Math.max(parseFloat(ethers.formatEther(walletInfo.balance)) - GAS_RESERVE, 0).toFixed(4)
        : '0';
    
    // Calculate fee amounts based on input
    const calculateFees = () => {
        if (!amountXdc || parseFloat(amountXdc) <= 0) {
            return {
                total: '0',
                platformFee: '0',
                netAmount: '0'
            };
        }
        
        const totalAmount = parseFloat(amountXdc);
        const platformFee = totalAmount * (PLATFORM_FEE_RATE / 10000);
        const netAmount = totalAmount - platformFee;
        
        return {
            total: totalAmount.toFixed(6),
            platformFee: platformFee.toFixed(6),
            netAmount: netAmount.toFixed(6)
        };
    };
    
    const fees = calculateFees();
    
    // Function to set max safe amount
    const setMaxAmount = () => {
        if (fundingStatus) {
            // Take the minimum of wallet balance (minus gas) and remaining daily limit
            const remainingLimit = fundingStatus.remainingLimit;
            const maxAmount = Math.min(parseFloat(maxSafeAmount), remainingLimit);
            
            // Only set if the max amount is above the minimum threshold
            if (maxAmount > 1.01) {
                setAmountXdc(maxAmount.toFixed(4));
            } else {
                // If max amount is too low, set to minimum allowed value
                setAmountXdc('1.01');
                toast({
                    title: 'Limited funds available',
                    description: `Setting to minimum funding amount of 1.01 XDC.`,
                    variant: 'default'
                });
            }
        } else {
            // Only set if the max amount is above the minimum threshold
            if (parseFloat(maxSafeAmount) > 1.01) {
                setAmountXdc(maxSafeAmount);
            } else {
                // If max amount is too low, set to minimum allowed value
                setAmountXdc('1.01');
                toast({
                    title: 'Limited funds available',
                    description: `Setting to minimum funding amount of 1.01 XDC.`,
                    variant: 'default'
                });
            }
        }
    };

    const { data: repository, refetch } = useQuery({
        queryKey: ['repository', repoId],
        queryFn: async () => {
            const result = await blockchainApi.getRepository(repoId);
            
            return result;
        }
    });
    
    // Query for repository funding status (only for pool managers)
    const { data: fundingStatus, isLoading: fundingStatusLoading } = useQuery({
        queryKey: ['repositoryFundingStatus', repoId],
        queryFn: async () => {
            return await blockchainApi.getRepositoryFundingStatus(repoId);
        },
        enabled: isPoolManager,
        refetchInterval: 60000 // Refresh every minute
    });

    const addFundsMutation = useMutation({
        mutationFn: (amount: string) => {
            if (!repositoryFullName) {
                throw new Error('Repository full name is required to add funds.');
            }
            return blockchainApi.addFundToRepository(repoId, amount, repositoryFullName);
        },
        onSuccess: (response: any) => {
            const explorerUrl = `https://xdcscan.com/tx/${response.transactionHash}`;
            toast({
                title: 'Funding Transaction Submitted',
                description: (
                    <div>
                        <span>{response.message || 'Funds added to repository.'}</span>
                        <a 
                            href={explorerUrl} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="ml-2 text-blue-500 hover:underline"
                        >
                            View on Explorer
                        </a>
                    </div>
                ),
                duration: 9000
            });
            setAmountXdc('');
            queryClient.invalidateQueries({ queryKey: ['repository', repoId] });
            queryClient.invalidateQueries({ queryKey: ['repository-rewards', repoId] });
            queryClient.invalidateQueries({ queryKey: ['repositoryFundingStatus', repoId] });
        },
        onError: (error: any) => {
            const errorMessage = error.response?.data?.error || 
                               (error instanceof Error ? error.message : 'Failed to add funds');
            toast({
                title: 'Error Adding Funds',
                description: errorMessage,
                variant: 'destructive'
            });
        }
    });

    const allocateRewardMutation = useMutation({
        mutationFn: (reward: string) => {
            if (!issueId) throw new Error('No issue selected');
            if (!repositoryFullName) throw new Error('Repository name is required');
            
            // For issue title and URL, use placeholders if we don't have the actual data
            // In a real implementation, these would be passed from the parent component
            const issueTitle = `Issue #${issueId}`;
            const issueUrl = `https://github.com/${repositoryFullName}/issues/${issueId}`;
            
            return blockchainApi.allocateIssueReward(
                repoId, 
                issueId, 
                reward,
                repositoryFullName,
                issueTitle,
                issueUrl
            );
        },
        onSuccess: (response: any) => {
            toast({
                title: 'Success',
                description: response?.message || 'Bounty assigned to issue'
            });
            setRewardXdc('');
            queryClient.invalidateQueries({ queryKey: ['repository', repoId] });
            queryClient.invalidateQueries({ queryKey: ['issue-reward', repoId, issueId] });
        },
        onError: (error: any) => {
            const errorMessage = error.response?.data?.error || 
                               (error instanceof Error ? error.message : 'Failed to assign bounty');
            toast({
                title: 'Error Assigning Bounty',
                description: errorMessage,
                variant: 'destructive'
            });
        }
    });

    const handleAddFunds = () => {
        if (!amountXdc) return;
        if (!repositoryFullName) {
            toast({ title: 'Error', description: 'Repository details missing.', variant: 'destructive' });
            return;
        }
        
        // Validate against wallet balance
        if (walletInfo?.balance) {
            const amountValue = parseFloat(amountXdc);
            const balanceValue = parseFloat(ethers.formatEther(walletInfo.balance));
            
            // Check if the amount is less than the minimum required (1 XDC)
            if (amountValue <= 1) {
                toast({ 
                    title: 'Minimum funding amount not met', 
                    description: `The minimum amount to fund a repository is more than 1 XDC.`,
                    variant: 'destructive'
                });
                return;
            }
            
            // Check if amount is too close to total balance (not leaving gas fee)
            if (amountValue > 0 && balanceValue - amountValue < GAS_RESERVE) {
                toast({ 
                    title: 'Insufficient funds for gas', 
                    description: `Please leave at least ${GAS_RESERVE} XDC in your wallet for transaction fees.`,
                    variant: 'destructive'
                });
                return;
            }
            
            // Check if amount exceeds daily funding limit
            if (fundingStatus && amountValue > fundingStatus.remainingLimit) {
                toast({ 
                    title: 'Exceeds daily funding limit', 
                    description: `The amount exceeds the remaining daily limit of ${fundingStatus.remainingLimit.toFixed(2)} XDC for this repository.`,
                    variant: 'destructive'
                });
                return;
            }
        }
        
        addFundsMutation.mutate(amountXdc);
    };

    const handleAllocateReward = () => {
        if (!rewardXdc || !issueId) return;
        allocateRewardMutation.mutate(rewardXdc);
    };

    const currencySymbol = 'XDC';

    return (
        <Card className="p-4">
            <div className="space-y-4">
                <div>
                    <h3 className="text-lg font-semibold mb-2">Repository Rewards</h3>
                    <div className="mb-4">
                        <div className="flex justify-between items-center mb-2">
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Current Pool: {repository ? ethers.formatEther(repository.poolRewards) : '0'} {currencySymbol}
                            </p>
                            {isPoolManager && fundingStatus && (
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-6 px-2 text-blue-500" 
                                    onClick={() => setShowFundingInfo(!showFundingInfo)}
                                >
                                    <Info className="h-4 w-4 mr-1" />
                                    Funding Limits
                                </Button>
                            )}
                        </div>
                        
                        {isPoolManager && showFundingInfo && fundingStatus && (
                            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-100 dark:border-blue-900 rounded-md p-3 mb-4">
                                <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">Daily Funding Limit Information</h4>
                                <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-1">
                                    <li>• Daily limit: <span className="font-medium">{fundingStatus.dailyLimit} XDC</span> per repository</li>
                                    <li>• Used today: <span className="font-medium">{fundingStatus.currentTotal.toFixed(2)} XDC</span></li>
                                    <li>• Remaining: <span className="font-medium">{fundingStatus.remainingLimit.toFixed(2)} XDC</span></li>
                                    <li>• Resets at: <span className="font-medium">{new Date(fundingStatus.windowEndTime).toLocaleString()}</span></li>
                                </ul>
                            </div>
                        )}
                    </div>
                </div>

                {isPoolManager && (
                <div>
                    <Label htmlFor="amountXdc">
                        Add Funds ({currencySymbol})
                        {fundingStatus && (
                            <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                                (Daily remaining: {fundingStatus.remainingLimit.toFixed(2)} XDC)
                            </span>
                        )}
                    </Label>
                    <div className="flex mt-1.5 gap-2">
                        <div className="relative flex-grow">
                            <Input
                                id="amountXdc"
                                placeholder="Amount to add (XDC)"
                                value={amountXdc}
                                onChange={(e) => setAmountXdc(e.target.value)}
                                type="number"
                                min="1.01"
                                step="0.01"
                                max={(() => {
                                    // Calculate max value (min of wallet balance and daily limit)
                                    let maxValue = fundingStatus 
                                        ? Math.min(parseFloat(maxSafeAmount), fundingStatus.remainingLimit)
                                        : parseFloat(maxSafeAmount);
                                    
                                    // Only apply max if it's greater than minimum (1.01)
                                    return maxValue > 1.01 ? maxValue.toString() : undefined;
                                })()} 
                            />
                            <Button 
                                type="button" 
                                variant="outline" 
                                size="sm" 
                                className="absolute right-2 top-1/2 -translate-y-1/2 h-7 text-xs"
                                onClick={setMaxAmount}
                                disabled={walletLoading || (parseFloat(maxSafeAmount) <= 1.01 && (!fundingStatus || fundingStatus.remainingLimit <= 1.01))}
                            >
                                Max
                            </Button>
                        </div>
                        <Button 
                            onClick={handleAddFunds} 
                            disabled={addFundsMutation.isPending || !amountXdc || parseFloat(amountXdc) <= 0}
                        >
                            {addFundsMutation.isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Adding...
                                </>
                            ) : (
                                'Add Funds'
                            )}
                        </Button>
                    </div>
                    
                    {/* Fee Breakdown Section */}
                    {parseFloat(amountXdc) > 0 && (
                        <div className="mt-3 p-3 bg-accent/30 dark:bg-accent/20 rounded-md border border-border">
                            <h4 className="text-xs font-semibold mb-2 text-foreground">Transaction Breakdown</h4>
                            <div className="space-y-1.5 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Total amount:</span>
                                    <span className="font-medium">{fees.total} XDC</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground flex items-center">
                                        Platform fee (0.5%):
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Info className="h-3 w-3 inline ml-1 cursor-help text-muted-foreground/70" />
                                                </TooltipTrigger>
                                                <TooltipContent className="max-w-xs">
                                                    <p className="text-xs">This fee supports ongoing development and maintenance of the platform.</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </span>
                                    <span className="text-orange-500 dark:text-orange-400">-{fees.platformFee} XDC</span>
                                </div>
                                <div className="h-px bg-border my-1"></div>
                                <div className="flex justify-between font-medium">
                                    <span>Net amount to repository:</span>
                                    <span className="text-emerald-600 dark:text-emerald-400">{fees.netAmount} XDC</span>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                        <AlertCircle className="h-3 w-3 text-orange-500" />
                        <span>
                            Your balance: {walletLoading ? '...' : ethers.formatEther(walletInfo?.balance || '0')} XDC
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Info className="h-3 w-3 inline ml-1 cursor-help text-muted-foreground/70" />
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs">
                                        <p className="text-xs">You need to keep at least {GAS_RESERVE} XDC in your wallet for transaction fees. The maximum amount you can send is automatically calculated.</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                        <span className="font-semibold text-orange-600">Note:</span> Funds added become part of the repository's on-chain pool and will be used for bounty payouts (which <span className="font-semibold">cannot be changed</span> once assigned to an issue).
                    </p>
                </div>
                )}

                {issueId && isPoolManager && (
                    <div>
                        <Label htmlFor="rewardXdc">Assign Bounty ({currencySymbol})</Label>
                        <div className="flex mt-1.5 gap-2">
                            <Input
                                id="rewardXdc"
                                placeholder="Bounty amount (XDC)"
                                value={rewardXdc}
                                onChange={(e) => setRewardXdc(e.target.value)}
                                type="number"
                                min="0"
                                step="0.01"
                            />
                            <Button 
                                onClick={handleAllocateReward} 
                                disabled={allocateRewardMutation.isPending || addFundsMutation.isPending || !rewardXdc}
                            >
                                {allocateRewardMutation.isPending ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Assigning...
                                    </>
                                ) : (
                                    'Assign Bounty'
                                )}
                            </Button>
                        </div>
                    </div>
                )}

                {(repository?.issues?.filter((issue: Issue) => {
                    const rewardInEther = ethers.formatEther(issue.rewardAmount || '0');
                    const isValid = 
                        issue.issueId && 
                        issue.rewardAmount &&
                        parseFloat(rewardInEther) > 0;
                    
                    return isValid;
                }) || []).length > 0 && (
                    <div className="mt-4">
                        <h4 className="text-sm font-semibold mb-2">Active Issue Rewards</h4>
                        <div className="space-y-2">
                            {repository?.issues
                                ?.filter((issue: Issue) => {
                                    const rewardInEther = ethers.formatEther(issue.rewardAmount || '0');
                                    return issue.issueId && 
                                           issue.rewardAmount &&
                                           parseFloat(rewardInEther) > 0;
                                })
                                .sort((a: Issue, b: Issue) => parseInt(a.issueId) - parseInt(b.issueId))
                                .map((issue: Issue) => (
                                    <div 
                                        key={`issue-reward-${issue.issueId}`} 
                                        className="flex justify-between text-sm p-2 bg-gray-50 rounded"
                                    >
                                        <span>Issue #{issue.issueId}</span>
                                        <span className="font-medium">
                                            {ethers.formatEther(issue.rewardAmount)} {currencySymbol}
                                        </span>
                                    </div>
                                ))
                            }
                        </div>
                    </div>
                )}
            </div>
        </Card>
    );
}
