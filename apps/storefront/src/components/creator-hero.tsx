import type { StorefrontCreator } from "@taravee/types";
import { Button } from "@taravee/ui/components/button";
import { Instagram, Youtube } from "lucide-react";

import { redirectUrl } from "@/lib/api";

export function CreatorHero({ creator }: { creator: StorefrontCreator }) {
  const hasSocials = creator.instagramUsername || creator.youtubeChannel;
  return (
    <section className="rounded-2xl bg-gradient-to-br from-primary/15 to-accent/40 p-8 text-center sm:p-12">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        {creator.displayName}&apos;s picks
      </h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Hand-selected favourites. Shop the full store or browse below.
      </p>
      {hasSocials ? (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-muted-foreground">
          {creator.instagramUsername ? (
            <a
              href={`https://instagram.com/${creator.instagramUsername}`}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 text-sm hover:text-foreground"
            >
              <Instagram className="size-4" />@{creator.instagramUsername}
            </a>
          ) : null}
          {creator.youtubeChannel ? (
            <a
              href={`https://youtube.com/results?search_query=${encodeURIComponent(creator.youtubeChannel)}`}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 text-sm hover:text-foreground"
            >
              <Youtube className="size-4" />
              {creator.youtubeChannel}
            </a>
          ) : null}
        </div>
      ) : null}
      <Button asChild className="mt-5">
        <a href={redirectUrl(creator.refCode)} rel="nofollow">
          Shop the store
        </a>
      </Button>
    </section>
  );
}
