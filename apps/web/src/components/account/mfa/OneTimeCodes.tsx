'use client';

import { useCallback, useState } from 'react';
import { Button } from '@techfusion/ui';
import { Check, Copy } from 'lucide-react';
import { copyText } from '@/lib/clipboard';
import { RECOVERY_CODE_COUNT } from '@/lib/mfa-client';

interface OneTimeCodesProps {
  codes: string[];
}

/**
 * One-time recovery-code display. The parent owns the plaintext codes (they
 * come straight from the backend generation response) and must clear them when
 * the dialog closes. This component never persists anything.
 */
export function OneTimeCodes({ codes }: OneTimeCodesProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const copyOne = useCallback(async (code: string, index: number) => {
    const ok = await copyText(code);
    if (!ok) return;
    setCopiedIndex(index);
    window.setTimeout(() => setCopiedIndex(null), 2000);
  }, []);

  const copyAll = useCallback(async () => {
    const ok = await copyText(codes.join('\n'));
    if (!ok) return;
    setCopiedAll(true);
    window.setTimeout(() => setCopiedAll(false), 2000);
  }, [codes]);

  return (
    <div>
      <p className="text-xs text-text-muted">
        Store these somewhere safe. Each code can be used only once and will never be shown
        again after you close this screen.
      </p>

      <ol className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {codes.map((code, index) => (
          <li
            key={code}
            className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-subtle px-3 py-2"
          >
            <code className="text-sm font-medium tracking-wide text-text-primary">{code}</code>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => copyOne(code, index)}
              aria-label={`Copy recovery code ${index + 1}`}
              className="gap-1"
            >
              {copiedIndex === index ? (
                <Check className="h-3.5 w-3.5 text-success" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copiedIndex === index ? 'Copied' : 'Copy'}
            </Button>
          </li>
        ))}
      </ol>

      <div className="mt-3">
        <Button variant="outline" size="sm" onClick={copyAll} className="gap-1">
          {copiedAll ? (
            <Check className="h-3.5 w-3.5 text-success" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copiedAll ? 'All codes copied' : 'Copy all codes'}
        </Button>
      </div>
      <p className="mt-2 text-xs text-text-muted" role="note">
        {RECOVERY_CODE_COUNT} codes issued. Keep them private — anyone who has one can sign
        in as you.
      </p>
    </div>
  );
}
