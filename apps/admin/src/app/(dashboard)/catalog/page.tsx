import type { Product } from "@taravee/types";
import { Card, CardContent, CardHeader, CardTitle } from "@taravee/ui/components/card";

import { CatalogTable } from "@/components/catalog-table";
import { serverGet } from "@/lib/server-api";

export default async function CatalogPage() {
  const data = await serverGet<{ items: Product[]; total: number }>("/admin/products");
  const items = data?.items ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
        <p className="text-muted-foreground">
          Synced from Shopify. Select products to bulk list/unlist or set a commission rate. A
          product&apos;s commission overrides the creator&apos;s default for sales via its link.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Products ({data?.total ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          <CatalogTable items={items} />
        </CardContent>
      </Card>
    </div>
  );
}
