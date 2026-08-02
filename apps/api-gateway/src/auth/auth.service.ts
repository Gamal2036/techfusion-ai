import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import * as speakeasy from 'speakeasy';

const JWT_SECRET = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return secret;
};
const JWT_REFRESH_SECRET = () => {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) {
    throw new Error('JWT_REFRESH_SECRET environment variable is required');
  }
  return secret;
};

interface SignupInput {
  email: string;
  password: string;
  displayName: string;
  orgName: string;
}

interface LoginInput {
  email: string;
  password: string;
}

function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString('hex');
}

const MAX_SLUG_RETRIES = 10;

export function normalizeSlug(input: string): string {
  let slug = input
    .toLowerCase()
    .replace(/[^a-z0-9\u00C0-\u024F]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  return slug || 'organization';
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private prisma: PrismaService) {}

  async signup(input: SignupInput) {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const baseSlug = normalizeSlug(input.orgName);

    let lastError: unknown = null;

    for (let attempt = 0; attempt <= MAX_SLUG_RETRIES; attempt++) {
      const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;

      try {
        const result = await this.prisma.$transaction(async (tx) => {
          const org = await tx.organization.create({
            data: { name: input.orgName, slug },
          });

          const user = await tx.user.create({
            data: {
              email: input.email,
              passwordHash,
              displayName: input.displayName,
              orgId: org.id,
              role: 'Owner',
            },
          });

          return { org, user };
        });

        this.logger.debug(`Signup complete with slug "${slug}"`);
        const tokens = await this.generateTokens(result.user.id, result.org.id, result.user.role);
        return {
          user: { id: result.user.id, email: result.user.email, displayName: result.user.displayName, role: result.user.role, orgId: result.org.id },
          ...tokens,
        };
      } catch (err: any) {
        if (err?.code === 'P2002' && attempt < MAX_SLUG_RETRIES) {
          this.logger.debug(`Slug collision on "${slug}", retrying (attempt ${attempt + 1})`);
          lastError = err;
          continue;
        }
        throw err;
      }
    }

    this.logger.error(`Failed to generate unique slug after ${MAX_SLUG_RETRIES + 1} attempts`);
    throw lastError || new Error('Failed to generate unique slug');
  }

  async login(input: LoginInput) {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.isMfaEnabled) {
      return { mfaRequired: true, userId: user.id };
    }

    const tokens = await this.generateTokens(user.id, user.orgId, user.role);
    return {
      user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role, orgId: user.orgId },
      ...tokens,
    };
  }

  async verifyLoginMfa(userId: string, token: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isMfaEnabled || !user.mfaSecret) {
      throw new UnauthorizedException('MFA verification required');
    }

    const verified = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token,
    });

    if (!verified) {
      throw new UnauthorizedException('Invalid MFA code');
    }

    const tokens = await this.generateTokens(user.id, user.orgId, user.role);
    return {
      user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role, orgId: user.orgId },
      ...tokens,
    };
  }

  async refresh(refreshToken: string) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.generateTokens(stored.user.id, stored.user.orgId, stored.user.role);
    return {
      user: {
        id: stored.user.id,
        email: stored.user.email,
        displayName: stored.user.displayName,
        role: stored.user.role,
        orgId: stored.user.orgId,
      },
      ...tokens,
    };
  }

  async logout(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async generateTokens(userId: string, orgId: string, role: string) {
    const accessToken = jwt.sign(
      { sub: userId, orgId, role },
      JWT_SECRET(),
      { expiresIn: '15m' },
    );

    const refreshTokenStr = generateRefreshToken();
    await this.prisma.refreshToken.create({
      data: {
        token: refreshTokenStr,
        userId,
        orgId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return { accessToken, refreshToken: refreshTokenStr };
  }
}
