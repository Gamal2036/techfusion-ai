import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-8">
      <div className="max-w-md text-center">
        <h1 className="text-6xl font-bold text-white/10 mb-4">404</h1>
        <h2 className="text-2xl font-bold text-white mb-2">Page not found</h2>
        <p className="text-white/50 mb-6">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link
          href="/"
          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium transition-all inline-block"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
