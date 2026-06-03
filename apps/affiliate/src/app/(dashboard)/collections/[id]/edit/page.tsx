import type { CreatorCollection, Product } from "@taravee/types";
import { notFound } from "next/navigation";

import { CollectionBuilder } from "@/components/collection-builder";
import { serverGet } from "@/lib/server-api";

export default async function EditCollectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [products, collections] = await Promise.all([
    serverGet<Product[]>("/products"),
    serverGet<CreatorCollection[]>("/creator/collections"),
  ]);
  const collection = (collections ?? []).find((c) => c.id === id);
  if (!collection) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{collection.title}</h1>
        <p className="text-muted-foreground">Edit your collection, then publish.</p>
      </div>
      <CollectionBuilder products={products ?? []} initial={collection} />
    </div>
  );
}
