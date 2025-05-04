import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { blockchainApi } from '../lib/blockchain';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';
import { Label } from './ui/label';
import { useToast } from '../hooks/use-toast';

interface PoolManagersProps {
    repoId: number;
}

export function PoolManagers({ repoId }: PoolManagersProps) {
    const [username, setUsername] = useState('');
    const [githubId, setGithubId] = useState('');
    const [walletAddress, setWalletAddress] = useState('');
    const { toast } = useToast();

    const { data: repository, refetch } = useQuery({
        queryKey: ['repository', repoId],
        queryFn: () => blockchainApi.getRepository(repoId)
    });

    const addPoolManagerMutation = useMutation({
        mutationFn: () => blockchainApi.addPoolManager(repoId, walletAddress, username, parseInt(githubId)),
        onSuccess: () => {
            toast({
                title: 'Success',
                description: 'Pool manager added successfully'
            });
            setUsername('');
            setGithubId('');
            setWalletAddress('');
            refetch();
        },
        onError: (error) => {
            toast({
                title: 'Error',
                description: 'Failed to add pool manager',
                variant: 'destructive'
            });
        }
    });

    const handleAddPoolManager = () => {
        if (!username || !githubId || !walletAddress) return;
        addPoolManagerMutation.mutate();
    };

    return (
        <Card className="p-4">
            <div className="space-y-4">
                <div>
                    <h3 className="text-lg font-semibold mb-2">Pool Managers</h3>
                    {repository && repository.poolManagers.length > 0 && (
                        <div className="space-y-2 mb-4">
                            {repository.poolManagers.map((manager, index) => (
                                <div key={index} className="text-sm font-mono">
                                    {manager}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="space-y-4">
                    <div>
                        <Label htmlFor="username">GitHub Username</Label>
                        <Input
                            id="username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="username"
                        />
                    </div>

                    <div>
                        <Label htmlFor="githubId">GitHub ID</Label>
                        <Input
                            id="githubId"
                            type="number"
                            value={githubId}
                            onChange={(e) => setGithubId(e.target.value)}
                            placeholder="123456"
                        />
                    </div>

                    <div>
                        <Label htmlFor="walletAddress">Wallet Address</Label>
                        <Input
                            id="walletAddress"
                            value={walletAddress}
                            onChange={(e) => setWalletAddress(e.target.value)}
                            placeholder="0x..."
                        />
                    </div>

                    <Button 
                        onClick={handleAddPoolManager}
                        disabled={!username || !githubId || !walletAddress || addPoolManagerMutation.isPending}
                        className="w-full"
                    >
                        {addPoolManagerMutation.isPending ? 'Adding...' : 'Add Pool Manager'}
                    </Button>
                </div>
            </div>
        </Card>
    );
}
