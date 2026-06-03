"use client";

import { Button } from "@taravee/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@taravee/ui/components/dialog";
import { Input } from "@taravee/ui/components/input";
import { Label } from "@taravee/ui/components/label";
import { toast } from "@taravee/ui/components/sonner";
import { UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { apiFetch } from "@/lib/api";

const EMPTY = {
  email: "",
  name: "",
  instagramUsername: "",
  youtubeChannel: "",
  igFollowers: "",
  igAvgViews: "",
  ytSubscribers: "",
  ytAvgViews: "",
  commission: "",
  password: "",
};

export function AddCreatorDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [approve, setApprove] = useState(false);
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);

  const set = (k: keyof typeof EMPTY, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function reset() {
    setForm({ ...EMPTY });
    setApprove(false);
    setCreatedPassword(null);
  }

  async function submit() {
    if (!form.email.trim() || !form.name.trim()) {
      toast.error("Email and name are required");
      return;
    }
    const body: Record<string, unknown> = {
      email: form.email.trim(),
      name: form.name.trim(),
      approve,
      metrics: {
        igFollowers: Number(form.igFollowers) || 0,
        igAvgViews: Number(form.igAvgViews) || 0,
        ytSubscribers: Number(form.ytSubscribers) || 0,
        ytAvgViews: Number(form.ytAvgViews) || 0,
      },
    };
    if (form.instagramUsername.trim()) body.instagramUsername = form.instagramUsername.trim();
    if (form.youtubeChannel.trim()) body.youtubeChannel = form.youtubeChannel.trim();
    if (form.password.trim()) body.password = form.password.trim();
    if (approve && form.commission.trim()) {
      const pct = Number(form.commission);
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
        toast.error("Commission must be 0–100%");
        return;
      }
      body.commissionRate = pct / 100;
    }

    setBusy(true);
    try {
      const res = await apiFetch("/admin/creators", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => null)) as
        | { message?: string; tempPassword?: string }
        | null;
      if (!res.ok) {
        toast.error(data?.message ?? "Could not create creator");
        return;
      }
      router.refresh();
      if (data?.tempPassword) {
        // Show the one-time generated password so the admin can share it.
        setCreatedPassword(data.tempPassword);
      } else {
        toast.success("Creator created");
        setOpen(false);
        reset();
      }
    } catch {
      toast.error("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="size-4" />
          Add creator
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add creator</DialogTitle>
        </DialogHeader>

        {createdPassword ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm">
              Creator <strong>{form.email}</strong> was created. Share this one-time password —
              it won&apos;t be shown again:
            </p>
            <code className="rounded-md border bg-muted/40 px-3 py-2 font-mono text-sm">
              {createdPassword}
            </code>
            <DialogFooter>
              <Button
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
              >
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Field label="Email" required>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="creator@example.com"
              />
            </Field>
            <Field label="Name" required>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Instagram username">
                <Input
                  value={form.instagramUsername}
                  onChange={(e) => set("instagramUsername", e.target.value)}
                  placeholder="handle"
                />
              </Field>
              <Field label="YouTube channel">
                <Input
                  value={form.youtubeChannel}
                  onChange={(e) => set("youtubeChannel", e.target.value)}
                />
              </Field>
              <Field label="IG followers">
                <Input
                  type="number"
                  value={form.igFollowers}
                  onChange={(e) => set("igFollowers", e.target.value)}
                />
              </Field>
              <Field label="IG avg views">
                <Input
                  type="number"
                  value={form.igAvgViews}
                  onChange={(e) => set("igAvgViews", e.target.value)}
                />
              </Field>
              <Field label="YT subscribers">
                <Input
                  type="number"
                  value={form.ytSubscribers}
                  onChange={(e) => set("ytSubscribers", e.target.value)}
                />
              </Field>
              <Field label="YT avg views">
                <Input
                  type="number"
                  value={form.ytAvgViews}
                  onChange={(e) => set("ytAvgViews", e.target.value)}
                />
              </Field>
            </div>
            <Field label="Initial password (optional — auto-generated if blank)">
              <Input
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                placeholder="min 8 chars"
              />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={approve}
                onChange={(e) => setApprove(e.target.checked)}
              />
              Approve immediately (active + ref code)
            </label>
            {approve && (
              <Field label="Commission % (default 10)">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={form.commission}
                  onChange={(e) => set("commission", e.target.value)}
                  placeholder="10"
                />
              </Field>
            )}
            <DialogFooter>
              <Button disabled={busy} onClick={submit}>
                {approve ? "Create & approve" : "Create (pending)"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
    </div>
  );
}
