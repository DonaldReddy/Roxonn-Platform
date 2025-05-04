import { useState, useEffect } from 'react';
import { useWallet } from '../hooks/use-wallet';
import { useAuth } from '../hooks/use-auth';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Loader2, Copy, Check, RefreshCw } from 'lucide-react';
import { ethers } from 'ethers';
import { Alert, AlertDescription } from './ui/alert';
import { TransactionHistory } from './transaction-history';
import { QRCodeSVG } from 'qrcode.react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { WalletSend } from './wallet-send';

export function WalletReceive() {
  const { data: walletInfo, isLoading, refetch } = useWallet();
  const { user } = useAuth();
  
  // Get user role information
  const isPoolManager = user?.role === "poolmanager";
  
  // Allow sending for anyone who is not a pool manager
  // This enables contributors and any other role to use the send feature
  const canSendFunds = user && !isPoolManager;
  
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState(isPoolManager ? 'receive' : canSendFunds ? 'send' : 'transactions');

  // Copy wallet address to clipboard
  const copyToClipboard = () => {
    if (walletInfo?.address) {
      navigator.clipboard.writeText(walletInfo.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Generate QR code value
  const qrValue = walletInfo?.address 
    ? `xdc:${walletInfo.address.replace('xdc', '')}` 
    : '';

  return (
    <div className="space-y-4">
      <Tabs defaultValue={isPoolManager ? "receive" : canSendFunds ? "send" : "transactions"} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          {isPoolManager && (
            <TabsTrigger value="receive">Receive</TabsTrigger>
          )}
          {canSendFunds && (
            <TabsTrigger value="send">Send</TabsTrigger>
          )}
          <TabsTrigger value="transactions" className={isPoolManager || canSendFunds ? "" : "col-span-3"}>
            Transactions
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="receive" className="space-y-4 pt-2">
          <Card className="p-6">
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Receive XDC</h2>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => refetch()} 
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Refresh
                </Button>
              </div>
              
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-10 w-10 animate-spin text-gray-400" />
                </div>
              ) : walletInfo?.address ? (
                <>
                  <div className="flex flex-col md:flex-row gap-6 items-center">
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border dark:border-gray-700">
                      <QRCodeSVG 
                        value={qrValue} 
                        size={180} 
                        includeMargin={true}
                        level="H"
                      />
                    </div>
                    
                    <div className="flex-1 space-y-4">
                      <div>
                        <h3 className="text-md font-medium mb-1">Your Wallet Address</h3>
                        <div className="flex items-center gap-2">
                          <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-md font-mono text-sm break-all text-gray-900 dark:text-gray-100">
                            {walletInfo.address}
                          </div>
                          <Button 
                            variant="outline" 
                            size="icon" 
                            onClick={copyToClipboard}
                            className="flex-shrink-0"
                          >
                            {copied ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-500">XDC Balance:</span>
                          <span className="font-medium">
                            {walletInfo?.balance ? ethers.formatEther(walletInfo.balance) : '0'} XDC
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">ROXN Balance:</span>
                          <span className="font-medium">
                            {walletInfo?.tokenBalance ? ethers.formatEther(walletInfo.tokenBalance) : '0'} ROXN
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <Alert>
                    <AlertDescription>
                      Share this address to receive XDC to your wallet. Always verify the address before sharing it.
                      Transactions may take a few minutes to be confirmed on the blockchain.
                    </AlertDescription>
                  </Alert>
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No wallet address found. Please contact support if this issue persists.
                </div>
              )}
            </div>
          </Card>
        </TabsContent>
        
        <TabsContent value="send" className="pt-2">
          <WalletSend />
        </TabsContent>

        <TabsContent value="transactions" className="pt-2">
          <TransactionHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
}
