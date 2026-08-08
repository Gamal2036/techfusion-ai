'use client';

import { apiFetch } from './auth-client';

export interface DeletionBlocker {
  organizationId: string;
  organizationName: string;
  reason: 'SOLE_OWNER';
}

export interface EmptyOrganizationToRemove {
  organizationId: string;
  organizationName: string;
}

export interface DeletionPreview {
  canDelete: boolean;
  blockers: DeletionBlocker[];
  membershipsCount: number;
  ownedOrganizationsCount: number;
  emptyOrganizationsToRemove: EmptyOrganizationToRemove[];
}

export interface DeleteAccountResult {
  message: string;
  removedOrganizations: string[];
}

async function readError(res: Response): Promise<string> {
  const body = await res.json().catch(() => null);
  if (body?.message) return body.message;
  return `Request failed (${res.status})`;
}

export class AccountError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'AccountError';
    this.status = status;
  }
}

/** GET /auth/account/deletion-preview — eligibility for account deletion. */
export async function fetchDeletionPreview(): Promise<DeletionPreview> {
  const res = await apiFetch('/auth/account/deletion-preview');
  if (!res.ok) throw new AccountError(await readError(res), res.status);
  return res.json();
}

/** DELETE /auth/account — requires the literal confirmation value "DELETE". */
export async function deleteAccount(confirmation: string): Promise<DeleteAccountResult> {
  const res = await apiFetch('/auth/account', {
    method: 'DELETE',
    body: JSON.stringify({ confirmation }),
  });
  if (!res.ok) throw new AccountError(await readError(res), res.status);
  return res.json();
}
