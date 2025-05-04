import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2, Github, Wallet, UserCircle2, Mail } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { STAGING_API_URL } from "../config";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form";
import { SocialRewardsBanner } from "@/components/social-rewards-banner";

type UserRole = "contributor" | "poolmanager";

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { user, loading } = useAuth();
  const [role, setRole] = useState<UserRole>("contributor");
  const [isRegistering, setIsRegistering] = useState(false);
  const { toast } = useToast();

  const returnTo = new URLSearchParams(window.location.search).get("returnTo") || "/repos";
  const isRegistration = new URLSearchParams(window.location.search).get("registration") === "true";

  useEffect(() => {
    if (user?.isProfileComplete && !isRegistration) {
      setLocation(returnTo);
    }
  }, [user, setLocation, returnTo, isRegistration]);

  const handleRegister = async () => {
    setIsRegistering(true);
    try {
      const response = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ 
          role,
          email: user?.email  // Use email from GitHub directly
        }),
      });

      if (response.success) {
        window.location.href = returnTo;
      }
    } catch (error: any) {
      console.error("Registration error:", error);
      
      // Display toast notification for registration errors
      let errorMessage = "There was an error during registration. Please try again later.";
      
      // Try to extract detailed error message from the error object
      if (error.message) {
        // The error message might contain the actual server error response
        if (error.message.includes("User already has a wallet")) {
          errorMessage = "User already has a wallet address registered.";
          
          toast({
            title: "Registration Error",
            description: errorMessage,
            variant: "destructive",
          });
        } else if (error.message.includes("Failed to register on blockchain")) {
          errorMessage = "Failed to register on the blockchain. Please try again.";
          
          toast({
            title: "Blockchain Registration Error",
            description: errorMessage,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Registration Failed",
            description: errorMessage,
            variant: "destructive",
          });
        }
      } else {
        // Generic error
        toast({
          title: "Registration Failed",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } finally {
      setIsRegistering(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="glass-card flex items-center gap-2 px-4 py-2 animate-pulse">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container relative mx-auto max-w-lg py-12">
      {/* Animated background gradients */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[400px] w-[400px] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl animate-pulse" />
        <div className="absolute right-0 bottom-0 h-64 w-64 rounded-full bg-secondary/5 blur-2xl animate-pulse delay-700" />
      </div>

      <Card className="overflow-hidden backdrop-blur-xl border-border/50 shadow-lg transition-all duration-300 hover:shadow-xl">
        <CardHeader className="border-b border-border/40 bg-background/50 p-6">
          <div className="flex items-center gap-3">
            <Github className="h-6 w-6 text-primary animate-in fade-in slide-in-from-left-1" />
            <CardTitle className="animate-in fade-in slide-in-from-right-1">Roxonn</CardTitle>
          </div>
          <CardDescription className="animate-in fade-in slide-in-from-bottom-1">
            {!user
              ? "Connect your GitHub account to get started"
              : !user.isProfileComplete
              ? "Choose your role to complete registration"
              : "You're all set!"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          {!user ? (
            <Button
              variant="default"
              size="lg"
              className="w-full bg-primary/90 hover:bg-primary transition-all duration-200 hover:scale-[1.02] animate-in fade-in-50 slide-in-from-bottom-2"
              onClick={() => {
                const normalizedReturnTo = returnTo.startsWith('/') ? returnTo : `/${returnTo}`;
                const returnUrl = encodeURIComponent(normalizedReturnTo);
                
                const authUrl = `${STAGING_API_URL}/api/auth/github?returnTo=${returnUrl}`;
                console.log('GitHub auth URL:', authUrl);
                
                window.location.href = authUrl;
              }}
            >
              <Github className="mr-2 h-5 w-5" />
              Sign in with GitHub
            </Button>
          ) : !user.isProfileComplete ? (
            <div className="space-y-6 animate-in fade-in-50 slide-in-from-bottom-3">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <img
                    src={user.avatarUrl || ""}
                    alt={user.name || "User"}
                    className="h-12 w-12 rounded-full ring-2 ring-border/50 transition-all duration-200 hover:ring-primary"
                  />
                  <div className="absolute -bottom-1 -right-1 rounded-full bg-primary p-0.5 text-primary-foreground animate-in zoom-in-50">
                    <UserCircle2 className="h-4 w-4" />
                  </div>
                </div>
                <div>
                  <h3 className="font-medium">{user.name}</h3>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">Your role:</h4>
                <RadioGroup 
                  value={role} 
                  onValueChange={(value) => setRole(value as UserRole)}
                  className="space-y-2"
                >
                  <div className="relative flex cursor-pointer items-center space-x-3 rounded-lg border border-border/50 p-4 transition-all duration-200 hover:border-primary hover:bg-accent/5">
                    <RadioGroupItem value="contributor" id="contributor" />
                    <div>
                      <Label htmlFor="contributor" className="cursor-pointer">Contributor</Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Work on issues with rewards and get paid in XDC tokens when your pull requests are merged.
                      </p>
                    </div>
                  </div>
                  <div className="relative flex cursor-pointer items-center space-x-3 rounded-lg border border-border/50 p-4 transition-all duration-200 hover:border-primary hover:bg-accent/5">
                    <RadioGroupItem value="poolmanager" id="poolmanager" />
                    <div>
                      <Label htmlFor="poolmanager" className="cursor-pointer">Pool Manager</Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Fund repositories, assign rewards to issues, and manage distribution to contributors who solve them.
                      </p>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              <Button
                variant="default"
                size="lg"
                className="w-full bg-primary/90 hover:bg-primary transition-all duration-200 hover:scale-[1.02]"
                disabled={isRegistering || !user?.email}
                onClick={handleRegister}
              >
                {isRegistering ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Creating XDC wallet...
                  </>
                ) : (
                  <>
                    <Wallet className="mr-2 h-5 w-5" />
                    Complete Registration
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-6 text-center animate-in fade-in-50 slide-in-from-bottom-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary animate-bounce">
                <Wallet className="h-6 w-6" />
              </div>
              <p className="font-medium text-primary">Registration complete!</p>
              {user.xdcWalletAddress && (
                <div className="text-sm text-muted-foreground">
                  <p>Your XDC Wallet Address:</p>
                  <code className="mt-2 block break-all rounded-lg border border-border/50 bg-card p-3 font-mono text-xs transition-colors hover:bg-accent/5">
                    {user.xdcWalletAddress}
                  </code>
                </div>
              )}
              <Button
                variant="default"
                size="lg"
                className="mt-4 bg-primary/90 hover:bg-primary transition-all duration-200 hover:scale-[1.02]"
                onClick={() => setLocation(returnTo)}
              >
                Continue to App
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Show social rewards banner after registration is complete */}
      {user && user.isProfileComplete && (
        <div className="mt-6 animate-in fade-in-50 slide-in-from-bottom-5">
          <SocialRewardsBanner />
        </div>
      )}
    </div>
  );
}