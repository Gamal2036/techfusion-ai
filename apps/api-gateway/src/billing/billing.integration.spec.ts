import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BillingService } from './billing.service';
import { PrismaService } from '../prisma/prisma.service';

describe('BillingService (integration)', () => {
  let service: BillingService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      organization: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      subscription: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      invoice: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      device: {
        count: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      report: { count: jest.fn().mockResolvedValue(0) },
      aiUsageLog: { count: jest.fn().mockResolvedValue(0) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
    // Replace the Stripe instance with a mock
    (service as any).stripe = {
      customers: { create: jest.fn().mockResolvedValue({ id: 'cus_mock' }) },
      checkout: { sessions: { create: jest.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/test', id: 'cs_test' }) } },
      billingPortal: { sessions: { create: jest.fn().mockResolvedValue({ url: 'https://portal.stripe.com/test' }) } },
      subscriptions: { retrieve: jest.fn().mockResolvedValue({ id: 'sub_mock', status: 'active', current_period_start: Math.floor(Date.now() / 1000), current_period_end: Math.floor(Date.now() / 1000) + 2592000, items: { data: [{ price: { id: 'price_pro' } }] } }) },
      webhooks: { constructEvent: jest.fn() },
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getOrCreateStripeCustomer', () => {
    it('returns existing stripeCustomerId', async () => {
      prisma.organization.findUnique.mockResolvedValue({ id: 'org-1', stripeCustomerId: 'cus_existing' });
      const result = await service.getOrCreateStripeCustomer('org-1');
      expect(result).toBe('cus_existing');
    });

    it('creates new customer if none exists', async () => {
      prisma.organization.findUnique.mockResolvedValue({ id: 'org-1', name: 'Test Org', stripeCustomerId: null });
      const result = await service.getOrCreateStripeCustomer('org-1');
      expect(result).toBe('cus_mock');
      expect(prisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'org-1' }, data: { stripeCustomerId: 'cus_mock' } }),
      );
    });

    it('throws NotFoundException for missing org', async () => {
      prisma.organization.findUnique.mockResolvedValue(null);
      await expect(service.getOrCreateStripeCustomer('org-nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getCurrentPlan', () => {
    it('returns plan info with usage', async () => {
      prisma.organization.findUnique.mockResolvedValue({
        id: 'org-1',
        name: 'Test Org',
        plan: 'Pro',
        subscription: { status: 'Active', currentPeriodEnd: new Date(), cancelAtPeriodEnd: false },
      });
      prisma.device.count.mockResolvedValue(5);

      const result = await service.getCurrentPlan('org-1');
      expect(result.plan).toBe('Pro');
      expect(result.limits.maxDevices).toBe(25);
      expect(result.usage.devices).toBe(5);
      expect(result.subscription).toBeDefined();
    });

    it('returns Free plan info when no subscription exists', async () => {
      prisma.organization.findUnique.mockResolvedValue({
        id: 'org-2',
        name: 'Free Org',
        plan: 'Free',
        subscription: null,
      });
      prisma.device.count.mockResolvedValue(1);

      const result = await service.getCurrentPlan('org-2');
      expect(result.plan).toBe('Free');
      expect(result.subscription).toBeNull();
      expect(result.price).toBe(0);
    });

    it('throws NotFoundException for missing org', async () => {
      prisma.organization.findUnique.mockResolvedValue(null);
      await expect(service.getCurrentPlan('org-nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('checkDeviceLimit', () => {
    it('returns true when under limit', async () => {
      prisma.organization.findUnique.mockResolvedValue({ plan: 'Pro' });
      prisma.device.count.mockResolvedValue(10);
      const result = await service.checkDeviceLimit('org-1');
      expect(result).toBe(true);
    });

    it('returns false when at limit', async () => {
      prisma.organization.findUnique.mockResolvedValue({ plan: 'Free' });
      prisma.device.count.mockResolvedValue(3);
      const result = await service.checkDeviceLimit('org-1');
      expect(result).toBe(false);
    });

    it('returns false when over limit', async () => {
      prisma.organization.findUnique.mockResolvedValue({ plan: 'Free' });
      prisma.device.count.mockResolvedValue(5);
      const result = await service.checkDeviceLimit('org-1');
      expect(result).toBe(false);
    });
  });

  describe('handleGracefulDowngrade', () => {
    it('marks excess devices as inactive when downgrading', async () => {
      prisma.device.findMany.mockResolvedValueOnce([
        { id: 'd1' }, { id: 'd2' }, { id: 'd3' }, { id: 'd4' },
      ]);
      prisma.device.findMany.mockResolvedValueOnce([]);

      await service.handleGracefulDowngrade('org-1', 'Free');
      expect(prisma.device.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: ['d4'] } },
          data: { inactive: true },
        }),
      );
    });

    it('does nothing when under limit for the plan', async () => {
      prisma.device.findMany.mockResolvedValueOnce([{ id: 'd1' }, { id: 'd2' }]);
      prisma.device.findMany.mockResolvedValueOnce([]);

      await service.handleGracefulDowngrade('org-1', 'Pro');
      expect(prisma.device.updateMany).not.toHaveBeenCalled();
    });

    it('reactivates devices when upgrading to higher plan', async () => {
      prisma.device.findMany
        .mockResolvedValueOnce([{ id: 'd1' }]) // active devices
        .mockResolvedValueOnce([{ id: 'd2' }]); // inactive devices available

      await service.handleGracefulDowngrade('org-1', 'Pro');
      expect(prisma.device.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: ['d2'] } },
          data: { inactive: false },
        }),
      );
    });
  });

  describe('checkFeatureAccess', () => {
    it('returns true for feature available on plan', async () => {
      prisma.organization.findUnique.mockResolvedValue({ plan: 'Business' });
      const result = await service.checkFeatureAccess('org-1', 'remoteSupport');
      expect(result).toBe(true);
    });

    it('returns false for feature not available on plan', async () => {
      prisma.organization.findUnique.mockResolvedValue({ plan: 'Pro' });
      const result = await service.checkFeatureAccess('org-1', 'remoteSupport');
      expect(result).toBe(false);
    });

    it('returns false for unknown org', async () => {
      prisma.organization.findUnique.mockResolvedValue(null);
      const result = await service.checkFeatureAccess('org-nonexistent', 'remoteSupport');
      expect(result).toBe(false);
    });
  });

  describe('handleStripeWebhook', () => {
    it('throws BadRequestException on invalid signature', async () => {
      const stripe = (service as any).stripe;
      stripe.webhooks.constructEvent.mockImplementation(() => { throw new Error('Invalid signature'); });
      await expect(
        service.handleStripeWebhook(Buffer.from('{}'), 'bad_sig'),
      ).rejects.toThrow(BadRequestException);
    });

    it('processes checkout.session.completed event', async () => {
      const stripe = (service as any).stripe;
      stripe.webhooks.constructEvent.mockReturnValue({
        type: 'checkout.session.completed',
        data: {
          object: {
            metadata: { orgId: 'org-1' },
            subscription: 'sub_mock_test',
            customer: 'cus_test',
          },
        },
      });
      stripe.subscriptions.retrieve.mockResolvedValue({
        id: 'sub_mock_test',
        status: 'active',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 2592000,
        items: { data: [{ price: { id: 'price_pro' } }] },
      });

      prisma.subscription.findUnique.mockResolvedValue(null);
      prisma.subscription.create.mockResolvedValue({ id: 'sub-1' });
      prisma.organization.update.mockResolvedValue({});
      prisma.device.findMany.mockResolvedValue([]);

      const result = await service.handleStripeWebhook(Buffer.from('{}'), 'valid_sig');
      expect(result).toEqual({ received: true });
      expect(prisma.subscription.create).toHaveBeenCalled();
      expect(prisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'org-1' }, data: expect.objectContaining({ plan: 'Pro' }) }),
      );
    });

    it('processes customer.subscription.updated event', async () => {
      const stripe = (service as any).stripe;
      stripe.webhooks.constructEvent.mockReturnValue({
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_mock_test',
            metadata: { orgId: 'org-1' },
            customer: 'cus_test',
            status: 'active',
            current_period_start: Math.floor(Date.now() / 1000),
            current_period_end: Math.floor(Date.now() / 1000) + 2592000,
            cancel_at_period_end: false,
            items: { data: [{ price: { id: 'price_business' } }] },
          },
        },
      });

      prisma.subscription.upsert.mockResolvedValue({ id: 'sub-1' });
      prisma.organization.update.mockResolvedValue({});
      prisma.device.findMany.mockResolvedValue([]);

      const result = await service.handleStripeWebhook(Buffer.from('{}'), 'valid_sig');
      expect(result).toEqual({ received: true });
      expect(prisma.subscription.upsert).toHaveBeenCalled();
      expect(prisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'org-1' }, data: { plan: 'Business' } }),
      );
    });

    it('processes customer.subscription.deleted event and resets to Free', async () => {
      const stripe = (service as any).stripe;
      stripe.webhooks.constructEvent.mockReturnValue({
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_mock_test',
            metadata: { orgId: 'org-1' },
          },
        },
      });

      prisma.subscription.update.mockResolvedValue({});
      prisma.organization.update.mockResolvedValue({});
      prisma.device.findMany.mockResolvedValue([]);

      const result = await service.handleStripeWebhook(Buffer.from('{}'), 'valid_sig');
      expect(result).toEqual({ received: true });
      expect(prisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'org-1' }, data: { plan: 'Free' } }),
      );
    });

    it('processes invoice.paid event and creates invoice record', async () => {
      const stripe = (service as any).stripe;
      stripe.webhooks.constructEvent.mockReturnValue({
        type: 'invoice.paid',
        data: {
          object: {
            id: 'in_mock',
            metadata: { orgId: 'org-1' },
            subscription_details: { metadata: { orgId: 'org-1' } },
            amount_paid: 2900,
            currency: 'usd',
            status: 'paid',
            paid: true,
            invoice_pdf: 'https://invoice.stripe.com/pdf',
            period_start: Math.floor(Date.now() / 1000),
            period_end: Math.floor(Date.now() / 1000) + 2592000,
          },
        },
      });

      prisma.subscription.findUnique.mockResolvedValue({ id: 'sub-1' });
      prisma.invoice.create.mockResolvedValue({});

      const result = await service.handleStripeWebhook(Buffer.from('{}'), 'valid_sig');
      expect(result).toEqual({ received: true });
      expect(prisma.invoice.create).toHaveBeenCalled();
    });

    it('processes invoice.payment_failed event', async () => {
      const stripe = (service as any).stripe;
      stripe.webhooks.constructEvent.mockReturnValue({
        type: 'invoice.payment_failed',
        data: {
          object: {
            id: 'in_mock_failed',
            metadata: { orgId: 'org-1' },
            amount_due: 2900,
            currency: 'usd',
            status: 'unpaid',
            paid: false,
            period_start: Math.floor(Date.now() / 1000),
            period_end: Math.floor(Date.now() / 1000) + 2592000,
          },
        },
      });

      prisma.subscription.findUnique.mockResolvedValue({ id: 'sub-1' });
      prisma.invoice.create.mockResolvedValue({});
      prisma.subscription.update.mockResolvedValue({});

      const result = await service.handleStripeWebhook(Buffer.from('{}'), 'valid_sig');
      expect(result).toEqual({ received: true });
      expect(prisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { orgId: 'org-1' }, data: { status: 'PastDue' } }),
      );
    });
  });
});
