import globals from "globals";
import { baseConfig } from "./base.js";

/**
 * ESLint flat config for Next.js apps.
 * @type {import("eslint").Linter.Config[]}
 */
export const nextConfig = [
  ...baseConfig,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        React: "readonly",
      },
    },
  },
];

export default nextConfig;
