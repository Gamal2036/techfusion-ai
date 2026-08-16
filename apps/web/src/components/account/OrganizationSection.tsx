'use client';

import Link from 'next/link';
import { Badge, Button, GlassPanel } from '@techfusion/ui';
import { Building2, Loader2, Settings2 } from 'lucide-react';
import type { Organization } from '@/lib/org-client';

interface OrganizationSectionProps {
  org: Organization | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

export function OrganizationSection({ org, loading, error, onRetry }: OrganizationSectionProps) {
  return (
    <GlassPanel intensity="light" className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <Building2 className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-medium text-text-primary">Organization</h2>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-text-disabled" role="status">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading organization...
        </div>
      ) : error ? (
        <div className="space-y-3">
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
          <Button variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        </div>
      ) : org ? (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-base font-medium text-text-primary">{org.name}</p>
              <p className="text-xs text-text-muted mt-0.5">/{org.slug}</p>
            </div>
            <Badge variant="default">{org.membershipRole}</Badge>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/settings/organization">
                <Settings2 className="mr-1.5 h-3.5 w-3.5" /> Manage organization
              </Link>
            </Button>
            <span className="text-xs text-text-muted">
              Your role here is shown in the badge; membership changes are managed on the
              organization page.
            </span>
          </div>
        </div>
      ) : null}
    </GlassPanel>
  );
}
