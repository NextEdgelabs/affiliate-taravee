"use client";

import type { AdminCreator } from "@taravee/types";
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
import { Input } from "@taravee/ui/components/input";
import { Label } from "@taravee/ui/components/label";
import { toast } from "@taravee/ui/components/sonner";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { apiFetch } from "@/lib/api";

export function CreatorActions({ creator }: { creator: AdminCreator }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function call(path: string, body?: unknown, method = "POST") {
    setBusy(true);
    try {
      const res = await apiFetch(path, {
        method,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        toast.error("Action failed");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      toast.error("Could not reach the server");
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (creator.verificationStatus === "pending") {
    return (
      <div className="flex justify-end gap-2">
        <ApproveDialog
          disabled={busy}
          onApprove={(pct) =>
            call(`/admin/creators/${creator.id}/approve`, { commissionRate: pct / 100 }).then(
              (ok) => ok && toast.success("Creator approved"),
            )
          }
        />
        <RejectDialog
          disabled={busy}
          onReject={(reason) =>
            call(`/admin/creators/${creator.id}/reject`, { reason }).then(
              (ok) => ok && toast.success("Creator rejected"),
            )
          }
        />
      </div>
    );
  }

  return (
    <div className="flex justify-end gap-2">
      <CommissionDialog
        current={Math.round(creator.commissionRate * 100)}
        disabled={busy}
        onSave={(pct) =>
          call(`/admin/creators/${creator.id}/commission`, { commissionRate: pct / 100 }, "PATCH").then(
            (ok) => ok && toast.success("Commission updated"),
          )
        }
      />
      {creator.linksSuspended ? (
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() =>
            call(`/admin/creators/${creator.id}/links-suspend`, { suspended: false }, "PATCH").then(
              (ok) => ok && toast.success("Links resumed"),
            )
          }
        >
          Resume links
        </Button>
      ) : (
        <Button
          size="sm"
          variant="destructive"
          disabled={busy}
          onClick={() =>
            call(
              `/admin/creators/${creator.id}/links-suspend`,
              { suspended: true, reason: "Compliance takedown" },
              "PATCH",
            ).then((ok) => ok && toast.success("All links suspended"))
          }
        >
          Suspend links
        </Button>
      )}
      {creator.status === "suspended" ? (
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() =>
            call(`/admin/creators/${creator.id}/status`, { status: "active" }, "PATCH").then(
              (ok) => ok && toast.success("Reactivated"),
            )
          }
        >
          Reactivate
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() =>
            call(`/admin/creators/${creator.id}/status`, { status: "suspended" }, "PATCH").then(
              (ok) => ok && toast.success("Suspended"),
            )
          }
        >
          Suspend
        </Button>
      )}
    </div>
  );
}

function ApproveDialog({
  onApprove,
  disabled,
}: {
  onApprove: (pct: number) => void;
  disabled: boolean;
}) {
  const [pct, setPct] = useState(10);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" disabled={disabled}>
          Approve
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Approve creator</DialogTitle>
          <DialogDescription>Set the commission rate (default 10%).</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="pct">Commission %</Label>
          <Input
            id="pct"
            type="number"
            min={0}
            max={100}
            value={pct}
            onChange={(e) => setPct(Number(e.target.value))}
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button onClick={() => onApprove(pct)}>Approve</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RejectDialog({
  onReject,
  disabled,
}: {
  onReject: (reason: string) => void;
  disabled: boolean;
}) {
  const [reason, setReason] = useState("");
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={disabled}>
          Reject
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject application</DialogTitle>
          <DialogDescription>Let the creator know why (optional).</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="reason">Reason</Label>
          <Input
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Not enough reach"
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button variant="destructive" onClick={() => onReject(reason || "Rejected")}>
              Reject
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CommissionDialog({
  current,
  onSave,
  disabled,
}: {
  current: number;
  onSave: (pct: number) => void;
  disabled: boolean;
}) {
  const [pct, setPct] = useState(current);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={disabled}>
          {current}%
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit commission</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="cpct">Commission %</Label>
          <Input
            id="cpct"
            type="number"
            min={0}
            max={100}
            value={pct}
            onChange={(e) => setPct(Number(e.target.value))}
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button onClick={() => onSave(pct)}>Save</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
