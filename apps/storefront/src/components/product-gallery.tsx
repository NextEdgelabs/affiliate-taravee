"use client";

import { cn } from "@taravee/ui/lib/utils";
import { useState } from "react";

export function ProductGallery({
  images,
  alt,
}: {
  images: { src: string; alt?: string }[];
  alt: string;
}) {
  const [active, setActive] = useState(0);
  if (images.length === 0) {
    return <div className="aspect-square w-full rounded-xl border bg-muted" />;
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-xl border">
        <img
          src={images[active]?.src}
          alt={images[active]?.alt ?? alt}
          className="aspect-square w-full object-cover"
        />
      </div>
      {images.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={`${img.src}-${i}`}
              type="button"
              aria-label={`View image ${i + 1}`}
              onClick={() => setActive(i)}
              className={cn(
                "size-16 shrink-0 overflow-hidden rounded-md border transition",
                i === active ? "ring-2 ring-primary" : "opacity-70 hover:opacity-100",
              )}
            >
              <img src={img.src} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
