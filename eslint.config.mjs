import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["node_modules/", "prototype/", "playwright-report/", "test-results/", "**/*.ts"] },
  js.configs.recommended,
  {
    files: ["scripts/**/*.mjs", "tests/**/*.mjs", "*.mjs"],
    languageOptions: { ecmaVersion: 2023, sourceType: "module", globals: { ...globals.node } },
  },
  {
    files: ["site/assets/**/*.js"],
    languageOptions: { ecmaVersion: 2017, sourceType: "script", globals: { ...globals.browser } },
    rules: { "no-unused-vars": ["error", { varsIgnorePattern: "^(start)$" }] },
  },
  { rules: { eqeqeq: ["error", "smart"], "no-var": "off", "prefer-const": "warn" } },
];
