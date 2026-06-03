"use client";

import type { CommissionStatus } from "@taravee/types";
import { Button } from "@taravee/ui/components/button";
import { toast } from "@taravee/ui/components/sonner";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { apiFetch } from "@/lib/api";

export function CommissionStatusActions({
  id,
  status,
}: {
  id: string;
  status: CommissionStatus;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function set(next: CommissionStatus) {
    setBusy(true);
    try {
      const res = await apiFetch(`/commissions/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        toast.error("Could not update");
        return;
      }
      toast.success(`Marked ${next}`);
      router.refresh();
    } catch {
      toast.error("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex justify-end gap-2">
      {status === "pending" && (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => set("approved")}>
          Approve
        </Button>
      )}
      {status === "approved" && (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => set("paid")}>
          Mark paid
        </Button>
      )}
      {status !== "reversed" && (
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => set("reversed")}>
          Reverse
        </Button>
      )}
    </div>
  );
}
