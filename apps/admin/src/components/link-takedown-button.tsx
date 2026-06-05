"use client";

import { Button } from "@taravee/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@taravee/ui/components/dialog";
import { toast } from "@taravee/ui/components/sonner";
import { Textarea } from "@taravee/ui/components/textarea";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { apiFetch } from "@/lib/api";

export function LinkTakedownButton({
  id,
  status,
}: {
  id: string;
  status: "active" | "disabled";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function patch(next: "active" | "disabled", why?: string) {
    setBusy(true);
    try {
      const res = await apiFetch(`/admin/links/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: next, reason: why }),
      });
      if (!res.ok) {
        toast.error("Could not update the link");
        return;
      }
      toast.success(next === "disabled" ? "Link disabled" : "Link re-enabled");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  if (status === "disabled") {
    return (
      <Button size="sm" variant="outline" disabled={busy} onClick={() => void patch("active")}>
        Re-enable
      </Button>
    );
  }

  return (
    <>
      <Button size="sm" variant="destructive" onClick={() => setOpen(true)}>
        Disable
      </Button>
      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disable this link</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Shoppers who tap it will see a neutral &ldquo;unavailable&rdquo; page instead of the
            store. Use this for a non-compliant post. The reason is recorded.
          </p>
          <Textarea
            rows={3}
            placeholder="Why is this link being taken down? (e.g. disallowed health claim in the Reel)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => void patch("disabled", reason.trim() || undefined)}
            >
              {busy ? "Disabling…" : "Disable link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
