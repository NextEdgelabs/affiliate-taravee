import { redirect } from "next/navigation";

import { RegisterForm } from "@/components/register-form";
import { getSession } from "@/lib/session";

export default async function RegisterPage() {
  const session = await getSession();
  if (session?.role === "affiliate") {
    redirect("/dashboard");
  }
  return <RegisterForm />;
}
