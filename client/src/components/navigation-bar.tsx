import { Link } from "wouter";
import { motion } from "framer-motion";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/hooks/use-auth";
import { useWallet } from "@/hooks/use-wallet";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ethers } from "ethers";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, LogOut, User, HelpCircle, Code, BookOpen, AlertCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { showContributionDemo } from "@/components/contribution-demo";
import { showReposWelcomeGuide } from "@/components/welcome-guide";
import { showPoolManagerGuide } from "@/components/pool-manager-guide";
import { showFundingDemo } from "@/components/funding-demo";
import { Badge } from "@/components/ui/badge";

export function NavigationBar() {
  const { user, signOut } = useAuth();
  const { data: walletInfo, isLoading: walletLoading } = useWallet();
  const { toast } = useToast();

  // Determine the correct home link based on role
  const homeLink = user?.role === 'poolmanager' ? '/my-repos' : '/repos';

  // Format XDC balance with appropriate precision
  const formattedXdcBalance = walletInfo?.balance 
    ? parseFloat(ethers.formatEther(walletInfo.balance)).toFixed(4) 
    : "0.0000";
    
  // Format ROXN balance with appropriate precision
  const formattedRoxnBalance = walletInfo?.tokenBalance 
    ? parseFloat(ethers.formatEther(walletInfo.tokenBalance)).toFixed(2) 
    : "0.00";

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({
        title: "Signed out successfully",
        description: "You have been signed out of your account",
      });
    } catch (error) {
      toast({
        title: "Error signing out",
        description: "There was a problem signing out. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <nav className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/80 backdrop-blur-lg backdrop-saturate-150">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo and brand */}
        <div className="flex items-center gap-4">
          <Link href={homeLink} className="flex flex-col items-center relative group">
            <div className="relative">
              <span className="text-2xl font-bold">
                <span className="bg-gradient-to-r from-violet-600 via-red-500 to-violet-500 bg-clip-text text-transparent">
                  ROXONN
                </span>
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-foreground/30 to-transparent"
                  animate={{
                    x: ['100%', '-100%'],
                  }}
                  transition={{
                    duration: 3.5,
                    repeat: Infinity,
                    ease: 'linear',
                  }}
                  style={{
                    clipPath: 'polygon(0 0, 100% 0, 80% 100%, 20% 100%)',
                  }}
                />
              </span>
              <motion.div
                className="absolute -inset-2 bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] opacity-0 blur-xl"
                animate={{
                  opacity: [0, 0.2, 0],
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            </div>
            <span className="text-[0.6rem] font-bold tracking-[0.3em] relative">
              <span className="bg-gradient-to-r from-violet-600 via-red-500 to-violet-500 bg-clip-text text-transparent">
                FUTURE TECH
              </span>
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-violet-600 via-red-500 to-violet-500"
                animate={{
                  opacity: [0, 0.3, 0],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                style={{
                  mixBlendMode: 'overlay',
                }}
              />
            </span>
          </Link>
          <div className="flex items-center">
            <Badge variant="outline" className="ml-2 bg-violet-500/10 hover:bg-violet-500/20 text-violet-500 border-violet-500/30 text-xs uppercase font-bold tracking-wide">
              Beta
            </Badge>
          </div>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-muted-foreground hover:text-primary"
              >
                <HelpCircle className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Help & Guides</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {/* Show different demos based on user role */}
              {user?.role === 'contributor' && (
                <DropdownMenuItem onClick={() => showContributionDemo()}>
                  <BookOpen className="mr-2 h-4 w-4" />
                  Contribution Demo
                </DropdownMenuItem>
              )}
              
              {user?.role === 'poolmanager' && (
                <>
                  <DropdownMenuItem onClick={() => showPoolManagerGuide()}>
                    <BookOpen className="mr-2 h-4 w-4" />
                    Pool Manager Guide
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => showFundingDemo()}>
                    <BookOpen className="mr-2 h-4 w-4" />
                    Funding Demo
                  </DropdownMenuItem>
                </>
              )}
              
              <DropdownMenuItem asChild>
                <Link to="/faq" className="w-full cursor-pointer">
                  <HelpCircle className="mr-2 h-4 w-4" />
                  FAQs
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Link href="/repos">
            <Button variant="ghost" className="text-muted-foreground hover:text-primary hover:bg-violet-500/10">
              Explore
            </Button>
          </Link>
          
          <ThemeToggle />

          {user && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="hidden md:flex items-center gap-3 border rounded-lg px-3 py-1.5 bg-background/50 text-sm">
                    {walletLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      <>
                        <div className="flex flex-col">
                          <span className="text-muted-foreground text-xs">Balance</span>
                          <span className="font-medium">{formattedXdcBalance} XDC</span>
                        </div>
                        <div className="h-8 w-px bg-border" />
                        <div className="flex flex-col">
                          <span className="text-muted-foreground text-xs">Wallet</span>
                          <span className="font-mono text-xs truncate w-20">
                            {walletInfo?.address 
                              ? `${walletInfo.address.slice(0, 6)}...${walletInfo.address.slice(-4)}`
                              : "..."}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <div>
                    <div className="inline-flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5 text-yellow-500" />
                      <span className="text-xs font-medium text-yellow-500">Live Environment: XDC Mainnet</span>
                    </div>
                    <p className="text-xs mt-1">All transactions involve real XDC tokens with actual value. Please handle with care.</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Avatar className="h-9 w-9 ring-2 ring-border/40 transition-all duration-200 hover:ring-violet-500 hover:scale-105 cursor-pointer">
                  <AvatarImage src={user.avatarUrl || undefined} alt={user.username} />
                  <AvatarFallback className="bg-violet-500/10 text-violet-500">
                    {user.username.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <Link href="/profile">
                  <DropdownMenuItem className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                </Link>
                <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link href="/auth">
              <Button
                variant="outline"
                className="bg-background/50 backdrop-blur-sm hover:bg-violet-500/10 transition-all duration-200 hover:scale-105 hover:text-violet-500 hover:border-violet-500"
              >
                Sign In
              </Button>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}