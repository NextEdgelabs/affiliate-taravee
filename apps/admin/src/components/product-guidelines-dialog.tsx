"use client";

import type { ContentGuidelines, Product } from "@taravee/types";
import { Button } from "@taravee/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@taravee/ui/components/dialog";
import { Input } from "@taravee/ui/components/input";
import { Switch } from "@taravee/ui/components/switch";
import { toast } from "@taravee/ui/components/sonner";
import { Textarea } from "@taravee/ui/components/textarea";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { apiFetch } from "@/lib/api";

/**
 * Compliance-aware starter template (India health products: ASCI disclosure +
 * DMR Act / FSSAI prohibited-claims). Seeded only when a product has NO brief
 * yet, so admins start compliant and edit from there.
 */
const DEFAULTS: ContentGuidelines = {
  generalNotes:
    "Speak in your own voice — authentic, friend-style recommendations outperform hard-sell. Describe how YOU use the product. Only use brand-approved claims.",
  disclosure:
    "#ad · Paid affiliate partnership with BJW Health. Put this at the START of your caption — never buried in hashtags.",
  requiredHashtags: ["#ad", "#BJWHealth"],
  requiredMentions: ["@bjwhealth"],
  reel:
    "15–30s vertical (9:16). Hook in the first 3 seconds. Show the product in use. Say “link in bio” out loud + on screen. Keep the #ad disclosure on-screen for at least 3 seconds.",
  story:
    "Use the Link sticker pointing to your Taravee link, placed in the middle of the frame. Say “tap to shop”. Superimpose the #ad label on the image/video.",
  post:
    "Lead the caption with your hook + #ad in the first line (before the “more” cut-off). Link in bio. Tag @bjwhealth using the Paid Partnership label.",
  prohibitedClaims:
    "Do NOT claim the product cures, treats, or prevents any disease (diabetes, cancer, heart disease, thyroid, PCOS, COVID, etc.) — a criminal offence under the DMR Act 1954. No “works like medicine / replaces medication / no need for a doctor”. No “guaranteed results”, “100% safe, no side-effects”, or miracle/magic-cure language. No fabricated before/after testimonials.",
  healthDisclaimer:
    "Not for medicinal use. This is not a substitute for professional medical advice, diagnosis, or treatment — consult a qualified healthcare professional before use.",
};

function hasAny(g?: ContentGuidelines | null): boolean {
  if (!g) return false;
  return Boolean(
    g.reel ||
      g.story ||
      g.post ||
      g.generalNotes ||
      g.disclosure ||
      g.prohibitedClaims ||
      g.healthDisclaimer ||
      g.requiredHashtags?.length ||
      g.requiredMentions?.length,
  );
}

/** Parse a free-text tag field into a deduped, prefixed array. */
function toTags(input: string, prefix: "#" | "@"): string[] {
  return Array.from(
    new Set(
      input
        .split(/[\s,]+/)
        .map((t) => t.trim())
        .filter(Boolean)
        .map((t) => prefix + t.replace(/^[#@]+/, "")),
    ),
  );
}
const fromTags = (a?: string[]) => (a ?? []).join(" ");

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

export function ProductGuidelinesDialog({
  product,
  onClose,
}: {
  product: Product;
  onClose: () => void;
}) {
  const router = useRouter();
  const seed = hasAny(product.contentGuidelines) ? product.contentGuidelines! : DEFAULTS;

  const [reel, setReel] = useState(seed.reel ?? "");
  const [story, setStory] = useState(seed.story ?? "");
  const [post, setPost] = useState(seed.post ?? "");
  const [generalNotes, setGeneralNotes] = useState(seed.generalNotes ?? "");
  const [disclosure, setDisclosure] = useState(seed.disclosure ?? "");
  const [hashtags, setHashtags] = useState(fromTags(seed.requiredHashtags));
  const [mentions, setMentions] = useState(fromTags(seed.requiredMentions));
  const [prohibitedClaims, setProhibitedClaims] = useState(seed.prohibitedClaims ?? "");
  const [healthDisclaimer, setHealthDisclaimer] = useState(seed.healthDisclaimer ?? "");
  const [visible, setVisible] = useState(product.guidelinesVisibleToCreators ?? false);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const t = (s: string) => {
      const v = s.trim();
      return v ? v : undefined;
    };
    const guidelines: ContentGuidelines = {
      reel: t(reel),
      story: t(story),
      post: t(post),
      generalNotes: t(generalNotes),
      disclosure: t(disclosure),
      requiredHashtags: toTags(hashtags, "#"),
      requiredMentions: toTags(mentions, "@"),
      prohibitedClaims: t(prohibitedClaims),
      healthDisclaimer: t(healthDisclaimer),
    };
    try {
      const res = await apiFetch(`/admin/products/${product.id}/guidelines`, {
        method: "PATCH",
        body: JSON.stringify({ guidelines, visible }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { message?: string } | null;
        toast.error(data?.message ?? "Could not save guidelines");
        return;
      }
      toast.success(visible ? "Saved — visible to creators" : "Saved (hidden from creators)");
      router.refresh();
      onClose();
    } catch {
      toast.error("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Content guidelines — {product.title}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
            India · health products: affiliate posts are co-liable. Disclosure is mandatory
            (ASCI) and disease cure/treatment claims are a criminal offence (DMR Act 1954) /
            barred for nutraceuticals (FSSAI). Keep the compliance fields below filled in.
          </p>

          <Field label="General notes" hint="Talking points & overall do/don't — applies to every format.">
            <Textarea rows={3} value={generalNotes} onChange={(e) => setGeneralNotes(e.target.value)} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Reel">
              <Textarea rows={5} value={reel} onChange={(e) => setReel(e.target.value)} />
            </Field>
            <Field label="Story">
              <Textarea rows={5} value={story} onChange={(e) => setStory(e.target.value)} />
            </Field>
            <Field label="Post">
              <Textarea rows={5} value={post} onChange={(e) => setPost(e.target.value)} />
            </Field>
          </div>

          <Field label="Required disclosure" hint="Must appear upfront — affiliate = a material connection (FTC/ASCI).">
            <Input value={disclosure} onChange={(e) => setDisclosure(e.target.value)} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Required hashtags" hint="Space or comma separated.">
              <Input value={hashtags} onChange={(e) => setHashtags(e.target.value)} placeholder="#ad #BJWHealth" />
            </Field>
            <Field label="Required @mentions" hint="Space or comma separated.">
              <Input value={mentions} onChange={(e) => setMentions(e.target.value)} placeholder="@bjwhealth" />
            </Field>
          </div>

          <Field label="Claims creators may NOT make" hint="DMR Act 1954 / FSSAI — prohibited health claims.">
            <Textarea rows={4} value={prohibitedClaims} onChange={(e) => setProhibitedClaims(e.target.value)} />
          </Field>

          <Field label="Health disclaimer" hint="Creators must include this line.">
            <Textarea rows={2} value={healthDisclaimer} onChange={(e) => setHealthDisclaimer(e.target.value)} />
          </Field>

          <label className="flex items-center justify-between rounded-md border p-3">
            <span className="text-sm">
              <span className="font-medium">Visible to creators</span>
              <span className="block text-xs text-muted-foreground">
                When on, creators see these guidelines (with a “follow strictly” notice) on the product.
              </span>
            </span>
            <Switch checked={visible} onCheckedChange={setVisible} disabled={busy} />
          </label>
        </div>

        <DialogFooter className="gap-2 sm:justify-end">
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy} onClick={() => void save()}>
            {busy ? "Saving…" : "Save guidelines"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
