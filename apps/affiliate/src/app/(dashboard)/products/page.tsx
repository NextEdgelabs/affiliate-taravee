import type { Product } from "@taravee/types";
import { Card, CardContent } from "@taravee/ui/components/card";

import { CreateLinkButton } from "@/components/create-link-button";
import { serverGet } from "@/lib/server-api";

export default async function ProductsPage() {
  const products = (await serverGet<Product[]>("/products")) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
        <p className="text-muted-foreground">
          Products available to promote. Create a link to start earning.
        </p>
      </div>

      {products.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No products available yet. Check back once the catalog is published.
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
                  <p className="line-clamp-2 text-sm font-medium">{p.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {new Intl.NumberFormat("en-IN", {
                      style: "currency",
                      currency: p.priceRange.currency,
                    }).format(p.priceRange.min)}
                  </p>
                </div>
                <CreateLinkButton
                  type="product"
                  productHandle={p.handle}
                  title={p.title}
                  label="Create link"
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
