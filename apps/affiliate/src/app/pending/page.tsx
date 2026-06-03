import { BrandLogo } from "@taravee/ui/components/brand-logo";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@taravee/ui/components/card";
import { Clock } from "lucide-react";
import { redirect } from "next/navigation";

import { LogoutButton } from "@/components/logout-button";
import { getSession } from "@/lib/session";

export default async function PendingPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "affiliate" && session.status === "active") {
    redirect("/dashboard");
  }

  const suspended = session.status === "suspended";

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md text-center shadow-xl shadow-black/5">
        <CardHeader className="items-center">
          <BrandLogo orientation="vertical" showTagline className="mb-2" />
          <div className="mt-2 flex size-12 items-center justify-center rounded-full bg-primary/10">
            <Clock className="size-6 text-primary" />
          </div>
          <CardTitle className="mt-2">
            {suspended ? "Account suspended" : "Application under review"}
          </CardTitle>
          <CardDescription>
            {suspended
              ? "Your creator account is currently suspended. Please contact support."
              : "Thanks for applying! Our team is reviewing your profile and social metrics. You'll get access as soon as you're approved."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3">
          <p className="text-sm text-muted-foreground">Signed in as {session.email}</p>
          <LogoutButton />
        </CardContent>
      </Card>
    </div>
  );
}
