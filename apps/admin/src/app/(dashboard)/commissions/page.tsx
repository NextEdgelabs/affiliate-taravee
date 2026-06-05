import type { Commission } from "@taravee/types";
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
import { formatMoney, formatRate, titleCase } from "@taravee/ui/lib/format";

import { CommissionStatusActions } from "@/components/commission-status-actions";
import { serverGet } from "@/lib/server-api";

const STATUS_VARIANT: Record<string, "warning" | "success" | "secondary" | "destructive"> = {
  pending: "warning",
  approved: "success",
  paid: "secondary",
  reversed: "destructive",
};

export default async function CommissionsPage() {
  const commissions = (await serverGet<Commission[]>("/commissions")) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Commissions</h1>
        <p className="text-muted-foreground">
          Estimated (pre-refund). Payouts are tracked only — no money moves in v1.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ledger</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Base</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Commission</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {commissions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    No commissions yet.
                  </TableCell>
                </TableRow>
              ) : (
                commissions.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{c.shopifyOrderId.slice(-10)}</TableCell>
                    <TableCell>{formatMoney(c.baseAmount, c.currency)}</TableCell>
                    <TableCell>{formatRate(c.rateApplied)}</TableCell>
                    <TableCell className="font-medium">{formatMoney(c.amount, c.currency)}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[c.status] ?? "secondary"}>
                        {titleCase(c.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <CommissionStatusActions id={c.id} status={c.status} />
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
