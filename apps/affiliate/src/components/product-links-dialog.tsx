"use client";

import type { CreatorLink, Product } from "@taravee/types";
import { Button } from "@taravee/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@taravee/ui/components/dialog";
import { toast } from "@taravee/ui/components/sonner";
import { Link2 } from "lucide-react";
import { useState } from "react";

import { apiFetch } from "@/lib/api";

import { CampaignLinkForm } from "./campaign-link-form";
import { CopyButton } from "./copy-button";
import { GuidelinesView } from "./guidelines-view";

function LinkRow({ label, hint, value }: { label: string; hint: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        <CopyButton value={value} />
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      <p className="mt-1 truncate text-xs text-muted-foreground">{value}</p>
    </div>
  );
}

/**
 * Per-product "Get links & guide". When the product carries a mandatory
 * compliance pack (guidelinesHash set), the creator must read & accept the
 * guidelines BEFORE the links are revealed — the acceptance hash is sent to the
 * API, which records provable consent and refuses to mint a link without it.
 */
export function ProductLinksDialog({ product }: { product: Product }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState<CreatorLink | null>(null);
  const [accepted, setAccepted] = useState(false);

  const guide = product.contentGuidelines ?? null;
  const mustAccept = Boolean(product.guidelinesHash);

  async function fetchLinks() {
    if (loading || link) return;
    setLoading(true);
    try {
      const res = await apiFetch("/links", {
        method: "POST",
        body: JSON.stringify({
          type: "product",
          productHandle: product.handle,
          title: product.title,
          ...(mustAccept ? { acknowledgedGuidelinesHash: product.guidelinesHash } : {}),
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { message?: string } | null;
        toast.error(data?.message ?? "Could not prepare your links");
        return;
      }
      setLink((await res.json()) as CreatorLink);
    } catch {
      toast.error("Could not reach the server");
    } finally {
      setLoading(false);
    }
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    // No compliance pack → prepare links immediately on open.
    if (next && !mustAccept && !link) void fetchLinks();
  }

  return (
    <>
      <Button variant="default" size="sm" onClick={() => onOpenChange(true)}>
        <Link2 className="size-3.5" />
        {guide ? "Get links & guide" : "Get links"}
      </Button>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{product.title}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            {link ? (
              <>
                <LinkRow
                  label="Storefront page"
                  hint="Your branded product page with full details — best for your bio link, Stories, and multi-product content."
                  value={link.publicUrl}
                />
                <LinkRow
                  label="Direct to product"
                  hint="Sends shoppers straight to this product on the store — fewest clicks, best for a single-product Reel or a launch."
                  value={link.redirectUrl}
                />
                <CampaignLinkForm
                  type="product"
                  productHandle={product.handle}
                  acknowledgedGuidelinesHash={mustAccept ? product.guidelinesHash : undefined}
                />
              </>
            ) : mustAccept ? (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3">
                <p className="text-sm font-medium text-amber-900">
                  Read the posting guidelines below, then accept to get your links.
                </p>
                <label className="mt-2 flex items-start gap-2 text-sm text-amber-900">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 cursor-pointer accent-amber-600"
                    checked={accepted}
                    onChange={(e) => setAccepted(e.target.checked)}
                  />
                  <span>I have read these guidelines and will follow them when I post.</span>
                </label>
                <Button
                  size="sm"
                  className="mt-3"
                  disabled={!accepted || loading}
                  onClick={() => void fetchLinks()}
                >
                  {loading ? "Preparing…" : "Accept & get my links"}
                </Button>
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Preparing your links…
              </p>
            )}

            {guide ? <GuidelinesView guidelines={guide} /> : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
