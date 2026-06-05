"use client";

import { BrandMark, Wordmark } from "@taravee/ui/components/brand-logo";
import { cn } from "@taravee/ui/lib/utils";
import {
  LayoutDashboard,
  Link2,
  Package,
  Receipt,
  ShoppingCart,
  Store,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/creators", label: "Creators", icon: Users },
  { href: "/catalog", label: "Products", icon: Package },
  { href: "/links", label: "Links", icon: Link2 },
  { href: "/orders", label: "Orders", icon: ShoppingCart },
  { href: "/commissions", label: "Commissions", icon: Receipt },
  { href: "/payouts", label: "Payouts", icon: Wallet },
  { href: "/shopify", label: "Shopify", icon: Store },
];

/** Sidebar contents — shared by the desktop rail and the mobile drawer. */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex h-16 items-center gap-2.5 px-5">
        <BrandMark className="size-8" />
        <div className="flex flex-col leading-none">
          <Wordmark className="text-lg" />
          <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.22em] text-sidebar-foreground/55">
            Admin
          </span>
        </div>
      </div>

      <div className="px-5 pb-2 pt-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/45">
        Menu
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-[#f3e2a1] to-[#a9802a]" />
              )}
              <Icon
                className={cn(
                  "size-4 transition-colors",
                  active ? "text-[#e7c66a]" : "text-sidebar-foreground/60",
                )}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer card */}
      <div className="m-3 rounded-xl border border-sidebar-border bg-sidebar-accent/40 p-3">
        <p className="text-xs font-medium text-[#e7c66a]">Taravee Pro</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-sidebar-foreground/55">
          Full affiliate analytics &amp; payouts.
        </p>
      </div>
    </div>
  );
}

/** Fixed desktop sidebar (hidden on mobile — replaced by the drawer). */
export function AppSidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:block">
      <SidebarNav />
    </aside>
  );
}
