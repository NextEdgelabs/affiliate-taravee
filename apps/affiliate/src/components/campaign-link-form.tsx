"use client";

import type { CreatorLink, LinkType } from "@taravee/types";
import { Button } from "@taravee/ui/components/button";
import { Input } from "@taravee/ui/components/input";
import { Label } from "@taravee/ui/components/label";
import { Textarea } from "@taravee/ui/components/textarea";
import { toast } from "@taravee/ui/components/sonner";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { apiFetch } from "@/lib/api";

import { CopyButton } from "./copy-button";

/** Channel presets → utm_source / utm_medium overrides (utm_campaign stays = refCode). */
const CHANNELS = [
  { label: "Instagram Reel", source: "instagram", medium: "reel" },
  { label: "Instagram Story", source: "instagram", medium: "story" },
  { label: "Instagram Post", source: "instagram", medium: "post" },
  { label: "YouTube", source: "youtube", medium: "video" },
  { label: "Email", source: "email", medium: "email" },
  { label: "WhatsApp", source: "whatsapp", medium: "message" },
  { label: "Other / unset", source: "", medium: "" },
] as const;

/**
 * Mint a NEW tracking link for the same target under a named campaign, so the
 * same product/store/collection can be promoted repeatedly (e.g. across months
 * or channels) and reported apart. The default link is created elsewhere; this
 * is purely the "differentiate it" path.
 */
export function CampaignLinkForm({
  type,
  productHandle,
  collectionSlug,
  acknowledgedGuidelinesHash,
}: {
  type: LinkType;
  productHandle?: string;
  collectionSlug?: string;
  acknowledgedGuidelinesHash?: string;
}) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [channel, setChannel] = useState(0);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<CreatorLink | null>(null);

  async function submit() {
    const campaignLabel = label.trim();
    if (!campaignLabel) {
      toast.error("Give the campaign a name (e.g. “June Reel”)");
      return;
    }
    setLoading(true);
    try {
      const ch = CHANNELS[channel]!;
      const res = await apiFetch("/links", {
        method: "POST",
        body: JSON.stringify({
          type,
          productHandle,
          collectionSlug,
          campaignLabel,
          ...(ch.source ? { utmSourceOverride: ch.source, utmMediumOverride: ch.medium } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
          ...(acknowledgedGuidelinesHash ? { acknowledgedGuidelinesHash } : {}),
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { message?: string } | null;
        toast.error(data?.message ?? "Could not create campaign link");
        return;
      }
      setCreated((await res.json()) as CreatorLink);
      toast.success("Campaign link ready");
      router.refresh();
    } catch {
      toast.error("Could not reach the server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-md border p-3">
      <p className="text-sm font-medium">New campaign link</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Tag this promotion so you can tell it apart from other times you share the same thing.
      </p>

      <div className="mt-3 flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="campaign-label">Campaign name</Label>
          <Input
            id="campaign-label"
            placeholder="e.g. June Reel"
            value={label}
            maxLength={80}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="campaign-channel">Channel</Label>
          <select
            id="campaign-channel"
            className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
            value={channel}
            onChange={(e) => setChannel(Number(e.target.value))}
          >
            {CHANNELS.map((c, i) => (
              <option key={c.label} value={i}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="campaign-notes">Notes (optional)</Label>
          <Textarea
            id="campaign-notes"
            placeholder="e.g. Paid story, runs Jun 1–15"
            value={notes}
            maxLength={500}
            rows={2}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <Button size="sm" disabled={loading} onClick={() => void submit()}>
          {loading ? "Creating…" : "Create campaign link"}
        </Button>
      </div>

      {created ? (
        <div className="mt-3 flex flex-col gap-2 border-t pt-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium">Storefront page</span>
            <CopyButton value={created.publicUrl} />
          </div>
          <p className="truncate text-xs text-muted-foreground">{created.publicUrl}</p>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium">Direct link</span>
            <CopyButton value={created.redirectUrl} />
          </div>
          <p className="truncate text-xs text-muted-foreground">{created.redirectUrl}</p>
        </div>
      ) : null}
    </div>
  );
}
