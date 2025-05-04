import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useOnboarding } from '@/hooks/use-onboarding';
import { useAuth } from '@/hooks/use-auth';
import { Coins, Wallet, DollarSign, Layers, AlertCircle } from 'lucide-react';

// Create a function to manually show the pool manager guide
export const showPoolManagerGuide = () => {
  localStorage.setItem('roxonn-onboarding-hasSeenPoolManagerGuide', 'false');
  window.dispatchEvent(new Event('storage'));
};

export function PoolManagerWelcomeGuide() {
  const { hasSeenGuide, setHasSeen } = useOnboarding('hasSeenPoolManagerGuide', false);
  const [isOpen, setIsOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const { user } = useAuth();
  
  // Only show for pool managers
  const isPoolManager = user?.role === "poolmanager";

  const handleClose = () => {
    setIsOpen(false);
    setHasSeen(true);
  };

  // Separate initialization and open/close logic
  useEffect(() => {
    setIsInitialized(true);
    // Listen for storage events to handle reopening the dialog
    const handleStorageChange = () => {
      const value = localStorage.getItem('roxonn-onboarding-hasSeenPoolManagerGuide');
      if (value === 'false') {
        setIsOpen(true);
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Only after initialization, check if we should show the dialog
  useEffect(() => {
    if (isInitialized && !hasSeenGuide && isPoolManager) {
      setIsOpen(true);
    }
  }, [hasSeenGuide, isInitialized, isPoolManager]);

  // Only render when initialized and for pool managers
  if (!isInitialized || !isPoolManager) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (!open) setHasSeen(true);
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Welcome, Pool Manager!</DialogTitle>
          <DialogDescription>
            You're responsible for funding repositories and allocating rewards to issues.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Your role includes:</p>
            <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-2">
              <li className="flex items-start">
                <Wallet className="h-4 w-4 mr-2 mt-0.5 text-blue-500" />
                <span><span className="font-medium">Receive XDC</span> - Fund your wallet from external sources</span>
              </li>
              <li className="flex items-start">
                <Coins className="h-4 w-4 mr-2 mt-0.5 text-green-500" />
                <span><span className="font-medium">Fund Repositories</span> - Allocate XDC to repositories (up to 1000 XDC per day per repository)</span>
              </li>
              <li className="flex items-start">
                <DollarSign className="h-4 w-4 mr-2 mt-0.5 text-amber-500" />
                <span><span className="font-medium">Set Issue Rewards</span> - Assign bounties to specific issues for contributors</span>
              </li>
              <li className="flex items-start">
                <Layers className="h-4 w-4 mr-2 mt-0.5 text-purple-500" />
                <span><span className="font-medium">Approve Solutions</span> - Review and approve contributions to release rewards</span>
              </li>
            </ul>
          </div>
          
          <div className="flex items-start p-3 bg-amber-50 dark:bg-amber-950/50 rounded-md border border-amber-200 dark:border-amber-800">
            <AlertCircle className="h-5 w-5 mr-2 text-amber-600 dark:text-amber-500 flex-shrink-0" />
            <div className="text-sm text-amber-800 dark:text-amber-300">
              <p className="font-medium">Daily Funding Limit</p>
              <p className="text-amber-700 dark:text-amber-400">
                Each repository has a daily funding limit of 1000 XDC to ensure compliance with regulatory requirements.
              </p>
            </div>
          </div>
        </div>
        
        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button 
            variant="outline" 
            onClick={() => showFundingDemo()}
            className="w-full sm:w-auto"
          >
            Show Demo
          </Button>
          <Button 
            onClick={handleClose} 
            className="w-full sm:w-auto"
          >
            Get Started
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RepoFundingGuide() {
  const { hasSeenGuide, setHasSeen } = useOnboarding('hasSeenFundingGuide', false);
  const [isInitialized, setIsInitialized] = useState(false);
  const { user } = useAuth();
  
  // Only show for pool managers
  const isPoolManager = user?.role === "poolmanager";

  // Initialize safely
  useEffect(() => {
    setIsInitialized(true);
  }, []);

  // Only render when initialized to prevent flashing
  if (!isInitialized || hasSeenGuide || !isPoolManager) {
    return null;
  }

  return (
    <div className="mb-4 p-4 border rounded-lg bg-muted/40 animate-in fade-in slide-in-from-bottom-5 duration-500">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h3 className="text-sm font-medium">💰 Funding Guide</h3>
          <p className="text-sm text-muted-foreground">
            Use this panel to add XDC funds to your repository. Funds can then be allocated to specific issues as rewards.
            Each repository has a daily funding limit of 1000 XDC.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setHasSeen(true)}>
          Got it
        </Button>
      </div>
    </div>
  );
}

// Create a function to manually show the funding demo
export const showFundingDemo = () => {
  localStorage.setItem('roxonn-onboarding-hasSeenFundingDemo', 'false');
  window.dispatchEvent(new Event('storage'));
};
