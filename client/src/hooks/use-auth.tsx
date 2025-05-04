import { createContext, useContext, useEffect, useState } from "react";
import api from "../lib/api";
import csrfService from "../lib/csrf";

interface User {
  id: number;
  githubId: string;
  username: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  githubUsername: string;
  githubAccessToken: string;
  isProfileComplete: boolean;
  xdcWalletAddress: string | null;
  walletReferenceId: string | null;
  role: "contributor" | "poolmanager" | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchUser = async () => {
    try {
      setLoading(true);
      const data = await api.get<User>('/api/auth/user');
      setUser(data);
      
      // If user is authenticated, fetch CSRF token
      if (data) {
        try {
          await csrfService.fetchToken();
          
        } catch (csrfError) {
          console.error('Failed to fetch CSRF token:', csrfError);
          // Don't fail authentication if CSRF token fetch fails
          // The token will be fetched on-demand later
        }
      } else {
        // No authenticated user, clear CSRF token
        csrfService.clearToken();
      }
    } catch (err) {
      console.error("Error fetching user:", err);
      if (err instanceof Error && err.message.includes('401')) {
        // Not authenticated - clear the user and CSRF token
        setUser(null);
        csrfService.clearToken();
      } else {
        setError(err instanceof Error ? err : new Error("Unknown error"));
      }
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      await api.post('/api/auth/logout');
      setUser(null);
      csrfService.clearToken();
    } catch (err) {
      console.error("Error signing out:", err);
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, error, refetch: fetchUser, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}