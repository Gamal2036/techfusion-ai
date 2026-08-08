import { Injectable, BadRequestException, UnauthorizedException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';

const JWT_SECRET = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return secret;
};

interface SsoConfigData {
  provider: 'saml' | 'oidc';
  issuer?: string;
  entryPoint?: string;
  certificate?: string;
  clientId?: string;
  clientSecretEncrypted?: string;
  attributeMapping?: Record<string, string>;
  isEnabled?: boolean;
}

function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString('hex');
}

@Injectable()
export class SsoService {
  private readonly logger = new Logger(SsoService.name);

  constructor(private prisma: PrismaService) {}

  async getConfig(orgId: string) {
    const config = await this.prisma.ssoConfig.findUnique({ where: { orgId } });
    if (!config) throw new NotFoundException('SSO not configured for this organization');
    // Never expose encrypted secret
    const { clientSecretEncrypted, ...safe } = config;
    return safe;
  }

  async configureSso(orgId: string, data: SsoConfigData) {
    const existing = await this.prisma.ssoConfig.findUnique({ where: { orgId } });
    if (existing) {
      return this.prisma.ssoConfig.update({
        where: { orgId },
        data: {
          provider: data.provider,
          issuer: data.issuer,
          entryPoint: data.entryPoint,
          certificate: data.certificate,
          clientId: data.clientId,
          clientSecretEncrypted: data.clientSecretEncrypted,
          attributeMapping: data.attributeMapping || undefined,
          isEnabled: data.isEnabled ?? true,
        },
      });
    }
    return this.prisma.ssoConfig.create({
      data: {
        orgId,
        provider: data.provider,
        issuer: data.issuer,
        entryPoint: data.entryPoint,
        certificate: data.certificate,
        clientId: data.clientId,
        clientSecretEncrypted: data.clientSecretEncrypted,
        attributeMapping: data.attributeMapping || undefined,
        isEnabled: data.isEnabled ?? true,
      },
    });
  }

  async disableSso(orgId: string) {
    const config = await this.prisma.ssoConfig.findUnique({ where: { orgId } });
    if (!config) throw new NotFoundException('SSO not configured');
    return this.prisma.ssoConfig.update({
      where: { orgId },
      data: { isEnabled: false },
    });
  }

  async ssoLogin(body: {
    orgSlug: string;
    idpToken: string;
    provider: 'saml' | 'oidc';
    attributes?: { email: string; displayName?: string; ssoId?: string };
  }) {
    const { orgSlug, idpToken, provider, attributes } = body;

    const org = await this.prisma.organization.findUnique({ where: { slug: orgSlug } });
    if (!org) throw new NotFoundException('Organization not found');

    const config = await this.prisma.ssoConfig.findUnique({ where: { orgId: org.id } });
    if (!config || !config.isEnabled) {
      throw new UnauthorizedException('SSO is not enabled for this organization');
    }

    // Validate the IdP token (in production, verify SAML assertion or OIDC id_token)
    if (!idpToken || idpToken.length < 10) {
      throw new UnauthorizedException('Invalid IdP token');
    }

    if (!attributes || !attributes.email) {
      throw new BadRequestException('SSO response must include email attribute');
    }

    const email = attributes.email.toLowerCase().trim();
    const ssoId = attributes.ssoId || email;

    // JIT Provisioning: find or create user
    let user = await this.prisma.user.findFirst({
      where: { orgId: org.id, email },
    });

    if (!user) {
      // Create new user via JIT provisioning. A membership row is created
      // alongside so the issued token resolves against the authoritative
      // OrganizationMember record on every subsequent request.
      user = await this.prisma.user.create({
        data: {
          email,
          passwordHash: crypto.randomBytes(32).toString('hex'), // No password for SSO users
          displayName: attributes.displayName || email.split('@')[0],
          orgId: org.id,
          ssoId,
          ssoProvider: provider,
          role: 'Viewer',
        },
      });
      await this.prisma.organizationMember.create({
        data: { userId: user.id, orgId: org.id, role: 'Viewer' },
      });
      this.logger.log(`JIT provisioned user ${email} in org ${org.slug}`);
    } else if (!user.ssoId) {
      // Link existing user to SSO. The user already belongs to this org, so a
      // membership must exist; if it is missing the link is repaired with the
      // user's own role so the user does not lose access mid-link.
      await this.ensureMembership(user, org.id);
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { ssoId, ssoProvider: provider },
      });
    } else {
      await this.ensureMembership(user, org.id);
    }

    const membership = await this.prisma.organizationMember.findUnique({
      where: { userId_orgId: { userId: user.id, orgId: org.id } },
    });
    const role = membership?.role ?? 'Viewer';

    const accessToken = jwt.sign(
      { sub: user.id, orgId: org.id, role },
      JWT_SECRET(),
      { expiresIn: '15m' },
    );

    const refreshTokenStr = generateRefreshToken();
    await this.prisma.refreshToken.create({
      data: {
        token: refreshTokenStr,
        userId: user.id,
        orgId: org.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      user: { id: user.id, email: user.email, displayName: user.displayName, role, orgId: org.id },
      accessToken,
      refreshToken: refreshTokenStr,
    };
  }

  private async ensureMembership(
    user: { id: string; orgId: string | null; role: Role },
    orgId: string,
  ) {
    const existing = await this.prisma.organizationMember.findUnique({
      where: { userId_orgId: { userId: user.id, orgId } },
    });
    if (existing) {
      return existing;
    }
    return this.prisma.organizationMember.create({
      data: { userId: user.id, orgId, role: user.orgId === orgId ? user.role : 'Viewer' },
    });
  }
}
