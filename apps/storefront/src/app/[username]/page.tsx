import type { PublicProduct, StorefrontCreator } from "@taravee/types";
import { notFound, permanentRedirect } from "next/navigation";

import { CreatorHero } from "@/components/creator-hero";
import { EmptyState } from "@/components/empty-state";
import { ProductCard } from "@/components/product-card";
import { sfGet } from "@/lib/api";

export default async function CreatorStorePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const [creator, products] = await Promise.all([
    sfGet<StorefrontCreator>(`/storefront/creators/${username}`),
    sfGet<PublicProduct[]>(`/storefront/creators/${username}/products`),
  ]);
  if (!creator) notFound();
  // Old username (resolved via slug history) → 301 to the canonical store URL.
  if (creator.slug !== username) permanentRedirect(`/${creator.slug}`);

  return (
    <div className="flex flex-col gap-8">
      <CreatorHero creator={creator} />

      {products && products.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              refCode={creator.refCode}
              username={creator.slug}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No products featured yet"
          hint="Check back soon — this creator is curating their picks."
        />
      )}
    </div>
  );
}
