"use client";

import { Button } from "@taravee/ui/components/button";
import { toast } from "@taravee/ui/components/sonner";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { apiFetch } from "@/lib/api";

export function MarkPaidButton({
  creatorId,
  disabled,
}: {
  creatorId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={busy || disabled}
      onClick={async () => {
        setBusy(true);
        try {
          const res = await apiFetch(`/admin/payouts/${creatorId}/pay`, { method: "POST" });
          if (!res.ok) {
            toast.error("Could not mark paid");
            return;
          }
          const r = (await res.json()) as { paid: number };
          toast.success(`Marked ${r.paid} commission(s) paid`);
          router.refresh();
        } catch {
          toast.error("Could not reach the server");
        } finally {
          setBusy(false);
        }
      }}
    >
      Mark paid
    </Button>
  );
}
