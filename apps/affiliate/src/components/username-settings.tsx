"use client";

import type { CreatorProfile } from "@taravee/types";
import { Button } from "@taravee/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@taravee/ui/components/card";
import { Input } from "@taravee/ui/components/input";
import { Label } from "@taravee/ui/components/label";
import { toast } from "@taravee/ui/components/sonner";
import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";

const STOREFRONT =
  process.env.NEXT_PUBLIC_STOREFRONT_URL ?? "http://localhost:3003";

export function UsernameSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState(""); // live slug from the server
  const [input, setInput] = useState("");

  useEffect(() => {
    apiFetch("/creators/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((p: CreatorProfile | null) => {
        setCurrent(p?.slug ?? "");
        setInput(p?.slug ?? "");
      })
      .finally(() => setLoading(false));
  }, []);

  const liveUrl = current ? `${STOREFRONT}/${current}` : "";
  const previewUrl = `${STOREFRONT}/${input || "your-name"}`;
  const changed = input.trim() !== current;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiFetch("/creators/me/username", {
        method: "PATCH",
        body: JSON.stringify({ username: input.trim() }),
      });
      const data = (await res.json().catch(() => null)) as
        | { slug?: string; message?: string }
        | null;
      if (!res.ok) {
        toast.error(data?.message ?? "Could not update username");
        return;
      }
      setCurrent(data?.slug ?? input.trim());
      toast.success("Username updated — old links will redirect here.");
    } catch {
      toast.error("Could not reach the server");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Store username</CardTitle>
        <CardDescription>
          Your public store lives at this URL. Changing it keeps old links working (they
          redirect here). You can change it once every 14 days.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="flex flex-col gap-4 sm:max-w-lg">
          {liveUrl && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 p-3 text-sm">
              <span className="text-muted-foreground">Your store:</span>
              <a
                href={liveUrl}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-primary hover:underline"
              >
                {liveUrl}
              </a>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="ml-auto"
                onClick={() => {
                  void navigator.clipboard?.writeText(liveUrl);
                  toast.success("Link copied");
                }}
              >
                Copy
              </Button>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={input}
              disabled={loading}
              placeholder="your-name"
              onChange={(e) => setInput(e.target.value.toLowerCase())}
            />
            <p className="text-xs text-muted-foreground">
              3–40 chars, lowercase letters/numbers/hyphens. Preview:{" "}
              <span className="font-mono">{previewUrl}</span>
            </p>
          </div>
          <Button type="submit" disabled={saving || loading || !changed} className="w-fit">
            {saving ? "Saving…" : "Save username"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
