import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import ja3dan from "@ja3dan/eslint-plugin";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    ...ja3dan.configs.recommended,
    files: ["src/app/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    rules: {
      // bran's own tokens on top of the contract. See context/ui-rules.md
      // before adding one here.
      "@ja3dan/no-raw-colors": [
        "error",
        {
          allowTokens: [
            "flvs-red",
            "positive",
            "negative",
            "line",
            "track",
            "step-1",
            "step-2",
            "step-3",
            "section",
            "row",
            "orange",
            "nav-dashboard",
            "nav-calendar",
            "nav-campaigns",
            "nav-analytics",
            "nav-team",
            "nav-integrations",
            "nav-inventory",
            "nav-orders",
            "nav-storefronts",
            "nav-billing",
            "nav-help",
            "nav-docs",
          ],
        },
      ],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "flvsbran-pkg/**"]),
]);

export default eslintConfig;
