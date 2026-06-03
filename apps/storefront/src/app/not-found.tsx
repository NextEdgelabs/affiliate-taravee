import { BrandLogo } from "@taravee/ui/components/brand-logo";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <BrandLogo orientation="vertical" />
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="text-sm text-muted-foreground">
        This creator or product isn&apos;t available.
      </p>
    </main>
  );
}
