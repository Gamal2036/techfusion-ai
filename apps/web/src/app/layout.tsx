import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TechFusion AI',
  description: 'Unified SaaS Platform for IT Technicians and Cybersecurity Teams',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0a0a0a] text-white">{children}</body>
    </html>
  );
}
