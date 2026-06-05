import type { AdminPayoutRow } from "@taravee/types";
import { Card, CardContent, CardHeader, CardTitle } from "@taravee/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@taravee/ui/components/table";

import { MarkPaidButton } from "@/components/mark-paid-button";
import { serverGet } from "@/lib/server-api";

function money(n: number, currency: string) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(n);
}

export default async function AdminPayoutsPage() {
  const rows = (await serverGet<AdminPayoutRow[]>("/admin/payouts")) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Payouts</h1>
        <p className="text-muted-foreground">
          Approve commissions first, then pay creators (manual transfer to their UPI/bank)
          and mark them paid.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Creators</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Creator</TableHead>
                <TableHead>Payout to</TableHead>
                <TableHead className="text-right">Pending</TableHead>
                <TableHead className="text-right">Owed (approved)</TableHead>
                <TableHead className="text-right">Clawback</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    No approved creators yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.creatorId}>
                    <TableCell>
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-muted-foreground">{r.email}</div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.payout?.upiId ? (
                        <span className="font-mono">{r.payout.upiId}</span>
                      ) : (
                        <span className="text-muted-foreground">— not set —</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {money(r.pendingAmount, r.currency)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {money(r.approvedAmount, r.currency)}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.clawbackOutstanding > 0 ? (
                        <span className="text-destructive">
                          −{money(r.clawbackOutstanding, r.currency)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {money(r.paidAmount, r.currency)}
                    </TableCell>
                    <TableCell className="text-right">
                      <MarkPaidButton
                        creatorId={r.creatorId}
                        disabled={r.approvedAmount <= 0}
                      />
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
