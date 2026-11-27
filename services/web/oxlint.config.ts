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
  ignorePatterns: [".next/**", "next-env.d.ts"],
  plugins: ["typescript", "unicorn", "oxc", "react", "nextjs", "jsx-a11y"],
  rules: {
    // The JSX transform of Next.js needs no React import.
    "react/react-in-jsx-scope": "off",
  },
});
