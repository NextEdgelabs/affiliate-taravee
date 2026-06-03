"use client";

import type { CreatorLink } from "@taravee/types";
import { Button } from "@taravee/ui/components/button";
import { toast } from "@taravee/ui/components/sonner";
import { Link2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { apiFetch } from "@/lib/api";

export function CreateLinkButton({
  type,
  productHandle,
  title,
  label,
  variant = "default",
}: {
  type: "product" | "store";
  productHandle?: string;
  title?: string;
  label: string;
  variant?: "default" | "outline";
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <Button
      variant={variant}
      size="sm"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          const res = await apiFetch("/links", {
            method: "POST",
            body: JSON.stringify({ type, productHandle, title }),
          });
          if (!res.ok) {
            toast.error("Could not create link");
            return;
          }
          const link = (await res.json()) as CreatorLink;
          await navigator.clipboard.writeText(link.publicUrl).catch(() => {});
          toast.success("Link created & copied to clipboard");
          router.refresh();
        } catch {
          toast.error("Could not reach the server");
        } finally {
          setLoading(false);
        }
      }}
    >
      <Link2 className="size-3.5" />
      {loading ? "Creating…" : label}
    </Button>
  );
}
