import * as crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { JwtTokenPayload, AuthTokens } from '@packing-proof/shared-types';

export class AuthService {
  static hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  static verifyPassword(plainPassword: string, storedHash: string): boolean {
    const hashed = this.hashPassword(plainPassword);
    return hashed === storedHash;
  }

  static generateTokens(payload: Omit<JwtTokenPayload, 'iat' | 'exp'>): AuthTokens {
    const accessToken = jwt.sign(payload, config.jwtSecret, {
      expiresIn: '8h'
    });
    const refreshToken = jwt.sign({ sub: payload.sub }, config.jwtSecret, {
      expiresIn: '7d'
    });
    return {
      accessToken,
      refreshToken,
      expiresIn: 28800
    };
  }

  static verifyToken(token: string): JwtTokenPayload {
    return jwt.verify(token, config.jwtSecret) as JwtTokenPayload;
  }
}
