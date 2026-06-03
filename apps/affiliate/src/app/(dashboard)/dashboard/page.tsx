import type { CreatorProfile, CreatorStats } from "@taravee/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@taravee/ui/components/card";
import { MousePointerClick, ShoppingBag, Wallet } from "lucide-react";

import { serverGet } from "@/lib/server-api";

function money(n: number, currency: string) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(n);
}

export default async function CreatorDashboardPage() {
  const [stats, profile] = await Promise.all([
    serverGet<CreatorStats>("/creator/stats"),
    serverGet<CreatorProfile>("/creators/me"),
  ]);
  const currency = stats?.currency ?? "INR";
  const cards = [
    { label: "Clicks", value: stats?.clicks ?? 0, icon: MousePointerClick },
    { label: "Orders", value: stats?.orders ?? 0, icon: ShoppingBag },
    {
      label: "Revenue driven",
      value: money(stats?.revenue ?? 0, currency),
      icon: ShoppingBag,
    },
    {
      label: "Pending commission",
      value: money(stats?.commissionPending ?? 0, currency),
      icon: Wallet,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Your performance
          {profile ? ` · ${Math.round(profile.commissionRate * 100)}% commission` : ""}.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <c.icon className="size-4" /> {c.label}
              </CardDescription>
              <CardTitle className="text-3xl">{c.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Commission is estimated before refunds settle.
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
