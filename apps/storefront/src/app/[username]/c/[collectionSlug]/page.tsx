import type { StorefrontCollection } from "@taravee/types";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import { EmptyState } from "@/components/empty-state";
import { ProductCard } from "@/components/product-card";
import { sfGet } from "@/lib/api";
import { themeStyle } from "@/lib/theme";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string; collectionSlug: string }>;
}): Promise<Metadata> {
  const { username, collectionSlug } = await params;
  const c = await sfGet<StorefrontCollection>(
    `/storefront/creators/${username}/collections/${collectionSlug}`,
  );
  if (!c) return { title: "Taravee" };
  return {
    title: `${c.title} · ${c.creator.displayName} · Taravee`,
    description: c.description ?? `${c.creator.displayName}'s ${c.title} collection.`,
    alternates: { canonical: `/${username}/c/${collectionSlug}` },
    openGraph: { title: c.title, description: c.description },
  };
}

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ username: string; collectionSlug: string }>;
}) {
  const { username, collectionSlug } = await params;
  const collection = await sfGet<StorefrontCollection>(
    `/storefront/creators/${username}/collections/${collectionSlug}`,
  );
  if (!collection) notFound();
  if (collection.creator.slug !== username) {
    permanentRedirect(`/${collection.creator.slug}/c/${collectionSlug}`);
  }

  return (
    // The collection's own theme overrides the creator's default for this subtree.
    <div style={themeStyle(collection.theme)} className="flex flex-col gap-8">
      <section className="rounded-2xl bg-gradient-to-br from-primary/15 to-accent/40 p-8 text-center sm:p-12">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {collection.creator.displayName}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
          {collection.title}
        </h1>
        {collection.description ? (
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {collection.description}
          </p>
        ) : null}
      </section>

      {collection.products.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {collection.products.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              refCode={collection.creator.refCode}
              username={username}
            />
          ))}
        </div>
      ) : (
        <EmptyState title="This collection is empty right now" />
      )}
    </div>
  );
}
