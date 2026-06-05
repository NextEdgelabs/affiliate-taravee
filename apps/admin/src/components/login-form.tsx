"use client";

import { BrandLogo } from "@taravee/ui/components/brand-logo";
import { Button } from "@taravee/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@taravee/ui/components/card";
import { Input } from "@taravee/ui/components/input";
import { Label } from "@taravee/ui/components/label";
import { toast } from "@taravee/ui/components/sonner";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { apiFetch } from "@/lib/api";

// DEMO ONLY — remove before production.
const DEMO = { email: "admin@taravee.com", password: "admin12345" };

export function LoginForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function login(creds: { email: string; password: string }) {
    setLoading(true);
    try {
      const res = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify(creds),
      });
      if (!res.ok) {
        toast.error("Invalid email or password");
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } catch {
      toast.error("Could not reach the server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-sm shadow-xl shadow-black/5">
      <CardHeader className="items-center text-center">
        <BrandLogo orientation="vertical" showTagline className="mb-2" />
        <CardTitle className="text-lg">Admin sign in</CardTitle>
        <CardDescription>Manage the Taravee creator program</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void login({ email, password });
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={loading} className="mt-2">
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        {/* DEMO ONLY — tree-shaken out of production builds. */}
        {process.env.NODE_ENV !== "production" && (
          <div className="mt-5 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground">Demo credentials</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                disabled={loading}
                onClick={() => {
                  setEmail(DEMO.email);
                  setPassword(DEMO.password);
                  void login(DEMO);
                }}
              >
                Use demo login
              </Button>
            </div>
            <p className="mt-2 text-muted-foreground">
              Email: <span className="font-mono text-foreground">{DEMO.email}</span>
              <br />
              Password: <span className="font-mono text-foreground">{DEMO.password}</span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
