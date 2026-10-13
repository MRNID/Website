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
    const accessToken = jwt.sign({ ...payload, tokenUse: 'access' }, config.jwtSecret, {
      algorithm: 'HS256',
      expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn']
    });
    const refreshToken = jwt.sign({ sub: payload.sub, tokenUse: 'refresh' }, config.jwtSecret, {
      algorithm: 'HS256',
      expiresIn: config.refreshTokenExpiresIn as jwt.SignOptions['expiresIn']
    });
    return {
      accessToken,
      refreshToken,
      expiresIn: (jwt.decode(accessToken) as jwt.JwtPayload).exp! - (jwt.decode(accessToken) as jwt.JwtPayload).iat!
    };
  }

  static verifyToken(token: string): JwtTokenPayload {
    return this.verifyTokenUse(token, 'access') as unknown as JwtTokenPayload;
  }

  static verifyRefreshToken(token: string): { sub: string } {
    return this.verifyTokenUse(token, 'refresh') as { sub: string };
  }

  static createPlaybackTicket(userId: string, videoId: string): string {
    return jwt.sign({ sub: userId, videoId, tokenUse: 'video-playback' }, config.jwtSecret, { algorithm: 'HS256', expiresIn: '15m' });
  }

  static verifyPlaybackTicket(token: string, videoId: string): { sub: string } {
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    if (typeof payload === 'string' || payload.tokenUse !== 'video-playback' || payload.videoId !== videoId || !payload.sub) throw new Error('Invalid playback ticket');
    return { sub: payload.sub };
  }

  private static verifyTokenUse(token: string, expectedUse: 'access' | 'refresh'): jwt.JwtPayload {
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    if (typeof payload === 'string' || payload.tokenUse !== expectedUse ||
        typeof payload.sub !== 'string' || !payload.sub || typeof payload.exp !== 'number') {
      throw new Error('Invalid token type or claims');
    }
    return payload;
  }
}
