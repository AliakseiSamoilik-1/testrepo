// JWTService.test.ts
import { JWTService } from '../../src/services/JWTService';
import { describe, expect, it } from "vitest";

describe('JWTService', () => {
  const scope = 'https://www.googleapis.com/auth/spreadsheets.readonly';

  it('should load service account from file and generate a valid JWT', () => {
    const jwtService = new JWTService();
    const jwt = jwtService.generateJWT(scope);
    expect(typeof jwt).toBe('string');
    expect(jwt.length).toBeGreaterThan(0);
    // Optionally, decode and check claims
    const parts = jwt.split('.');
    expect(parts.length).toBe(3);
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    expect(payload.iss).toBeDefined();
    expect(payload.scope).toBe(scope);
    expect(payload.aud).toBe('https://oauth2.googleapis.com/token');
  });
});
