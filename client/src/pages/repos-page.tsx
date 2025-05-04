import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GitBranch, GitPullRequest, Star, Coins, HelpCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { ethers } from "ethers";
import { STAGING_API_URL } from '../config';
import { blockchainApi } from "../lib/blockchain";
import { ReposWelcomeGuide } from "@/components/welcome-guide";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { SocialRewardsBanner } from "@/components/social-rewards-banner";

// Helper function to generate image URL based on repository title and description
function getUnsplashImageUrl(repoName: string, repoDescription: string): string {
  // Normalized repository name for matching
  const normalizedName = repoName.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  // Map of repository names to themed, topic-specific image URLs
  const repoImageMap: Record<string, string> = {
    // Healthcare/Medical
    "medisync": "https://images.pexels.com/photos/263402/pexels-photo-263402.jpeg?auto=compress&cs=tinysrgb&w=800&h=400&dpr=1", // Hospital corridor
    
    // Agriculture/Farming
    "farmsense": "https://images.pexels.com/photos/440731/pexels-photo-440731.jpeg?auto=compress&cs=tinysrgb&w=800&h=400&dpr=1", // Farm with technology
    
    // Driving/Transportation - Updated with working URL
    "alertdrive": "https://images.pexels.com/photos/3136673/pexels-photo-3136673.jpeg?auto=compress&cs=tinysrgb&w=800&h=400&dpr=1", // Car dashboard with navigation
    
    // Ocean/Marine - Updated with beach robot image
    "oceanguardian": "https://images.pexels.com/photos/2599244/pexels-photo-2599244.jpeg?auto=compress&cs=tinysrgb&w=800&h=400&dpr=1", // Beach/ocean technology
    
    // Education/Skills
    "skillswap": "https://images.pexels.com/photos/3184292/pexels-photo-3184292.jpeg?auto=compress&cs=tinysrgb&w=800&h=400&dpr=1", // People collaborating
    
    // Plants/Gardening
    "plantpal": "https://images.pexels.com/photos/1002703/pexels-photo-1002703.jpeg?auto=compress&cs=tinysrgb&w=800&h=400&dpr=1" // Plant close-up
  };
  
  // Domain-based image selection if no exact repository match
  if (repoImageMap[normalizedName]) {
    return repoImageMap[normalizedName];
  }
  
  // Fallback by domain if no exact match
  const name = repoName.toLowerCase();
  
  if (name.includes('medi') || name.includes('health') || name.includes('hospital')) {
    return "https://images.pexels.com/photos/247786/pexels-photo-247786.jpeg?auto=compress&cs=tinysrgb&w=800&h=400&dpr=1"; // Medical tech
  } 
  else if (name.includes('farm') || name.includes('agri') || name.includes('crop')) {
    return "https://images.pexels.com/photos/2047422/pexels-photo-2047422.jpeg?auto=compress&cs=tinysrgb&w=800&h=400&dpr=1"; // Agricultural field
  } 
  else if (name.includes('drive') || name.includes('car') || name.includes('vehicle')) {
    return "https://images.pexels.com/photos/3136673/pexels-photo-3136673.jpeg?auto=compress&cs=tinysrgb&w=800&h=400&dpr=1"; // Car dashboard - updated
  } 
  else if (name.includes('ocean') || name.includes('marine') || name.includes('beach') || name.includes('robot')) {
    return "https://images.pexels.com/photos/2599244/pexels-photo-2599244.jpeg?auto=compress&cs=tinysrgb&w=800&h=400&dpr=1"; // Beach/ocean technology - updated
  } 
  else if (name.includes('skill') || name.includes('learn') || name.includes('mentor')) {
    return "https://images.pexels.com/photos/3183153/pexels-photo-3183153.jpeg?auto=compress&cs=tinysrgb&w=800&h=400&dpr=1"; // Learning environment
  } 
  else if (name.includes('plant') || name.includes('garden') || name.includes('botany')) {
    return "https://images.pexels.com/photos/3511755/pexels-photo-3511755.jpeg?auto=compress&cs=tinysrgb&w=800&h=400&dpr=1"; // Plant identification
  }
  
  // Technology default fallback
  return "https://images.pexels.com/photos/325229/pexels-photo-325229.jpeg?auto=compress&cs=tinysrgb&w=800&h=400&dpr=1"; // Generic tech image
}

// Helper function to get a themed color overlay based on repository domain
function getThemeColorForRepo(repoName: string): string {
  const name = repoName.toLowerCase();
  
  // Medical/health - blue theme
  if (name.includes('medi') || name.includes('health') || name === 'medisync') {
    return 'from-blue-500/30 to-blue-700/5';
  }
  // Agriculture/farming - green theme
  else if (name.includes('farm') || name.includes('plant') || name === 'farmsense' || name === 'plantpal') {
    return 'from-green-500/30 to-green-700/5';
  }
  // Transportation/driving - red theme
  else if (name.includes('drive') || name.includes('car') || name === 'alertdrive') {
    return 'from-red-500/30 to-red-700/5';
  }
  // Ocean/water - cyan theme
  else if (name.includes('ocean') || name.includes('water') || name === 'oceanguardian') {
    return 'from-cyan-500/30 to-cyan-700/5';
  }
  // Education/skills - purple theme
  else if (name.includes('skill') || name.includes('education') || name === 'skillswap') {
    return 'from-purple-500/30 to-purple-700/5';
  }
  // Default - primary color theme
  else {
    return 'from-primary/30 to-primary/5';
  }
}

// Update interface to match registered repository data
interface PublicRepository {
  id: number; // DB id
  githubRepoId: string;
  githubRepoFullName: string;
  registeredAt: string;
  // Potentially add description, owner, open_issues_count if fetched/joined on backend
  // description?: string;
  // ownerLogin?: string;
  // open_issues_count?: number;
}

interface PublicRepositoriesResponse {
  repositories: PublicRepository[];
  // Add pagination if the public endpoint supports it
  // pagination?: { ... };
}

export default function ReposPage() {
  const { user } = useAuth();
  // Change default to show only funded repos
  const [showOnlyFunded, setShowOnlyFunded] = useState(true);
  // Pagination state if needed
  // const [page, setPage] = useState(1);
  // const perPage = 10;

  // Update useQuery to fetch from the new public endpoint using fetch
  const { data, isLoading, error } = useQuery<PublicRepositoriesResponse>({
    queryKey: ["/api/repositories/public"],
    queryFn: async () => {
      // Use fetch directly
      const response = await fetch(`${STAGING_API_URL}/api/repositories/public`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})); // Try parsing error
        throw new Error(errorData?.error || 'Failed to fetch public repositories');
      }
      const data = await response.json(); 
      return data; // Backend returns { repositories: [...] }
    },
    retry: false,
    staleTime: 1000 * 60 * 2,
  });

  // Query for repository rewards - Update to use githubRepoId
  const { data: rewardsData } = useQuery({
    queryKey: ["repository-rewards", data?.repositories?.map(r => r.githubRepoId)],
    queryFn: async () => {
      if (!data?.repositories || data.repositories.length === 0) return null;
      // Backend expects numbers for repoIds, ensure conversion
      const repoIds = data.repositories.map((repo: PublicRepository) => parseInt(repo.githubRepoId, 10)).filter(id => !isNaN(id));
      if (repoIds.length === 0) return null;
      // Assuming blockchainApi is still used for this specific call
      return await blockchainApi.getRepositoryRewards(repoIds); 
    },
    enabled: !!data?.repositories?.length,
    staleTime: 1000 * 60 * 2, // Cache rewards for 2 minutes
  });

  if (isLoading) {
    return (
      <div className="space-y-8">
        {/* Social Rewards Banner - even during loading */}
        <SocialRewardsBanner />
        
        {/* Skeleton Header */}
        <Card className="mb-8 overflow-hidden backdrop-blur-xl border-border/50 bg-gradient-to-br from-background/95 to-background/90">
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-border/40 bg-background/50 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <Skeleton className="h-7 w-48" />
              </div>
              <Skeleton className="h-4 w-72" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-32" />
            </div>
          </CardHeader>
        </Card>

        {/* Skeleton Grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="overflow-hidden border-border/50">
              {/* Image Skeleton */}
              <div className="w-full h-32 bg-muted/30 animate-pulse" />
              
              <CardHeader className="border-b border-border/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1">
                    <Skeleton className="h-5 w-5" />
                    <Skeleton className="h-6 w-48" />
                  </div>
                  <Skeleton className="h-5 w-24" />
                </div>
                <div className="mt-2 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </CardHeader>
              <CardContent className="space-y-4 p-6">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-5 w-32" />
                </div>
                <div className="flex justify-end pt-2">
                  <Skeleton className="h-9 w-32" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col min-h-[50vh] space-y-6">
        {/* Social Rewards Banner - even during error */}
        <SocialRewardsBanner />
        
        <div className="flex items-center justify-center">
          <div className="glass-card flex items-center gap-2 px-4 py-2 text-destructive">
            <span>Error loading repositories: {error instanceof Error ? error.message : "Unknown error"}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Social Rewards Banner */}
      <SocialRewardsBanner />
      
      {/* Welcome Guide */}
      <ReposWelcomeGuide />
      
      {/* Header Section - Modern Bento Grid Style */}
      <Card className="mb-8 overflow-hidden backdrop-blur-xl border-border/50 bg-gradient-to-br from-background/95 to-background/90">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-border/40 bg-background/50 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-2 animate-pulse">
                <GitBranch className="h-5 w-5 text-primary" />
              </div>
              <CardTitle>Explore Bounties</CardTitle>
            </div>
            <CardDescription>
              Explore registered repositories and find bounties to work on.
            </CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex items-center gap-2">
              <Button 
                variant={showOnlyFunded ? "default" : "outline"} 
                size="sm"
                className="flex items-center gap-2 transition-all"
                onClick={() => setShowOnlyFunded(!showOnlyFunded)}
              >
                <Coins className="h-4 w-4" />
                {showOnlyFunded ? "Showing Funded Repos" : "Show All Repos"}
              </Button>
            </div>
            {user && (
              <Button variant="glass" asChild className="transition-all duration-200 hover:scale-105">
                <Link to="/profile">Manage Profile</Link>
              </Button>
            )}
            {user?.role === 'poolmanager' && (
              <Button variant="glass-primary" asChild className="transition-all duration-200 hover:scale-105">
                <Link to="/my-repos">
                  <GitBranch className="h-4 w-4 mr-2" />
                  Manage My Repos
                </Link>
              </Button>
            )}
            <Button variant="glass-primary" asChild className="transition-all duration-200 hover:scale-105">
              <Link to="/faq">
                <HelpCircle className="h-4 w-4 mr-2" />
                Guide
              </Link>
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Repositories Grid - Modern Card Design */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {(() => {
          // Calculate repositories with funds
          const filteredRepos = data?.repositories?.filter((repo: PublicRepository) => {
            if (!showOnlyFunded) return true;
            const repoRewardData = rewardsData?.rewards?.find(
              (r: { repoId: number; totalRewards: string }) => 
                String(r.repoId) === repo.githubRepoId
            );
            const repoRewards = repoRewardData?.totalRewards || '0';
            return ethers.parseEther(repoRewards) > ethers.parseEther('0');
          }) || [];
          
          // Count repositories with funds
          const reposWithFunds = data?.repositories?.filter((repo: PublicRepository) => {
            const repoRewardData = rewardsData?.rewards?.find(
              (r: { repoId: number; totalRewards: string }) => 
                String(r.repoId) === repo.githubRepoId
            );
            const repoRewards = repoRewardData?.totalRewards || '0';
            return ethers.parseEther(repoRewards) > ethers.parseEther('0');
          }).length || 0;
          
          // Total repositories count
          const totalRepos = data?.repositories?.length || 0;
          
          // Display repo count message
          if (filteredRepos.length === 0) {
            return (
              <div className="col-span-3 p-8 text-center">
                <div className="mb-4">
                  <Coins className="h-12 w-12 mx-auto text-muted-foreground" />
                </div>
                <h3 className="text-xl font-medium mb-2">No {showOnlyFunded ? 'funded' : ''} repositories found</h3>
                <p className="text-muted-foreground mb-4">
                  {showOnlyFunded 
                    ? `There are currently no repositories with funds. ${totalRepos} repositories are registered but not funded.` 
                    : 'No repositories have been registered yet.'}
                </p>
                {showOnlyFunded && totalRepos > 0 && (
                  <Button 
                    variant="outline" 
                    onClick={() => setShowOnlyFunded(false)}
                    className="mx-auto"
                  >
                    Show All Repositories
                  </Button>
                )}
              </div>
            );
          }
          
          // Add repo count badge at the top of the grid
          return (
            <>
              <div className="col-span-3 mb-2 flex items-center justify-between">
                <Badge variant="outline" className="flex items-center gap-1 px-3 py-1.5">
                  <span className="text-xs text-muted-foreground">Showing:</span> 
                  <span className="font-semibold">{filteredRepos.length} {showOnlyFunded ? 'funded' : ''} {filteredRepos.length === 1 ? 'repository' : 'repositories'}</span>
                  {showOnlyFunded && (
                    <span className="text-xs ml-1 text-muted-foreground">
                      of {totalRepos} total
                    </span>
                  )}
                </Badge>
                <div className="text-xs text-muted-foreground">
                  {reposWithFunds} of {totalRepos} repositories have funds
                </div>
              </div>
              
              {filteredRepos.map((repo: PublicRepository) => {
                // Find reward using githubRepoId (as string)
                const repoRewardData = rewardsData?.rewards?.find((r: { repoId: number; totalRewards: string }) => String(r.repoId) === repo.githubRepoId);
                const repoRewards = repoRewardData?.totalRewards || '0';
                // Extract name from full name for display/helpers
                const repoName = repo.githubRepoFullName.split('/')[1] || repo.githubRepoFullName;
                const ownerName = repo.githubRepoFullName.split('/')[0] || '';

                return (
                  <Card 
                    key={repo.id}
                    className="group relative overflow-hidden border-2 border-zinc-200/20 dark:border-zinc-700/50 transition-all duration-300 hover:shadow-xl hover:scale-[1.02] bg-background/80 hover:bg-background backdrop-blur-lg"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -translate-x-12 -translate-y-12 group-hover:scale-150 transition-transform duration-500" />
                    
                    {/* Repository image from Unsplash */}
                    <div className="w-full h-32 overflow-hidden relative">
                      <img 
                        src={getUnsplashImageUrl(repoName, 'Repository with bounties')}
                        alt={`${repoName} visual representation`}
                        className="w-full h-full object-cover transition-all duration-500 group-hover:scale-110 opacity-80 group-hover:opacity-90"
                        loading="lazy"
                      />
                      <div className={`absolute inset-0 bg-gradient-to-br ${getThemeColorForRepo(repoName)} transition-opacity duration-300`} />
                      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent opacity-70" />
                    </div>
                    
                    <CardHeader className="border-b border-border/40 relative z-10">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1">
                          <div className="rounded-full bg-primary/10 p-1.5 group-hover:bg-primary/20 transition-colors">
                            <GitPullRequest className="h-4 w-4 text-primary" />
                          </div>
                          <Link 
                            href={`/repos/${repo.githubRepoFullName}`}
                            className="text-lg font-semibold text-primary hover:text-primary/80 transition-colors truncate"
                          >
                            {repoName}
                          </Link>
                        </div>
                        <Badge variant="outline" className="flex items-center gap-1 bg-primary/5 text-primary group-hover:bg-primary/10 transition-colors">
                          <Coins className="h-3.5 w-3.5" />
                          {ethers.formatEther(repoRewards)} XDC
                        </Badge>
                      </div>
                      <CardDescription className="line-clamp-2 mt-2 text-sm">
                        {repo.githubRepoFullName}
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-4 p-6 relative z-10">
                      <p className="text-xs text-muted-foreground">Registered: {formatDistanceToNow(new Date(repo.registeredAt))} ago</p>

                      <div className="flex justify-end mt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          className="transition-all duration-200 hover:scale-105 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-100 dark:hover:text-white dark:border-zinc-700"
                        >
                          <Link href={`/repos/${repo.githubRepoFullName}`}>
                            View Details & Bounties
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </>
          );
        })()}
      </div>
    </div>
  );
}