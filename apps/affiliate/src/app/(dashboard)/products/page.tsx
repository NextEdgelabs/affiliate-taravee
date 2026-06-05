import type { Product } from "@taravee/types";
import { Badge } from "@taravee/ui/components/badge";
import { Card, CardContent } from "@taravee/ui/components/card";
import { BookOpen } from "lucide-react";

import { ProductLinksDialog } from "@/components/product-links-dialog";
import { serverGet } from "@/lib/server-api";

export default async function ProductsPage() {
  const products = (await serverGet<Product[]>("/products")) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
        <p className="text-muted-foreground">
          Products available to promote. Get your links — a storefront page and a direct link to
          the product — and follow each product&apos;s posting guidelines.
        </p>
      </div>

      {products.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No products available yet. Check back once products are listed.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((p) => (
            <Card key={p.id} className="flex flex-col overflow-hidden">
              {p.featuredImage ? (
                <img
                  src={p.featuredImage}
                  alt={p.title}
                  className="aspect-square w-full object-cover"
                />
              ) : (
                <div className="aspect-square w-full bg-muted" />
              )}
              <CardContent className="flex flex-1 flex-col gap-2 p-4">
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-2 text-sm font-medium">{p.title}</p>
                    {p.contentGuidelines ? (
                      <Badge variant="secondary" className="shrink-0 gap-1">
                        <BookOpen className="size-3" />
                        Guide
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {new Intl.NumberFormat("en-IN", {
                      style: "currency",
                      currency: p.priceRange.currency,
                    }).format(p.priceRange.min)}
                  </p>
                </div>
                <ProductLinksDialog product={p} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
