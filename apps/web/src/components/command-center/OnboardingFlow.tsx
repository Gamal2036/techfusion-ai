'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Monitor, Loader2, Copy, Check, CheckCircle, Key, AlertTriangle } from 'lucide-react';
import { GlassPanel } from '@techfusion/ui';
import { useDeviceList } from '@/hooks/useDevices';
import { apiFetch } from '@/lib/auth-client';
import { resolveAgentReleaseBaseUrl } from '@/lib/agent-download';
import { toast } from 'sonner';

function EnrollmentStep({ number, title, description, active, completed }: {
  number: number; title: string; description: string; active?: boolean; completed?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all ${
        completed
          ? 'bg-success/15 text-success border border-success/20'
          : active
            ? 'bg-primary-600/20 text-primary border border-primary-500/30'
            : 'bg-surface-subtle text-text-disabled border border-border'
      }`}>
        {completed ? <CheckCircle className="h-3.5 w-3.5" /> : number}
      </div>
      <div>
        <p className={`text-sm font-medium ${active || completed ? 'text-text-primary' : 'text-text-muted'}`}>{title}</p>
        <p className="mt-0.5 text-xs text-text-disabled">{description}</p>
      </div>
    </div>
  );
}

/**
 * Preserved real onboarding flow (DASH-01). Device detection polling is owned
 * by this component so the Command Center surface itself never mounts a device
 * poller (DASH-02 §22 single-poller contract). Detection effect is stabilized
 * against churn (D11).
 *
 * V1-ENROLL-01A: Linux onboarding now uses the one-time bootstrap installer
 * (no source checkout, no cargo, no manual TF_ORG_TOKEN export). Windows and
 * macOS keep the existing developer command until their installers land.
 */
export function OnboardingFlow({ onComplete }: { onComplete: () => void }) {
  const { devices, loading, startFastPolling } = useDeviceList();
  const [step, setStep] = useState(1);
  const [os, setOs] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [detected, setDetected] = useState(false);
  const [enrollmentToken, setEnrollmentToken] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const baselineRef = useRef<number | null>(null);

  const devicesRef = useRef(devices);
  const loadingRef = useRef(loading);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    devicesRef.current = devices;
  }, [devices]);
  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Anchor the detection baseline to the first fully-loaded fleet snapshot.
  // Completion must be tied to the NEW device appearing, never to the mere
  // existence of a Device row (DASH-02 / D11). For an org that already has
  // devices, "any device exists" would falsely complete onboarding.
  useEffect(() => {
    if (loadingRef.current || baselineRef.current !== null) return;
    baselineRef.current = devicesRef.current.length;
  });

  useEffect(() => {
    if (!detecting) return;

    const checkDevices = () => {
      const baseline = baselineRef.current;
      if (
        baseline !== null &&
        devicesRef.current.length > baseline &&
        !loadingRef.current
      ) {
        setDetected(true);
        if (pollRef.current) clearInterval(pollRef.current);
        setTimeout(() => onCompleteRef.current(), 1500);
      }
    };

    checkDevices();
    pollRef.current = setInterval(checkDevices, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [detecting]);

  const generateToken = useCallback(async () => {
    setGenerating(true);
    setTokenError(null);
    try {
      const maxUses = os === 'linux' ? 1 : 5;
      const res = await apiFetch('/enrollment/tokens', {
        method: 'POST',
        body: JSON.stringify({
          label: `onboarding-${os || 'auto'}`,
          maxUses,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setEnrollmentToken(data.token);
        // The device being enrolled cannot register before it holds the
        // enrollment token, so re-anchor the baseline now: any subsequent
        // increase in the fleet is the new device, even if it registers before
        // the user clicks "I've installed the agent".
        if (!loadingRef.current) {
          baselineRef.current = devicesRef.current.length;
        }
        setStep(4);
      } else {
        const err = await res.text();
        setTokenError(`Failed to generate token: ${err}`);
      }
    } catch (e: any) {
      setTokenError(`Error: ${e.message}`);
    } finally {
      setGenerating(false);
    }
  }, [os]);

  const copyText = useCallback((text: string, message: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(message);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const getCommand = useCallback(() => {
    if (!enrollmentToken) return '';
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    if (os === 'windows') {
      return `$env:TF_API_URL="${apiBase}"; $env:TF_ORG_TOKEN="${enrollmentToken}"; cargo run`;
    }
    if (os === 'linux') {
      const origin =
        process.env.NEXT_PUBLIC_APP_URL ||
        (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
      const releaseBase = resolveAgentReleaseBaseUrl();
      const urlArg = ` --release "${releaseBase}"`;
      return [
        `curl -fsSL -o /tmp/techfusion-install.sh "${origin}/install-linux.sh"`,
        `curl -fsSL -o /tmp/techfusion-install.sh.sha256 "${origin}/install-linux.sh.sha256"`,
        `(cd /tmp && sha256sum -c techfusion-install.sh.sha256)`,
        `sudo bash /tmp/techfusion-install.sh --api "${apiBase}" --enroll-token "${enrollmentToken}"${urlArg}`,
      ].join('\n');
    }
    return `export TF_API_URL="${apiBase}"\nexport TF_ORG_TOKEN="${enrollmentToken}"\ncargo run`;
  }, [enrollmentToken, os]);

  const agentBinaryConfigured = Boolean(process.env.NEXT_PUBLIC_AGENT_DOWNLOAD_URL?.trim());

  return (
    <div className="mx-auto max-w-2xl">
      <GlassPanel intensity="medium" className="p-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-primary/20">
            <Monitor className="h-8 w-8 text-text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-text-primary">Welcome to TechFusion AI</h2>
          <p className="mx-auto mt-2 max-w-md text-text-secondary">
            Your intelligent device management platform. Connect your first device in 3 steps.
          </p>
        </div>

        <div className="mb-8 space-y-4">
          <EnrollmentStep number={1} title="Choose Operating System" description="Select your device platform" active={step === 1} completed={step > 1} />
          <EnrollmentStep number={2} title="Generate Enrollment Token" description="Create a secure token for device registration" active={step === 2 || (step === 3 && !enrollmentToken)} completed={!!enrollmentToken} />
          <EnrollmentStep number={3} title={os === 'linux' ? 'Install the Agent' : 'Run the Agent'} description={os === 'linux' ? 'One-time install that registers your device' : 'Execute the command on your device'} active={step >= 4 && !detected} completed={detected} />
        </div>

        {step === 1 && (
          <div className="text-center">
            <p className="mb-4 text-sm text-text-secondary">Choose your operating system</p>
            <div className="mx-auto grid max-w-md grid-cols-3 gap-3">
              {[
                { id: 'linux', label: 'Linux', icon: '🐧' },
                { id: 'mac', label: 'macOS', icon: '🍎' },
                { id: 'windows', label: 'Windows', icon: '🪟' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => { setOs(opt.id); setStep(2); }}
                  aria-pressed={os === opt.id}
                  className="cmd-focus-ring flex flex-col items-center gap-2 rounded-xl border border-border bg-surface-subtle p-4 transition-all hover:bg-surface-muted hover:border-border-strong"
                >
                  <span className="text-3xl">{opt.icon}</span>
                  <span className="text-xs font-medium text-text-secondary">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="text-center">
            <p className="mb-4 text-sm text-text-secondary">
              {os === 'linux'
                ? 'Generate a one-time enrollment token used only during installation'
                : 'Generate a secure enrollment token'}
            </p>
            {tokenError && (
              <div className="mb-4 rounded-xl border border-danger/20 bg-danger/10 p-3 text-xs text-danger">
                {tokenError}
              </div>
            )}
            <button
              type="button"
              onClick={generateToken}
              disabled={generating}
              className="cmd-focus-ring h-11 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-8 font-medium text-text-primary shadow-lg shadow-primary/20 transition-all hover:from-blue-500 hover:to-purple-500 disabled:opacity-50"
            >
              {generating ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Generating...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Key className="h-4 w-4" /> Generate Enrollment Token
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="cmd-focus-ring mt-3 text-xs text-text-disabled transition-colors hover:text-text-secondary"
            >
              Back
            </button>
          </div>
        )}

        {step >= 3 && enrollmentToken && (
          <div>
            {os === 'linux' ? (
              <p className="mb-4 text-sm text-text-secondary">
                Run this one-time install command on your <span className="font-medium text-text-secondary">Linux</span> device.
                It downloads the installer, verifies its checksum, installs the agent, and registers your device.
              </p>
            ) : (
              <p className="mb-4 text-sm text-text-secondary">
                Run this command on your <span className="font-medium capitalize text-text-secondary">{os}</span> device
              </p>
            )}
            <div className="relative rounded-xl border border-border bg-black/40 p-4 font-mono text-xs">
              <pre className="overflow-x-auto whitespace-pre-wrap text-success/80">{getCommand()}</pre>
              <button
                type="button"
                onClick={() => copyText(getCommand(), os === 'linux' ? 'Install command copied' : 'Command copied')}
                aria-label="Copy enrollment command"
                className="cmd-focus-ring absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-lg bg-surface-muted transition-all"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5 text-text-secondary" />}
              </button>
            </div>

            {os === 'linux' && (
              <div className="mx-auto mt-4 max-w-md space-y-2 text-left">
                <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-subtle p-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-600/20 text-xs font-bold text-primary">1</span>
                  <p className="text-xs text-text-secondary">Downloads the installer and verifies its checksum</p>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-subtle p-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-600/20 text-xs font-bold text-primary">2</span>
                  <p className="text-xs text-text-secondary">Installs the agent binary and configures it automatically</p>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-subtle p-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-600/20 text-xs font-bold text-primary">3</span>
                  <p className="text-xs text-text-secondary">Registers the device once and enables auto-start on boot</p>
                </div>
                {!agentBinaryConfigured && (
                  <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-subtle p-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-text-disabled" />
                    <p className="text-xs text-text-secondary">
                      Using the published TechFusion agent release. To point this deployment at your own
                      mirror, set{' '}
                      <code className="rounded bg-surface-muted px-1 text-primary">NEXT_PUBLIC_AGENT_DOWNLOAD_URL</code>{' '}
                      to your release base URL.
                    </p>
                  </div>
                )}
                <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-subtle p-3">
                  <Key className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <p className="text-xs text-text-secondary">
                    Your enrollment token is single-use: it is consumed during installation and never needed again.
                  </p>
                </div>
              </div>
            )}

            {os !== 'linux' && (
              <div className="mx-auto mt-4 max-w-md space-y-2 text-left">
                <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-subtle p-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-600/20 text-xs font-bold text-primary">1</span>
                  <p className="text-xs text-text-secondary">Install Rust and clone the TechFusion agent repo</p>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-subtle p-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-600/20 text-xs font-bold text-primary">2</span>
                  <p className="text-xs text-text-secondary">Copy and run the command above in your terminal</p>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-subtle p-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-600/20 text-xs font-bold text-primary">3</span>
                  <p className="text-xs text-text-secondary">The agent will register automatically and start sending telemetry</p>
                </div>
              </div>
            )}

            <div className="mt-6 flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => { setDetecting(true); setStep(5); startFastPolling(); }}
                className="cmd-focus-ring h-11 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-8 font-medium text-text-primary transition-all hover:from-blue-500 hover:to-purple-500"
              >
                {os === 'linux' ? "I've installed the agent" : "I've started the agent"}
              </button>
              <button
                type="button"
                onClick={() => { navigator.clipboard.writeText(enrollmentToken); setCopied(true); toast.success('Token copied'); }}
                className="cmd-focus-ring flex h-11 items-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 font-medium text-text-secondary transition-all hover:bg-surface-muted"
              >
                {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                Copy Token
              </button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div>
            <div className="flex flex-col items-center gap-4 py-4">
              {detected ? (
                <>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/15">
                    <CheckCircle className="h-6 w-6 text-success" />
                  </div>
                  <h2 className="text-xl font-bold text-text-primary">Device Connected!</h2>
                  <p className="text-sm text-text-secondary">Your device has been detected. Loading dashboard...</p>
                </>
              ) : (
                <>
                  <div className="relative">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  </div>
                  <h2 className="text-xl font-bold text-text-primary">Waiting for device...</h2>
                  <p className="max-w-sm text-center text-sm text-text-secondary">
                    {os === 'linux'
                      ? 'The agent installs and registers within a few seconds. If it does not appear, check the terminal output for errors.'
                      : 'The agent should register within a few seconds. If not, verify the enrollment token is correct.'}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                    <span className="text-xs text-text-disabled">Polling every 3 seconds</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setDetecting(false); setStep(3); }}
                    className="cmd-focus-ring mt-2 text-xs text-primary transition-colors hover:text-primary-300"
                  >
                    Back to instructions
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDetecting(false); onComplete(); }}
                    className="cmd-focus-ring text-xs text-text-disabled transition-colors hover:text-text-secondary"
                  >
                    Skip (I&apos;ll do this later)
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </GlassPanel>
    </div>
  );
}
