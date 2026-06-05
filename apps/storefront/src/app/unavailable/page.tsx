import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Link unavailable",
  robots: { index: false, follow: false },
};

export default function UnavailablePage() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-2xl">
        🔌
      </div>
      <h1 className="text-xl font-semibold tracking-tight">This link isn&apos;t available</h1>
      <p className="text-sm text-muted-foreground">
        The link you followed has been turned off and isn&apos;t pointing to the store right now.
        If you reached this from a creator&apos;s post, please check back later.
      </p>
    </main>
  );
}
