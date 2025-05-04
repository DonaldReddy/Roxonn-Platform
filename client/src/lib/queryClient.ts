import { QueryClient } from "@tanstack/react-query";
import { STAGING_API_URL } from "../config";

interface QueryFnOptions {
  endpoint: string;
  params?: Record<string, any>;
  enabled?: boolean;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

export const getQueryFn = ({ endpoint, params }: QueryFnOptions) => {
  return async () => {
    const queryParams = params ? new URLSearchParams(params).toString() : "";
    const url = `${STAGING_API_URL}${endpoint}${queryParams ? `?${queryParams}` : ""}`;
    
    const response = await fetch(url, {
      credentials: 'include', // Include credentials for all requests
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }
    return response.json();
  };
};

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface ApiResponse<T = any> {
  success: boolean;
  user?: T;
  error?: string;
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const response = await fetch(`${STAGING_API_URL}${endpoint}`, {
    ...options,
    credentials: 'include', // Include credentials for all requests
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'An error occurred');
  }

  return response.json();
}

// Add this function to invalidate wallet info queries
export function invalidateWalletInfo() {
  queryClient.invalidateQueries({ queryKey: ['wallet-info'] });
}
