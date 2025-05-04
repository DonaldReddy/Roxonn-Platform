import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateProfileSchema, UpdateProfile } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, LogOut } from "lucide-react";
import { Link } from "wouter";
import { SocialRewardsBanner } from "@/components/social-rewards-banner";

export default function HomePage() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();

  const updateProfileMutation = useMutation({
    mutationFn: async (profile: UpdateProfile) => {
      const response = await apiRequest(`/api/profile`, {
        method: 'PATCH',
        body: JSON.stringify(profile),
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: "Profile updated",
        description: "Your profile has been successfully updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      toast({
        title: "Signed out",
        description: "You have been successfully signed out.",
      });
    },
  });

  const form = useForm<UpdateProfile>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      avatarUrl: user?.avatarUrl || "",
      bio: user?.bio || "",
      location: user?.location || "",
      website: user?.website || "",
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-background/90 py-8">
      {/* Animated background shapes */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-1/2 left-0 right-0 h-[200%] rotate-12 bg-gradient-to-br from-primary/5 via-primary/10 to-transparent blur-3xl dark:from-primary/10 dark:via-primary/15 animate-[gradient_20s_ease-in-out_infinite]" />
        <div className="absolute -bottom-1/2 left-0 right-0 h-[200%] -rotate-12 bg-gradient-to-tr from-secondary/5 via-secondary/10 to-transparent blur-3xl dark:from-secondary/10 dark:via-secondary/15 animate-[gradient_15s_ease-in-out_infinite_reverse]" />
      </div>

      <div className="max-w-4xl mx-auto px-4">
        <div className="flex justify-between items-center mb-8 animate-in fade-in slide-in-from-top-2">
          <h1 className="text-3xl font-bold text-foreground">Profile Settings</h1>
          <div className="flex gap-4">
            <Button variant="outline" asChild className="transition-all duration-200 hover:scale-105">
              <Link href="/repos">View Repositories</Link>
            </Button>
            <Button
              variant="outline"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              className="transition-all duration-200 hover:scale-105"
            >
              {logoutMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4 mr-2" />
              )}
              Sign Out
            </Button>
          </div>
        </div>

        {/* Social Rewards Banner */}
        <SocialRewardsBanner />

        {/* Profile Info Card */}
        <Card className="mb-8 backdrop-blur-sm border-border/50 shadow-lg transition-all duration-300 hover:shadow-xl animate-in fade-in slide-in-from-bottom-2">
          <CardHeader>
            <CardTitle>Welcome {user?.githubUsername}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="animate-in fade-in slide-in-from-left-3">
                <span className="font-medium">GitHub Username:</span>{" "}
                <span className="text-muted-foreground">{user?.githubUsername}</span>
              </div>
              <div className="animate-in fade-in slide-in-from-left-4">
                <span className="font-medium">XDC Wallet Address:</span>{" "}
                <span className="font-mono text-sm text-muted-foreground break-all">
                  {user?.xdcWalletAddress}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profile Edit Card */}
        <Card className="backdrop-blur-sm border-border/50 shadow-lg transition-all duration-300 hover:shadow-xl animate-in fade-in slide-in-from-bottom-3">
          <CardHeader>
            <CardTitle>Edit Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((data) =>
                  updateProfileMutation.mutate(data)
                )}
                className="space-y-6"
              >
                <FormField
                  control={form.control}
                  name="avatarUrl"
                  render={({ field }) => (
                    <FormItem className="transition-all duration-200 group hover:scale-[1.01]">
                      <FormLabel>Avatar URL</FormLabel>
                      <Input 
                        {...field} 
                        value={field.value || ""} 
                        placeholder="https://..." 
                        className="transition-shadow duration-200 focus-visible:ring-2 focus-visible:ring-primary/50 group-hover:shadow-md"
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bio"
                  render={({ field }) => (
                    <FormItem className="transition-all duration-200 group hover:scale-[1.01]">
                      <FormLabel>Bio</FormLabel>
                      <Textarea 
                        {...field} 
                        value={field.value || ""} 
                        placeholder="Tell us about yourself..." 
                        className="transition-shadow duration-200 focus-visible:ring-2 focus-visible:ring-primary/50 group-hover:shadow-md"
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem className="transition-all duration-200 group hover:scale-[1.01]">
                      <FormLabel>Location</FormLabel>
                      <Input 
                        {...field} 
                        value={field.value || ""} 
                        placeholder="Your location..." 
                        className="transition-shadow duration-200 focus-visible:ring-2 focus-visible:ring-primary/50 group-hover:shadow-md"
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="website"
                  render={({ field }) => (
                    <FormItem className="transition-all duration-200 group hover:scale-[1.01]">
                      <FormLabel>Website</FormLabel>
                      <Input 
                        {...field} 
                        value={field.value || ""} 
                        placeholder="https://..." 
                        className="transition-shadow duration-200 focus-visible:ring-2 focus-visible:ring-primary/50 group-hover:shadow-md"
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  disabled={updateProfileMutation.isPending}
                  className="w-full bg-primary/90 hover:bg-primary transition-all duration-200 hover:scale-[1.02]"
                >
                  {updateProfileMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Save Changes
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}