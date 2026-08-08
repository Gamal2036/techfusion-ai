'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
  Badge,
} from '@techfusion/ui';
import {
  Building2,
  Check,
  Loader2,
  Plus,
  Settings,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';
import {
  createOrganization,
  fetchOrganizations,
  switchToOrganization,
  type Organization,
} from '@/lib/org-client';

function roleBadgeVariant(role: string): 'primary' | 'success' | 'warning' | 'secondary' {
  switch (role) {
    case 'Owner': return 'primary';
    case 'Admin': return 'success';
    case 'Technician': return 'warning';
    default: return 'secondary';
  }
}

interface OrganizationSwitcherProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OrganizationSwitcher({ open, onOpenChange }: OrganizationSwitcherProps) {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setOrganizations(await fetchOrganizations());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load organizations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setShowCreate(false);
      setName('');
      setError(null);
      load();
    }
  }, [open]);

  const handleSwitch = async (org: Organization) => {
    if (org.isActive) {
      onOpenChange(false);
      return;
    }
    setSwitchingId(org.id);
    setError(null);
    try {
      await switchToOrganization(org.id);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to switch organization');
    } finally {
      setSwitchingId(null);
    }
  };

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCreating(true);
    setError(null);
    try {
      const org = await createOrganization(trimmed);
      setName('');
      await switchToOrganization(org.id);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create organization');
    } finally {
      setCreating(false);
    }
  };

  const switching = switchingId !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Switch Organization</DialogTitle>
          <DialogDescription>
            Choose the organization you want to work in, or create a new one.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-danger"
          >
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-1 max-h-64 overflow-y-auto" aria-busy={loading}>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-text-disabled" />
              <span className="sr-only">Loading organizations</span>
            </div>
          ) : organizations.length === 0 ? (
            <p className="py-6 text-center text-sm text-text-disabled">
              No organizations found.
            </p>
          ) : (
            organizations.map((org) => {
              const isCurrent = org.isActive;
              const isSwitching = switchingId === org.id;
              return (
                <button
                  key={org.id}
                  type="button"
                  disabled={switching && !isSwitching}
                  onClick={() => handleSwitch(org)}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                    isCurrent
                      ? 'border-primary-500/40 bg-primary-600/10'
                      : 'border-border bg-surface hover:bg-surface-subtle'
                  } disabled:opacity-50`}
                  aria-current={isCurrent || undefined}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-muted">
                    <Building2 className="h-4 w-4 text-text-secondary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-text-primary">
                        {org.name}
                      </span>
                      <Badge variant={roleBadgeVariant(org.membershipRole)} className="text-[10px]">
                        {org.membershipRole}
                      </Badge>
                    </div>
                    {isCurrent && (
                      <p className="mt-0.5 text-xs text-text-disabled">Current organization</p>
                    )}
                  </div>
                  {isSwitching ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                  ) : isCurrent ? (
                    <Check className="h-4 w-4 shrink-0 text-primary" aria-label="Active" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-text-disabled" />
                  )}
                </button>
              );
            })
          )}
        </div>

        {showCreate ? (
          <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
            <label htmlFor="new-org-name" className="block text-xs font-medium text-text-secondary">
              Organization name
            </label>
            <input
              id="new-org-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !creating) handleCreate();
              }}
              placeholder="e.g. TechFusion Lab"
              maxLength={100}
              autoFocus
              className="h-9 w-full rounded-lg border border-border bg-surface-subtle px-3 text-sm text-text-primary placeholder:text-text-disabled outline-none focus:border-primary-500/40"
            />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleCreate}
                loading={creating}
                loadingText="Creating…"
                disabled={!name.trim()}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Create & Switch
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            </div>
            <p className="text-xs text-text-disabled">
              You will be switched to the new organization immediately. It starts empty.
            </p>
          </div>
        ) : (
          <Button
            variant="outline"
            fullWidth
            onClick={() => setShowCreate(true)}
            disabled={switching}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Create Organization
          </Button>
        )}

        <div className="mt-1 border-t border-border pt-3">
          <Button
            variant="ghost"
            size="sm"
            fullWidth
            disabled={switching}
            onClick={() => {
              onOpenChange(false);
              router.push('/dashboard/settings/organization');
            }}
          >
            <Settings className="mr-1.5 h-3.5 w-3.5" />
            Manage Organizations
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
