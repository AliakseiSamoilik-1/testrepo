// GoogleAuthService.ts
// Exchanges JWT for Google OAuth2 access token
import axios from "axios";

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export class GoogleAuthService {
  async getAccessToken(jwt: string): Promise<string> {
    const response = await axios.post('https://oauth2.googleapis.com/token',
      `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );
    const data = response.data as GoogleTokenResponse;
    if (!data || !data.access_token) {
      throw new Error(`Failed to get access token: ${response.statusText || 'No access token returned'}`);
    }
    return data.access_token;
  }
}
