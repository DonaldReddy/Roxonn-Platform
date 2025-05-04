import { useWallet } from '../hooks/use-wallet';
import { Card } from './ui/card';
import { ethers } from 'ethers';
import { Loader2 } from 'lucide-react';

export function WalletInfo() {
    const { data: walletInfo, isLoading } = useWallet();
    
    return (
        <Card className="p-4">
            <div className="space-y-4">
                <div>
                    <h3 className="text-lg font-semibold mb-2">Wallet Information</h3>
                    {isLoading ? (
                        <div className="flex items-center justify-center py-4">
                            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-500">Wallet Address</span>
                                <span className="text-sm font-mono truncate max-w-[200px]">
                                    {walletInfo?.address || 'Not available'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-500">XDC Balance:</span>
                                <span className="text-sm font-medium">
                                    {walletInfo?.balance ? ethers.formatEther(walletInfo.balance) : '0'} XDC
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-500">ROXN Balance:</span>
                                <span className="text-sm font-medium">
                                    {walletInfo?.tokenBalance ? ethers.formatEther(walletInfo.tokenBalance) : '0'} ROXN
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Card>
    );
} 