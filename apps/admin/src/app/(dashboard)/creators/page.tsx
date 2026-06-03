import type { AdminCreator } from "@taravee/types";
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

import { AddCreatorDialog } from "@/components/add-creator-dialog";
import { CreatorActions } from "@/components/creator-actions";
import { serverGet } from "@/lib/server-api";

const STATUS_VARIANT: Record<string, "warning" | "success" | "destructive"> = {
  pending: "warning",
  approved: "success",
  rejected: "destructive",
};

function compact(n: number) {
  return new Intl.NumberFormat("en-IN", { notation: "compact" }).format(n);
}

export default async function CreatorsPage() {
  const creators = (await serverGet<AdminCreator[]>("/admin/creators")) ?? [];
  const pending = creators.filter((c) => c.verificationStatus === "pending");
  const rest = creators.filter((c) => c.verificationStatus !== "pending");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Creators</h1>
          <p className="text-muted-foreground">
            Review applications and manage commission rates.
          </p>
        </div>
        <AddCreatorDialog />
      </div>

      <CreatorTable
        title={`Pending review (${pending.length})`}
        rows={pending}
        emptyText="No applications waiting."
      />
      <CreatorTable title="All creators" rows={rest} emptyText="No creators yet." />
    </div>
  );
}

function CreatorTable({
  title,
  rows,
  emptyText,
}: {
  title: string;
  rows: AdminCreator[];
  emptyText: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Creator</TableHead>
              <TableHead>Instagram</TableHead>
              <TableHead>YouTube</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  {emptyText}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.email}</div>
                  </TableCell>
                  <TableCell>
                    {c.instagramUsername ? (
                      <div>
                        <div>@{c.instagramUsername}</div>
                        <div className="text-xs text-muted-foreground">
                          {compact(c.metrics.igFollowers)} followers · {compact(c.metrics.igAvgViews)} avg
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {c.youtubeChannel ? (
                      <div>
                        <div>{c.youtubeChannel}</div>
                        <div className="text-xs text-muted-foreground">
                          {compact(c.metrics.ytSubscribers)} subs · {compact(c.metrics.ytAvgViews)} avg
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[c.verificationStatus] ?? "secondary"}>
                      {c.verificationStatus}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <CreatorActions creator={c} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
