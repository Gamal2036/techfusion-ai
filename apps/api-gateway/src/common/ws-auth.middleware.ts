import { Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';

export interface WsUser {
  userId: string;
  orgId: string;
  role: string;
}

declare module 'socket.io' {
  interface SocketData {
    user?: WsUser;
  }
}

export function createWsAuthMiddleware() {
  return (socket: Socket, next: (err?: Error) => void) => {
    const token = extractToken(socket);
    if (!token) {
      return next(new Error('Authentication required'));
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return next(new Error('Server configuration error'));
    }

    try {
      const payload = jwt.verify(token, secret) as jwt.JwtPayload;
      if (!payload.sub || !payload.orgId || !payload.role) {
        return next(new Error('Invalid token payload'));
      }

      socket.data.user = {
        userId: payload.sub,
        orgId: payload.orgId,
        role: payload.role as string,
      };
      next();
    } catch {
      return next(new Error('Invalid or expired token'));
    }
  };
}

function extractToken(socket: Socket): string | null {
  const auth = socket.handshake.auth;
  if (auth && typeof auth === 'object' && typeof auth.token === 'string' && auth.token.length > 0) {
    return auth.token;
  }

  const header = socket.handshake.headers?.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    return header.slice(7);
  }

  return null;
}
