import type { Product } from "@taravee/types";

import { CollectionBuilder } from "@/components/collection-builder";
import { serverGet } from "@/lib/server-api";

export default async function NewCollectionPage() {
  const products = (await serverGet<Product[]>("/products")) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New collection</h1>
        <p className="text-muted-foreground">Pick products, set a theme, then publish.</p>
      </div>
      <CollectionBuilder products={products} />
    </div>
  );
}
