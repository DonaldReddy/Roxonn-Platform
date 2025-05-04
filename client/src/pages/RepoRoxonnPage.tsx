import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { ethers } from 'ethers';
import { blockchainApi, Repository } from '@/lib/blockchain';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  GitBranch,
  GitFork,
  Star,
  Users,
  Award,
  Clock,
  Activity,
  Sparkles,
  ExternalLink,
  Link2,
  ShieldCheck,
  LockIcon,
  AlertCircle
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/use-auth';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';

// Define expected API response types with more specific details
interface Manager {
  id: string;
  username: string;
  avatarUrl: string;
  joinedAt: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'completed';
  reward: string;
  createdAt: string;
  assignee?: string;
  labels?: any[]; // Add optional labels property
}

interface Contributor {
  id: string;
  username: string;
  avatarUrl: string;
  totalRewards: string;
  contributionsCount: number;
}

interface Activity {
  id: string;
  type: 'task_created' | 'task_completed' | 'reward_sent' | 'manager_added';
  description: string;
  timestamp: string;
  actor: {
    username: string;
    avatarUrl: string;
  };
}

interface RoxonnRepoData {
  githubRepoId: string;
  githubRepoFullName: string;
  registeredAt: string | null;
  poolBalance: string;
  totalFunded: string;
  totalRewarded: string;
  managers: Manager[];
  tasks: Task[];
  contributors: Contributor[];
  recentActivity: Activity[];
}

interface GitHubInfo {
  name: string;
  owner: string;
  description: string;
  stars: number;
  forks: number;
  watchers: number;
  openIssues: number;
  language: string;
  lastUpdated: string;
  topics: string[];
  avatarUrl: string;
}

interface RepoDetailsResponse {
  status: 'managed' | 'not_managed';
  data?: RoxonnRepoData;
  github_info?: GitHubInfo | null;
}

const fetchRepoDetails = async (owner: string, repo: string): Promise<RepoDetailsResponse> => {
  try {
    // Make the actual API call
    const response = await axios.get(`/api/repos/details`, { params: { owner, repo } });
    return response.data;
  } catch (error) {
    console.error('Error fetching repo details:', error);
    throw error;
  }
};

// Function to fetch blockchain data for a repository
const fetchBlockchainData = async (repoId: string) => {
  try {
    if (!repoId) return null;
    
    const numberId = parseInt(repoId);
    if (isNaN(numberId)) return null;
    
    let result: { repo: Repository | null; funding: any | null } = { 
      repo: null, 
      funding: null 
    };
    
    // Fetch repository blockchain data - this might work without auth
    try {
      const repoData = await blockchainApi.getRepository(numberId);
      result.repo = repoData;
    } catch (repoError) {
      console.error('Error fetching repository data:', repoError);
      // Continue with other API call even if this one fails
    }

    // Fetch funding status - this requires authentication
    try {
      const fundingStatus = await blockchainApi.getRepositoryFundingStatus(numberId);
      result.funding = fundingStatus;
    } catch (fundingError) {
      console.error('Error fetching funding status:', fundingError);
      // This is likely to fail for unauthenticated users (401)
    }
    
    // Return whatever data we were able to fetch
    return result;
  } catch (error) {
    console.error('Error in fetchBlockchainData:', error);
    return null;
  }
};

// Function to fetch GitHub issues with bounty labels
const fetchGitHubIssuesWithBounties = async (owner: string, repo: string) => {
  try {
    const response = await axios.get(`/api/github/issues`, {
      params: { owner, repo, labels: 'bounty,rewards,funded' }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching GitHub issues with bounties:', error);
    return [];
  }
};

// Define props type for wouter parameters
interface RepoRoxonnPageProps {
  params: {
    owner: string;
    repo: string;
  };
}

export function RepoRoxonnPage({ params }: RepoRoxonnPageProps) {
  // Animation states
  const [statProgress, setStatProgress] = useState(0);
  const { user } = useAuth();
  const { toast } = useToast();
  const [showRewardsGuide, setShowRewardsGuide] = useState(true);
  
  // Log params on component mount/update
  useEffect(() => {
    console.log('[RepoRoxonnPage] Params received:', params);
    
    // Trigger animations after component mounts
    const timer = setTimeout(() => setStatProgress(100), 500);
    return () => clearTimeout(timer);
  }, [params]);

  // Use optional chaining for safer access
  const owner = params?.owner;
  const repo = params?.repo;

  // Handle missing parameters
  if (!owner || !repo) {
    console.error("Route parameters owner/repo not available.", { params });
    return (
      <div className="container mx-auto p-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Repository Not Found</CardTitle>
              <CardDescription>No data available for {params?.owner}/{params?.repo}</CardDescription>
            </CardHeader>
            <CardContent>
              <Alert variant="default" className="mb-4">
                <AlertTitle>No Data Available</AlertTitle>
                <AlertDescription>
                  We couldn't find any details for this repository. It may not exist or there might be an issue with our service.
                </AlertDescription>
              </Alert>
            </CardContent>
            <CardFooter className="bg-card/50 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.href = `https://github.com/${params?.owner}/${params?.repo}`}
              >
                <GitBranch className="h-4 w-4 mr-2" />
                View on GitHub
              </Button>
            </CardFooter>
          </Card>
        </motion.div>
      </div>
    );
  }

  const repoFullName = `${owner}/${repo}`;
  // GitHub URL for reference
  const githubUrl = `https://github.com/${repoFullName}`;
  const roxonnUrl = `https://roxonn.com/${repoFullName}`;

  // Handle contribute button click
  const handleContribute = (taskId: string) => {
    if (!user) {
      // Store task ID in session storage for after auth
      sessionStorage.setItem('pendingContribution', taskId);
      
      // Redirect to auth with return URL to this page
      const currentUrl = window.location.pathname;
      const returnUrl = encodeURIComponent(currentUrl);
      window.location.href = `/auth?returnTo=${returnUrl}`;
      return;
    }
    
    // If user is logged in, show a toast message
    toast({
      title: "Contribution Started",
      description: "You're now contributing to this issue. Check your dashboard for details.",
    });
    
    // In a real implementation, you would redirect to a contribution page
    // or open a modal with more details
  };

  const { data: repoDetails, isLoading, error } = useQuery<RepoDetailsResponse, Error>({
    queryKey: ['repoDetails', owner, repo],
    queryFn: () => fetchRepoDetails(owner, repo),
    retry: false, // Don't retry on error for now
  });
  
  // Additional query for blockchain data, enabled only when we have the githubRepoId
  const { 
    data: blockchainData, 
    isLoading: isBlockchainLoading,
    error: blockchainError 
  } = useQuery({
    queryKey: ['repository-blockchain', repoDetails?.data?.githubRepoId],
    queryFn: () => fetchBlockchainData(repoDetails?.data?.githubRepoId || ''),
    enabled: !!repoDetails?.data?.githubRepoId,
    // Only refetch when the window gains focus if 5 minutes have passed
    refetchOnWindowFocus: (query) => {
      const lastFetch = query.state.dataUpdatedAt;
      return Date.now() - lastFetch > 5 * 60 * 1000;
    },
  });
  
  // Query for GitHub issues with bounty labels as a fallback
  const { data: githubIssues } = useQuery({
    queryKey: ['github-issues-bounties', owner, repo],
    queryFn: () => fetchGitHubIssuesWithBounties(owner, repo),
    enabled: !!(owner && repo && (!repoDetails?.data?.tasks || repoDetails.data.tasks.length === 0)),
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center justify-center py-12"
        >
          <div className="relative w-16 h-16 mb-4">
            <div className="absolute inset-0 rounded-full border-4 border-primary/30 border-t-primary animate-spin"></div>
          </div>
          <h3 className="text-xl font-medium text-primary mb-2">Loading Repository</h3>
          <p className="text-muted-foreground">
            Fetching details for <span className="font-mono bg-muted px-1.5 py-0.5 rounded">{repoFullName}</span>
          </p>
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="border-destructive/50">
            <CardHeader className="bg-destructive/5">
              <CardTitle className="text-destructive flex items-center gap-2">
                <span className="i-lucide-alert-circle h-5 w-5" />
                Error Loading Repository
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <Alert variant="destructive" className="mb-4">
                <AlertTitle>Failed to fetch repository data</AlertTitle>
                <AlertDescription className="mt-2">
                  {error.message || 'Could not fetch repository details. Please try again later.'}
                </AlertDescription>
              </Alert>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Link2 className="h-4 w-4" />
                <span>Repository: <span className="font-mono">{repoFullName}</span></span>
              </div>
            </CardContent>
            <CardFooter className="bg-card/50 border-t">
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.location.reload()}
                >
                  Try Again
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.location.href = githubUrl}
                >
                  View on GitHub
                </Button>
              </div>
            </CardFooter>
          </Card>
        </motion.div>
      </div>
    );
  }

  if (!repoDetails) {
    return (
      <div className="container mx-auto p-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Repository Not Found</CardTitle>
              <CardDescription>No data available for {repoFullName}</CardDescription>
            </CardHeader>
            <CardContent>
              <Alert variant="default" className="mb-4">
                <AlertTitle>No Data Available</AlertTitle>
                <AlertDescription>
                  We couldn't find any details for this repository. It may not exist or there might be an issue with our service.
                </AlertDescription>
              </Alert>
            </CardContent>
            <CardFooter className="bg-card/50 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.href = githubUrl}
              >
                <GitBranch className="h-4 w-4 mr-2" />
                View on GitHub
              </Button>
            </CardFooter>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {repoDetails.status === 'managed' && repoDetails?.data ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-8"
        >
          {/* Repository Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 px-3 py-1 rounded-full">
                <Sparkles className="w-3.5 h-3.5 mr-1" />
                Roxonn Powered
              </Badge>
              <a href={githubUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-1">
                <GitBranch className="h-3.5 w-3.5" /> {repoDetails?.data?.githubRepoFullName || repoFullName}
              </a>
            </div>
            <h1 className="text-2xl font-bold">{repoDetails?.github_info?.name || repo}</h1>
            <p className="text-muted-foreground mt-1">{repoDetails?.github_info?.description || "No description available"}</p>
            <div className="flex mt-3 gap-3">
              <Button variant="outline" size="sm" onClick={() => window.location.href = githubUrl}>
                <GitBranch className="h-4 w-4 mr-2" />
                View on GitHub
              </Button>
            </div>
          </div>

          {/* Rewards Guide */}
          {showRewardsGuide && (
            <Card className="mb-6 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-400">
                  <Award className="h-5 w-5" /> Rewards Guide
                </CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 w-8 p-0" 
                  onClick={() => setShowRewardsGuide(false)}
                >
                  <span className="sr-only">Close</span>
                  <AlertCircle className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-amber-800 dark:text-amber-400">
                  Issues with reward amounts show how much you'll earn for solving them. The more challenging the issue, the higher the reward!
                </p>
              </CardContent>
            </Card>
          )}

          {/* Bounty Issues Table */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <CardTitle>Open Bounties</CardTitle>
                <Badge variant="outline" className="px-3 py-1 rounded-full">
                  {repoDetails?.data?.tasks?.length || githubIssues?.length || 0} Available
                </Badge>
              </div>
              <CardDescription>
                Contribute to these issues and earn XDC rewards
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Labels</TableHead>
                    <TableHead className="text-right">Reward</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {repoDetails?.data?.tasks && Array.isArray(repoDetails.data.tasks) && repoDetails.data.tasks.length > 0 ? (
                    repoDetails.data.tasks.map((task) => {
                      // Find task reward in blockchain data if available
                      const taskReward = blockchainData?.repo?.issues?.find(
                        (issue: {issueId: string; rewardAmount: string; status: string}) => 
                          issue.issueId === task.id.toString()
                      );
                      
                      const rewardAmount = taskReward?.rewardAmount
                        ? parseFloat(ethers.formatEther(taskReward.rewardAmount)).toFixed(2)
                        : task.reward;
                        
                      return (
                        <TableRow key={task.id}>
                          <TableCell className="font-medium">{task.title}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {Array.isArray(task.labels) && task.labels.map((label: any) => (
                                <Badge 
                                  key={label.id} 
                                  variant="secondary" 
                                  style={{
                                    backgroundColor: `#${label.color}20`,
                                    color: `#${label.color}`,
                                    borderColor: `#${label.color}40`
                                  }}
                                >
                                  {label.name}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            {parseFloat(rewardAmount) > 0 ? (
                              <Badge className="bg-primary/10 text-primary px-2 py-1">
                                {rewardAmount} XDC
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">0.0 XDC</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => window.open(`https://github.com/${repoFullName}/issues/${task.id}`, '_blank')}
                              >
                                View Issue
                              </Button>
                              <Button 
                                size="sm"
                                onClick={() => handleContribute(task.id)}
                              >
                                Contribute
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : githubIssues && githubIssues.length > 0 ? (
                    // Fallback to GitHub issues with bounty labels
                    Array.isArray(githubIssues) && githubIssues.map((issue: any) => (
                      <TableRow key={issue.id}>
                        <TableCell className="font-medium">{issue.title}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {Array.isArray(issue.labels) && issue.labels.map((label: any) => (
                              <Badge 
                                key={label.id} 
                                variant="secondary" 
                                style={{
                                  backgroundColor: `#${label.color}20`,
                                  color: `#${label.color}`,
                                  borderColor: `#${label.color}40`
                                }}
                              >
                                {label.name}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/30">
                            Bounty Available
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => window.open(issue.html_url, '_blank')}
                            >
                              View Issue
                            </Button>
                            <Button 
                              size="sm"
                              onClick={() => handleContribute(issue.id.toString())}
                            >
                              Contribute
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-10">
                        <div className="flex flex-col items-center">
                          <Clock className="h-12 w-12 text-muted-foreground/50 mb-4" />
                          <h3 className="text-lg font-medium mb-1">No Open Bounties</h3>
                          <p className="text-sm text-muted-foreground">
                            There are no bounty tasks available for this repository yet.
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Stats Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                {/* Stat Card 1: Total Funded */}
                <motion.div 
                  className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl p-6 border border-primary/20"
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.4 }}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Award className="h-5 w-5 text-primary" />
                    </div>
                    <Badge variant="outline" className="bg-primary/5 text-primary border-primary/30">XDC</Badge>
                  </div>
                  <h3 className="text-3xl font-bold">
                    {blockchainData?.repo?.poolRewards 
                      ? parseFloat(ethers.formatEther(blockchainData.repo.poolRewards)).toFixed(2)
                      : repoDetails?.data.totalFunded || '0'}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">Total Funded</p>
                  <Progress className="h-1.5 mt-4" value={statProgress} />
                </motion.div>

                {/* Stat Card 2: Available Rewards */}
                <motion.div 
                  className="bg-gradient-to-br from-green-500/5 to-green-500/10 rounded-xl p-6 border border-green-600/20"
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2, duration: 0.4 }}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-green-500/10 rounded-lg">
                      <Award className="h-5 w-5 text-green-600 dark:text-green-500" />
                    </div>
                    <Badge variant="outline" className="bg-green-500/5 text-green-600 dark:text-green-500 border-green-600/30">XDC</Badge>
                  </div>
                  <h3 className="text-3xl font-bold text-green-700 dark:text-green-500">
                    {blockchainData?.repo?.poolRewards 
                      ? parseFloat(ethers.formatEther(blockchainData.repo.poolRewards)).toFixed(2)
                      : repoDetails?.data.poolBalance || '0'}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">Available Rewards</p>
                  <Progress className="h-1.5 mt-4 bg-green-100 dark:bg-green-950" value={statProgress} />
                </motion.div>

                {/* Stat Card 3: Contributors Rewarded */}
                <motion.div 
                  className="bg-gradient-to-br from-blue-500/5 to-blue-500/10 rounded-xl p-6 border border-blue-500/20"
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.3, duration: 0.4 }}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                      <Users className="h-5 w-5 text-blue-600 dark:text-blue-500" />
                    </div>
                    <Badge variant="outline" className="bg-blue-500/5 text-blue-600 dark:text-blue-500 border-blue-500/30">Contributors</Badge>
                  </div>
                  <h3 className="text-3xl font-bold text-blue-700 dark:text-blue-500">
                    {blockchainData?.repo?.contributors?.length || repoDetails?.data.contributors?.length || '0'}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">Total Contributors</p>
                  <Progress className="h-1.5 mt-4 bg-blue-100 dark:bg-blue-950" value={statProgress} />
                </motion.div>
              </div>
              
              {/* Login Prompt for Unauthenticated Users */}
              {!user && blockchainData?.repo && !blockchainData?.funding && (
                <Alert className="mt-6 bg-primary/5 border-primary/20">
                  <div className="flex items-center gap-2">
                    <LockIcon className="h-4 w-4 text-primary" />
                    <AlertTitle className="text-sm font-medium">Additional Funding Data Available</AlertTitle>
                  </div>
                  <AlertDescription className="mt-1 text-sm">
                    Sign in to view complete blockchain funding status and transaction details.
                  </AlertDescription>
                  <div className="mt-3">
                    <Button variant="outline" size="sm" onClick={() => window.location.href = '/auth'}>
                      Sign In
                    </Button>
                  </div>
                </Alert>
              )}

          {/* Tabs for Activity and Contributors */}
          <Tabs defaultValue="activity" className="w-full mt-6">
            <TabsList className="grid w-full grid-cols-2 mb-8">
              <TabsTrigger value="activity" className="text-center">
                <Activity className="h-4 w-4 mr-2" />
                Recent Activity
              </TabsTrigger>
              <TabsTrigger value="contributors" className="text-center">
                <Users className="h-4 w-4 mr-2" />
                Contributors
              </TabsTrigger>
            </TabsList>
            {/* Recent Activity Tab */}
            <TabsContent value="activity" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Recent Activity</CardTitle>
                  <CardDescription>Latest actions and events for this repository</CardDescription>
                </CardHeader>
                <CardContent>
                  {repoDetails?.data?.recentActivity?.length > 0 ? (
                    <div className="space-y-4">
                      {repoDetails?.data?.recentActivity.map((activity) => (
                        <div key={activity.id} className="flex items-start gap-4 p-3 border rounded-lg bg-card hover:bg-accent/5 transition-colors">
                          <Avatar className="h-9 w-9 border">
                            <AvatarImage src={activity.actor.avatarUrl} alt={activity.actor.username} />
                            <AvatarFallback>{activity.actor.username.substring(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium">{activity.actor.username}</span>
                              <Badge variant="outline" className="text-xs">
                                {activity.type.replace('_', ' ')}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{activity.description}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(activity.timestamp).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Activity className="h-12 w-12 text-muted-foreground/50 mb-4" />
                      <h3 className="text-lg font-medium mb-1">No Recent Activity</h3>
                      <p className="text-sm text-muted-foreground">
                        There hasn't been any activity for this repository yet.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Contributors Tab */}
            <TabsContent value="contributors" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Contributors</CardTitle>
                  <CardDescription>People who have contributed to this repository</CardDescription>
                </CardHeader>
                <CardContent>
                  {repoDetails?.data?.contributors?.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {repoDetails?.data?.contributors.map((contributor) => {
                        // Check if contributor exists in blockchain data
                        const isVerified = blockchainData?.repo?.contributors?.includes(contributor.id);
                        
                        return (
                          <div key={contributor.id} className="flex items-center gap-3 p-3 border rounded-lg">
                            <Avatar className="h-10 w-10 border">
                              <AvatarImage src={contributor.avatarUrl} alt={contributor.username} />
                              <AvatarFallback>{contributor.username.substring(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{contributor.username}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs bg-primary/5 text-primary">
                                  {contributor.totalRewards} XDC earned
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {contributor.contributionsCount} contributions
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
                      <h3 className="text-lg font-medium mb-1">No Contributors Yet</h3>
                      <p className="text-sm text-muted-foreground">
                        Be the first to contribute to this repository!
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            

          </Tabs>
          
          {/* Footer with GitHub Link */}
          <div className="flex justify-center mt-8">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.href = githubUrl}
              className="gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              View Full Details on GitHub
            </Button>
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-8"
        >
          {/* Repository Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold">{repoDetails?.github_info?.name || repo}</h1>
            <p className="text-muted-foreground mt-1">{repoDetails?.github_info?.description || "No description available"}</p>
            <div className="flex mt-3 gap-3">
              <Button variant="outline" size="sm" onClick={() => window.location.href = githubUrl}>
                <GitBranch className="h-4 w-4 mr-2" />
                View on GitHub
              </Button>
            </div>
          </div>

          {/* GitHub Issues with Bounty Labels */}
          {githubIssues && githubIssues.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Issues Marked for Bounties</CardTitle>
                <CardDescription>
                  These issues are marked with bounty-related labels on GitHub
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Labels</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.isArray(githubIssues) && githubIssues.map((issue: any) => (
                      <TableRow key={issue.id}>
                        <TableCell className="font-medium">{issue.title}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {Array.isArray(issue.labels) && issue.labels.map((label: any) => (
                              <Badge 
                                key={label.id} 
                                variant="secondary" 
                                style={{
                                  backgroundColor: `#${label.color}20`,
                                  color: `#${label.color}`,
                                  borderColor: `#${label.color}40`
                                }}
                              >
                                {label.name}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => window.open(issue.html_url, '_blank')}
                            >
                              View on GitHub
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
              <CardFooter className="bg-card/50 border-t">
                <div className="text-sm text-muted-foreground">
                  <p>This repository is not yet managed on Roxonn. Register it to enable XDC rewards for contributors.</p>
                </div>
              </CardFooter>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Not Yet on Roxonn</CardTitle>
                <CardDescription>
                  This repository is not currently managed on the Roxonn platform
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert variant="default" className="mb-6 bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <AlertTitle className="font-medium">Add to Roxonn</AlertTitle>
                  <AlertDescription>
                    Add this repository to start funding and rewarding contributors!
                  </AlertDescription>
                </Alert>
                
                <div className="space-y-6">
                  <div className="bg-card/50 p-5 rounded-lg border">
                    <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
                      <Award className="h-5 w-5 text-primary" />
                      Why Add This Repository?
                    </h3>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <span className="i-lucide-check h-4 w-4 text-green-500 mt-0.5" />
                        <span>Incentivize contributors with XDC tokens</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="i-lucide-check h-4 w-4 text-green-500 mt-0.5" />
                        <span>Set bounties for specific issues and feature requests</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="i-lucide-check h-4 w-4 text-green-500 mt-0.5" />
                        <span>Build a community of motivated developers</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="i-lucide-check h-4 w-4 text-green-500 mt-0.5" />
                        <span>Track contributions and distribute rewards automatically</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="bg-card/50 border-t py-4">
                <Button variant="outline" onClick={() => window.location.href = githubUrl} className="gap-2">
                  <GitBranch className="h-4 w-4" />
                  View on GitHub
                </Button>
              </CardFooter>
            </Card>
          )}
        </motion.div>
      )}
    </div>
  );
}

// Export the component for routing
export default RepoRoxonnPage;
