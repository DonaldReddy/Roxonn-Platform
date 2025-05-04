import { STAGING_API_URL } from '../config';

interface CsrfResponse {
  csrfToken: string;
}

/**
 * Service for managing CSRF tokens
 */
class CsrfService {
  private token: string | null = null;
  
  /**
   * Fetch a new CSRF token from the server
   */
  async fetchToken(): Promise<string> {
    try {
      const response = await fetch(`${STAGING_API_URL}/api/auth/csrf-token`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch CSRF token: ${response.status}`);
      }
      
      const data = await response.json() as CsrfResponse;
      this.token = data.csrfToken;
      return this.token;
    } catch (error) {
      console.error('Error fetching CSRF token:', error);
      throw error;
    }
  }
  
  /**
   * Get the current CSRF token, fetching a new one if necessary
   */
  async getToken(): Promise<string> {
    if (!this.token) {
      return this.fetchToken();
    }
    return this.token;
  }
  
  /**
   * Clear the stored CSRF token
   */
  clearToken(): void {
    this.token = null;
  }
  
  /**
   * Add CSRF token to an existing headers object
   */
  async addTokenToHeaders(headers: HeadersInit = {}): Promise<Headers> {
    const token = await this.getToken();
    const headersObj = new Headers(headers);
    headersObj.set('X-CSRF-Token', token);
    return headersObj;
  }
  
  /**
   * Add CSRF token to a request body object
   */
  async addTokenToBody(body: Record<string, any> = {}): Promise<Record<string, any>> {
    const token = await this.getToken();
    return {
      ...body,
      _csrf: token
    };
  }
}

// Export a singleton instance
const csrfService = new CsrfService();
export default csrfService; 