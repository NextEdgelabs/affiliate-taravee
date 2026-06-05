"use client";

import type { Product } from "@taravee/types";
import { Button } from "@taravee/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@taravee/ui/components/dialog";
import { Input } from "@taravee/ui/components/input";
import { toast } from "@taravee/ui/components/sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@taravee/ui/components/table";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { apiFetch } from "@/lib/api";

import { ProductGuidelinesDialog } from "./product-guidelines-dialog";
import { ProductListedToggle } from "./product-listed-toggle";

function formatRate(rate: number | null | undefined): string {
  if (rate == null) return "—";
  const pct = rate * 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(1)}%`;
}

function hasGuidelines(p: Product): boolean {
  const g = p.contentGuidelines;
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

export function CatalogTable({ items }: { items: Product[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  // Commission dialog state — `ids` it acts on (one for a single row, many for bulk).
  const [dialogIds, setDialogIds] = useState<string[] | null>(null);
  const [pctInput, setPctInput] = useState("");
  // Content-guidelines editor — the product whose brief is being edited.
  const [guideProduct, setGuideProduct] = useState<Product | null>(null);

  const allChecked = items.length > 0 && items.every((p) => selected.has(p.id));
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const toggleAll = () =>
    setSelected(allChecked ? new Set() : new Set(items.map((p) => p.id)));
  const clear = () => setSelected(new Set());

  async function mutate(fn: () => Promise<Response>, ok: (data: unknown) => string) {
    setBusy(true);
    try {
      const res = await fn();
      const data = (await res.json().catch(() => null)) as
        | { message?: string; matched?: number; modified?: number }
        | null;
      if (!res.ok) {
        toast.error(data?.message ?? "Action failed");
        return false;
      }
      toast.success(ok(data));
      clear();
      router.refresh();
      return true;
    } catch {
      toast.error("Could not reach the server");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const ids = () => [...selected];

  function bulkListed(listed: boolean) {
    return mutate(
      () =>
        apiFetch("/admin/products/bulk-listed", {
          method: "PATCH",
          body: JSON.stringify({ ids: ids(), listed }),
        }),
      (d) =>
        `${(d as { modified?: number })?.modified ?? 0} ${listed ? "listed" : "unlisted"}`,
    );
  }

  function bulkGuidelinesVisibility(visible: boolean) {
    return mutate(
      () =>
        apiFetch("/admin/products/bulk-guidelines-visibility", {
          method: "PATCH",
          body: JSON.stringify({ ids: ids(), visible }),
        }),
      (d) =>
        `Guidelines ${visible ? "shown" : "hidden"} on ${(d as { modified?: number })?.modified ?? 0}`,
    );
  }

  function setHold(id: string, hold: boolean) {
    return mutate(
      () =>
        apiFetch(`/admin/products/${id}/compliance-hold`, {
          method: "PATCH",
          body: JSON.stringify({ hold, reason: hold ? "Compliance hold" : undefined }),
        }),
      () => (hold ? "Product put on compliance hold" : "Compliance hold released"),
    );
  }

  async function submitCommission(value: number | null) {
    const targets = dialogIds ?? [];
    if (targets.length === 0) return;
    const ok = await mutate(
      () =>
        targets.length === 1
          ? apiFetch(`/admin/products/${targets[0]}/commission`, {
              method: "PATCH",
              body: JSON.stringify({ commissionRate: value }),
            })
          : apiFetch("/admin/products/bulk-commission", {
              method: "PATCH",
              body: JSON.stringify({ ids: targets, commissionRate: value }),
            }),
      (d) => {
        const n = (d as { modified?: number })?.modified ?? targets.length;
        if (value == null) return `Cleared override on ${targets.length === 1 ? 1 : n}`;
        return `Set ${value * 100}% on ${targets.length === 1 ? 1 : n}`;
      },
    );
    if (ok) setDialogIds(null);
  }

  function onApply() {
    const pct = Number(pctInput);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      toast.error("Enter a percent between 0 and 100");
      return;
    }
    void submitCommission(pct / 100);
  }

  return (
    <>
      {/* Sticky bulk action bar — only when something is selected. */}
      {selected.size > 0 && (
        <div className="sticky top-2 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-lg border bg-background/95 p-2 shadow-sm backdrop-blur">
          <span className="px-2 text-sm font-medium">{selected.size} selected</span>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => bulkListed(true)}>
            List
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => bulkListed(false)}>
            Unlist
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => {
              setPctInput("");
              setDialogIds(ids());
            }}
          >
            Set commission…
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => bulkGuidelinesVisibility(true)}
          >
            Show guide
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => bulkGuidelinesVisibility(false)}
          >
            Hide guide
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={clear}>
            Clear
          </Button>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <input
                type="checkbox"
                aria-label="Select all on page"
                className="size-4 cursor-pointer accent-primary"
                checked={allChecked}
                onChange={toggleAll}
              />
            </TableHead>
            <TableHead className="w-12" />
            <TableHead>Title</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Price</TableHead>
            <TableHead>Commission</TableHead>
            <TableHead>Guidelines</TableHead>
            <TableHead className="text-right">Listed</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                No products yet. Connect Shopify and run a sync.
              </TableCell>
            </TableRow>
          ) : (
            items.map((p) => (
              <TableRow key={p.id} data-state={selected.has(p.id) ? "selected" : undefined}>
                <TableCell>
                  <input
                    type="checkbox"
                    aria-label={`Select ${p.title}`}
                    className="size-4 cursor-pointer accent-primary"
                    checked={selected.has(p.id)}
                    onChange={() => toggle(p.id)}
                  />
                </TableCell>
                <TableCell>
                  {p.featuredImage ? (
                    <img src={p.featuredImage} alt="" className="size-9 rounded object-cover" />
                  ) : (
                    <div className="size-9 rounded bg-muted" />
                  )}
                </TableCell>
                <TableCell className="font-medium">{p.title}</TableCell>
                <TableCell className="text-muted-foreground">{p.productType ?? "—"}</TableCell>
                <TableCell>
                  {new Intl.NumberFormat("en-IN", {
                    style: "currency",
                    currency: p.priceRange.currency,
                  }).format(p.priceRange.min)}
                </TableCell>
                <TableCell>
                  {p.commissionRate == null ? (
                    <span className="text-muted-foreground">creator default</span>
                  ) : (
                    <span className="font-medium">{formatRate(p.commissionRate)} override</span>
                  )}
                  <button
                    type="button"
                    className="ml-2 text-xs text-primary underline-offset-2 hover:underline"
                    onClick={() => {
                      setPctInput(p.commissionRate == null ? "" : String(p.commissionRate * 100));
                      setDialogIds([p.id]);
                    }}
                  >
                    Edit
                  </button>
                </TableCell>
                <TableCell>
                  {hasGuidelines(p) ? (
                    <span
                      className={
                        p.guidelinesVisibleToCreators
                          ? "text-xs font-medium text-emerald-600"
                          : "text-xs text-muted-foreground"
                      }
                    >
                      {p.guidelinesVisibleToCreators ? "Visible" : "Hidden"}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                  <button
                    type="button"
                    className="ml-2 text-xs text-primary underline-offset-2 hover:underline"
                    onClick={() => setGuideProduct(p)}
                  >
                    {hasGuidelines(p) ? "Edit" : "Add"}
                  </button>
                  <span className="mt-0.5 block">
                    {p.complianceHold ? (
                      <button
                        type="button"
                        disabled={busy}
                        className="text-xs font-medium text-destructive underline-offset-2 hover:underline"
                        onClick={() => setHold(p.id, false)}
                      >
                        ⛔ On hold · release
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                        onClick={() => setHold(p.id, true)}
                      >
                        Hold
                      </button>
                    )}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <ProductListedToggle id={p.id} listed={p.listed} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <Dialog open={dialogIds !== null} onOpenChange={(o) => !o && setDialogIds(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Set commission {dialogIds && dialogIds.length > 1 ? `(${dialogIds.length} products)` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium" htmlFor="pct">
              Commission rate (%)
            </label>
            <Input
              id="pct"
              type="number"
              min={0}
              max={100}
              step="0.5"
              placeholder="e.g. 12"
              value={pctInput}
              onChange={(e) => setPctInput(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Applies to sales attributed via this product&apos;s link. Clearing reverts to the
              creator&apos;s default rate. Existing accrued commissions are not changed.
            </p>
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => void submitCommission(null)}
            >
              Clear override
            </Button>
            <Button disabled={busy} onClick={onApply}>
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {guideProduct && (
        <ProductGuidelinesDialog
          key={guideProduct.id}
          product={guideProduct}
          onClose={() => setGuideProduct(null)}
        />
      )}
    </>
  );
}
