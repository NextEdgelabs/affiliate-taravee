import type { CreatorLink } from "@taravee/types";
import { Badge } from "@taravee/ui/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@taravee/ui/components/card";
import { titleCase } from "@taravee/ui/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@taravee/ui/components/table";

import { CopyButton } from "@/components/copy-button";
import { CreateLinkButton } from "@/components/create-link-button";
import { serverGet } from "@/lib/server-api";

export default async function LinksPage() {
  const links = (await serverGet<CreatorLink[]>("/links/mine")) ?? [];

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
        <CreateLinkButton type="store" title="My store" label="Create store link" variant="outline" />
      </div>

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
                <TableHead>Links</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Clicks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {links.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    No links yet — create one from the Products page or add a store link.
                  </TableCell>
                </TableRow>
              ) : (
                links.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      <Badge variant={l.type === "store" ? "secondary" : "outline"}>
                        {titleCase(l.type)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{l.title}</TableCell>
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
