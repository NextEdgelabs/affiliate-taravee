import type { CreatorCollection } from "@taravee/types";
import { Badge } from "@taravee/ui/components/badge";
import { Button } from "@taravee/ui/components/button";
import { Card, CardContent } from "@taravee/ui/components/card";
import { titleCase } from "@taravee/ui/lib/format";
import { Plus } from "lucide-react";
import Link from "next/link";

import { CopyButton } from "@/components/copy-button";
import { serverGet } from "@/lib/server-api";

export default async function CollectionsPage() {
  const collections = (await serverGet<CreatorCollection[]>("/creator/collections")) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Collections</h1>
          <p className="text-muted-foreground">
            Build personalized, themed product collections to share with your audience.
          </p>
        </div>
        <Button asChild>
          <Link href="/collections/new">
            <Plus className="size-4" /> New collection
          </Link>
        </Button>
      </div>

      {collections.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No collections yet. Create your first one.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((c) => (
            <Card key={c.id}>
              <CardContent className="flex flex-col gap-3 p-5">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{c.title}</span>
                  <Badge variant={c.status === "published" ? "success" : "secondary"}>
                    {titleCase(c.status)}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {c.productHandles.length} product{c.productHandles.length === 1 ? "" : "s"} ·{" "}
                  {c.theme} theme
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/collections/${c.id}/edit`}>Edit</Link>
                  </Button>
                  {c.status === "published" && <CopyButton value={c.publicUrl} label="Copy URL" />}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
