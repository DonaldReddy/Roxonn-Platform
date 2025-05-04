import { useState, useEffect, useRef } from 'react';
import { ethers } from 'ethers';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { blockchainApi } from '@/lib/blockchain';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';

// Refined interface for data expected in the 'repository-rewards' query cache
interface RepositoryRewardsData {
    poolManagers: string[];
    contributors: string[];
    poolRewards: string;
    issues: {
        issueId: string;
        rewardAmount: string; // Wei string
        status?: string; // Optional status
        rewardInEther?: string; // Optional formatted value
    }[];
}

interface SetRewardModalProps {
    isOpen: boolean;
    onClose: () => void;
    issue: {
        id: number;
        title: string;
    };
    repoId: number;
    currentPool: string;
    onSuccess: () => void;
    githubRepoFullName: string;
    issueUrl: string;
}

export function SetRewardModal({ isOpen, onClose, issue, repoId, currentPool, onSuccess: onParentSuccess, githubRepoFullName, issueUrl }: SetRewardModalProps) {
    const [amount, setAmount] = useState('');
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Query to check if a reward ALREADY exists
    const { data: currentRewardWei, isLoading: isLoadingCurrentReward } = useQuery({
        queryKey: ['issue-reward', repoId, issue.id],
        queryFn: async () => {
            const rewardData = await blockchainApi.getIssueReward(repoId, issue.id);
            return rewardData.reward; // Store reward amount (string Wei)
        },
        enabled: isOpen, // Only fetch when modal is open
        staleTime: 1000 * 60, // Cache for 1 min
    });

    const { mutate: assignBounty, isPending } = useMutation({
        mutationKey: ['allocateReward', repoId, issue.id],
        mutationFn: (rewardData: { rewardAmount: string; githubRepoFullName: string; issueTitle: string; issueUrl: string }) => {
            return blockchainApi.allocateIssueReward(
                repoId, 
                issue.id, 
                rewardData.rewardAmount,
                rewardData.githubRepoFullName,
                rewardData.issueTitle, 
                rewardData.issueUrl 
            );
        },
        onSuccess: (data) => { 
            // Construct block explorer URL
            const explorerUrl = `https://xdcscan.com/tx/${data.transactionHash}`;
            toast({
                title: 'Bounty Transaction Submitted',
                // Updated description with link
                description: (
                    <div>
                        <span>Transaction sent successfully.</span>
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
                duration: 9000 // Keep toast longer
            });
            onClose();
            onParentSuccess();
        },
        onError: (err: any) => {
            toast({
                title: 'Error Setting Bounty',
                description: err instanceof Error ? err.message : 'Failed to allocate reward',
                variant: 'destructive'
            });
        },
        onSettled: () => {
             // Invalidate queries to refetch data after success or error
             queryClient.invalidateQueries({ queryKey: ['repository-rewards', repoId] });
             queryClient.invalidateQueries({ queryKey: ['repository', repoId] });
             queryClient.invalidateQueries({ queryKey: ['issue-reward', repoId, issue.id] });
        },
    });

    const handleSetReward = () => {
        if (!amount || isPending) return; 

        assignBounty({
            rewardAmount: amount,
            githubRepoFullName: githubRepoFullName,
            issueTitle: issue.title,
            issueUrl: issueUrl
        });
    };

    // Validate amount against pool balance and minimum amount requirement
    const handleAmountChange = (value: string) => {
        // Check for minimum amount of 1 XDC
        if (value && parseFloat(value) < 1) {
            toast({ title: 'Invalid Amount', description: 'Minimum bounty amount must be at least 1 XDC', variant: 'destructive' });
            return;
        }

        const poolBalanceEther = parseFloat(ethers.formatEther(currentPool));
        if (value && parseFloat(value) > poolBalanceEther) {
            toast({ title: 'Invalid Amount', description: 'Amount cannot exceed available pool balance', variant: 'destructive' });
            return;
        }
        setAmount(value);
    };

    // Determine if reward already exists
    const rewardAlreadyExists = !isLoadingCurrentReward && currentRewardWei && currentRewardWei !== '0';

    // Determine overall disabled state for UI elements (primarily using isPending)
    const isDisabled = isPending || rewardAlreadyExists || isLoadingCurrentReward;

    return (
        <Dialog open={isOpen} onOpenChange={() => !isPending && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Set Bounty for Issue #{issue.id}</DialogTitle>
                    <DialogDescription>
                        Set the XDC bounty amount for this issue. This action cannot be undone or changed later.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="text-sm text-muted-foreground">
                        {issue.title}
                    </div>
                    
                    <div className="text-sm">
                        Available Pool: {ethers.formatEther(currentPool)} XDC
                    </div>

                    {/* Show message if reward already exists */}
                    {rewardAlreadyExists && (
                        <div className="flex items-center gap-2 text-sm text-orange-600 bg-orange-500/10 p-3 rounded-md border border-orange-500/30">
                            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                            <span>A bounty of {ethers.formatEther(currentRewardWei)} XDC is already assigned. You cannot change it.</span>
                        </div>
                    )}

                    {/* Input Section - disable if reward exists */}
                    <div className="space-y-2">
                        <Label htmlFor="amount">Bounty Amount (XDC)</Label>
                        <Input
                            id="amount"
                            type="number"
                            step="0.01"
                            min="1"
                            value={amount}
                            onChange={(e) => handleAmountChange(e.target.value)}
                            placeholder="0.0"
                            disabled={isDisabled}
                        />
                        <p className="text-xs text-muted-foreground">Minimum bounty amount: 1 XDC</p>
                    </div>
                    
                    {/* Warning Text */}
                    <p className="text-xs text-muted-foreground"><span className="font-semibold text-orange-600">Warning:</span> Setting a bounty is final and cannot be updated.</p>

                    {/* Buttons - disable Set if reward exists */}
                    <div className="flex justify-end space-x-2">
                        <Button
                            variant="outline"
                            onClick={onClose}
                            disabled={isPending}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSetReward}
                            disabled={isDisabled || !amount}
                        >
                            {isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Setting Bounty...
                                </>
                            ) : (
                                'Set Bounty'
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
} 