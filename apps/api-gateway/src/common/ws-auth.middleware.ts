import { Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { verifyAndValidateJwt, resolveMembershipUser } from './membership-auth';
import { Role } from '@prisma/client';

export interface WsUser {
  userId: string;
  orgId: string;
  role: Role;
}

declare module 'socket.io' {
  interface SocketData {
    user?: WsUser;
  }
}

export function createWsAuthMiddleware(prisma: PrismaService) {
  return (socket: Socket, next: (err?: Error) => void) => {
    const token = extractToken(socket);
    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const payload = verifyAndValidateJwt(token);
      resolveMembershipUser(prisma, payload)
        .then((user) => {
          socket.data.user = {
            userId: user.sub,
            orgId: user.orgId,
            role: user.role,
          };
          next();
        })
        .catch((err: unknown) => {
          next(err instanceof Error ? err : new Error('Invalid or expired token'));
        });
    } catch (err) {
      return next(err instanceof Error ? err : new Error('Invalid or expired token'));
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
