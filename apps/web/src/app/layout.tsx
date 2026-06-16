import type { Metadata } from 'next';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@techfusion/ui';
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
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
          <Toaster position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
