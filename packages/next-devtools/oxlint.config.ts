import { defineConfig } from "oxlint";

export default defineConfig({
  $schema: "./node_modules/oxlint/configuration_schema.json",
  categories: {
    correctness: "error",
    suspicious: "warn",
    perf: "warn",
  },
  env: {
    browser: true,
    builtin: true,
    node: true,
  },
  ignorePatterns: ["dist/**"],
  plugins: ["typescript", "unicorn", "oxc", "import"],
});
