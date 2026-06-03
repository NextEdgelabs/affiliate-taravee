import type { CSSProperties } from "react";
import type { ThemePreset } from "@taravee/types";

/**
 * Vetted storefront colour presets (Phase 1). Each maps to CSS custom
 * properties that override the shared @taravee/ui tokens for the creator's
 * page subtree — so every shadcn component re-skins automatically.
 */
const PRESETS: Record<ThemePreset, Record<string, string>> = {
  gold: {
    "--primary": "oklch(0.74 0.124 86)",
    "--primary-foreground": "oklch(0.22 0.012 70)",
    "--accent": "oklch(0.96 0.03 90)",
    "--accent-foreground": "oklch(0.42 0.07 75)",
    "--ring": "oklch(0.74 0.124 86)",
  },
  midnight: {
    "--primary": "oklch(0.55 0.16 264)",
    "--primary-foreground": "oklch(0.99 0 0)",
    "--accent": "oklch(0.96 0.02 264)",
    "--accent-foreground": "oklch(0.42 0.12 264)",
    "--ring": "oklch(0.55 0.16 264)",
  },
  rose: {
    "--primary": "oklch(0.63 0.2 12)",
    "--primary-foreground": "oklch(0.99 0 0)",
    "--accent": "oklch(0.96 0.03 12)",
    "--accent-foreground": "oklch(0.45 0.16 12)",
    "--ring": "oklch(0.63 0.2 12)",
  },
  emerald: {
    "--primary": "oklch(0.6 0.13 162)",
    "--primary-foreground": "oklch(0.99 0 0)",
    "--accent": "oklch(0.96 0.03 162)",
    "--accent-foreground": "oklch(0.42 0.1 162)",
    "--ring": "oklch(0.6 0.13 162)",
  },
};

export function themeStyle(preset: ThemePreset): CSSProperties {
  return (PRESETS[preset] ?? PRESETS.gold) as CSSProperties;
}
