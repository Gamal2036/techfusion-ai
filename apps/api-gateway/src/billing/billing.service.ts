import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PLAN_CONFIGS, PlanTier, getPlanConfig } from './plan-features';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_placeholder';

@Injectable()
export class BillingService {
  private stripe: any;

  constructor(private prisma: PrismaService) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Stripe = require('stripe');
    this.stripe = new Stripe(STRIPE_SECRET_KEY);
  }

  async getOrCreateStripeCustomer(orgId: string): Promise<string> {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException('Organization not found');

    if (org.stripeCustomerId) return org.stripeCustomerId;

    const customer = await this.stripe.customers.create({
      name: org.name,
      metadata: { orgId: org.id },
    });

    await this.prisma.organization.update({
      where: { id: orgId },
      data: { stripeCustomerId: customer.id },
    });

    return customer.id;
  }

  async createCheckoutSession(orgId: string, priceId: string, successUrl: string, cancelUrl: string) {
    const customerId = await this.getOrCreateStripeCustomer(orgId);

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { orgId },
      subscription_data: {
        metadata: { orgId },
      },
    });

    return { url: session.url, sessionId: session.id };
  }

  async createCustomerPortalSession(orgId: string, returnUrl: string) {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org?.stripeCustomerId) throw new BadRequestException('No Stripe customer found');

    const session = await this.stripe.billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: returnUrl,
    });

    return { url: session.url };
  }

  async getCurrentPlan(orgId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      include: { subscription: true },
    });
    if (!org) throw new NotFoundException('Organization not found');

    const planConfig = getPlanConfig(org.plan);
    const [deviceCount, reportCountCurrentMonth, aiUsageCurrentMonth] = await Promise.all([
      this.prisma.device.count({ where: { orgId, inactive: false } }),
      this.countReportsThisMonth(orgId),
      this.countAiQueriesThisMonth(orgId),
    ]);

    return {
      plan: org.plan,
      label: planConfig.label,
      price: planConfig.price,
      limits: planConfig.limits,
      features: planConfig.features,
      usage: {
        devices: deviceCount,
        reports: reportCountCurrentMonth,
        aiQueries: aiUsageCurrentMonth,
      },
      subscription: org.subscription
        ? {
            status: org.subscription.status,
            currentPeriodEnd: org.subscription.currentPeriodEnd,
            cancelAtPeriodEnd: org.subscription.cancelAtPeriodEnd,
          }
        : null,
    };
  }

  async getBillingHistory(orgId: string) {
    const subscription = await this.prisma.subscription.findUnique({ where: { orgId } });
    if (!subscription) return [];

    return this.prisma.invoice.findMany({
      where: { subscriptionId: subscription.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getUsageMetrics(orgId: string) {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException('Organization not found');

    const planConfig = getPlanConfig(org.plan);
    const [deviceCount, reportCountCurrentMonth, aiUsageCurrentMonth] = await Promise.all([
      this.prisma.device.count({ where: { orgId, inactive: false } }),
      this.countReportsThisMonth(orgId),
      this.countAiQueriesThisMonth(orgId),
    ]);

    return {
      devices: { used: deviceCount, limit: planConfig.limits.maxDevices },
      reports: { used: reportCountCurrentMonth, limit: planConfig.limits.maxReportsPerMonth },
      aiQueries: { used: aiUsageCurrentMonth, limit: planConfig.limits.maxAiQueriesPerMonth },
    };
  }

  async getAllEntitlements(orgId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      include: { subscription: true },
    });
    if (!org) throw new NotFoundException('Organization not found');

    const planConfig = getPlanConfig(org.plan);
    const history = await this.getBillingHistory(orgId);

    return {
      organization: { id: org.id, name: org.name, slug: org.slug },
      plan: org.plan,
      planConfig,
      subscription: org.subscription,
      invoices: history,
    };
  }

  async handleStripeWebhook(body: Buffer, signature: string) {
    let event: any;
    try {
      event = this.stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);
    } catch {
      throw new BadRequestException('Invalid webhook signature');
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object as Record<string, any>);
        break;
      case 'invoice.paid':
        await this.handleInvoicePaid(event.data.object as Record<string, any>);
        break;
      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(event.data.object as Record<string, any>);
        break;
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as Record<string, any>);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Record<string, any>);
        break;
    }

    return { received: true };
  }

  private async handleCheckoutCompleted(session: Record<string, any>) {
    const orgId = session.metadata?.orgId;
    if (!orgId) return;

    const subscriptionId = session.subscription;
    if (!subscriptionId) return;

    const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);

    const planTier = this.mapStripePriceToPlan(subscription.items.data[0]?.price?.id || '');

    const existingSub = await this.prisma.subscription.findUnique({ where: { orgId } });
    if (existingSub) {
      await this.prisma.subscription.update({
        where: { orgId },
        data: {
          stripeSubscriptionId: subscriptionId,
          stripeCustomerId: session.customer,
          status: this.mapStripeStatus(subscription.status),
          plan: planTier,
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        },
      });
    } else {
      await this.prisma.subscription.create({
        data: {
          orgId,
          stripeSubscriptionId: subscriptionId,
          stripeCustomerId: session.customer,
          status: this.mapStripeStatus(subscription.status),
          plan: planTier,
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        },
      });
    }

    await this.prisma.organization.update({
      where: { id: orgId },
      data: { plan: planTier, stripeCustomerId: session.customer },
    });

    await this.handleGracefulDowngrade(orgId, planTier);
  }

  private async handleInvoicePaid(invoice: Record<string, any>) {
    const orgId = invoice.metadata?.orgId || invoice.subscription_details?.metadata?.orgId;
    if (!orgId) return;

    const sub = await this.prisma.subscription.findUnique({ where: { orgId } });
    if (!sub) return;

    await this.prisma.invoice.create({
      data: {
        subscriptionId: sub.id,
        orgId,
        stripeInvoiceId: invoice.id,
        amount: invoice.amount_paid,
        currency: invoice.currency,
        status: invoice.status || 'paid',
        paid: invoice.paid,
        invoicePdf: invoice.invoice_pdf,
        periodStart: invoice.period_start ? new Date(invoice.period_start * 1000) : null,
        periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000) : null,
      },
    });
  }

  private async handleInvoicePaymentFailed(invoice: Record<string, any>) {
    const orgId = invoice.metadata?.orgId || invoice.subscription_details?.metadata?.orgId;
    if (!orgId) return;

    const sub = await this.prisma.subscription.findUnique({ where: { orgId } });
    if (!sub) return;

    await this.prisma.invoice.create({
      data: {
        subscriptionId: sub.id,
        orgId,
        stripeInvoiceId: invoice.id,
        amount: invoice.amount_due,
        currency: invoice.currency,
        status: invoice.status || 'unpaid',
        paid: false,
        invoicePdf: invoice.invoice_pdf,
        periodStart: invoice.period_start ? new Date(invoice.period_start * 1000) : null,
        periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000) : null,
      },
    });

    await this.prisma.subscription.update({
      where: { orgId },
      data: { status: 'PastDue' },
    });
  }

  private async handleSubscriptionUpdated(subscription: Record<string, any>) {
    const orgId = subscription.metadata?.orgId;
    if (!orgId) return;

    const planTier = this.mapStripePriceToPlan(subscription.items.data[0]?.price?.id || '');

    await this.prisma.subscription.upsert({
      where: { orgId },
      update: {
        stripeSubscriptionId: subscription.id,
        status: this.mapStripeStatus(subscription.status),
        plan: planTier,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
      create: {
        orgId,
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: subscription.customer,
        status: this.mapStripeStatus(subscription.status),
        plan: planTier,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
    });

    await this.prisma.organization.update({
      where: { id: orgId },
      data: { plan: planTier },
    });

    await this.handleGracefulDowngrade(orgId, planTier);
  }

  private async handleSubscriptionDeleted(subscription: Record<string, any>) {
    const orgId = subscription.metadata?.orgId;
    if (!orgId) return;

    await this.prisma.subscription.update({
      where: { orgId },
      data: { status: 'Canceled' },
    });

    await this.prisma.organization.update({
      where: { id: orgId },
      data: { plan: 'Free' },
    });

    await this.handleGracefulDowngrade(orgId, PlanTier.Free);
  }

  async handleGracefulDowngrade(orgId: string, newPlan: string) {
    const planConfig = getPlanConfig(newPlan);
    const activeDevices = await this.prisma.device.findMany({
      where: { orgId, inactive: false },
      orderBy: { registeredAt: 'asc' },
    });

    if (activeDevices.length > planConfig.limits.maxDevices) {
      const excessDevices = activeDevices.slice(planConfig.limits.maxDevices);
      await this.prisma.device.updateMany({
        where: { id: { in: excessDevices.map((d) => d.id) } },
        data: { inactive: true },
      });
    }

    if (activeDevices.length <= planConfig.limits.maxDevices) {
      const inactiveDevices = await this.prisma.device.findMany({
        where: { orgId, inactive: true },
        take: planConfig.limits.maxDevices - activeDevices.length,
        orderBy: { registeredAt: 'desc' },
      });

      if (inactiveDevices.length > 0) {
        await this.prisma.device.updateMany({
          where: { id: { in: inactiveDevices.map((d) => d.id) } },
          data: { inactive: false },
        });
      }
    }
  }

  async checkDeviceLimit(orgId: string): Promise<boolean> {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) return false;

    const planConfig = getPlanConfig(org.plan);
    const deviceCount = await this.prisma.device.count({ where: { orgId, inactive: false } });
    return deviceCount < planConfig.limits.maxDevices;
  }

  async checkReportLimit(orgId: string): Promise<boolean> {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) return false;

    const planConfig = getPlanConfig(org.plan);
    const count = await this.countReportsThisMonth(orgId);
    return count < planConfig.limits.maxReportsPerMonth;
  }

  async checkAiQuota(orgId: string): Promise<boolean> {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) return false;

    const planConfig = getPlanConfig(org.plan);
    const count = await this.countAiQueriesThisMonth(orgId);
    return count < planConfig.limits.maxAiQueriesPerMonth;
  }

  async checkFeatureAccess(orgId: string, feature: string): Promise<boolean> {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) return false;

    const planConfig = getPlanConfig(org.plan);
    const features = planConfig.features as unknown as Record<string, boolean>;
    return features[feature] ?? false;
  }

  private async countReportsThisMonth(orgId: string): Promise<number> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    return this.prisma.report.count({
      where: { orgId, createdAt: { gte: startOfMonth } },
    });
  }

  private async countAiQueriesThisMonth(orgId: string): Promise<number> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    return this.prisma.aiUsageLog.count({
      where: { orgId, createdAt: { gte: startOfMonth } },
    });
  }

  private mapStripePriceToPlan(priceId: string): PlanTier {
    for (const [tier, config] of Object.entries(PLAN_CONFIGS)) {
      if (config.stripePriceId === priceId) return tier as PlanTier;
    }
    return PlanTier.Free;
  }

  private mapStripeStatus(status: string): any {
    const map: Record<string, any> = {
      active: 'Active',
      past_due: 'PastDue',
      canceled: 'Canceled',
      incomplete: 'Incomplete',
      incomplete_expired: 'IncompleteExpired',
      trialing: 'Trialing',
      unpaid: 'Unpaid',
      paused: 'Paused',
    };
    return map[status] || 'Active';
  }
}
