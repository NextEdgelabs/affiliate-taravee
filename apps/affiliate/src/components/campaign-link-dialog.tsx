"use client";

import type { LinkType } from "@taravee/types";
import { Button } from "@taravee/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@taravee/ui/components/dialog";
import { Link2 } from "lucide-react";
import { useState } from "react";

import { CampaignLinkForm } from "./campaign-link-form";

/** Opens a dialog to mint a named campaign link for a store or collection. */
export function CampaignLinkDialog({
  type,
  collectionSlug,
  triggerLabel = "New campaign link",
  variant = "outline",
}: {
  type: Extract<LinkType, "store" | "collection">;
  collectionSlug?: string;
  triggerLabel?: string;
  variant?: "default" | "outline";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant={variant} onClick={() => setOpen(true)}>
        <Link2 className="size-3.5" /> {triggerLabel}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New campaign link</DialogTitle>
          </DialogHeader>
          <CampaignLinkForm type={type} collectionSlug={collectionSlug} />
        </DialogContent>
      </Dialog>
    </>
  );
}
