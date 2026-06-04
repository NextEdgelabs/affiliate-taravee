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
 * Per-product "Get links & guide": prepares the creator's link (idempotent) and
 * shows BOTH shareable link types + the admin's posting guidelines in one place —
 * the moment a creator is about to post is exactly when they need both.
 */
export function ProductLinksDialog({ product }: { product: Product }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState<CreatorLink | null>(null);
  const hasGuide = Boolean(product.contentGuidelines);

  async function openDialog() {
    setOpen(true);
    if (link) return; // already prepared
    setLoading(true);
    try {
      const res = await apiFetch("/links", {
        method: "POST",
        body: JSON.stringify({
          type: "product",
          productHandle: product.handle,
          title: product.title,
        }),
      });
      if (!res.ok) {
        toast.error("Could not prepare your links");
        return;
      }
      setLink((await res.json()) as CreatorLink);
    } catch {
      toast.error("Could not reach the server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button variant="default" size="sm" onClick={() => void openDialog()}>
        <Link2 className="size-3.5" />
        {hasGuide ? "Get links & guide" : "Get links"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{product.title}</DialogTitle>
          </DialogHeader>

          {loading || !link ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Preparing your links…
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              <LinkRow
                label="Storefront page"
                hint="Your branded product page with full details — best for your bio link, Stories, and multi-product content."
                value={link.publicUrl}
              />
              <LinkRow
                label="Direct to store"
                hint="Sends shoppers straight to checkout — fewest clicks, best for a single-product Reel or a launch."
                value={link.redirectUrl}
              />
              {product.contentGuidelines ? (
                <GuidelinesView guidelines={product.contentGuidelines} />
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
