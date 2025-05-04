import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Heart, X, CheckCircle, Youtube, Twitter, MessageCircle, Send, AlertCircle, Loader2 } from 'lucide-react';
import { STAGING_API_URL } from '../config';
import csrfService from '../lib/csrf';
import { useLocation } from 'wouter';

// Define the social platform data
const SOCIAL_PLATFORMS = [
  {
    id: 'youtube',
    name: 'YouTube',
    icon: Youtube,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    url: 'https://www.youtube.com/@RoxonnOfficial',
    label: 'Subscribe'
  },
  {
    id: 'twitter',
    name: 'Twitter',
    icon: Twitter,
    color: 'text-blue-400',
    bgColor: 'bg-blue-400/10',
    borderColor: 'border-blue-400/30',
    url: 'https://x.com/RoxonnEcosystem',
    label: 'Follow'
  },
  {
    id: 'discord',
    name: 'Discord',
    icon: MessageCircle,
    color: 'text-indigo-500',
    bgColor: 'bg-indigo-500/10',
    borderColor: 'border-indigo-500/30',
    url: 'https://discord.gg/B6vbW6aaVH',
    label: 'Join'
  },
  {
    id: 'telegram',
    name: 'Telegram',
    icon: Send,
    color: 'text-sky-500',
    bgColor: 'bg-sky-500/10',
    borderColor: 'border-sky-500/30',
    url: 'https://t.me/roxonnofficial',
    label: 'Join'
  }
];

export function SocialRewardsBanner() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [dismissed, setDismissed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isClaimingReward, setIsClaimingReward] = useState(false);
  const [socialStatus, setSocialStatus] = useState({
    platforms: {
      youtube: false,
      twitter: false,
      discord: false,
      telegram: false
    },
    allClicked: false,
    rewardSent: false,
    transactionHash: null as string | null
  });

  // Calculate progress
  const clickedCount = Object.values(socialStatus.platforms).filter(Boolean).length;
  const progress = (clickedCount / 4) * 100;

  // Load social status on mount
  useEffect(() => {
    // Only load status if user is logged in
    if (!user) {
      setIsLoading(false);
      return;
    }

    // Check if banner was dismissed
    const localDismissed = localStorage.getItem('socialBanner_dismissed') === 'true';
    setDismissed(localDismissed);

    // Fetch status from API
    const fetchStatus = async () => {
      try {
        const response = await fetch(`${STAGING_API_URL}/api/social/status`, {
          credentials: 'include'
        });
        
        if (!response.ok) {
          throw new Error('Failed to load social status');
        }
        
        const data = await response.json();
        setSocialStatus({
          platforms: data.platforms,
          allClicked: data.allClicked,
          rewardSent: data.rewardSent,
          transactionHash: data.transactionHash
        });
      } catch (error) {
        console.error('Error fetching social status:', error);
        toast({
          title: 'Error',
          description: 'Failed to load social engagement status',
          variant: 'destructive'
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchStatus();
  }, [user, toast]);

  // Handle platform click
  const handlePlatformClick = async (platformId: string) => {
    // If user is not logged in, redirect to auth page
    if (!user) {
      navigate('/auth');
      return;
    }
    
    // Open the platform URL in a new tab
    const platform = SOCIAL_PLATFORMS.find(p => p.id === platformId);
    if (platform) {
      window.open(platform.url, '_blank', 'noopener,noreferrer');
    }

    try {
      // Get CSRF token
      const csrfToken = await csrfService.getToken();
      
      // Record click in the backend
      const response = await fetch(`${STAGING_API_URL}/api/social/click`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({ 
          platform: platformId,
          _csrf: csrfToken
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to record social engagement');
      }
      
      const data = await response.json();
      
      // Update local state
      setSocialStatus(prevState => ({
        ...prevState,
        platforms: data.platforms,
        allClicked: data.allClicked,
        rewardSent: data.rewardSent
      }));
      
      // Show toast for completed platforms
      if (data.allClicked && !socialStatus.allClicked) {
        toast({
          title: 'All platforms followed!',
          description: 'You can now claim your 1 XDC reward',
          variant: 'default'
        });
      }
    } catch (error) {
      console.error('Error recording social click:', error);
      toast({
        title: 'Error',
        description: 'Failed to record your social engagement',
        variant: 'destructive'
      });
    }
  };

  // Handle reward claim
  const handleClaimReward = async () => {
    // If user is not logged in, redirect to auth page
    if (!user) {
      navigate('/auth');
      return;
    }
    
    setIsClaimingReward(true);
    
    try {
      // Get CSRF token
      const csrfToken = await csrfService.getToken();
      
      // Call the claim API
      const response = await fetch(`${STAGING_API_URL}/api/social/claim-reward`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({ _csrf: csrfToken })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to claim reward');
      }
      
      const data = await response.json();
      
      // Update state with transaction hash
      setSocialStatus(prevState => ({
        ...prevState,
        rewardSent: true,
        transactionHash: data.transactionHash
      }));
      
      // Show success toast
      toast({
        title: 'Reward Claimed!',
        description: '1 XDC has been sent to your wallet',
        variant: 'default'
      });
    } catch (error) {
      console.error('Error claiming reward:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to claim your reward',
        variant: 'destructive'
      });
    } finally {
      setIsClaimingReward(false);
    }
  };

  // Handle banner click for non-logged-in users
  const handleBannerClick = () => {
    if (!user) {
      navigate('/auth');
    }
  };

  // Handle dismiss
  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering parent click handlers
    setDismissed(true);
    localStorage.setItem('socialBanner_dismissed', 'true');
  };

  // Don't show banner if dismissed or still loading for logged-in users
  if (dismissed || (user && isLoading)) {
    return null;
  }

  // Show the completed state if user has already claimed the reward
  if (user && socialStatus.rewardSent) {
    return (
      <Card className="w-full mb-6 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/30">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-center">
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span>Reward Claimed!</span>
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={handleDismiss}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription>
            Thanks for following Roxonn on social media! Your 1 XDC reward has been sent to your wallet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <a 
            href={`https://xdcscan.com/tx/${socialStatus.transactionHash}`} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs text-blue-500 hover:underline"
          >
            View transaction on XDC Explorer
          </a>
        </CardContent>
      </Card>
    );
  }

  // Card for both logged-in and non-logged-in users
  return (
    <Card 
      className={`w-full mb-6 bg-gradient-to-r from-violet-500/10 to-indigo-500/10 border-violet-500/30 ${!user ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      onClick={!user ? handleBannerClick : undefined}
    >
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <Heart className="h-5 w-5 text-red-500" />
            <span>Follow Roxonn & Earn 1 XDC</span>
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={handleDismiss}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription>
          {user 
            ? "Engage with the Roxonn community across all platforms to receive a 1 XDC reward."
            : "Sign in to engage with the Roxonn community and earn XDC rewards."
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {user ? (
          <>
            <div className="flex items-center gap-2">
              <Progress value={progress} className="h-2 flex-1" />
              <span className="text-xs text-muted-foreground">{clickedCount}/4</span>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {SOCIAL_PLATFORMS.map(platform => (
                <Button
                  key={platform.id}
                  variant="outline"
                  className={`flex flex-col h-auto py-3 ${
                    socialStatus.platforms[platform.id as keyof typeof socialStatus.platforms]
                      ? `${platform.bgColor} ${platform.borderColor}`
                      : ''
                  }`}
                  onClick={() => handlePlatformClick(platform.id)}
                >
                  <platform.icon className={`h-6 w-6 mb-1 ${platform.color}`} />
                  <span className="text-xs">{platform.label}</span>
                  <span className="text-sm font-medium">{platform.name}</span>
                  {socialStatus.platforms[platform.id as keyof typeof socialStatus.platforms] && (
                    <Badge variant="outline" className="mt-1 bg-green-500/10 text-green-500 border-green-500/30">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Done
                    </Badge>
                  )}
                </Button>
              ))}
            </div>
            
            {/* Info alert */}
            <div className="p-3 rounded-md bg-blue-500/10 border border-blue-500/30">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-blue-500 flex-shrink-0" />
                <div className="text-sm text-blue-500">
                  Click each button to open our official social channels in a new tab. After engaging with all platforms, claim your 1 XDC reward.
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Content for non-logged in users */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {SOCIAL_PLATFORMS.map(platform => (
                <div
                  key={platform.id}
                  className="flex flex-col items-center p-3 rounded-md bg-card border border-border/50"
                >
                  <platform.icon className={`h-6 w-6 mb-1 ${platform.color}`} />
                  <span className="text-sm font-medium">{platform.name}</span>
                </div>
              ))}
            </div>
            
            <div className="p-3 rounded-md bg-blue-500/10 border border-blue-500/30">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-blue-500 flex-shrink-0" />
                <div className="text-sm text-blue-500">
                  Sign in to follow our social channels and earn 1 XDC as a reward!
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
      <CardFooter>
        <Button 
          className="w-full"
          disabled={user ? (!socialStatus.allClicked || isClaimingReward) : false}
          onClick={user ? handleClaimReward : handleBannerClick}
        >
          {user ? (
            isClaimingReward ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                {socialStatus.allClicked ? 'Claim 1 XDC Reward' : 'Follow All Platforms First'}
              </>
            )
          ) : (
            'Sign In to Earn Rewards'
          )}
        </Button>
      </CardFooter>
    </Card>
  );
} 