import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { getSession } from "@/lib/session";

export default async function LoginPage() {
  const session = await getSession();
  if (session?.role === "admin") {
    redirect("/dashboard");
  }
  return <LoginForm />;
}
