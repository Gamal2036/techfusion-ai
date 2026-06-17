import { Controller, Get, Post, Body, Req, Param } from '@nestjs/common';
import { SsoService } from './sso.service';
import { Public } from '../common/public.decorator';
import { Roles } from '../common/roles.decorator';
import { RequireFeature } from '../common/plan.decorator';

@Controller()
export class SsoController {
  constructor(private ssoService: SsoService) {}

  @Public()
  @Post('auth/sso/login')
  async ssoLogin(@Body() body: {
    orgSlug: string;
    idpToken: string;
    provider: 'saml' | 'oidc';
    attributes?: { email: string; displayName?: string; ssoId?: string };
  }) {
    return this.ssoService.ssoLogin(body);
  }

  @Get('admin/sso/config')
  @Roles('Owner', 'Admin')
  @RequireFeature('sso')
  async getSsoConfig(@Req() req: any) {
    return this.ssoService.getConfig(req.user.orgId);
  }

  @Post('admin/sso/config')
  @Roles('Owner')
  @RequireFeature('sso')
  async configureSso(
    @Req() req: any,
    @Body() body: {
      provider: 'saml' | 'oidc';
      issuer?: string;
      entryPoint?: string;
      certificate?: string;
      clientId?: string;
      clientSecretEncrypted?: string;
      attributeMapping?: Record<string, string>;
    },
  ) {
    return this.ssoService.configureSso(req.user.orgId, body);
  }

  @Post('admin/sso/disable')
  @Roles('Owner')
  @RequireFeature('sso')
  async disableSso(@Req() req: any) {
    return this.ssoService.disableSso(req.user.orgId);
  }
}
