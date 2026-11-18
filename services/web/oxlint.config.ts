import { defineConfig } from "oxlint";

// Follows apps/konfidence-ui/oxlint.config.ts of the Konfidence repository,
// with the React plugins instead of Svelte. ESLint stays for what Oxlint does
// not cover: the Next.js rules and the import zones in eslint.config.mjs.
export default defineConfig({
  $schema: "./node_modules/oxlint/configuration_schema.json",
  categories: {
    correctness: "error",
    nursery: "warn",
    pedantic: "off",
    perf: "warn",
    restriction: "off",
    style: "warn",
    suspicious: "warn",
  },
  env: {
    browser: true,
    builtin: true,
  },
  ignorePatterns: [".next/**", "next-env.d.ts"],
  overrides: [
    {
      env: { node: true },
      files: ["*.config.ts", "*.config.mjs"],
    },
    {
      env: { node: true },
      files: ["src/**/*.test.ts"],
      rules: {
        "import/no-nodejs-modules": "off",
        "unicorn/consistent-function-scoping": "off",
      },
    },
  ],
  plugins: ["typescript", "unicorn", "oxc", "eslint", "import", "react", "react-perf", "jsx-a11y"],
  rules: {
    // Multi-line `//` comments frequently start with lowercase continuation
    // lines; ignore consecutive comments so only the first line is checked.
    "eslint/capitalized-comments": ["warn", "always", { ignoreConsecutiveComments: true }],
    "eslint/no-duplicate-imports": ["warn", { allowSeparateTypeImports: true }],
    "eslint/no-ternary": "off",
    "eslint/one-var": "off",
    // Next.js wants default exports for pages, layouts and route files.
    "import/no-default-export": "off",
    "import/no-named-export": "off",
    "import/no-namespace": "off",
    "import/no-cycle": "error",
    "import/no-unassigned-import": ["warn", { allow: ["**/*.css", "server-only"] }],
    "import/prefer-default-export": "off",
    "sort-imports": ["warn", { ignoreDeclarationSort: true }],
    // The APIs and the UI use null for "no value" on purpose.
    "unicorn/no-null": "off",
    // Next.js names route files page.tsx, layout.tsx, not-found.tsx.
    "unicorn/filename-case": ["warn", { case: "kebabCase" }],
    // Style rules that conflict with this app's conventions: short lambdas,
    // single-line guards, function components as declarations, exports next
    // to their code, ordered-by-meaning keys, and JSX nesting. Off, so the
    // warnings that remain are worth reading.
    "eslint/curly": "off",
    "eslint/func-style": "off",
    "eslint/id-length": "off",
    "eslint/max-statements": "off",
    "eslint/no-magic-numbers": "off",
    "eslint/sort-keys": "off",
    "import/exports-last": "off",
    "import/group-exports": "off",
    "react/jsx-max-depth": "off",
    "react/react-in-jsx-scope": "off",
    "react-perf/jsx-no-new-function-as-prop": "off",
    "react-perf/jsx-no-new-object-as-prop": "off",
    "react-perf/jsx-no-new-array-as-prop": "off",
    // role="img" on an inline SVG, role="status" on a loading block and
    // role="search" on a form are the established patterns. The suggested
    // <img>, <output> and <search> elements do not fit those uses.
    "jsx-a11y/prefer-tag-over-role": "off",
  },
});
