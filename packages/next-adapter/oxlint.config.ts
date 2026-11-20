import { defineConfig } from "oxlint";

// Follows apps/konfidence-ui/oxlint.config.ts of the Konfidence repository,
// without its Svelte parts.
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
    node: true,
  },
  ignorePatterns: ["dist/**"],
  overrides: [
    {
      files: ["src/**/*.test.ts"],
      rules: {
        "unicorn/consistent-function-scoping": "off",
        "unicorn/no-null": "off",
      },
    },
  ],
  plugins: ["typescript", "unicorn", "oxc", "eslint", "import"],
  rules: {
    // Multi-line `//` comments frequently start with lowercase continuation
    // lines; ignore consecutive comments so only the first line is checked.
    "eslint/capitalized-comments": ["warn", "always", { ignoreConsecutiveComments: true }],
    "eslint/no-duplicate-imports": ["warn", { allowSeparateTypeImports: true }],
    "eslint/no-ternary": "off",
    "eslint/one-var": "off",
    "import/no-named-export": "off",
    "import/no-namespace": "off",
    "import/prefer-default-export": "off",
    // A Node.js CLI and server helpers: the built-in modules are the point.
    "import/no-nodejs-modules": "off",
    "sort-imports": ["warn", { ignoreDeclarationSort: true }],
    // The JSON documents this package reads and writes use null on purpose.
    "unicorn/no-null": "off",
    // Style rules the dashboard warns on that conflict with this package's
    // conventions: short lambdas (`(a, b) =>`), single-line guards without
    // braces, function declarations next to arrow helpers, exports next to
    // their code, ordered-by-meaning object keys, and createElement trees.
    // Off, so the warnings that remain are worth reading.
    "eslint/curly": "off",
    "eslint/func-style": "off",
    "eslint/id-length": "off",
    "eslint/max-statements": "off",
    "eslint/no-magic-numbers": "off",
    "eslint/sort-keys": "off",
    "import/exports-last": "off",
    "import/group-exports": "off",
    "unicorn/max-nested-calls": "off",
  },
});
