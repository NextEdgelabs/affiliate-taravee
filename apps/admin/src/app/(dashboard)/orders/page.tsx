import type { AdminCreator, OrderSummary } from "@taravee/types";
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

import { AttributeOrderDialog } from "@/components/attribute-order-dialog";
import { BackfillButton } from "@/components/backfill-button";
import { serverGet } from "@/lib/server-api";

const ATTR_VARIANT: Record<string, "success" | "warning" | "secondary" | "destructive"> = {
  attributed: "success",
  pending: "warning",
  unattributed: "secondary",
  reversed: "destructive",
};

export default async function OrdersPage() {
  const [orders, creators] = await Promise.all([
    serverGet<OrderSummary[]>("/admin/orders"),
    serverGet<AdminCreator[]>("/admin/creators?status=approved"),
  ]);
  const orderList = orders ?? [];
  const approved = (creators ?? [])
    .filter((c) => c.refCode)
    .map((c) => ({ refCode: c.refCode, displayName: c.displayName }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
          <p className="text-muted-foreground">
            Synced from Shopify and attributed to creators via UTM. Manually assign
            unattributed orders.
          </p>
        </div>
        <BackfillButton />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent orders</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Subtotal</TableHead>
                <TableHead>Attribution</TableHead>
                <TableHead>Creator</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orderList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    No orders synced yet.
                  </TableCell>
                </TableRow>
              ) : (
                orderList.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">
                      {o.orderNumber ?? o.shopifyOrderId.slice(-8)}
                    </TableCell>
                    <TableCell>
                      {new Intl.NumberFormat("en-IN", {
                        style: "currency",
                        currency: o.currency,
                      }).format(o.subtotal)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={ATTR_VARIANT[o.attributionStatus] ?? "secondary"}>
                        {o.attributionStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {o.attributedRefCode ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {o.shopifyCreatedAt ? new Date(o.shopifyCreatedAt).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {o.attributionStatus !== "attributed" ? (
                        <AttributeOrderDialog orderId={o.id} creators={approved} />
                      ) : null}
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
