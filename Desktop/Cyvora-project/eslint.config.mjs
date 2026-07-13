import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // API responses and sqlite rows enter the app as runtime-shaped data.
      // TypeScript's strict build remains the source of truth while those
      // boundaries are progressively modeled with domain interfaces.
      "@typescript-eslint/no-explicit-any": "off",
      // These compiler-oriented rules reject standard client-side data-loading
      // effects and imperative browser navigation used by this dashboard.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/immutability": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
