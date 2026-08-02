'use client';

import { useEffect } from 'react';
import { TriangleAlert } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global error:', error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="flex flex-col items-center justify-center min-h-screen bg-background p-8">
          <div className="max-w-md text-center">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-red-500/20 to-rose-600/20 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
              <TriangleAlert className="h-8 w-8 text-red-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Critical error</h2>
            <p className="text-white/50 mb-6">
              A critical system error occurred. Please try refreshing the page.
            </p>
            <button
              onClick={() => reset()}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium transition-all"
            >
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
