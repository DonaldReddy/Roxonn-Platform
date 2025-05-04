import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useOnboarding } from '@/hooks/use-onboarding';
import { useAuth } from '@/hooks/use-auth';
import { Coins, Wallet, Database, GitPullRequest, CheckCircle2, AlertCircle, DollarSign } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

// Sample repositories for the demo
const demoRepositories = [
  {
    id: 1,
    name: "roxonn/documentation",
    description: "Documentation for Roxonn platform",
    currentFunding: 200,
    issues: 5
  },
  {
    id: 2,
    name: "roxonn/smart-contracts",
    description: "Smart contracts for the Roxonn platform",
    currentFunding: 800,
    issues: 12
  },
  {
    id: 3,
    name: "roxonn/wallet-integration",
    description: "XDC wallet integration module",
    currentFunding: 0,
    issues: 3
  }
];

// Sample issues for the demo
const demoIssues = [
  {
    id: 1,
    repoId: 2,
    title: "Fix gas estimation in contract deployment",
    type: "bug",
    reward: 0,
    status: "open"
  },
  {
    id: 2,
    repoId: 2,
    title: "Optimize token transfer function",
    type: "enhancement",
    reward: 50,
    status: "funded"
  },
  {
    id: 3,
    repoId: 2,
    title: "Add event listener for reward distributions",
    type: "feature",
    reward: 0,
    status: "open"
  }
];

// Create a function to manually show the demo
export const showFundingDemo = () => {
  localStorage.setItem('roxonn-onboarding-hasSeenFundingDemo', 'false');
  window.dispatchEvent(new Event('storage'));
};

export function FundingDemo() {
  const { hasSeenGuide, setHasSeen } = useOnboarding('hasSeenFundingDemo', false);
  const [isOpen, setIsOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const { user } = useAuth();
  
  // Only show for pool managers
  const isPoolManager = user?.role === "poolmanager";

  // Demo state variables
  const [walletBalance, setWalletBalance] = useState(2000);
  const [repos, setRepos] = useState(demoRepositories);
  const [issues, setIssues] = useState(demoIssues);
  const [selectedRepo, setSelectedRepo] = useState<null | typeof demoRepositories[0]>(null);
  const [selectedIssue, setSelectedIssue] = useState<null | typeof demoIssues[0]>(null);
  const [currentStep, setCurrentStep] = useState('Select a repository to fund');
  const [fundAmount, setFundAmount] = useState(0);
  const [rewardAmount, setRewardAmount] = useState(0);
  const [showAnimation, setShowAnimation] = useState(false);
  const [demoPhase, setDemoPhase] = useState<'fund_repo' | 'assign_rewards' | 'complete'>('fund_repo');

  const handleClose = () => {
    setIsOpen(false);
    setHasSeen(true);
  };

  // Initialize component
  useEffect(() => {
    setIsInitialized(true);
    
    // Listen for storage events to handle reopening the dialog
    const handleStorageChange = () => {
      const value = localStorage.getItem('roxonn-onboarding-hasSeenFundingDemo');
      if (value === 'false') {
        setIsOpen(true);
        resetDemo();
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

  // Reset demo state
  const resetDemo = () => {
    setWalletBalance(2000);
    setRepos(demoRepositories);
    setIssues(demoIssues);
    setSelectedRepo(null);
    setSelectedIssue(null);
    setCurrentStep('Select a repository to fund');
    setFundAmount(0);
    setRewardAmount(0);
    setShowAnimation(false);
    setDemoPhase('fund_repo');
  };

  // Handle repository selection
  const selectRepository = (repo: typeof demoRepositories[0]) => {
    setSelectedRepo(repo);
    setCurrentStep(`Selected ${repo.name} for funding`);
    setFundAmount(200);
  };

  // Handle funding a repository
  const fundRepository = () => {
    if (!selectedRepo || fundAmount <= 0) return;
    
    setCurrentStep(`Funding ${selectedRepo.name} with ${fundAmount} XDC...`);
    setShowAnimation(true);
    
    // Simulate funding transaction
    setTimeout(() => {
      setWalletBalance(prev => prev - fundAmount);
      
      // Update repository funding
      setRepos(prev => prev.map(repo => 
        repo.id === selectedRepo.id 
          ? { ...repo, currentFunding: repo.currentFunding + fundAmount } 
          : repo
      ));
      
      setShowAnimation(false);
      setCurrentStep(`Successfully funded ${selectedRepo.name}!`);
      
      // Move to next phase after a brief delay
      setTimeout(() => {
        setDemoPhase('assign_rewards');
        setCurrentStep('Select an issue to assign a reward');
      }, 1500);
    }, 2000);
  };

  // Handle issue selection
  const selectIssue = (issue: typeof demoIssues[0]) => {
    setSelectedIssue(issue);
    setCurrentStep(`Selected issue: ${issue.title}`);
    setRewardAmount(30);
  };

  // Handle assigning a reward to an issue
  const assignReward = () => {
    if (!selectedIssue || rewardAmount <= 0 || !selectedRepo) return;
    
    setCurrentStep(`Assigning ${rewardAmount} XDC reward to issue...`);
    setShowAnimation(true);
    
    // Simulate reward assignment
    setTimeout(() => {
      // Update issue with reward
      setIssues(prev => prev.map(issue => 
        issue.id === selectedIssue.id 
          ? { ...issue, reward: rewardAmount, status: 'funded' } 
          : issue
      ));
      
      setShowAnimation(false);
      setCurrentStep(`Successfully assigned ${rewardAmount} XDC reward!`);
      
      // Move to completion phase
      setTimeout(() => {
        setDemoPhase('complete');
        setCurrentStep('Funding and reward assignment complete!');
      }, 1500);
    }, 2000);
  };

  // Only render when initialized and for pool managers
  if (!isInitialized || !isPoolManager) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (!open) setHasSeen(true);
    }}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl bg-gradient-to-r from-[#00C2FF] to-[#7000FF] bg-clip-text text-transparent">
            Pool Manager Funding Demo
          </DialogTitle>
          <DialogDescription>
            Learn how to fund repositories and assign rewards to issues
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
          {/* Left panel - depends on current phase */}
          <div className="border rounded-xl p-5 bg-background/50">
            {demoPhase === 'fund_repo' ? (
              <>
                <h3 className="text-lg font-semibold mb-3 flex items-center">
                  <Database className="h-5 w-5 text-[#00C2FF] mr-2" />
                  Repositories
                </h3>
                <div className="space-y-3">
                  {repos.map(repo => (
                    <div 
                      key={repo.id} 
                      className={`rounded-lg p-3 cursor-pointer hover:bg-accent/50 transition-colors ${
                        selectedRepo?.id === repo.id ? 'bg-accent/70 border-2 border-[#00C2FF]' : 'bg-accent/30'
                      }`}
                      onClick={() => selectRepository(repo)}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-medium">{repo.name}</h4>
                          <span className="text-sm text-muted-foreground">{repo.description}</span>
                        </div>
                        <div className="text-[#00C2FF] text-sm">
                          Current: {repo.currentFunding} XDC
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : demoPhase === 'assign_rewards' ? (
              <>
                <h3 className="text-lg font-semibold mb-3 flex items-center">
                  <GitPullRequest className="h-5 w-5 text-[#00C2FF] mr-2" />
                  Issues in {selectedRepo?.name}
                </h3>
                <div className="space-y-3">
                  {issues
                    .filter(issue => issue.repoId === selectedRepo?.id)
                    .map(issue => (
                      <div 
                        key={issue.id} 
                        className={`rounded-lg p-3 cursor-pointer hover:bg-accent/50 transition-colors ${
                          selectedIssue?.id === issue.id ? 'bg-accent/70 border-2 border-[#00C2FF]' : 'bg-accent/30'
                        }`}
                        onClick={() => selectIssue(issue)}
                      >
                        <div>
                          <div className="flex justify-between items-center">
                            <h4 className="font-medium">{issue.title}</h4>
                            <Badge variant={issue.status === 'funded' ? 'default' : 'outline'}>
                              {issue.status}
                            </Badge>
                          </div>
                          <div className="flex justify-between items-center mt-2">
                            <span className="text-sm text-muted-foreground">{issue.type}</span>
                            <span className="text-[#00C2FF] text-sm">
                              {issue.reward > 0 ? `${issue.reward} XDC` : 'No reward yet'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full space-y-4 py-10">
                <CheckCircle2 className="h-16 w-16 text-green-500" />
                <h3 className="text-xl font-semibold text-center">Process Complete!</h3>
                <p className="text-center text-muted-foreground">
                  You've successfully funded a repository and assigned a reward to an issue.
                </p>
              </div>
            )}
          </div>

          {/* Right panel - Changes based on selected item and phase */}
          <div className="border rounded-xl p-5 bg-background/50">
            <h3 className="text-lg font-semibold mb-3 flex items-center">
              {demoPhase === 'fund_repo' ? (
                <>
                  <Coins className="h-5 w-5 text-[#00C2FF] mr-2" />
                  Fund Repository
                </>
              ) : demoPhase === 'assign_rewards' ? (
                <>
                  <DollarSign className="h-5 w-5 text-[#00C2FF] mr-2" />
                  Assign Reward
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-500 mr-2" />
                  Summary
                </>
              )}
            </h3>

            <div className="space-y-4">
              {/* Current Step Status */}
              <div className="p-3 bg-accent/30 rounded-lg">
                <span>{currentStep}</span>
              </div>

              {/* Funding Input (Phase 1) */}
              {demoPhase === 'fund_repo' && selectedRepo && (
                <div className="space-y-3">
                  <div className="p-3 bg-accent/20 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Amount to Fund (XDC)</span>
                      <span className="text-[#00C2FF] text-sm">
                        Max: {Math.min(walletBalance, 1000)} XDC
                      </span>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <div className="grow relative">
                        <input
                          type="number"
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                          value={fundAmount}
                          onChange={(e) => setFundAmount(Number(e.target.value))}
                          min="1"
                          max={Math.min(walletBalance, 1000)}
                        />
                        <div className="absolute inset-y-0 right-2 flex items-center text-sm">XDC</div>
                      </div>
                      <Button 
                        onClick={fundRepository}
                        disabled={fundAmount <= 0 || fundAmount > Math.min(walletBalance, 1000) || showAnimation}
                      >
                        {showAnimation ? (
                          <Coins className="h-4 w-4 animate-spin" />
                        ) : "Fund"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Reward Assignment Input (Phase 2) */}
              {demoPhase === 'assign_rewards' && selectedIssue && (
                <div className="space-y-3">
                  <div className="p-3 bg-accent/20 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Reward Amount (XDC)</span>
                      <span className="text-[#00C2FF] text-sm">
                        Available: {selectedRepo?.currentFunding} XDC
                      </span>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <div className="grow relative">
                        <input
                          type="number"
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                          value={rewardAmount}
                          onChange={(e) => setRewardAmount(Number(e.target.value))}
                          min="1"
                          max={selectedRepo?.currentFunding || 0}
                        />
                        <div className="absolute inset-y-0 right-2 flex items-center text-sm">XDC</div>
                      </div>
                      <Button 
                        onClick={assignReward}
                        disabled={rewardAmount <= 0 || (selectedRepo ? rewardAmount > selectedRepo.currentFunding : true) || showAnimation}
                      >
                        {showAnimation ? (
                          <Coins className="h-4 w-4 animate-spin" />
                        ) : "Assign"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Summary (Phase 3) */}
              {demoPhase === 'complete' && (
                <div className="space-y-3">
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-900">
                    <h4 className="font-medium text-green-700 dark:text-green-300">Repository Funded</h4>
                    <p className="text-sm text-green-600 dark:text-green-400">
                      {selectedRepo?.name}: +{fundAmount} XDC
                    </p>
                  </div>
                  
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-900">
                    <h4 className="font-medium text-blue-700 dark:text-blue-300">Reward Assigned</h4>
                    <p className="text-sm text-blue-600 dark:text-blue-400">
                      Issue: {selectedIssue?.title}
                    </p>
                    <p className="text-sm text-blue-600 dark:text-blue-400">
                      Reward: {rewardAmount} XDC
                    </p>
                  </div>
                  
                  <Button onClick={resetDemo} className="w-full">
                    Restart Demo
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Wallet Section - Always visible */}
        <div className="border rounded-xl p-5 bg-background/50 mt-2">
          <h3 className="text-lg font-semibold mb-3 flex items-center">
            <Wallet className="h-5 w-5 text-[#00C2FF] mr-2" />
            Your XDC Wallet
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="ml-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 border-yellow-500/30">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Mainnet
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs max-w-xs">This system operates on XDC Mainnet using real XDC tokens with actual value.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-accent/30 rounded-lg">
              <span className="font-medium">XDC Balance</span>
              <span className="text-[#00C2FF] font-bold">
                {walletBalance.toLocaleString()} XDC
              </span>
            </div>
            
            {showAnimation && (
              <div className="h-2">
                <Progress value={45} className="h-2 animate-pulse" />
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 mt-4">
          <Button variant="outline" onClick={handleClose}>
            Close Demo
          </Button>
          <Button onClick={handleClose}>
            Start Managing
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
