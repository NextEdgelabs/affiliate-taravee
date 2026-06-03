import { BrandLogo } from "@taravee/ui/components/brand-logo";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <BrandLogo orientation="vertical" showTagline />
      <p className="max-w-sm text-sm text-muted-foreground">
        This is the Taravee creator storefront. Visit a creator&apos;s link to shop
        their picks.
      </p>
    </main>
  );
}
