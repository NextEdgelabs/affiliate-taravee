import type { Commission, CommissionSummary } from "@taravee/types";
import { Badge } from "@taravee/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@taravee/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@taravee/ui/components/table";

import { PayoutSettings } from "@/components/payout-settings";
import { serverGet } from "@/lib/server-api";

function money(n: number, currency: string) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(n);
}

const STATUS_VARIANT: Record<string, "warning" | "success" | "secondary" | "destructive"> = {
  pending: "warning",
  approved: "success",
  paid: "secondary",
  reversed: "destructive",
};

export default async function PayoutsPage() {
  const data = await serverGet<{ items: Commission[]; summary: CommissionSummary }>(
    "/creator/commissions",
  );
  const items = data?.items ?? [];
  const summary = data?.summary ?? { pending: 0, approved: 0, paid: 0, currency: "INR" };
  const cur = summary.currency;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Payouts</h1>
        <p className="text-muted-foreground">
          Commission tracking. Amounts are estimated before refunds settle.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Pending", value: summary.pending },
          { label: "Approved", value: summary.approved },
          { label: "Paid", value: summary.paid },
        ].map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardDescription>{s.label}</CardDescription>
              <CardTitle className="text-2xl">{money(s.value, cur)}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <PayoutSettings />

      <Card>
        <CardHeader>
          <CardTitle>Commission history</CardTitle>
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    No commissions yet.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{c.shopifyOrderId.slice(-10)}</TableCell>
                    <TableCell>{money(c.baseAmount, c.currency)}</TableCell>
                    <TableCell>{Math.round(c.rateApplied * 100)}%</TableCell>
                    <TableCell className="font-medium">{money(c.amount, c.currency)}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[c.status] ?? "secondary"}>{c.status}</Badge>
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
