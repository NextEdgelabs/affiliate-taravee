import { redirect } from "next/navigation";

import { AppSidebar } from "@/components/app-sidebar";
import { LogoutButton } from "@/components/logout-button";
import { MobileNav } from "@/components/mobile-nav";
import { Topbar } from "@/components/topbar";
import { UserMenu } from "@/components/user-menu";
import { getSession } from "@/lib/session";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  // This app is admin-only. Authenticated non-admins get a clear 403.
  if (session.role !== "admin") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
        <h1 className="text-2xl font-semibold">403 — Forbidden</h1>
        <p className="max-w-sm text-muted-foreground">
          You&apos;re signed in as {session.email}, which doesn&apos;t have admin access.
          Sign out and log in with an admin account to continue.
        </p>
        <LogoutButton />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between gap-2 border-b bg-background/70 px-4 backdrop-blur-sm sm:px-6">
          <div className="flex items-center gap-2">
            <MobileNav />
            <Topbar />
          </div>
          <UserMenu user={session} />
        </header>
        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
