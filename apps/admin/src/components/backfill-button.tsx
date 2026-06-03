"use client";

import { Button } from "@taravee/ui/components/button";
import { toast } from "@taravee/ui/components/sonner";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { apiFetch } from "@/lib/api";

export function BackfillButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const res = await apiFetch("/admin/orders/backfill", { method: "POST" });
          if (!res.ok) {
            const data = (await res.json().catch(() => null)) as { message?: string } | null;
            toast.error(data?.message ?? "Backfill failed");
            return;
          }
          const r = (await res.json()) as { ingested: number; attributed: number };
          toast.success(`Backfilled ${r.ingested} orders · ${r.attributed} attributed`);
          router.refresh();
        } catch {
          toast.error("Could not reach the server");
        } finally {
          setBusy(false);
        }
      }}
    >
      <RefreshCw className={busy ? "size-3.5 animate-spin" : "size-3.5"} />
      {busy ? "Backfilling…" : "Backfill from Shopify"}
    </Button>
  );
}
