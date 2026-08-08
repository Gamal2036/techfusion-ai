import {
  Controller, Get, Post, Body, Req, Headers,
} from '@nestjs/common';
import { BillingService } from './billing.service';
import { Public } from '../common/public.decorator';
import { RequirePermissions } from '../common/permissions.decorator';
import { Permission } from '../common/permissions';

@Controller('billing')
export class BillingController {
  constructor(private billingService: BillingService) {}

  @RequirePermissions(Permission.BILLING_MANAGE)
  @Post('checkout')
  async createCheckout(
    @Req() req: any,
    @Body() body: { priceId: string; successUrl: string; cancelUrl: string },
  ) {
    return this.billingService.createCheckoutSession(
      req.user.orgId,
      body.priceId,
      body.successUrl || `${req.protocol}://${req.hostname}:3000/dashboard/billing`,
      body.cancelUrl || `${req.protocol}://${req.hostname}:3000/dashboard/billing`,
    );
  }

  @RequirePermissions(Permission.BILLING_MANAGE)
  @Post('portal')
  async createPortal(
    @Req() req: any,
    @Body() body: { returnUrl?: string },
  ) {
    return this.billingService.createCustomerPortalSession(
      req.user.orgId,
      body.returnUrl || `${req.protocol}://${req.hostname}:3000/dashboard/billing`,
    );
  }

  @RequirePermissions(Permission.BILLING_VIEW)
  @Get('plan')
  async getPlan(@Req() req: any) {
    return this.billingService.getCurrentPlan(req.user.orgId);
  }

  @RequirePermissions(Permission.BILLING_VIEW)
  @Get('usage')
  async getUsage(@Req() req: any) {
    return this.billingService.getUsageMetrics(req.user.orgId);
  }

  @RequirePermissions(Permission.BILLING_MANAGE)
  @Get('history')
  async getHistory(@Req() req: any) {
    return this.billingService.getBillingHistory(req.user.orgId);
  }

  @RequirePermissions(Permission.BILLING_MANAGE)
  @Get('admin')
  async getAdminView(@Req() req: any) {
    return this.billingService.getAllEntitlements(req.user.orgId);
  }

  @Public()
  @Post('webhook')
  async webhook(
    @Req() req: any,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!signature) {
      throw new Error('Missing stripe-signature header');
    }

    const rawBody = req.rawBody || req.body;
    return this.billingService.handleStripeWebhook(
      Buffer.from(typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody)),
      signature,
    );
  }
}
