import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';

const JWT_SECRET = () => process.env.JWT_SECRET || 'dev-secret-change-in-production-abc123';
const JWT_REFRESH_SECRET = () =>
  process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-production-xyz789';

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

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  async signup(input: SignupInput) {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const slug = input.orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'org';

    const org = await this.prisma.organization.create({
      data: { name: input.orgName, slug },
    });

    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        displayName: input.displayName,
        orgId: org.id,
        role: 'Owner',
      },
    });

    const tokens = await this.generateTokens(user.id, org.id, user.role);
    return {
      user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role, orgId: org.id },
      ...tokens,
    };
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
