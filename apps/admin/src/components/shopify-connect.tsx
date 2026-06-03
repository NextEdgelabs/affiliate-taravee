"use client";

import type {
  ShopifyConnectionInfo,
  ShopifyTestResult,
  WebhookRegisterResult,
} from "@taravee/types";
import { Badge } from "@taravee/ui/components/badge";
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
import { Check, Store, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";

export function ShopifyConnect({ info }: { info: ShopifyConnectionInfo }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [shopDomain, setShopDomain] = useState(info.shopDomain ?? "");
  const [accessToken, setAccessToken] = useState("");
  const [test, setTest] = useState<ShopifyTestResult | null>(null);

  const connected = info.status === "connected";

  // Surface the OAuth callback result (?connected / ?error) and tidy the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected")) {
      toast.success("Shopify connected");
      window.history.replaceState({}, "", window.location.pathname);
      router.refresh();
    } else if (params.get("error")) {
      toast.error(`Connect failed: ${params.get("error")}`);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [router]);

  function connectWithOAuth() {
    // Full-page navigation: admin-guarded /api/shopify/oauth/install 302s to Shopify.
    const q = shopDomain.trim() ? `?shop=${encodeURIComponent(shopDomain.trim())}` : "";
    window.location.href = `/api/shopify/oauth/install${q}`;
  }

  // Dev Dashboard app on a store you own — mints a token from Client ID + Secret.
  function connectClientCredentials() {
    return action(
      () =>
        apiFetch("/admin/shopify/connect/client-credentials", {
          method: "POST",
          body: JSON.stringify(shopDomain.trim() ? { shopDomain: shopDomain.trim() } : {}),
        }),
      "Connected to Shopify",
    );
  }

  async function action(fn: () => Promise<Response>, okMsg: string) {
    setBusy(true);
    try {
      const res = await fn();
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { message?: string } | null;
        toast.error(data?.message ?? "Action failed");
        return;
      }
      toast.success(okMsg);
      router.refresh();
    } catch {
      toast.error("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  async function runTest() {
    setBusy(true);
    try {
      const res = await apiFetch("/admin/shopify/test", { method: "POST" });
      if (!res.ok) {
        toast.error("Connection test failed");
        return;
      }
      const result = (await res.json()) as ShopifyTestResult;
      setTest(result);
      toast.success(`Connected to ${result.shopName ?? "store"}`);
      router.refresh();
    } catch {
      toast.error("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  async function registerWebhooks() {
    setBusy(true);
    try {
      const res = await apiFetch("/admin/shopify/webhooks/register", { method: "POST" });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { message?: string } | null;
        toast.error(data?.message ?? "Could not register webhooks");
        return;
      }
      const result = (await res.json()) as WebhookRegisterResult;
      if (result.errors.length > 0) {
        toast.error(`Some webhooks failed: ${result.errors.join("; ")}`);
      } else {
        toast.success(`Registered ${result.registered.length} webhooks`);
      }
      router.refresh();
    } catch {
      toast.error("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Connection
            <Badge variant={connected ? "success" : "secondary"}>{info.status}</Badge>
          </CardTitle>
          <CardDescription>
            Connect your single brand store. Tokens are encrypted at rest and never shown again.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="domain">Store domain</Label>
            <Input
              id="domain"
              placeholder="your-store.myshopify.com"
              value={shopDomain}
              onChange={(e) => setShopDomain(e.target.value)}
            />
          </div>

          {/* Recommended: client-credentials for a Dev Dashboard app on a store you own. */}
          {info.clientCredentialsAvailable ? (
            <div className="flex flex-col gap-2 rounded-md border bg-muted/20 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={connectClientCredentials} disabled={busy} className="w-fit">
                  <Store className="size-4" />
                  {connected ? "Reconnect store" : "Connect store you own"}
                </Button>
                <span className="text-xs text-muted-foreground">Recommended</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Uses your Dev Dashboard <strong>Client ID + Secret</strong> to mint an Admin API
                token — no token to paste, no browser step. The app and this store must be in the
                same Shopify organization, and the app installed on the store. (Tokens last ~24h and
                are refreshed automatically.)
              </p>
            </div>
          ) : (
            <p className="rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
              One-click connect needs your Dev Dashboard app credentials — set{" "}
              <code>SHOPIFY_API_KEY</code> (Client ID), <code>SHOPIFY_API_SECRET</code> (Secret) and{" "}
              <code>SHOPIFY_STORE_DOMAIN</code>, then reload. Until then, paste an Admin API token below.
            </p>
          )}

          {/* One-click OAuth — when a public callback URL is also configured. */}
          {info.oauthAvailable ? (
            <Button onClick={connectWithOAuth} disabled={busy} variant="outline" className="w-fit">
              <Store className="size-4" />
              Connect with Shopify (OAuth)
            </Button>
          ) : null}

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or paste an existing token{" "}
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="token">Admin API access token</Label>
            <Input
              id="token"
              type="password"
              placeholder={connected ? `•••• ${info.tokenLast4 ?? ""}` : "shpat_…"}
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Only for an existing custom app&apos;s <strong>Admin API access token</strong> (starts
              with <code>shpat_</code>). <strong>Not</strong> the API key, the Secret (
              <code>shpss_</code>), or the App automation token (<code>atkn_</code>) — for a Dev
              Dashboard app use <em>Connect store you own</em> above.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy || !shopDomain || !accessToken}
              onClick={() =>
                action(
                  () =>
                    apiFetch("/admin/shopify/connect", {
                      method: "POST",
                      body: JSON.stringify({ shopDomain, accessToken }),
                    }),
                  "Connected to Shopify",
                )
              }
            >
              {connected ? "Reconnect" : "Connect"}
            </Button>
            <Button variant="outline" disabled={busy || !connected} onClick={runTest}>
              Test &amp; diagnose
            </Button>
            <Button
              variant="outline"
              disabled={busy || !connected}
              onClick={() =>
                action(
                  () => apiFetch("/admin/shopify/sync/products", { method: "POST" }),
                  "Products synced",
                )
              }
            >
              Sync products
            </Button>
          </div>

          {test && (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <Diag ok label={`Store: ${test.shopName ?? "—"}`} />
              <Diag
                ok={!!test.customerJourneyOk}
                label="Order customer-journey (UTM attribution) readable"
              />
              {test.scopes && test.scopes.length > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Scopes: {test.scopes.join(", ")}
                </p>
              )}
              {test.warning && <p className="mt-1 text-xs text-amber-600">{test.warning}</p>}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Webhooks</CardTitle>
          <CardDescription>
            One-click register the webhooks Taravee needs (orders + products). Requires
            PUBLIC_API_URL to be a public HTTPS URL Shopify can reach.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div>
            <Button variant="outline" disabled={busy || !connected} onClick={registerWebhooks}>
              Register webhooks
            </Button>
          </div>
          {info.webhooks && info.webhooks.length > 0 ? (
            <ul className="flex flex-col gap-1 text-sm">
              {info.webhooks.map((w) => (
                <li key={`${w.topic}-${w.callbackUrl}`} className="flex items-center gap-2">
                  <Check className="size-4 text-emerald-600" />
                  <span className="font-mono text-xs">{w.topic}</span>
                  <span className="truncate text-xs text-muted-foreground">{w.callbackUrl}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No webhooks registered yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <Info label="Shop domain" value={info.shopDomain ?? "—"} />
          <Info label="API version" value={info.apiVersion ?? "—"} />
          <Info label="Products synced" value={String(info.productCount ?? 0)} />
          <Info label="Listed for creators" value={String(info.listedCount ?? 0)} />
          <Info
            label="Last product sync"
            value={info.lastProductSyncAt ? new Date(info.lastProductSyncAt).toLocaleString() : "Never"}
          />
          <Info label="Sync state" value={info.syncState ?? "idle"} />
          <Info label="Auth mode" value={AUTH_MODE_LABEL[info.authMode ?? "token"]} />
          {info.tokenExpiresAt ? (
            <Info
              label="Token expires"
              value={new Date(info.tokenExpiresAt).toLocaleString()}
            />
          ) : null}
          {info.lastError ? (
            <p className="text-destructive sm:col-span-2">{info.lastError}</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

const AUTH_MODE_LABEL: Record<NonNullable<ShopifyConnectionInfo["authMode"]>, string> = {
  token: "Pasted token",
  oauth: "OAuth",
  client_credentials: "Client credentials (store you own)",
};

function Diag({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      {ok ? (
        <Check className="size-4 text-emerald-600" />
      ) : (
        <X className="size-4 text-destructive" />
      )}
      <span>{label}</span>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
