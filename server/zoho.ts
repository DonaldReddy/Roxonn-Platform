// Zoho CRM Integration Module
import axios from 'axios';
import { log } from './utils';
import { config } from './config';

// Zoho API endpoints - Using India region
const ZOHO_ACCOUNTS_URL = 'https://accounts.zoho.in';
const ZOHO_API_URL = 'https://www.zohoapis.in';
const DEFAULT_ZOHO_DC = 'in'; // Data center: com, eu, in, etc.

// Store token data
let accessToken: string | null = null;
let tokenExpiry: number = 0;

/**
 * Generate the authorization URL for Zoho OAuth flow
 * @returns {string} Authorization URL to redirect the user
 */
export function getZohoAuthUrl(): string {
  // Use the exact redirect URI that was configured in Zoho API Console
  const redirectUri = encodeURIComponent(`https://api.roxonn.com/api/zoho/auth/callback`);
  const scope = encodeURIComponent('ZohoCRM.modules.ALL,ZohoCRM.settings.ALL');
  
  return `${ZOHO_ACCOUNTS_URL}/oauth/v2/auth?scope=${scope}&client_id=${config.zohoClientId}&response_type=code&access_type=offline&redirect_uri=${redirectUri}`;
}

/**
 * Exchange authorization code for refresh token
 * @param {string} code The authorization code received from Zoho
 * @returns {Promise<string>} Refresh token
 */
export async function exchangeCodeForRefreshToken(code: string): Promise<string> {
  try {
    // Use the exact redirect URI that was configured in Zoho API Console
    const redirectUri = `https://api.roxonn.com/api/zoho/auth/callback`;
    
    const response = await axios.post(`${ZOHO_ACCOUNTS_URL}/oauth/v2/token`, null, {
      params: {
        grant_type: 'authorization_code',
        client_id: config.zohoClientId,
        client_secret: config.zohoClientSecret,
        code: code,
        redirect_uri: redirectUri
      }
    });
    
    if (response.data && response.data.refresh_token) {
      log(`Successfully obtained refresh token from Zoho`, 'zoho');
      return response.data.refresh_token;
    } else {
      throw new Error('Refresh token not found in response');
    }
  } catch (error: any) {
    log(`Error exchanging code for refresh token: ${error.message}`, 'zoho');
    throw error;
  }
}

/**
 * Get a valid access token for Zoho API calls
 * @returns {Promise<string>} Access token
 */
export async function getZohoAccessToken(): Promise<string> {
  // If we have a valid token, return it
  if (accessToken && tokenExpiry > Date.now()) {
    return accessToken as string;
  }
  
  try {
    if (!config.zohoRefreshToken) {
      throw new Error('Zoho refresh token not configured. Please complete the OAuth flow first.');
    }
    
    const response = await axios.post(`${ZOHO_ACCOUNTS_URL}/oauth/v2/token`, null, {
      params: {
        grant_type: 'refresh_token',
        client_id: config.zohoClientId,
        client_secret: config.zohoClientSecret,
        refresh_token: config.zohoRefreshToken
      }
    });
    
    if (response.data && response.data.access_token) {
      accessToken = response.data.access_token;
      // Set expiry time (token is valid for 1 hour, subtract 5 minutes for safety margin)
      tokenExpiry = Date.now() + ((response.data.expires_in - 300) * 1000);
      log(`Successfully refreshed Zoho access token`, 'zoho');
      return accessToken as string;
    } else {
      throw new Error('Access token not found in response');
    }
  } catch (error: any) {
    log(`Error getting Zoho access token: ${error.message}`, 'zoho');
    throw error;
  }
}

/**
 * Create a new user record in Zoho CRM based on user's role
 * @param {Object} userData User data from GitHub registration
 * @returns {Promise<boolean>} Success status
 */
export async function createZohoLead(userData: any): Promise<boolean> {
  try {
    const token = await getZohoAccessToken();
    
    // Determine which module to use based on role
    const userRole = userData.role || '';
    let moduleToUse = 'ROXONN_Users'; // Default module as fallback
    
    if (userRole.toLowerCase() === 'poolmanager') {
      moduleToUse = 'ROXONN_Pool_Managers';
    } else if (userRole.toLowerCase() === 'contributor') {
      moduleToUse = 'ROXONN_Contributors';
    }
    
    // Log which module is being used
    log(`Creating Zoho record in ${moduleToUse} for user: ${userData.username}`, 'zoho');
    
    // Prepare the user data for the selected module
    const roxonnUserData = {
      data: [
        {
          // Map to the exact field names in your custom module
          Name: userData.username || 'GitHub User',
          Email: userData.email || '',
          GitHub_ID: userData.githubId || '',
          GitHub_Username: userData.username || '',
          Role: userRole,
          // Add any other custom fields you want to populate
          XDC_Wallet_Address: userData.xdcWalletAddress || ''
        }
      ]
    };
    
    // Make API call to create record in the appropriate module
    const response = await axios.post(
      `${ZOHO_API_URL}/crm/v2/${moduleToUse}`,
      roxonnUserData,
      {
        headers: {
          'Authorization': `Zoho-oauthtoken ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (response.data && response.data.data && response.data.data[0].status === 'success') {
      log(`Successfully created record in ${moduleToUse} module for user: ${userData.username}`, 'zoho');
      
      // For backward compatibility, also create in the main ROXONN_Users module if we used a role-specific module
      if (moduleToUse !== 'ROXONN_Users') {
        try {
          await axios.post(
            `${ZOHO_API_URL}/crm/v2/ROXONN_Users`,
            roxonnUserData,
            {
              headers: {
                'Authorization': `Zoho-oauthtoken ${token}`,
                'Content-Type': 'application/json'
              }
            }
          );
          log(`Also created record in ROXONN_Users module for compatibility`, 'zoho');
        } catch (error) {
          // Don't fail if the secondary creation fails
          const innerError = error as Error;
          log(`Warning: Failed to create record in main ROXONN_Users module: ${innerError.message}`, 'zoho');
        }
      }
      
      return true;
    } else {
      log(`Failed to create record in ${moduleToUse} module: ${JSON.stringify(response.data)}`, 'zoho');
      return false;
    }
  } catch (error: any) {
    log(`Error creating Zoho record: ${error.message}`, 'zoho');
    // Don't let Zoho errors affect the main registration process
    return false;
  }
}

/**
 * Check if Zoho integration is properly configured
 * @returns {boolean} Is Zoho configured
 */
export function isZohoConfigured(): boolean {
  return !!(config.zohoClientId && config.zohoClientSecret);
}

/**
 * Send a notification to Zoho CRM when a bounty is allocated to an issue
 * This will create a record in the Bounty_Notifications module which triggers
 * a custom function to send emails to all contributors
 * 
 * @param {string} repoName Repository name
 * @param {number} issueId Issue ID
 * @param {string} issueTitle Issue title
 * @param {string} bountyAmount Amount of bounty in XDC
 * @param {string} issueUrl URL to the GitHub issue
 * @returns {Promise<boolean>} Success status
 */
export async function sendBountyNotification(
  repoName: string,
  issueId: number,
  issueTitle: string,
  bountyAmount: string, // Keep receiving as string
  issueUrl: string
): Promise<boolean> {
  try {
    // Don't block or throw errors if Zoho is not configured
    if (!isZohoConfigured()) {
      log(`Zoho not configured, skipping bounty notification`, 'zoho');
      return false;
    }

    const token = await getZohoAccessToken();

    // Extract the actual issue number from the URL (the last segment after 'issues/')
    let displayIssueNumber = "0";
    try {
      const urlParts = issueUrl.split('/');
      displayIssueNumber = urlParts[urlParts.length - 1]; // Get the last segment
      // Validate that it's a number
      if (!/^\d+$/.test(displayIssueNumber)) {
        log(`Warning: Could not extract valid issue number from URL: ${issueUrl}`, 'zoho');
        // Fall back to the issueId if we can't extract a valid number
        displayIssueNumber = issueId.toString();
      }
    } catch (err) {
      log(`Warning: Error extracting issue number from URL: ${err}`, 'zoho');
      displayIssueNumber = issueId.toString();
    }

    // Convert bountyAmount to an integer, handle potential errors
    const bountyAmountInteger = parseInt(bountyAmount, 10); // Use parseInt for integer type
    if (isNaN(bountyAmountInteger)) {
        log(`Error converting bountyAmount '${bountyAmount}' to integer for Zoho notification`, 'zoho');
        // Decide how to handle - skip notification or send 0? Skipping for now.
        return false;
    }

    // Prepare the notification data
    const notificationData = {
      data: [
        {
          // Add the Name field (mandatory in Zoho CRM)
          Name: `${repoName} - Issue #${displayIssueNumber}`,
          Repository_Name: repoName,
          Issue_Number: displayIssueNumber, // Use the extracted issue number
          Issue_Title: issueTitle,
          Bounty_Amount: bountyAmountInteger, // Send as integer
          GitHub_Issue_URL: issueUrl
        }
      ]
    };

    log(`Sending bounty notification to Zoho for ${repoName}#${displayIssueNumber}`, 'zoho');
    log(`Data payload: ${JSON.stringify(notificationData.data[0])}`, 'zoho'); // Log the data being sent

    // Make API call to create record in the Bounty_Notifications module
    const response = await axios.post(
      `${ZOHO_API_URL}/crm/v2/Bounty_Notifications`,
      notificationData,
      {
        headers: {
          'Authorization': `Zoho-oauthtoken ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data && response.data.data && response.data.data[0].status === 'success') {
      log(`Successfully created bounty notification in Zoho CRM`, 'zoho');
      return true;
    } else {
      log(`Failed to create bounty notification in Zoho: ${JSON.stringify(response.data)}`, 'zoho');
      return false;
    }
  } catch (error: any) {
    log(`Error creating bounty notification in Zoho: ${error.message}`, 'zoho');
    // Don't let Zoho errors affect the main application process
    return false;
  }
}