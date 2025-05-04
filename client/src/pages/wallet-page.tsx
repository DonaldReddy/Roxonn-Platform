import { useAuth } from "@/hooks/use-auth";
import { WalletReceive } from "@/components/wallet-receive";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";
import { Helmet } from "react-helmet";

export default function WalletPage() {
  const { user, loading } = useAuth();

  // Redirect to auth page if not authenticated
  if (!loading && !user) {
    return <Redirect to="/auth" />;
  }

  return (
    <>
      <Helmet>
        <title>Wallet | Roxonn</title>
      </Helmet>
      
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold tracking-tight">Wallet</h1>
          </div>
          <p className="text-muted-foreground">
            {user?.role === "poolmanager" ? 
              "Manage your wallet, receive funds, and view transaction history." : 
              "View your wallet's transaction history and balance."}
          </p>
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <WalletReceive />
        )}
      </div>
    </>
  );
}
