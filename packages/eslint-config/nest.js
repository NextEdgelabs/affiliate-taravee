import globals from "globals";
import { baseConfig } from "./base.js";

/**
 * ESLint flat config for the NestJS API.
 * @type {import("eslint").Linter.Config[]}
 */
export const nestConfig = [
  ...baseConfig,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "@typescript-eslint/no-extraneous-class": "off",
      "@typescript-eslint/interface-name-prefix": "off",
    },
  },
];

export default nestConfig;
