import { nextConfig } from "@taravee/eslint-config/next";

export default [
  ...nextConfig,
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts"],
  },
];
