import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useOnboarding } from '@/hooks/use-onboarding';

// Create a function to manually show the welcome guide
export const showReposWelcomeGuide = () => {
  localStorage.setItem('roxonn-onboarding-hasSeenWelcome', 'false');
  window.dispatchEvent(new Event('storage'));
};

export function ReposWelcomeGuide() {
  const { hasSeenGuide, setHasSeen } = useOnboarding('hasSeenWelcome', false);
  const [isOpen, setIsOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const handleClose = () => {
    setIsOpen(false);
    setHasSeen(true);
  };

  // Separate initialization and open/close logic
  useEffect(() => {
    setIsInitialized(true);
    // Listen for storage events to handle reopening the dialog
    const handleStorageChange = () => {
      const value = localStorage.getItem('roxonn-onboarding-hasSeenWelcome');
      if (value === 'false') {
        setIsOpen(true);
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Only after initialization, check if we should show the dialog
  useEffect(() => {
    if (isInitialized && !hasSeenGuide) {
      setIsOpen(true);
    }
  }, [hasSeenGuide, isInitialized]);

  // Only render when initialized to prevent flashing
  if (!isInitialized) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (!open) setHasSeen(true);
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Welcome to Roxonn Contribution Portal</DialogTitle>
          <DialogDescription>
            Discover open source projects and earn crypto rewards for your contributions.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">How it works:</p>
            <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
              <li>Browse repositories below and find issues that interest you</li>
              <li>Click "View Details" to see issues with rewards</li>
              <li>Sign in <span className="font-bold">as contributor</span> to claim issues and get paid in crypto when your solution is accepted</li>
            </ul>
          </div>
        </div>
        
        <DialogFooter>
          <Button onClick={handleClose} className="w-full sm:w-auto">
            Get Started
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RepoDetailsGuide() {
  const { hasSeenGuide, setHasSeen } = useOnboarding('hasSeenRewardsGuide', false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize safely
  useEffect(() => {
    setIsInitialized(true);
  }, []);

  // Only render when initialized to prevent flashing
  if (!isInitialized || hasSeenGuide) {
    return null;
  }

  return (
    <div className="mb-4 p-4 border rounded-lg bg-muted/40 animate-in fade-in slide-in-from-bottom-5 duration-500">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h3 className="text-sm font-medium">💰 Rewards Guide</h3>
          <p className="text-sm text-muted-foreground">
            Issues with reward amounts show how much you'll earn for solving them. 
            The more challenging the issue, the higher the reward!
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setHasSeen(true)}>
          Got it
        </Button>
      </div>
    </div>
  );
}

export function SignInHighlight() {
  const { hasSeenGuide, setHasSeen } = useOnboarding('hasSeenSignInHighlight', false);
  
  if (hasSeenGuide) {
    return null;
  }

  return (
    <div className="absolute -bottom-20 right-0 w-64 p-3 rounded-lg border bg-card shadow-lg animate-in fade-in slide-in-from-top-5 z-50">
      <div className="space-y-2">
        <p className="text-sm font-medium">Sign in to get started</p>
        <p className="text-xs text-muted-foreground">
          Connect your GitHub account to claim issues and earn rewards
        </p>
        <div className="text-xs p-2 rounded bg-muted/50">
          <p>Example: John Doe</p>
          <p>Wallet: xdc123...456</p>
          <p>Balance: 0.00 XDC</p>
        </div>
      </div>
      <Button 
        variant="link" 
        size="sm" 
        className="absolute top-1 right-1 h-6 w-6 p-0" 
        onClick={() => setHasSeen(true)}
      >
        ✕
      </Button>
    </div>
  );
} 