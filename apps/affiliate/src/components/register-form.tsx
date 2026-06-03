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
import { Instagram, Youtube } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { apiFetch } from "@/lib/api";

export function RegisterForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const num = (k: string) => Number(form.get(k) || 0);
    try {
      const res = await apiFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          password: form.get("password"),
          instagramUsername: form.get("instagramUsername") || undefined,
          youtubeChannel: form.get("youtubeChannel") || undefined,
          metrics: {
            igFollowers: num("igFollowers"),
            igAvgViews: num("igAvgViews"),
            ytSubscribers: num("ytSubscribers"),
            ytAvgViews: num("ytAvgViews"),
          },
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
        const msg = Array.isArray(data?.message) ? data?.message[0] : data?.message;
        toast.error(msg ?? "Could not create account");
        return;
      }
      router.replace("/pending");
      router.refresh();
    } catch {
      toast.error("Could not reach the server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md shadow-xl shadow-black/5">
      <CardHeader className="items-center text-center">
        <BrandLogo orientation="vertical" showTagline className="mb-2" />
        <CardTitle className="text-lg">Become a creator</CardTitle>
        <CardDescription>
          Apply to the Taravee creator program — we review every application.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" name="name" autoComplete="name" required />
            <Field label="Email" name="email" type="email" autoComplete="email" required />
          </div>
          <Field
            label="Password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />

          <div className="rounded-lg border p-3">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium">
              <Instagram className="size-4 text-pink-500" /> Instagram
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Username" name="instagramUsername" placeholder="@you" />
              <Field label="Followers" name="igFollowers" type="number" min={0} />
              <Field label="Avg views / reel" name="igAvgViews" type="number" min={0} />
            </div>
          </div>

          <div className="rounded-lg border p-3">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium">
              <Youtube className="size-4 text-red-500" /> YouTube
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Channel" name="youtubeChannel" placeholder="Channel" />
              <Field label="Subscribers" name="ytSubscribers" type="number" min={0} />
              <Field label="Avg views / video" name="ytAvgViews" type="number" min={0} />
            </div>
          </div>

          <Button type="submit" disabled={loading} className="mt-1">
            {loading ? "Submitting…" : "Submit application"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  name,
  ...props
}: { label: string; name: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name} className="text-xs">
        {label}
      </Label>
      <Input id={name} name={name} {...props} />
    </div>
  );
}
