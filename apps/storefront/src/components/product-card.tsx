import type { PublicProduct } from "@taravee/types";
import { Button } from "@taravee/ui/components/button";
import { Card } from "@taravee/ui/components/card";
import Link from "next/link";

import { redirectUrl } from "@/lib/api";
import { formatPrice } from "@/lib/price";

export function ProductCard({
  product,
  refCode,
  username,
}: {
  product: PublicProduct;
  refCode: string;
  username: string;
}) {
  const price = formatPrice(
    product.priceRange.min,
    product.priceRange.max,
    product.priceRange.currency,
  );

  return (
    <Card className="flex flex-col overflow-hidden">
      <Link href={`/${username}/${product.handle}`} className="block">
        {product.featuredImage ? (
          <img
            src={product.featuredImage}
            alt={product.title}
            className="aspect-square w-full object-cover"
          />
        ) : (
          <div className="aspect-square w-full bg-muted" />
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <Link
          href={`/${username}/${product.handle}`}
          className="line-clamp-2 text-sm font-medium hover:underline"
        >
          {product.title}
        </Link>
        <p className="text-sm text-muted-foreground">{price}</p>
        <Button asChild size="sm" className="mt-1">
          <a href={redirectUrl(refCode, product.handle)} rel="nofollow">
            Shop now
          </a>
        </Button>
      </div>
    </Card>
  );
}
