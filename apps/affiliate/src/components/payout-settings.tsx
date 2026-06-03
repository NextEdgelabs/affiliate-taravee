"use client";

import type { CreatorProfile } from "@taravee/types";
import { Button } from "@taravee/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@taravee/ui/components/card";
import { Input } from "@taravee/ui/components/input";
import { Label } from "@taravee/ui/components/label";
import { toast } from "@taravee/ui/components/sonner";
import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";

export function PayoutSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [upiId, setUpiId] = useState("");
  const [accountName, setAccountName] = useState("");

  useEffect(() => {
    apiFetch("/creators/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((p: CreatorProfile | null) => {
        setUpiId(p?.payout?.upiId ?? "");
        setAccountName(p?.payout?.accountName ?? "");
      })
      .finally(() => setLoading(false));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiFetch("/creators/me/payout", {
        method: "PATCH",
        body: JSON.stringify({ upiId, accountName }),
      });
      toast[res.ok ? "success" : "error"](res.ok ? "Payout details saved" : "Could not save");
    } catch {
      toast.error("Could not reach the server");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payout details</CardTitle>
        <CardDescription>Where we send your earnings (UPI preferred).</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="flex flex-col gap-4 sm:max-w-md">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="upi">UPI ID</Label>
            <Input
              id="upi"
              placeholder="name@bank"
              value={upiId}
              disabled={loading}
              onChange={(e) => setUpiId(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="acct">Account holder name</Label>
            <Input
              id="acct"
              value={accountName}
              disabled={loading}
              onChange={(e) => setAccountName(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={saving || loading} className="w-fit">
            {saving ? "Saving…" : "Save payout details"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
