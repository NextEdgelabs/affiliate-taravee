"use client";

import { Button } from "@taravee/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@taravee/ui/components/dialog";
import { Label } from "@taravee/ui/components/label";
import { toast } from "@taravee/ui/components/sonner";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { apiFetch } from "@/lib/api";

export function AttributeOrderDialog({
  orderId,
  creators,
}: {
  orderId: string;
  creators: { refCode: string; displayName: string }[];
}) {
  const router = useRouter();
  const [refCode, setRefCode] = useState(creators[0]?.refCode ?? "");
  const [busy, setBusy] = useState(false);

  async function assign() {
    if (!refCode) return;
    setBusy(true);
    try {
      const res = await apiFetch(`/admin/orders/${orderId}/attribute`, {
        method: "POST",
        body: JSON.stringify({ refCode }),
      });
      if (!res.ok) {
        toast.error("Could not attribute order");
        return;
      }
      toast.success("Order attributed");
      router.refresh();
    } catch {
      toast.error("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={creators.length === 0}>
          Assign creator
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Attribute order</DialogTitle>
          <DialogDescription>
            Manually credit this order to a creator (creates a commission).
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="creator">Creator</Label>
          <select
            id="creator"
            value={refCode}
            onChange={(e) => setRefCode(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {creators.map((c) => (
              <option key={c.refCode} value={c.refCode}>
                {c.displayName} ({c.refCode})
              </option>
            ))}
          </select>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button disabled={busy} onClick={assign}>
              Attribute
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
