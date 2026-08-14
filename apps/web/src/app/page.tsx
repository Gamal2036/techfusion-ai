import type { Metadata } from 'next';
import { CyberNav } from '@/components/landing2036/CyberNav';
import { AmbientGrid } from '@/components/landing2036/AmbientGrid';
import { CyberHero } from '@/components/landing2036/CyberHero';
import { CorePillars } from '@/components/landing2036/CorePillars';
import { TelemetryTerminal } from '@/components/landing2036/TelemetryTerminal';
import { CyberFooter } from '@/components/landing2036/CyberFooter';

export const metadata: Metadata = {
  title: 'TechFusion AI — Autonomous Defense & Network Intelligence',
  description:
    'One unified intelligence layer where AI-driven cybersecurity, self-healing IT support, and adaptive network infrastructure operate in seamless synergy.',
  openGraph: {
    title: 'TechFusion AI — Autonomous Defense & Network Intelligence',
    description:
      'One unified intelligence layer where AI-driven cybersecurity, self-healing IT support, and adaptive network infrastructure operate in seamless synergy.',
    type: 'website',
    siteName: 'TechFusion AI',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TechFusion AI — Autonomous Defense & Network Intelligence',
    description:
      'One unified intelligence layer where AI-driven cybersecurity, self-healing IT support, and adaptive network infrastructure operate in seamless synergy.',
  },
};

export default function Home() {
  return (
    <div className="relative min-h-screen bg-[#030712] text-slate-100">
      <AmbientGrid />
      <CyberNav />
      <main className="relative z-10">
        <CyberHero />
        <CorePillars />
        <TelemetryTerminal />
      </main>
      <div className="relative z-10">
        <CyberFooter />
      </div>
    </div>
  );
}
