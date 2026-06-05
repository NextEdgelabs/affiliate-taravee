import type { CampaignAnalytics, CreatorLink } from "@taravee/types";
import { Badge } from "@taravee/ui/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@taravee/ui/components/card";
import { formatMoney, titleCase } from "@taravee/ui/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@taravee/ui/components/table";

import { CampaignLinkDialog } from "@/components/campaign-link-dialog";
import { CopyButton } from "@/components/copy-button";
import { CreateLinkButton } from "@/components/create-link-button";
import { serverGet } from "@/lib/server-api";

export default async function LinksPage() {
  const [links, campaigns] = await Promise.all([
    serverGet<CreatorLink[]>("/links/mine"),
    serverGet<CampaignAnalytics[]>("/creator/campaigns"),
  ]);
  const rows = links ?? [];
  // Only surface the named campaigns (default links live in the table below).
  const namedCampaigns = (campaigns ?? []).filter((c) => c.campaignLabel);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Links</h1>
          <p className="text-muted-foreground">
            Each link comes in two flavours — a <strong>storefront page</strong> (full details,
            great for your bio/Stories) and a <strong>direct link</strong> (jumps straight to the
            product on the store). Both track to you.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CreateLinkButton type="store" title="My store" label="Create store link" variant="outline" />
          <CampaignLinkDialog type="store" triggerLabel="New store campaign" />
        </div>
      </div>

      {namedCampaigns.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Campaign performance</CardTitle>
            <p className="text-sm text-muted-foreground">
              One row per named campaign. Clicks are exact; orders &amp; revenue are best-effort
              (they depend on the store keeping the link tag through checkout).
            </p>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead className="text-right">Clicks</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {namedCampaigns.map((c) => (
                  <TableRow key={c.linkId}>
                    <TableCell className="font-medium">{c.campaignLabel}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {titleCase(c.type)}
                      {c.productHandle ? ` · ${c.productHandle}` : ""}
                      {c.collectionSlug ? ` · ${c.collectionSlug}` : ""}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.utmSource}/{c.utmMedium}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{c.clicks}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.orders}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(c.revenue, c.currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Links</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Campaign</TableHead>
                <TableHead>Links</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Clicks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    No links yet — create one from the Products page or add a store link.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      <Badge variant={l.type === "store" ? "secondary" : "outline"}>
                        {titleCase(l.type)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{l.title}</TableCell>
                    <TableCell>
                      {l.campaignLabel ? (
                        <Badge variant="outline">{l.campaignLabel}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Default</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="w-20 justify-center">
                            Storefront
                          </Badge>
                          <span className="max-w-[260px] truncate text-xs text-muted-foreground">
                            {l.publicUrl}
                          </span>
                          <CopyButton value={l.publicUrl} label="Copy" />
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="w-20 justify-center">
                            Direct
                          </Badge>
                          <span className="max-w-[260px] truncate text-xs text-muted-foreground">
                            {l.redirectUrl}
                          </span>
                          <CopyButton value={l.redirectUrl} label="Copy" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {l.status === "disabled" ? (
                        <span>
                          <Badge variant="destructive">Disabled</Badge>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {l.disabledReason ?? "Turned off by the team"}
                          </span>
                        </span>
                      ) : (
                        <Badge variant="success">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{l.clicks}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
