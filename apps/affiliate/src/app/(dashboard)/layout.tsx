import { redirect } from "next/navigation";

import { AppSidebar } from "@/components/app-sidebar";
import { LogoutButton } from "@/components/logout-button";
import { MobileNav } from "@/components/mobile-nav";
import { UserMenu } from "@/components/user-menu";
import { getSession } from "@/lib/session";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  // This app is for creators. Admins should use the admin dashboard.
  if (session.role !== "affiliate") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
        <h1 className="text-2xl font-semibold">403 — Forbidden</h1>
        <p className="max-w-sm text-muted-foreground">
          You&apos;re signed in as {session.email}, which isn&apos;t a creator account.
          Sign out and log in with a creator account to continue.
        </p>
        <LogoutButton />
      </div>
    );
  }

  // Pending / suspended creators cannot use the dashboard yet.
  if (session.status !== "active") {
    redirect("/pending");
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between gap-2 border-b px-4 sm:px-6">
          <MobileNav />
          <div className="flex flex-1 items-center justify-end">
            <UserMenu user={session} />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
