// JWTService.ts
// Generates a JWT for Google service account authentication
import * as jwt from 'jsonwebtoken';
import * as fs from 'node:fs';

export interface ServiceAccount {
  client_email: string;
  private_key: string;
}

export class JWTService {
  private static readonly filePath = './jwt-private-key.json';
  private readonly serviceAccount: ServiceAccount;
  private static readonly scope: string = "https://www.googleapis.com/auth/spreadsheets";

  constructor() {
    try {
      this.serviceAccount = JWTService.getServiceAccountFromEnv();
    } catch (e) {
      this.serviceAccount = JWTService.getServiceAccountFromFile(JWTService.filePath);
      console.log(e);
    }
  }

  static getServiceAccountFromFile(filePath: string): ServiceAccount {
    const creds = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return {
      client_email: creds.client_email,
      private_key: creds.private_key,
    };
  }

  static getServiceAccountFromEnv(): ServiceAccount {
    const secretContent: string | undefined = process.env.JWT_PRIVATE_KEY_JSON;
    if (!secretContent) {
      throw new Error('JWT_PRIVATE_KEY_JSON environment variable is not set');
    }
    const creds = JSON.parse(secretContent);
    return {
      client_email: creds.client_email,
      private_key: creds.private_key,
    };
  }

  generateJWT(): string {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: this.serviceAccount.client_email,
      scope: JWTService.scope,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    };
    return jwt.sign(payload, this.serviceAccount.private_key, { algorithm: 'RS256' });
  }
}
