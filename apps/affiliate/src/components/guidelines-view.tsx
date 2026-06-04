"use client";

import type { ContentGuidelines } from "@taravee/types";
import { AlertTriangle, Ban } from "lucide-react";

import { CopyButton } from "./copy-button";

function Section({ title, body }: { title: string; body?: string }) {
  if (!body) return null;
  return (
    <div>
      <h4 className="text-sm font-semibold">{title}</h4>
      <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function CopyRow({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">{title}</h4>
        <CopyButton value={value} />
      </div>
      <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{value}</p>
    </div>
  );
}

/** Read-only render of an admin-authored content brief, shown to the creator. */
export function GuidelinesView({ guidelines }: { guidelines: ContentGuidelines }) {
  const g = guidelines;
  const tags = (g.requiredHashtags ?? []).join(" ");
  const mentions = (g.requiredMentions ?? []).join(" ");
  const perFormat = Boolean(g.reel || g.story || g.post);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <p className="text-xs font-medium">
          Posting guidelines — please follow these strictly. Disclosure is legally required and
          following them protects both you and your commissions.
        </p>
      </div>

      <Section title="General" body={g.generalNotes} />

      {perFormat && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Section title="Reel" body={g.reel} />
          <Section title="Story" body={g.story} />
          <Section title="Post" body={g.post} />
        </div>
      )}

      {g.disclosure ? <CopyRow title="Required disclosure" value={g.disclosure} /> : null}

      {(tags || mentions) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {tags ? <CopyRow title="Required hashtags" value={tags} /> : null}
          {mentions ? <CopyRow title="Tag these accounts" value={mentions} /> : null}
        </div>
      )}

      {g.prohibitedClaims ? (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-red-900">
          <div className="flex items-center gap-2">
            <Ban className="size-4 shrink-0" />
            <h4 className="text-sm font-semibold">Claims you may NOT make</h4>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-xs">{g.prohibitedClaims}</p>
        </div>
      ) : null}

      {g.healthDisclaimer ? <CopyRow title="Include this disclaimer" value={g.healthDisclaimer} /> : null}
    </div>
  );
}
