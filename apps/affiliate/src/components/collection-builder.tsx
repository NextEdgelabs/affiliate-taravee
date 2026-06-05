"use client";

import type { CreatorCollection, Product, ThemePreset } from "@taravee/types";
import { Button } from "@taravee/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@taravee/ui/components/card";
import { Input } from "@taravee/ui/components/input";
import { Label } from "@taravee/ui/components/label";
import { toast } from "@taravee/ui/components/sonner";
import { cn } from "@taravee/ui/lib/utils";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { CopyButton } from "@/components/copy-button";
import { apiFetch } from "@/lib/api";

const THEMES: ThemePreset[] = ["gold", "midnight", "rose", "emerald"];

export function CollectionBuilder({
  products,
  initial,
}: {
  products: Product[];
  initial?: CreatorCollection;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [theme, setTheme] = useState<ThemePreset>(initial?.theme ?? "gold");
  const [selected, setSelected] = useState<string[]>(initial?.productHandles ?? []);

  const byHandle = new Map(products.map((p) => [p.handle, p]));
  const isEdit = Boolean(initial?.id);

  function toggle(handle: string) {
    setSelected((s) => (s.includes(handle) ? s.filter((h) => h !== handle) : [...s, handle]));
  }
  function move(idx: number, dir: -1 | 1) {
    setSelected((s) => {
      const next = [...s];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return s;
      [next[idx], next[j]] = [next[j]!, next[idx]!];
      return next;
    });
  }

  async function save(): Promise<string | null> {
    if (!title.trim()) {
      toast.error("Give your collection a title");
      return null;
    }
    setBusy(true);
    try {
      const body = JSON.stringify({ title, description, theme, productHandles: selected });
      const res = initial?.id
        ? await apiFetch(`/creator/collections/${initial.id}`, { method: "PATCH", body })
        : await apiFetch("/creator/collections", { method: "POST", body });
      if (!res.ok) {
        toast.error("Could not save collection");
        return null;
      }
      const saved = (await res.json()) as CreatorCollection;
      toast.success("Saved");
      if (!isEdit) {
        router.replace(`/collections/${saved.id}/edit`);
        router.refresh();
      } else {
        router.refresh();
      }
      return saved.id;
    } catch {
      toast.error("Could not reach the server");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function publishToggle() {
    if (!initial?.id) {
      toast.error("Save the collection first");
      return;
    }
    const nextStatus = initial.status === "published" ? "draft" : "published";
    setBusy(true);
    try {
      const res = await apiFetch(`/creator/collections/${initial.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { message?: string } | null;
        toast.error(data?.message ?? "Could not update");
        return;
      }
      toast.success(nextStatus === "published" ? "Published" : "Unpublished");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      {/* Settings + selected ordering */}
      <div className="flex w-full flex-col gap-4 lg:max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="desc">Description</Label>
              <Input
                id="desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Theme</Label>
              <div className="flex gap-2">
                {THEMES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTheme(t)}
                    className={cn(
                      "size-8 rounded-full border-2 capitalize",
                      theme === t ? "ring-2 ring-ring ring-offset-2" : "border-transparent",
                    )}
                    style={{ background: SWATCH[t] }}
                    aria-label={t}
                  />
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={save} disabled={busy}>
                {busy ? "Saving…" : "Save"}
              </Button>
              {isEdit && (
                <Button variant="outline" onClick={publishToggle} disabled={busy}>
                  {initial?.status === "published" ? "Unpublish" : "Publish"}
                </Button>
              )}
              {initial?.status === "published" && (
                <CopyButton value={initial.publicUrl} label="Copy URL" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Selected ({selected.length})</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {selected.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Pick products on the right to add them.
              </p>
            ) : (
              selected.map((h, i) => {
                const p = byHandle.get(h);
                return (
                  <div key={h} className="flex items-center gap-2 rounded-md border p-2">
                    <span className="flex-1 truncate text-sm">{p?.title ?? h}</span>
                    <Button size="icon" variant="ghost" onClick={() => move(i, -1)}>
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => move(i, 1)}>
                      <ArrowDown className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => toggle(h)}>
                      <X className="size-4" />
                    </Button>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Product picker */}
      <Card className="flex-1">
        <CardHeader>
          <CardTitle>Products</CardTitle>
        </CardHeader>
        <CardContent>
          {products.length === 0 ? (
            <p className="text-sm text-muted-foreground">No products available yet.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((p) => {
                const on = selected.includes(p.handle);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggle(p.handle)}
                    className={cn(
                      "flex flex-col overflow-hidden rounded-lg border text-left transition-colors",
                      on ? "border-primary ring-1 ring-primary" : "hover:bg-accent/40",
                    )}
                  >
                    {p.featuredImage ? (
                      <img src={p.featuredImage} alt="" className="aspect-square w-full object-cover" />
                    ) : (
                      <div className="aspect-square w-full bg-muted" />
                    )}
                    <span className="line-clamp-2 p-2 text-xs font-medium">{p.title}</span>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const SWATCH: Record<ThemePreset, string> = {
  gold: "#c9a227",
  midnight: "#3b4ea8",
  rose: "#d6336c",
  emerald: "#0d9488",
};
