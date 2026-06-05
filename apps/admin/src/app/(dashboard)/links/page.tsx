import type { AdminLink } from "@taravee/types";
import { Badge } from "@taravee/ui/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@taravee/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@taravee/ui/components/table";
import { titleCase } from "@taravee/ui/lib/format";

import { LinkTakedownButton } from "@/components/link-takedown-button";
import { serverGet } from "@/lib/server-api";

export default async function AdminLinksPage() {
  const links = (await serverGet<AdminLink[]>("/admin/links")) ?? [];
  const live = links.filter((l) => l.status === "active").length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Links</h1>
        <p className="text-muted-foreground">
          Every creator link. Disable one to instantly stop it sending traffic to the store
          (shoppers see a neutral &ldquo;unavailable&rdquo; page) — use it to take down a
          non-compliant post. To halt ALL of a creator&apos;s links at once, use Suspend links
          on the Creators page.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Links ({live} live / {links.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Creator</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Clicks</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {links.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    No creator links yet.
                  </TableCell>
                </TableRow>
              ) : (
                links.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">
                      {l.creatorSlug}
                      <span className="ml-1 font-mono text-xs text-muted-foreground">
                        {l.creatorRefCode}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={l.type === "store" ? "secondary" : "outline"}>
                        {titleCase(l.type)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{l.productHandle ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{l.clicks}</TableCell>
                    <TableCell>
                      {l.status === "active" ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <span>
                          <Badge variant="destructive">Disabled</Badge>
                          {l.disabledReason ? (
                            <span className="block text-xs text-muted-foreground">
                              {l.disabledReason}
                            </span>
                          ) : null}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <LinkTakedownButton id={l.id} status={l.status} />
                    </TableCell>
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
