'use client';

import { apiFetch, getAccessToken, getApiUrl, setTokens } from './auth-client';

export type OrgRole = 'Owner' | 'Admin' | 'Technician' | 'Viewer';

export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';

export interface OrganizationInvitation {
  id: string;
  organizationId: string;
  email: string;
  role: OrgRole;
  status: InvitationStatus;
  expiresAt: string;
  createdAt: string;
  invitedBy: { userId: string; email: string; displayName: string } | null;
}

export interface CreateInvitationResult extends OrganizationInvitation {
  /** Dev-only invitation link returned once on create/resend; undefined in production. */
  devInvitationUrl?: string;
}

export interface InvitationInspection {
  organization: { id: string; name: string };
  role: OrgRole;
  /** Masked for display, e.g. "a***@example.com". */
  email: string;
  status: InvitationStatus;
  expiresAt: string;
}

export interface InvitationAcceptResult {
  organization: { id: string; name: string; slug: string };
  membership: { id: string; userId: string; orgId: string; role: OrgRole };
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  createdAt: string;
  membershipRole: OrgRole;
  isActive: boolean;
}

export interface OrganizationDetail extends Organization {
  deviceCount: number;
  memberCount: number;
}

export interface OrganizationMember {
  membershipId: string;
  userId: string;
  email: string;
  displayName: string;
  role: OrgRole;
  createdAt: string;
  isSelf: boolean;
}

export interface SwitchResult {
  user: { id: string; email: string; displayName: string; role: OrgRole; orgId: string };
  accessToken: string;
  refreshToken: string;
}

export const ORG_SWITCH_EVENT = 'techfusion:organization-switched';

async function readError(res: Response): Promise<string> {
  const body = await res.json().catch(() => null);
  if (body?.message) return body.message;
  return `Request failed (${res.status})`;
}

export class OrgError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'OrgError';
    this.status = status;
  }
}

/**
 * Subscribes to organization switch events. Returns an unsubscribe function.
 * The event fires only after both tokens have been replaced, so listeners can
 * safely invalidate org-scoped state and refetch.
 */
export function listenForOrgSwitch(cb: (orgId: string) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = (e: Event) => {
    const detail = (e as CustomEvent).detail as { orgId?: string } | undefined;
    cb(detail?.orgId ?? '');
  };
  window.addEventListener(ORG_SWITCH_EVENT, handler);
  return () => window.removeEventListener(ORG_SWITCH_EVENT, handler);
}

export async function fetchOrganizations(): Promise<Organization[]> {
  const res = await apiFetch('/organizations');
  if (!res.ok) throw new OrgError(await readError(res), res.status);
  return res.json();
}

export async function fetchCurrentOrganization(): Promise<Organization> {
  const res = await apiFetch('/organizations/current');
  if (!res.ok) throw new OrgError(await readError(res), res.status);
  return res.json();
}

export async function fetchOrganizationDetail(orgId: string): Promise<OrganizationDetail> {
  const res = await apiFetch(`/organizations/${orgId}`);
  if (!res.ok) throw new OrgError(await readError(res), res.status);
  return res.json();
}

export async function createOrganization(name: string): Promise<Organization> {
  const res = await apiFetch('/organizations', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new OrgError(await readError(res), res.status);
  return res.json();
}

export async function renameOrganization(orgId: string, name: string): Promise<Organization> {
  const res = await apiFetch(`/organizations/${orgId}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new OrgError(await readError(res), res.status);
  return res.json();
}

export async function fetchMembers(orgId: string): Promise<OrganizationMember[]> {
  const res = await apiFetch(`/organizations/${orgId}/members`);
  if (!res.ok) throw new OrgError(await readError(res), res.status);
  return res.json();
}

export async function updateMemberRole(
  orgId: string,
  userId: string,
  role: OrgRole,
): Promise<OrganizationMember> {
  const res = await apiFetch(`/organizations/${orgId}/members/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
  if (!res.ok) throw new OrgError(await readError(res), res.status);
  return res.json();
}

export async function removeMember(orgId: string, userId: string): Promise<void> {
  const res = await apiFetch(`/organizations/${orgId}/members/${userId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new OrgError(await readError(res), res.status);
}

export async function leaveOrganization(orgId: string): Promise<SwitchResult | { message: string }> {
  const res = await apiFetch(`/organizations/${orgId}/leave`, { method: 'POST' });
  if (!res.ok) throw new OrgError(await readError(res), res.status);
  return res.json();
}

export async function createInvitation(
  orgId: string,
  email: string,
  role: OrgRole,
): Promise<CreateInvitationResult> {
  const res = await apiFetch(`/organizations/${orgId}/invitations`, {
    method: 'POST',
    body: JSON.stringify({ email, role }),
  });
  if (!res.ok) throw new OrgError(await readError(res), res.status);
  return res.json();
}

export async function fetchInvitations(orgId: string): Promise<OrganizationInvitation[]> {
  const res = await apiFetch(`/organizations/${orgId}/invitations`);
  if (!res.ok) throw new OrgError(await readError(res), res.status);
  return res.json();
}

export async function revokeInvitation(orgId: string, invitationId: string): Promise<void> {
  const res = await apiFetch(`/organizations/${orgId}/invitations/${invitationId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new OrgError(await readError(res), res.status);
}

export async function resendInvitation(
  orgId: string,
  invitationId: string,
): Promise<CreateInvitationResult> {
  const res = await apiFetch(`/organizations/${orgId}/invitations/${invitationId}/resend`, {
    method: 'POST',
  });
  if (!res.ok) throw new OrgError(await readError(res), res.status);
  return res.json();
}

/**
 * Public token inspection — no authentication required. Returns only safe
 * metadata (org name, role, masked email, status, expiry).
 */
export async function inspectInvitation(token: string): Promise<InvitationInspection> {
  const res = await fetch(`${getApiUrl()}/invitations/${encodeURIComponent(token)}`);
  if (!res.ok) throw new OrgError(await readError(res), res.status);
  return res.json();
}

/**
 * Accepts an invitation for the currently authenticated user. The membership
 * is created with the invitation's stored role only; email ownership is
 * enforced server-side against the authenticated account.
 */
export async function acceptInvitation(token: string): Promise<InvitationAcceptResult> {
  const res = await apiFetch(`/invitations/${encodeURIComponent(token)}/accept`, {
    method: 'POST',
  });
  if (!res.ok) throw new OrgError(await readError(res), res.status);
  return res.json();
}

/**
 * Switches the active organization.
 *
 * Contract (ORG-01C §6/§7):
 * 1. POST /organizations/:id/switch must be membership-validated server-side.
 * 2. On success the access + refresh token pair is replaced in a single
 *    synchronous block — a mixed pair (new access + old refresh) is never
 *    observable by the rest of the client because nothing yields between the
 *    two writes.
 * 3. Old organization WebSockets are disconnected so no socket continues to
 *    hold a token for the previous org.
 * 4. An `ORG_SWITCH_EVENT` is dispatched so the shell can remount org-scoped
 *    UI (unmounting Org A components prevents a late Org A response from
 *    overwriting Org B state) and reconnect sockets with the new token.
 */
export async function switchToOrganization(orgId: string): Promise<SwitchResult> {
  const res = await apiFetch(`/organizations/${orgId}/switch`, { method: 'POST' });
  if (!res.ok) throw new OrgError(await readError(res), res.status);

  const data = (await res.json()) as SwitchResult;
  if (!data.accessToken || !data.refreshToken) {
    throw new OrgError('Switch response was missing a token pair', 500);
  }

  // Atomic token-pair replacement: synchronous, no yields between writes.
  setTokens(data.accessToken, data.refreshToken);

  try {
    const { disconnectAll } = await import('./socket-client');
    disconnectAll();
  } catch {
    // socket-client may not be loaded yet
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(ORG_SWITCH_EVENT, { detail: { orgId: data.user.orgId } }),
    );
  }

  return data;
}

/** Current active org id from the stored access token. */
export function getActiveOrgId(): string | null {
  return getAccessToken() ? decodeOrgId(getAccessToken()!) : null;
}

function decodeOrgId(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return typeof payload.orgId === 'string' ? payload.orgId : null;
  } catch {
    return null;
  }
}
