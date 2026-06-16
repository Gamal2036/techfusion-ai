'use client';

import { useState } from 'react';
import { GlassPanel, Button, Badge, Card, CardHeader, CardTitle, CardContent, Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@techfusion/ui';
import { CreditCard, Check, X, ArrowUpCircle, ExternalLink, Loader2, AlertTriangle } from 'lucide-react';
import { usePlan, useBillingHistory, createCheckoutSession, createPortalSession } from '@/hooks/useBilling';
import { cn } from '@techfusion/ui';

const PLAN_DETAILS = [
  {
    tier: 'Free',
    label: 'Free',
    price: '$0',
    period: 'forever',
    color: 'text-white/60',
    borderColor: 'border-white/10',
    features: ['3 devices', '5 reports/month', '100 AI queries/month', '1 team member', '5 alert rules', 'Basic monitoring'],
  },
  {
    tier: 'Pro',
    label: 'Pro',
    price: '$29',
    period: '/month',
    color: 'text-blue-400',
    borderColor: 'border-blue-500/30',
    features: ['25 devices', '50 reports/month', '1,000 AI queries/month', '5 team members', '20 alert rules', 'Analytics export', 'Custom branding', 'API access'],
  },
  {
    tier: 'Business',
    label: 'Business',
    price: '$99',
    period: '/month',
    color: 'text-purple-400',
    borderColor: 'border-purple-500/30',
    popular: true,
    features: ['100 devices', '200 reports/month', '5,000 AI queries/month', '20 team members', '50 alert rules', 'Analytics export', 'Custom branding', 'Remote Support', 'API access', 'Priority support'],
  },
  {
    tier: 'Enterprise',
    label: 'Enterprise',
    price: '$299',
    period: '/month',
    color: 'text-amber-400',
    borderColor: 'border-amber-500/30',
    features: ['Unlimited devices', 'Unlimited reports', 'Unlimited AI queries', 'Unlimited team members', 'Unlimited alert rules', 'All features', 'SSO', 'API access', 'Premium support'],
  },
];

function UsageBar({ used, limit, label }: { used: number; limit: number; label: string }) {
  const pct = Math.min((used / Math.max(limit, 1)) * 100, 100);
  const isNearLimit = pct >= 80;
  const isAtLimit = pct >= 100;

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-white/60">{label}</span>
        <span className={cn(
          'font-medium',
          isAtLimit ? 'text-red-400' : isNearLimit ? 'text-amber-400' : 'text-white/80',
        )}>
          {used} / {limit === 999999 ? '∞' : limit}
        </span>
      </div>
      <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            isAtLimit ? 'bg-red-500' : isNearLimit ? 'bg-amber-500' : 'bg-primary-500',
          )}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

export default function BillingPage() {
  const { plan, loading: planLoading, refetch: refetchPlan } = usePlan();
  const { invoices, loading: invoicesLoading } = useBillingHistory();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleUpgrade(priceId: string, tier: string) {
    setActionLoading(tier);
    setError(null);
    try {
      const { url } = await createCheckoutSession(priceId);
      if (url) window.location.href = url;
    } catch (e) {
      setError('Failed to create checkout session. Please try again.');
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleManageSubscription() {
    setActionLoading('portal');
    setError(null);
    try {
      const { url } = await createPortalSession();
      if (url) window.location.href = url;
    } catch (e) {
      setError('Failed to open billing portal. Please try again.');
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  }

  const currentTier = plan?.plan || 'Free';
  const currentTierIndex = PLAN_DETAILS.findIndex((p) => p.tier === currentTier);

  if (planLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-white/40" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">Billing & Plans</h1>
          <p className="text-sm text-white/40 mt-1">Manage your subscription, view usage, and upgrade your plan.</p>
        </div>
        {plan?.subscription && (
          <Button variant="outline" onClick={handleManageSubscription} disabled={actionLoading === 'portal'}>
            {actionLoading === 'portal' ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ExternalLink className="h-4 w-4 mr-2" />
            )}
            Manage Subscription
          </Button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-600/10 border border-red-500/20 text-red-300 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      )}

      {/* Current Plan */}
      <GlassPanel intensity="medium" className="p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-white">Current Plan</h2>
              <Badge variant="primary">{plan?.label || 'Free'}</Badge>
              {plan?.subscription?.cancelAtPeriodEnd && (
                <Badge variant="warning">Cancels at period end</Badge>
              )}
            </div>
            <p className="text-sm text-white/40 mt-1">
              ${((plan?.price ?? 0) / 100).toFixed(2)}/month
              {plan?.subscription?.currentPeriodEnd && (
                <> &middot; Current period ends {new Date(plan.subscription.currentPeriodEnd).toLocaleDateString()}</>
              )}
            </p>
          </div>
          {plan?.subscription?.status && (
            <Badge variant={plan.subscription.status === 'Active' ? 'success' : 'warning'}>
              {plan.subscription.status}
            </Badge>
          )}
        </div>

        {/* Usage Meters */}
        {plan && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <UsageBar used={plan.usage.devices} limit={plan.limits.maxDevices} label="Devices" />
            <UsageBar used={plan.usage.reports} limit={plan.limits.maxReportsPerMonth} label="Reports (this month)" />
            <UsageBar used={plan.usage.aiQueries} limit={plan.limits.maxAiQueriesPerMonth} label="AI Queries (this month)" />
          </div>
        )}
      </GlassPanel>

      {/* Plan Comparison */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Compare Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {PLAN_DETAILS.map((p) => {
            const isCurrent = p.tier === currentTier;
            const isUpgrade = PLAN_DETAILS.indexOf(p) > currentTierIndex;
            const isDowngrade = PLAN_DETAILS.indexOf(p) < currentTierIndex && p.tier !== 'Free';

            return (
              <Card
                key={p.tier}
                className={cn(
                  'relative flex flex-col border transition-all duration-200',
                  isCurrent ? `${p.borderColor} ring-1 ring-primary-500/20` : p.borderColor,
                  p.popular && !isCurrent && 'scale-[1.02]',
                )}
              >
                {p.popular && !isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge variant="primary">Most Popular</Badge>
                  </div>
                )}
                <CardHeader>
                  <CardTitle className={p.color}>{p.label}</CardTitle>
                  <div className="mt-2">
                    <span className="text-3xl font-bold text-white">{p.price}</span>
                    <span className="text-sm text-white/40 ml-1">{p.period}</span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <ul className="space-y-2.5 flex-1">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-400 mt-0.5 shrink-0" />
                        <span className="text-white/70">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6">
                    {isCurrent ? (
                      <Button variant="outline" className="w-full" disabled>
                        Current Plan
                      </Button>
                    ) : (
                      <Button
                        variant={isUpgrade ? 'default' : 'outline'}
                        className="w-full"
                        onClick={() => handleUpgrade(
                          p.tier === 'Pro' ? 'price_pro' :
                          p.tier === 'Business' ? 'price_business' :
                          p.tier === 'Enterprise' ? 'price_enterprise' : '',
                          p.tier,
                        )}
                        disabled={actionLoading === p.tier}
                      >
                        {actionLoading === p.tier ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : isUpgrade ? (
                          <ArrowUpCircle className="h-4 w-4 mr-2" />
                        ) : null}
                        {isUpgrade ? 'Upgrade' : isDowngrade ? 'Downgrade' : 'Contact Sales'}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Billing History (Owner only) */}
      {!invoicesLoading && invoices.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Billing History</h2>
          <GlassPanel intensity="medium" className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Invoice</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="text-white/70">
                      {new Date(inv.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-white">
                      ${(inv.amount / 100).toFixed(2)} {inv.currency.toUpperCase()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={inv.paid ? 'success' : 'destructive'}>
                        {inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {inv.invoicePdf ? (
                        <a
                          href={inv.invoicePdf}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-400 hover:text-primary-300 text-sm flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          PDF
                        </a>
                      ) : (
                        <span className="text-white/30 text-sm">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </GlassPanel>
        </div>
      )}

      {/* Contact for Enterprise */}
      <GlassPanel intensity="light" className="p-6 text-center">
        <h3 className="text-base font-medium text-white">Need a custom plan?</h3>
        <p className="text-sm text-white/40 mt-1 max-w-md mx-auto">
          Contact our sales team for custom pricing, SSO, dedicated support, and more.
        </p>
        <Button variant="outline" className="mt-4" asChild>
          <a href="mailto:sales@techfusion.ai">Contact Sales</a>
        </Button>
      </GlassPanel>
    </div>
  );
}
