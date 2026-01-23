// JWTService.ts
// Generates a JWT for Google service account authentication
import * as jwt from 'jsonwebtoken';
import * as fs from 'fs';

export interface ServiceAccount {
  client_email: string;
  private_key: string;
}

export class JWTService {
  private static readonly filePath = './jwt-private-key.json';
  private serviceAccount: ServiceAccount;

  constructor() {
    this.serviceAccount = JWTService.getServiceAccountFromFile(JWTService.filePath);
  }

  static getServiceAccountFromFile(filePath: string): ServiceAccount {
    const creds = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return {
      client_email: creds.client_email,
      private_key: creds.private_key,
    };
  }

  generateJWT(scope: string): string {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: this.serviceAccount.client_email,
      scope,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    };
    return jwt.sign(payload, this.serviceAccount.private_key, { algorithm: 'RS256' });
  }
}
