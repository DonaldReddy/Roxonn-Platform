import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider, useAuth } from "./hooks/use-auth";
import { NavigationBar } from "@/components/navigation-bar";
import { ThemeProvider } from "@/components/theme-provider";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import HomePage from "@/pages/home-page";
import ReposPage from "@/pages/repos-page";
import RepoDetailsPage from "@/pages/repo-details-page";
import ProfilePage from "@/pages/profile-page";
import WalletPage from "@/pages/wallet-page";
import FAQPage from "@/pages/faq-page";
import RepoRoxonnPage from "@/pages/RepoRoxonnPage"; // Import the new page
import { ContributionDemo } from "@/components/contribution-demo";
import { ChatWidget } from "@/components/chat-widget";
import { PoolManagerWelcomeGuide } from "@/components/pool-manager-guide";
import { FundingDemo } from "@/components/funding-demo";
import { MyRepositories } from "@/components/my-repositories";
import { Loader2 } from "lucide-react";

function Router() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-16 w-16 animate-spin text-primary/70" />
      </div>
    );
  }

  // Show guide components based on user role
  const showGuides = !loading && user;

  console.log('[Router Render] Loading finished. User Role:', user?.role);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-background/90 dark:from-background dark:via-background/95 dark:to-background/90 flex flex-col">
      {/* Animated background shapes */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-1/2 left-0 right-0 h-[200%] rotate-12 bg-gradient-to-br from-primary/5 via-primary/10 to-transparent blur-3xl dark:from-primary/10 dark:via-primary/15" />
        <div className="absolute -bottom-1/2 left-0 right-0 h-[200%] -rotate-12 bg-gradient-to-tr from-secondary/5 via-secondary/10 to-transparent blur-3xl dark:from-secondary/10 dark:via-secondary/15" />
      </div>
      
      {/* Main content */}
      <div className="relative z-10 flex-1">
        <NavigationBar />
        {showGuides && (
          <>
            {/* Show appropriate guide based on user role */}
            {user?.role === "contributor" && <ContributionDemo />}
            {user?.role === "poolmanager" && <PoolManagerWelcomeGuide />}
            {user?.role === "poolmanager" && <FundingDemo />}
          </>
        )}
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <Switch>
            <Route path="/">
              {!loading && user ? (
                <Redirect to="/repos" />
              ) : (
                <Redirect to="/repos" />
              )}
            </Route>
            <Route path="/my-repos">
              {(params) => {
                console.log('[Route /my-repos] Evaluating. User Role:', user?.role);
                if (!user) {
                  console.log('[Route /my-repos] User is null/undefined, redirecting.');
                  return <Redirect to="/repos" />;
                }
                if (user.role === 'poolmanager') {
                  console.log('[Route /my-repos] User exists and is poolmanager, rendering MyRepositories.');
                  return <MyRepositories />;
                } else {
                  console.log('[Route /my-repos] User exists but not poolmanager, redirecting.');
                  return <Redirect to="/repos" />;
                }
              }}
            </Route>
            <Route path="/repos" component={ReposPage} />
            <Route path="/repos/:owner/:name" component={RepoDetailsPage} />
            <Route path="/auth" component={AuthPage} />
            <Route path="/profile" component={ProfilePage} />
            <Route path="/wallet" component={WalletPage} />
            <Route path="/faq" component={FAQPage} />
            {/* Add the new route for owner/repo */}
            <Route path="/:owner/:repo" component={RepoRoxonnPage} />
            <Route path="*" component={NotFound} />
          </Switch>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="github-identity-theme">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Router />
          <Toaster />
          <ContributionDemo />
          <ChatWidget />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
