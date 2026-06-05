import type { AdminStats } from "@taravee/types";
import { Card } from "@taravee/ui/components/card";
import { formatMoney as money } from "@taravee/ui/lib/format";
import { cn } from "@taravee/ui/lib/utils";
import {
  Package,
  ShoppingCart,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { serverGet } from "@/lib/server-api";

export default async function AdminDashboardPage() {
  const stats = await serverGet<AdminStats>("/admin/stats");
  const currency = stats?.currency ?? "INR";

  const cards: { label: string; value: string; sub: string; icon: LucideIcon; tint: string }[] = [
    {
      label: "Creators",
      value: String(stats?.creators ?? 0),
      sub: `${stats?.pendingCreators ?? 0} pending review`,
      icon: Users,
      tint: "from-amber-500/15 to-yellow-500/15 text-amber-600",
    },
    {
      label: "Listed products",
      value: String(stats?.listedProducts ?? 0),
      sub: "available to creators",
      icon: Package,
      tint: "from-sky-500/15 to-cyan-500/15 text-sky-600",
    },
    {
      label: "Attributed revenue",
      value: money(stats?.revenue ?? 0, currency),
      sub: `${stats?.attributedOrders ?? 0}/${stats?.orders ?? 0} orders attributed`,
      icon: ShoppingCart,
      tint: "from-emerald-500/15 to-teal-500/15 text-emerald-600",
    },
    {
      label: "Commission owed",
      value: money(stats?.commissionOwed ?? 0, currency),
      sub: "estimated, pre-refund",
      icon: Wallet,
      tint: "from-violet-500/15 to-fuchsia-500/15 text-violet-600",
    },
  ];

  const attrRate = Math.round((stats?.attributionRate ?? 0) * 100);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back 👋</h1>
        <p className="text-muted-foreground">Overview of your creator program.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="p-5">
            <div className="flex items-start justify-between">
              <span
                className={cn(
                  "flex size-10 items-center justify-center rounded-xl bg-gradient-to-br",
                  c.tint,
                )}
              >
                <c.icon className="size-5" />
              </span>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">{c.label}</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight">{c.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{c.sub}</p>
          </Card>
        ))}
      </div>

      <Card className="flex items-center gap-3 p-6">
        <TrendingUp className="size-5 text-primary" />
        <div>
          <p className="text-sm font-medium">Attribution coverage: {attrRate}%</p>
          <p className="text-xs text-muted-foreground">
            Share of orders matched to a creator via UTM. Unmatched orders appear in the Orders tab.
          </p>
        </div>
      </Card>
    </div>
  );
}
