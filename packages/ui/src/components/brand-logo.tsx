import { cn } from "@taravee/ui/lib/utils";

/**
 * Taravee brand assets — a gold wireframe four-point star mark plus the serif
 * wordmark and tagline. Recreated as crisp SVG/CSS so it scales and works on
 * both light and dark backgrounds.
 */

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={cn("size-10", className)}
      fill="none"
      role="img"
      aria-label="Taravee"
    >
      <defs>
        <linearGradient id="taravee-gold" x1="10" y1="6" x2="90" y2="94" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f6e7a8" />
          <stop offset="40%" stopColor="#d4af37" />
          <stop offset="72%" stopColor="#a9802a" />
          <stop offset="100%" stopColor="#7a571c" />
        </linearGradient>
      </defs>
      <g
        stroke="url(#taravee-gold)"
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        {/* Outer four-point star */}
        <path d="M50 3 L61 39 L97 50 L61 61 L50 97 L39 61 L3 50 L39 39 Z" />
        {/* Inner diamond */}
        <path d="M50 22 L78 50 L50 78 L22 50 Z" opacity="0.85" />
        {/* Cross-hatch through the waist */}
        <path d="M39 39 L61 61 M61 39 L39 61" opacity="0.55" />
        {/* Center cardinal lines */}
        <path d="M50 22 L50 78 M22 50 L78 50" opacity="0.35" />
      </g>
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "bg-gradient-to-b from-[#f3e2a1] via-[#d4af37] to-[#a9802a] bg-clip-text font-serif text-2xl font-semibold uppercase tracking-[0.18em] text-transparent",
        className,
      )}
    >
      Taravee
    </span>
  );
}

export function BrandLogo({
  orientation = "vertical",
  showTagline = false,
  markClassName,
  className,
}: {
  orientation?: "vertical" | "horizontal";
  showTagline?: boolean;
  markClassName?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3",
        orientation === "vertical" && "flex-col gap-2",
        className,
      )}
    >
      <BrandMark className={cn("size-12", markClassName)} />
      <div
        className={cn(
          "flex flex-col",
          orientation === "vertical" ? "items-center" : "items-start leading-none",
        )}
      >
        <Wordmark />
        {showTagline && (
          <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.32em] text-muted-foreground">
            Own Your Story Daily
          </span>
        )}
      </div>
    </div>
  );
}
