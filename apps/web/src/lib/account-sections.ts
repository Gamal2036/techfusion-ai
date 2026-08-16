'use client';

import { useEffect, useState } from 'react';

/**
 * ACC-UX-02C — Account settings section navigation. Section identity travels
 * in the URL fragment (#profile / #security / #organization / #danger) so the
 * location is shareable, back/forward work natively, and no section state is
 * held in a non-authoritative store.
 */
export const ACCOUNT_SECTIONS = [
  { id: 'profile', label: 'Profile' },
  { id: 'security', label: 'Security' },
  { id: 'organization', label: 'Organization' },
  { id: 'danger', label: 'Danger Zone' },
] as const;

export type AccountSectionId = (typeof ACCOUNT_SECTIONS)[number]['id'];

export function isAccountSectionId(value: string): value is AccountSectionId {
  return ACCOUNT_SECTIONS.some((section) => section.id === value);
}

export function useAccountSection(): AccountSectionId {
  const [section, setSection] = useState<AccountSectionId>('profile');

  useEffect(() => {
    const read = () => {
      const hash = window.location.hash.replace(/^#/, '');
      setSection(isAccountSectionId(hash) ? hash : 'profile');
    };
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);

  return section;
}
