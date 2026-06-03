"use client";

import { Button } from "@taravee/ui/components/button";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { apiFetch } from "@/lib/api";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  return (
    <Button
      variant="outline"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        await apiFetch("/auth/logout", { method: "POST" });
        router.replace("/login");
        router.refresh();
      }}
    >
      {loading ? "Signing out…" : "Sign out"}
    </Button>
  );
}
