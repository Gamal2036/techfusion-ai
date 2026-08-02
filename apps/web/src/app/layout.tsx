import type { Metadata } from 'next';
import { ThemeProvider } from 'next-themes';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'TechFusion AI — Enterprise AI Platform',
    template: '%s | TechFusion AI',
  },
  description:
    'Unified device intelligence, real-time monitoring, and autonomous cybersecurity powered by next-generation artificial intelligence.',
  keywords: ['AI', 'enterprise', 'cybersecurity', 'device intelligence', 'monitoring', 'SaaS'],
  authors: [{ name: 'TechFusion AI' }],
  openGraph: {
    title: 'TechFusion AI — Enterprise AI Platform',
    description:
      'Unified device intelligence, real-time monitoring, and autonomous cybersecurity powered by next-generation artificial intelligence.',
    type: 'website',
    siteName: 'TechFusion AI',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TechFusion AI — Enterprise AI Platform',
    description:
      'Unified device intelligence, real-time monitoring, and autonomous cybersecurity powered by next-generation artificial intelligence.',
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
