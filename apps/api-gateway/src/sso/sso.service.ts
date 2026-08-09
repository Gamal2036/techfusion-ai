import { Injectable, NotImplementedException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

@Injectable()
export class SsoService {
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

  /**
   * FAIL-CLOSED — SSO authentication is DISABLED until a real IdP
   * verification mechanism exists.
   *
   * V1-STAGE-01-SUB-01 (S1, CRITICAL auth bypass): the previous
   * implementation trusted client-supplied identity attributes
   * (`attributes { email, ssoId, displayName }`) and an IdP token validated
   * only by length, then JIT-provisioned users, linked SSO identities, and
   * issued access + refresh tokens — an authentication bypass. Real
   * SAML/OIDC assertion verification is OUT OF SCOPE for this substage, so
   * this route deterministically rejects BEFORE touching any data:
   *
   *   - no access token, refresh token, or session is ever produced
   *   - no user is JIT-provisioned and no ssoId is written
   *   - no SSO/org configuration is read or leaked (slug/enabled state are
   *     indistinguishable)
   *
   * The route/contract is intentionally preserved so a future substage can
   * implement server-side verification (OIDC issuer/audience/signature/exp/
   * nonce + PKCE, or SAML signature/issuer/audience/destination/validity/
   * replay protection) in exactly this method. See
   * docs/tech-lead/V1-STAGE-01-SUB-01_SSO_REMEDIATION_REPORT.md.
   */
  async ssoLogin(_body: {
    orgSlug: string;
    idpToken: string;
    provider: 'saml' | 'oidc';
    attributes?: { email: string; displayName?: string; ssoId?: string };
  }): Promise<never> {
    throw new NotImplementedException(
      'SSO authentication is not available: server-side IdP verification is not implemented',
    );
  }
}
