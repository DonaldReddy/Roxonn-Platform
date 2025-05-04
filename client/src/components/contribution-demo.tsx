import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useOnboarding } from '@/hooks/use-onboarding';
import { Coins, Bug, FileCode, GitPullRequest, CheckCircle2, AlertCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';

// Sample issues for the demo
const demoIssues = [
  {
    id: 1,
    title: "Fix Documentation Typo",
    type: "minor-bug",
    reward: 10,
    steps: ["Fork Repository", "Fix Typo", "Create PR", "Get Merged"]
  },
  {
    id: 2,
    title: "Fix Login Function",
    type: "major-bug",
    reward: 50,
    steps: ["Fork Repository", "Debug Issue", "Implement Fix", "Add Tests", "Create PR", "Get Merged"]
  },
  {
    id: 3,
    title: "Add Dark Mode",
    type: "feature",
    reward: 100,
    steps: ["Fork Repository", "Design Feature", "Implement", "Add Tests", "Create PR", "Get Merged"]
  }
];

// Create a function to manually show the demo
export const showContributionDemo = () => {
  localStorage.setItem('roxonn-onboarding-hasSeenContributionDemo', 'false');
  window.dispatchEvent(new Event('storage'));
};

export function ContributionDemo() {
  const { hasSeenGuide, setHasSeen } = useOnboarding('hasSeenContributionDemo', false);
  const [isOpen, setIsOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentBalance, setCurrentBalance] = useState(0);
  const [totalContributions, setTotalContributions] = useState(0);
  const [currentStep, setCurrentStep] = useState('Select an issue to start');
  const [selectedIssue, setSelectedIssue] = useState<null | typeof demoIssues[0]>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [showTokenAnimation, setShowTokenAnimation] = useState(false);

  const handleClose = () => {
    setIsOpen(false);
    setHasSeen(true);
  };

  // Separate initialization and open/close logic
  useEffect(() => {
    setIsInitialized(true);
    // Listen for storage events to handle reopening the dialog
    const handleStorageChange = () => {
      const value = localStorage.getItem('roxonn-onboarding-hasSeenContributionDemo');
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

  // Handle issue selection
  const simulateContribution = (issue: typeof demoIssues[0]) => {
    setSelectedIssue(issue);
    setCurrentStepIndex(0);
    runSimulation(issue);
  };

  // Run the simulation steps
  const runSimulation = (issue: typeof demoIssues[0]) => {
    let index = 0;

    const simulationInterval = setInterval(() => {
      if (index < issue.steps.length) {
        setCurrentStep(`${issue.steps[index]} (${index + 1}/${issue.steps.length})`);
        setCurrentStepIndex(index + 1);
        index++;
      } else {
        clearInterval(simulationInterval);
        // Show token animation
        setShowTokenAnimation(true);
        
        // Update wallet after animation
        setTimeout(() => {
          setCurrentBalance(prev => prev + issue.reward);
          setTotalContributions(prev => prev + 1);
          setShowTokenAnimation(false);
          setCurrentStep('Contribution Complete! 🎉');
        }, 1500);
      }
    }, 1500);
  };

  // Only render when initialized to prevent flashing
  if (!isInitialized) {
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
            Roxonn Contribution Demo
          </DialogTitle>
          <DialogDescription>
            Experience how contributing earns you ROXN tokens
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
          {/* Issues Section */}
          <div className="border rounded-xl p-5 bg-background/50">
            <h3 className="text-lg font-semibold mb-3 flex items-center">
              <Bug className="h-5 w-5 text-[#00C2FF] mr-2" />
              Available Issues
            </h3>
            <div className="space-y-3">
              {demoIssues.map(issue => (
                <div 
                  key={issue.id} 
                  className="bg-accent/30 rounded-lg p-3 cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => simulateContribution(issue)}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-medium">{issue.title}</h4>
                      <span className="text-sm text-muted-foreground">{issue.type}</span>
                    </div>
                    <div className="text-[#00C2FF] flex items-center">
                      <Coins className="h-4 w-4 mr-1" /> 
                      {issue.reward} ROXN
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Simulation Section */}
          <div className="border rounded-xl p-5 bg-background/50">
            <h3 className="text-lg font-semibold mb-3 flex items-center">
              <GitPullRequest className="h-5 w-5 text-[#00C2FF] mr-2" />
              Live Simulation
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-accent/30 rounded-lg">
                <span>{currentStep}</span>
                <span className="text-[#00C2FF] flex items-center">
                  <Coins className="h-4 w-4 mr-1" />
                  Balance: {currentBalance} ROXN
                </span>
              </div>

              {selectedIssue && (
                <div className="relative h-10 flex items-center justify-center">
                  {/* Progress indicators */}
                  <div className="flex justify-between w-full mb-2">
                    {selectedIssue.steps.map((step, idx) => (
                      <div 
                        key={idx} 
                        className={`h-2 w-2 rounded-full ${
                          idx < currentStepIndex ? 'bg-[#00C2FF]' : 'bg-accent'
                        }`}
                        title={step}
                      />
                    ))}
                  </div>
                  
                  {/* Token animation */}
                  {showTokenAnimation && (
                    <div className="absolute transition-all duration-1500 animate-in fade-in slide-in-from-left-80 slide-out-to-right-96">
                      <Coins className="h-6 w-6 text-[#00C2FF]" />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Wallet Section */}
        <div className="border rounded-xl p-5 bg-background/50">
          <h3 className="text-lg font-semibold mb-3 flex items-center">
            <Coins className="h-5 w-5 text-[#00C2FF] mr-2" />
            Your ROXN Wallet
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="ml-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 border-yellow-500/30">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Testnet
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                <p className="text-xs max-w-xs">This system operates on XDC Mainnet using real XDC tokens with actual value. Soon, additional payment options will be available for buying and selling within the platform.</p>                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-accent/30 rounded-lg p-3">
              <div className="text-muted-foreground">Total Earned</div>
              <div className="text-xl font-bold text-[#00C2FF]">{currentBalance} ROXN</div>
            </div>
            <div className="bg-accent/30 rounded-lg p-3">
              <div className="text-muted-foreground">Contributions</div>
              <div className="text-xl font-bold text-[#00C2FF]">{totalContributions}</div>
            </div>
            <div className="bg-accent/30 rounded-lg p-3">
              <div className="text-muted-foreground">Value (₹)</div>
              <div className="text-xl font-bold text-[#00C2FF]">₹{currentBalance * 3}</div>
              <div className="text-xs text-muted-foreground mt-1">*Test tokens now, real value post-launch</div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
            Close Demo
          </Button>
          <Button onClick={handleClose}>
            Get Started
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 