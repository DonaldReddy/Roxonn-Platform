import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { ExternalLink, GitPullRequest, GitBranch, Star, GitFork, AlertCircle, Loader2, ChevronLeft, Shield, ShieldCheck, ShieldAlert } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RepoRewards } from "@/components/repo-rewards";
import { useState, useEffect } from "react";
import { SetRewardModal } from "@/components/set-reward-modal";
import { blockchainApi } from "@/lib/blockchain";
import { ethers } from "ethers";
import { STAGING_API_URL } from '../config';
import { RepoDetailsGuide } from "@/components/welcome-guide";

interface Repository {
  id: number;
  name: string;
  description: string;
  html_url: string;
  updated_at: string;
  open_issues_count: number;
  full_name: string;
  permissions?: {
    admin: boolean;
    push: boolean;
    pull: boolean;
  };
}

interface Label {
  name: string;
  color: string;
}

interface Issue {
  id: number;
  title: string;
  body: string;
  state: string;
  html_url: string;
  labels: Label[];
  user: {
    login: string;
    avatar_url: string;
  };
  created_at: string;
  updated_at: string;
}

interface PullRequest {
  id: number;
  title: string;
  user: {
    login: string;
    avatar_url: string;
  };
  created_at: string;
  state: string;
  html_url: string;
}

interface RepoDetailsResponse {
  repo: Repository;
  issues: Issue[];
  pullRequests: PullRequest[];
}

interface IssueReward {
  issueId: string;
  rewardAmount: string;
  rewardInEther: string;
}

export default function RepoDetailsPage() {
  const [, params] = useRoute("/repos/:owner/:name");
  const { user } = useAuth();
  const { toast } = useToast();
  const isPoolManager = user?.role === "poolmanager";
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);

  // Track if the user has admin permissions for this repository
  const [hasAdminPermission, setHasAdminPermission] = useState<boolean | null>(null);
  const repoFullName = params?.owner && params?.name ? `${params.owner}/${params.name}` : '';
  
  const { data, isLoading, error } = useQuery({
    queryKey: ["repo-details", params?.owner, params?.name],
    queryFn: async () => {
      if (!params?.owner || !params?.name) {
        throw new Error("Repository owner and name are required");
      }

      const response = await fetch(
        `${STAGING_API_URL}/api/github/repos/${params.owner}/${params.name}`,
        {
          credentials: 'include'
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch repository details");
      }

      const fetchedData = await response.json();
      return fetchedData as RepoDetailsResponse;
    },
    enabled: !!params?.owner && !!params?.name,
    retry: false
  });
  
  // Declare repoId *after* data is defined
  const repoId = data?.repo?.id;

  // Check if user has admin permission when data loads
  useEffect(() => {
    if (data?.repo?.permissions) {
      setHasAdminPermission(data.repo.permissions.admin);
    }
  }, [data]);

  // Query for repository rewards (uses repoId declared above)
  const { data: repoData, refetch: refetchRepo } = useQuery({
    queryKey: ["repository-rewards", repoId],
    queryFn: async () => {
      if (!repoId) return null;
      const result = await blockchainApi.getRepository(repoId);

      // Fetch individual issue rewards
      if (!data?.issues) return { ...result, issues: [] };
      const issueRewards = await Promise.all(
        data.issues
          .filter(issue => issue.state === 'open' && !issue.html_url.includes('/pull/'))
          .map(async (issue) => {
            const reward = await blockchainApi.getIssueReward(repoId, issue.id);
            const rewardInEther = ethers.formatEther(reward.reward);
            return {
              issueId: issue.id.toString(),
              rewardAmount: reward.reward,
              rewardInEther
            };
          })
      );

      return {
        ...result,
        issues: issueRewards.filter(reward => parseFloat(reward.rewardInEther) > 0)
      };
    },
    enabled: !!repoId
  });

  const handleContribute = async (issueId: number) => {
    if (!user) {
      // Redirect to GitHub auth with return URL
      const currentUrl = window.location.pathname;
      const normalizedReturnTo = currentUrl.startsWith('/') ? currentUrl : `/${currentUrl}`;
      const returnUrl = encodeURIComponent(normalizedReturnTo);
      
      window.location.href = `${STAGING_API_URL}/api/auth/github?returnTo=${returnUrl}`;
      return;
    }

    try {
      // 1. Check if user is already registered as pool manager or contributor
      const roleResponse = await fetch(`${STAGING_API_URL}/api/user/role`, {
        credentials: 'include'
      });
      const { role } = await roleResponse.json();

      if (!role) {
        // 2. If not registered, prompt for role selection and register
        toast({
          title: "Role Selection Required",
          description: "Please select your role as Pool Manager or Contributor",
          action: (
            <div className="flex gap-2">
              <Button 
                onClick={() => window.location.href = `/register/pool-manager?issueId=${issueId}`}
                variant="default"
              >
                Pool Manager
              </Button>
              <Button 
                onClick={() => window.location.href = `/register/contributor?issueId=${issueId}`}
                variant="outline"
              >
                Contributor
              </Button>
            </div>
          )
        });
        return;
      }

      // 3. Create or get wallet
      const walletResponse = await fetch(`${STAGING_API_URL}/api/wallet`, {
        method: 'POST',
        credentials: 'include'
      });
      const { address } = await walletResponse.json();

      // 4. Register with smart contract
      const contractResponse = await fetch(`${STAGING_API_URL}/api/blockchain/register`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          role,
          walletAddress: address,
          issueId
        })
      });

      if (!contractResponse.ok) {
        throw new Error('Failed to register with smart contract');
      }

      toast({
        title: "Success!",
        description: "You're now registered to contribute to this issue.",
      });

    } catch (error) {
      console.error('Contribution error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process contribution",
        variant: "destructive"
      });
    }
  };

  const handleSetReward = (issue: Issue) => {
    setSelectedIssue(issue);
  };

  const handleModalClose = () => {
    setSelectedIssue(null);
  };

  const handleRewardSuccess = () => {
    refetchRepo();
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="glass-card flex items-center gap-2 px-4 py-2">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span>Loading repository details...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="glass-card flex items-center gap-2 px-4 py-2 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <span>
            {error instanceof Error ? error.message : "Failed to load repository"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <Card className="glass-card overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border/40 bg-background/50">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                asChild
                className="mr-2 hover:bg-accent/50"
              >
                <Link href="/repos" className="flex items-center">
                  <ChevronLeft className="h-5 w-5" />
                </Link>
              </Button>
              <GitBranch className="h-5 w-5 text-primary" />
              <CardTitle>{data.repo.name}</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">{data.repo.description}</p>
          </div>
          <Button variant="glass" asChild>
            <a href={data.repo.html_url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              View on GitHub
            </a>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Tabs defaultValue="issues" className="w-full">
            <div className="border-b border-border/40 bg-background/50 px-4">
              <TabsList className="glass-card my-2">
                <TabsTrigger value="issues" className="data-[state=active]:glass-hover">
                  <GitPullRequest className="mr-2 h-4 w-4" />
                  Issues
                </TabsTrigger>
                <TabsTrigger value="pull-requests" className="data-[state=active]:glass-hover">
                  <GitFork className="mr-2 h-4 w-4" />
                  Pull Requests
                </TabsTrigger>
                <TabsTrigger value="rewards" className="data-[state=active]:glass-hover">
                  <Star className="mr-2 h-4 w-4" />
                  Rewards
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="issues" className="p-4">
              {/* Rewards Guide */}
              <RepoDetailsGuide />
              
              <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/40 hover:bg-accent/5">
                        <TableHead>Title</TableHead>
                        <TableHead>Issue #</TableHead>
                        <TableHead>Labels</TableHead>
                        <TableHead>Reward</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.issues
                        .filter(issue => issue.state === 'open' && !issue.html_url.includes('/pull/'))
                        .map((issue) => {
                          const issueNumber = issue.html_url.split('/').pop() || '';
                          const issueReward = repoData?.issues.find((i: IssueReward) => 
                            i.issueId === issue.id.toString()
                          );

                          return (
                            <TableRow key={issue.id} className="border-border/40 transition-colors hover:bg-accent/5">
                              <TableCell>
                                <a
                                  href={issue.html_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 font-medium text-primary hover:text-primary/80"
                                >
                                  <GitPullRequest className="h-4 w-4" />
                                  {issue.title}
                                </a>
                              </TableCell>
                              <TableCell className="font-mono text-sm">#{issueNumber}</TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  {issue.labels.map((label: any) => (
                                    <Badge
                                      key={label.id}
                                      className="glass-card px-2 py-0.5 text-xs"
                                      style={{
                                        backgroundColor: `${label.color}15`,
                                        color: `#${label.color}`,
                                        borderColor: `#${label.color}30`
                                      }}
                                    >
                                      {label.name}
                                    </Badge>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1 text-sm text-primary">
                                  <Star className="h-4 w-4" />
                                  <span>{ethers.formatEther(issueReward?.rewardAmount || '0')} XDC</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="glass"
                                    size="sm"
                                    asChild
                                  >
                                    <a
                                      href={issue.html_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      View Issue
                                    </a>
                                  </Button>
                                  {isPoolManager && (
                                    <Button
                                      variant="glass-secondary"
                                      size="sm"
                                      onClick={() => handleSetReward(issue)}
                                    >
                                      Set Reward
                                    </Button>
                                  )}
                                  {!isPoolManager && user?.role !== 'contributor' && (
                                    <Button
                                      variant="glass-primary"
                                      size="sm"
                                      onClick={() => handleContribute(issue.id)}
                                    >
                                      Contribute
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="pull-requests" className="p-4">
              <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/40 hover:bg-accent/5">
                        <TableHead>Title</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.pullRequests.map((pr) => (
                        <TableRow key={pr.id} className="border-border/40 transition-colors hover:bg-accent/5">
                          <TableCell>
                            <a
                              href={pr.html_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 font-medium text-primary hover:text-primary/80"
                            >
                              <GitFork className="h-4 w-4" />
                              {pr.title}
                            </a>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(pr.created_at))} ago
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="rewards" className="p-4">
              <div className="glass-card">
                {/* Permission status card */}
                <CardHeader className="pb-0">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Repository Funding</CardTitle>
                    {hasAdminPermission !== null && (
                      <Badge variant="outline" className={`flex items-center gap-1 ${
                        hasAdminPermission 
                          ? 'bg-green-500/10 text-green-600 border-green-200 dark:border-green-900' 
                          : 'bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-900'
                      }`}>
                        {hasAdminPermission ? (
                          <>
                            <ShieldCheck className="h-3 w-3" />
                            <span>Admin Access</span>
                          </>
                        ) : (
                          <>
                            <ShieldAlert className="h-3 w-3" />
                            <span>No Admin Access</span>
                          </>
                        )}
                      </Badge>
                    )}
                  </div>
                  <CardDescription>
                    {hasAdminPermission 
                      ? 'You have admin permissions for this repository and can add funds.' 
                      : 'You need admin permissions to fund this repository.'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-2">
                  <RepoRewards
                    repoId={data.repo.id}
                    issueId={undefined}
                    isPoolManager={isPoolManager}
                    repositoryFullName={repoFullName}
                  />
                </CardContent>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {selectedIssue && (
        <SetRewardModal
          isOpen={!!selectedIssue}
          onClose={handleModalClose}
          issue={selectedIssue}
          repoId={data.repo.id}
          currentPool={repoData?.poolRewards || '0'}
          onSuccess={handleRewardSuccess}
          githubRepoFullName={repoFullName}
          issueUrl={selectedIssue.html_url}
        />
      )}
    </div>
  );
}

async function handleIssueReward(issueId: number) {
  // This will be implemented in the next step
}