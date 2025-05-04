import { useAuth } from "@/hooks/use-auth";
import { useWallet } from "@/hooks/use-wallet";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Loader2, Github, Mail, Globe, MapPin, Wallet, AlertCircle, ChevronRight } from "lucide-react";
import { Redirect, Link } from "wouter";
import { ethers } from "ethers";
import { MyRepositories } from "@/components/my-repositories";
import { Button } from "@/components/ui/button";

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const { data: walletInfo, isLoading: walletLoading } = useWallet();

  // Redirect to auth page if not authenticated
  if (!loading && !user) {
    return <Redirect to="/auth" />;
  }

  // Format balances with appropriate precision
  const formattedXdcBalance = walletInfo?.balance 
    ? parseFloat(ethers.formatEther(walletInfo.balance)).toFixed(4) 
    : "0.0000";
    
  // Format ROXN balance with appropriate precision
  const formattedRoxnBalance = walletInfo?.tokenBalance 
    ? parseFloat(ethers.formatEther(walletInfo.tokenBalance)).toFixed(2) 
    : "0.00";

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
      
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : user && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* User Profile Card */}
          <Card className="overflow-hidden">
            <div className="h-24 bg-gradient-to-r from-violet-600 to-violet-400"></div>
            <div className="px-6 pb-6">
              <div className="flex -mt-12 space-x-4">
                <Avatar className="h-24 w-24 ring-4 ring-background">
                  <AvatarImage src={user.avatarUrl || undefined} alt={user.username} />
                  <AvatarFallback className="text-2xl bg-violet-500/10 text-violet-500">
                    {user.username.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="pt-12">
                  <h2 className="text-2xl font-bold">{user.name || user.username}</h2>
                  <p className="text-muted-foreground">@{user.githubUsername}</p>
                </div>
              </div>
            </div>
            <CardContent className="space-y-4">
              {user.bio && (
                <p>{user.bio}</p>
              )}

              <div className="grid gap-3">
                {user.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{user.email}</span>
                  </div>
                )}
                
                <div className="flex items-center gap-2">
                  <Github className="h-4 w-4 text-muted-foreground" />
                  <a 
                    href={`https://github.com/${user.githubUsername}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-violet-500 hover:underline"
                  >
                    github.com/{user.githubUsername}
                  </a>
                </div>

                {user.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{user.location}</span>
                  </div>
                )}

                {user.website && (
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <a 
                      href={user.website} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-violet-500 hover:underline"
                    >
                      {user.website.replace(/^https?:\/\//, '')}
                    </a>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Enhanced Wallet Component with Transaction History */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Wallet</CardTitle>
                <CardDescription>Your XDC wallet details and transaction history</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Mainnet information alert */}
                <div className="p-3 rounded-md bg-yellow-500/10 border border-yellow-500/30 mb-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                    <div className="text-sm font-medium text-yellow-500">Mainnet Environment</div>
                  </div>
                  <p className="text-xs text-yellow-600 mt-1">
                    This wallet is on the XDC Mainnet. All transactions involve real XDC tokens with actual value.
                    Additional payment options will be available soon.
                  </p>
                </div>
                
                {/* Import our new WalletReceive component */}
                <Link href="/wallet" className="w-full">
                  <Button variant="outline" className="w-full flex justify-between items-center">
                    <span>Manage Your Wallet</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
            
            {/* Summary of wallet balances */}
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-sm text-muted-foreground">XDC Balance</div>
                  <div className="text-2xl font-bold mt-1">{formattedXdcBalance} XDC</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-sm text-muted-foreground">ROXN Balance</div>
                  <div className="text-2xl font-bold mt-1">{formattedRoxnBalance} ROXN</div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}
      
      {/* Pool Manager Dashboard - Only shown if user is a pool manager */}
      {!loading && user?.role === 'poolmanager' && (
        <div className="space-y-6 mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold tracking-tight">Pool Manager Dashboard</h2>
            <Button variant="outline" size="sm" asChild>
              <Link href="/faq#pool-manager" className="flex items-center gap-1">
                <span>Learn more</span>
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          
          <div className="p-3 rounded-md bg-blue-500/10 border border-blue-500/30">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-blue-500" />
              <div className="text-sm font-medium text-blue-500">Pool Manager Guide</div>
            </div>
            <p className="text-sm text-blue-600 mt-1">
              As a pool manager, you can add funds to your GitHub repositories and allocate rewards to issues.
              Select a repository below or visit the Repositories page to get started.
            </p>
          </div>
          
          <MyRepositories />
        </div>
      )}
    </div>
  );
} 