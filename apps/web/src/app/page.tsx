import type { Metadata } from 'next';
import { Hero } from '@/components/landing/Hero';
import { Navbar } from '@/components/landing/Navbar';

export const metadata: Metadata = {
  title: 'TechFusion AI — Enterprise AI Platform',
  description:
    'Unified device intelligence, real-time monitoring, and autonomous cybersecurity powered by next-generation artificial intelligence.',
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
};

function PlaceholderSection({
  id,
  title,
  description,
}: {
  id: string;
  title: string;
  description: string;
}) {
  return (
    <section
      id={id}
      className="relative flex min-h-[50vh] items-center justify-center px-6"
    >
      <div className="text-center">
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          {title}
        </h2>
        <p className="mt-4 text-base text-white/35">{description}</p>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <PlaceholderSection
          id="features"
          title="Features"
          description="Powerful AI-driven features for enterprise infrastructure management."
        />
        <PlaceholderSection
          id="solutions"
          title="Solutions"
          description="Tailored solutions for every industry and use case."
        />
        <PlaceholderSection
          id="pricing"
          title="Pricing"
          description="Flexible pricing plans that scale with your business."
        />
        <PlaceholderSection
          id="docs"
          title="Documentation"
          description="Comprehensive guides and API references."
        />
      </main>
    </>
  );
}
