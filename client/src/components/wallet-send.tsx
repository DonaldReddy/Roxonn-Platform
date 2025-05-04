import { useState, useEffect } from 'react';
import { useWallet } from '../hooks/use-wallet';
import csrfService from '../lib/csrf';
import { STAGING_API_URL } from '../config';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Loader2, AlertCircle } from 'lucide-react';
import { ethers } from 'ethers';
import { Alert, AlertDescription } from './ui/alert';
import { useToast } from '../hooks/use-toast';

export function WalletSend() {
  const { data: walletInfo, isLoading, refetch } = useWallet();
  const { toast } = useToast();
  
  // State for transfer limits
  const [transferLimits, setTransferLimits] = useState<{ 
    usedAmount: number;
    remainingLimit: number;
    dailyLimit: number;
    resetTime: number | null;
  } | null>(null);
  const [isLoadingLimits, setIsLoadingLimits] = useState(false);
  
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidAddress, setIsValidAddress] = useState(false);
  
  // Constants
  const GAS_RESERVE = 0.1; // Keep 0.1 XDC for gas fees
  const MIN_AMOUNT = 0.1; // Minimum send amount is 0.1 XDC
  
  // Calculate max safe amount based on wallet balance
  const maxSendAmount = walletInfo?.balance 
    ? Math.max(parseFloat(ethers.formatEther(walletInfo.balance)) - GAS_RESERVE, 0)
    : 0;
  
  // Format max amount to 4 decimal places
  const formattedMaxAmount = maxSendAmount.toFixed(4);
  
  // Set max amount function
  const setMaxAmount = () => {
    if (maxSendAmount > 0) {
      setAmount(formattedMaxAmount);
    }
  };
  
  // Validate XDC address on input change
  const validateAddress = (address: string) => {
    try {
      // Check if it's a valid Ethereum address (XDC uses same format with xdc prefix)
      let normalizedAddress = address;
      
      // If address starts with xdc, replace with 0x for validation
      if (address.startsWith('xdc')) {
        normalizedAddress = '0x' + address.substring(3);
      }
      
      // Use ethers to check if it's a valid address
      const isValid = ethers.isAddress(normalizedAddress);
      setIsValidAddress(isValid);
      return isValid;
    } catch (error) {
      setIsValidAddress(false);
      return false;
    }
  };
  
  // Handle recipient address change
  const handleRecipientChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newAddress = e.target.value;
    setRecipient(newAddress);
    validateAddress(newAddress);
  };
  
  // Fetch transfer limits
  const fetchTransferLimits = async () => {
    try {
      setIsLoadingLimits(true);
      const csrfToken = await csrfService.getToken();
      const response = await fetch(`${STAGING_API_URL}/api/wallet/limits`, {
        credentials: 'include',
        headers: { 
          'Accept': 'application/json',
          'X-CSRF-Token': csrfToken
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch transfer limits');
      }
      
      const data = await response.json();
      setTransferLimits(data);
    } catch (error) {
      console.error('Error fetching transfer limits:', error);
    } finally {
      setIsLoadingLimits(false);
    }
  };
  
  // Fetch transfer limits on component mount
  useEffect(() => {
    fetchTransferLimits();
  }, []);

  // Handle sending funds
  const handleSendFunds = async () => {
    // Validate inputs
    if (!recipient || !amount) {
      toast({
        title: 'Missing information',
        description: 'Please provide both recipient address and amount',
        variant: 'destructive',
      });
      return;
    }
    
    // Make sure recipient is a valid address
    if (!isValidAddress) {
      toast({
        title: 'Invalid address',
        description: 'Please enter a valid XDC address',
        variant: 'destructive',
      });
      return;
    }
    
    // Validate amount
    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue <= 0) {
      toast({
        title: 'Invalid amount',
        description: 'Please enter a valid amount greater than 0',
        variant: 'destructive',
      });
      return;
    }
    
    // Check if amount is too small
    if (amountValue < MIN_AMOUNT) {
      toast({
        title: 'Amount too small',
        description: `Minimum transfer amount is ${MIN_AMOUNT} XDC`,
        variant: 'destructive',
      });
      return;
    }
    
    // Check if amount exceeds balance minus gas reserve
    if (amountValue > maxSendAmount) {
      toast({
        title: 'Insufficient balance',
        description: `Please leave at least ${GAS_RESERVE} XDC for gas fees`,
        variant: 'destructive',
      });
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      // Get CSRF token from the proper service
      const csrfToken = await csrfService.getToken();
      
      // Prepare the request
      const response = await fetch(`${STAGING_API_URL}/api/wallet/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({
          to: recipient,
          amount: amount,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send funds');
      }
      
      // Success
      toast({
        title: 'Transaction submitted',
        description: 'Your funds are being transferred. This may take a few minutes to confirm.',
      });
      
      // Clear form
      setRecipient('');
      setAmount('');
      
      // Refresh wallet data and transfer limits
      refetch();
      fetchTransferLimits();
      
    } catch (error: any) {
      toast({
        title: 'Transaction failed',
        description: error.message || 'An error occurred while sending funds',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold">Send XDC</h2>
        </div>
        
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-10 w-10 animate-spin text-gray-400" />
          </div>
        ) : walletInfo?.address ? (
          <>
            <div className="space-y-4">
              <div>
                <Label htmlFor="balance" className="text-md font-medium mb-1">Your Balance</Label>
                <div className="flex justify-between items-center p-3 bg-gray-100 dark:bg-gray-800 rounded-md">
                  <span>{walletInfo?.balance ? ethers.formatEther(walletInfo.balance) : '0'} XDC</span>
                  <span className="text-sm text-gray-500">
                    Available to send: {formattedMaxAmount} XDC
                  </span>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="recipient" className="text-md font-medium">Recipient Address</Label>
                <Input
                  id="recipient"
                  placeholder="xdc..."
                  value={recipient}
                  onChange={handleRecipientChange}
                  className={isValidAddress && recipient ? 'border-green-500' : ''}
                />
                {recipient && !isValidAddress && (
                  <p className="text-xs text-red-500 mt-1">Please enter a valid XDC address</p>
                )}
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="amount" className="text-md font-medium">Amount (XDC)</Label>
                  {transferLimits && (
                    <span className="text-xs text-gray-500">
                      Daily Limit: {transferLimits.usedAmount.toFixed(2)}/{transferLimits.dailyLimit} XDC
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Input
                    id="amount"
                    type="number"
                    placeholder="0.0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    min={MIN_AMOUNT}
                    max={formattedMaxAmount}
                    step="0.01"
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-7 text-xs"
                    onClick={setMaxAmount}
                    disabled={maxSendAmount <= 0}
                  >
                    Max
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  Minimum: {MIN_AMOUNT} XDC
                </p>
              </div>
              
              {transferLimits && transferLimits.remainingLimit > 0 && (
                <div className="mt-1">
                  <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                    <div 
                      className="bg-blue-600 h-2.5 rounded-full" 
                      style={{ width: `${(transferLimits.usedAmount / transferLimits.dailyLimit) * 100}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Used: {transferLimits.usedAmount.toFixed(2)} XDC</span>
                    <span>Remaining: {transferLimits.remainingLimit.toFixed(2)} XDC</span>
                  </div>
                  {transferLimits.resetTime && (
                    <p className="text-xs text-gray-500 mt-1">
                      Limit resets: {new Date(transferLimits.resetTime).toLocaleString()}
                    </p>
                  )}
                </div>
              )}
              <Button 
                className="w-full mt-4" 
                onClick={handleSendFunds}
                disabled={isSubmitting || !isValidAddress || !amount || parseFloat(amount) <= 0 || parseFloat(amount) > maxSendAmount || (transferLimits ? parseFloat(amount) > transferLimits.remainingLimit : false)}
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Send Funds
              </Button>
            </div>
            
            <Alert>
              <AlertCircle className="h-4 w-4 mr-2" />
              <AlertDescription>
                Double-check the recipient address before sending. Blockchain transactions cannot be reversed once confirmed.
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
  );
}
