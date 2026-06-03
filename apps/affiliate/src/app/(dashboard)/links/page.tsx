import type { CreatorLink } from "@taravee/types";
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
            Share these — every visit is tracked and attributed to you.
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
                <TableHead>Public link</TableHead>
                <TableHead className="text-right">Clicks</TableHead>
                <TableHead className="w-24" />
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
                        {l.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{l.title}</TableCell>
                    <TableCell className="max-w-[280px] truncate text-muted-foreground">
                      {l.publicUrl}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{l.clicks}</TableCell>
                    <TableCell className="text-right">
                      <CopyButton value={l.publicUrl} />
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
