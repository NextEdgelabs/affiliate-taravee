import type { StorefrontCreator } from "@taravee/types";
import { Wordmark } from "@taravee/ui/components/brand-logo";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { sfGet } from "@/lib/api";
import { themeStyle } from "@/lib/theme";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const creator = await sfGet<StorefrontCreator>(`/storefront/creators/${username}`);
  if (!creator) return { title: "Taravee" };
  return {
    title: `${creator.displayName} · Taravee`,
    description: `Shop ${creator.displayName}'s curated picks on Taravee.`,
    alternates: { canonical: `/${creator.slug}` },
    openGraph: {
      title: `${creator.displayName} · Taravee`,
      description: `Shop ${creator.displayName}'s curated picks.`,
    },
  };
}

export default async function CreatorLayout({
  params,
  children,
}: {
  params: Promise<{ username: string }>;
  children: React.ReactNode;
}) {
  const { username } = await params;
  const creator = await sfGet<StorefrontCreator>(`/storefront/creators/${username}`);
  if (!creator) notFound();

  return (
    <div style={themeStyle(creator.theme)} className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <a href={`/${creator.slug}`} aria-label={`${creator.displayName} store`}>
            <Wordmark className="text-lg" />
          </a>
          <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Creator store
          </span>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-4 py-8">{children}</div>
      <footer className="mx-auto max-w-5xl px-4 py-10 text-center text-xs text-muted-foreground">
        Powered by Taravee · Own Your Story Daily
      </footer>
    </div>
  );
}
