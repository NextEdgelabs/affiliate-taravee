import type { ShopifyConnectionInfo } from "@taravee/types";

import { ShopifyConnect } from "@/components/shopify-connect";
import { serverGet } from "@/lib/server-api";

export default async function ShopifyPage() {
  const info =
    (await serverGet<ShopifyConnectionInfo>("/admin/shopify/connection")) ?? {
      status: "disconnected" as const,
    };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Shopify</h1>
        <p className="text-muted-foreground">
          Connect your store and sync your products.
        </p>
      </div>
      <ShopifyConnect info={info} />
    </div>
  );
}
