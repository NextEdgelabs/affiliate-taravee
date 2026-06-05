import type { PublicProduct, StorefrontCreator } from "@taravee/types";
import { Button } from "@taravee/ui/components/button";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import { ProductGallery } from "@/components/product-gallery";
import { redirectUrl, sfGet } from "@/lib/api";
import { formatPrice } from "@/lib/price";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string; productHandle: string }>;
}): Promise<Metadata> {
  const { username, productHandle } = await params;
  const product = await sfGet<PublicProduct>(
    `/storefront/creators/${username}/products/${productHandle}`,
  );
  if (!product) return { title: "Taravee" };
  return {
    title: `${product.title} · Taravee`,
    description: product.description?.slice(0, 150),
    alternates: { canonical: `/${username}/${productHandle}` },
    openGraph: {
      title: product.title,
      images: product.featuredImage ? [product.featuredImage] : undefined,
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ username: string; productHandle: string }>;
}) {
  const { username, productHandle } = await params;
  const [creator, product] = await Promise.all([
    sfGet<StorefrontCreator>(`/storefront/creators/${username}`),
    sfGet<PublicProduct>(`/storefront/creators/${username}/products/${productHandle}`),
  ]);
  if (!creator || !product) notFound();
  if (creator.slug !== username) permanentRedirect(`/${creator.slug}/${productHandle}`);

  const price = formatPrice(
    product.priceRange.min,
    product.priceRange.max,
    product.priceRange.currency,
  );
  // Prefer the full image set; fall back to the featured image.
  const images =
    product.images.length > 0
      ? product.images
      : product.featuredImage
        ? [{ src: product.featuredImage }]
        : [];

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/${creator.slug}`}
        className="text-sm text-muted-foreground hover:underline"
      >
        ← Back to {creator.displayName}&apos;s picks
      </Link>

      <div className="grid gap-8 md:grid-cols-2">
        <ProductGallery images={images} alt={product.title} />

        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">{product.title}</h1>
          <p className="text-xl font-medium">{price}</p>
          {product.description ? (
            <div
              className="prose-sm text-sm text-muted-foreground"
              // descriptionHtml comes from Shopify (trusted store owner content)
              dangerouslySetInnerHTML={{ __html: product.description }}
            />
          ) : null}

          {product.variants.length > 1 ? (
            <div className="flex flex-wrap gap-2">
              {product.variants.slice(0, 12).map((v, i) => (
                <span
                  key={`${v.title}-${i}`}
                  className="rounded-md border px-2 py-1 text-xs text-muted-foreground"
                >
                  {v.title}
                </span>
              ))}
            </div>
          ) : null}

          <Button asChild size="lg" className="mt-2 w-full sm:w-auto">
            <a href={redirectUrl(creator.refCode, product.handle)} rel="nofollow">
              Buy now
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
