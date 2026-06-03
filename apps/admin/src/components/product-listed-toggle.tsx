"use client";

import { Switch } from "@taravee/ui/components/switch";
import { toast } from "@taravee/ui/components/sonner";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { apiFetch } from "@/lib/api";

export function ProductListedToggle({
  id,
  listed,
}: {
  id: string;
  listed: boolean;
}) {
  const router = useRouter();
  const [checked, setChecked] = useState(listed);
  const [busy, setBusy] = useState(false);

  return (
    <Switch
      checked={checked}
      disabled={busy}
      onCheckedChange={async (next) => {
        setBusy(true);
        setChecked(next);
        try {
          const res = await apiFetch(`/admin/products/${id}/listed`, {
            method: "PATCH",
            body: JSON.stringify({ listed: next }),
          });
          if (!res.ok) {
            setChecked(!next);
            toast.error("Could not update");
            return;
          }
          toast.success(next ? "Listed for creators" : "Unlisted");
          router.refresh();
        } catch {
          setChecked(!next);
          toast.error("Could not reach the server");
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}
