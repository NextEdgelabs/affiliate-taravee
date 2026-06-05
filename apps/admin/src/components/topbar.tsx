"use client";

import { usePathname } from "next/navigation";

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/creators": "Creators",
  "/catalog": "Products",
  "/links": "Links",
  "/orders": "Orders",
  "/commissions": "Commissions",
  "/payouts": "Payouts",
  "/shopify": "Shopify",
};

export function Topbar() {
  const pathname = usePathname();
  const key = Object.keys(TITLES).find((k) => pathname.startsWith(k));
  const title = key ? TITLES[key] : "Admin";

  return (
    <div className="flex flex-col">
      <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        Taravee Admin
      </span>
      <span className="text-sm font-semibold tracking-tight">{title}</span>
    </div>
  );
}
