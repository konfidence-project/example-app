// Lint rules. The import zones follow bulletproof-react: features never
// import each other, shared code never imports features or routes, and
// routes in src/app compose everything.
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const FEATURES = ["people", "schedule"];

const config = [
  ...nextVitals,
  ...nextTypescript,
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts"],
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            // No imports across features, e.g. schedule may not import people.
            ...FEATURES.map((feature) => ({
              target: `./src/features/${feature}`,
              from: "./src/features",
              except: [`./${feature}`],
            })),
            // Features never import routes.
            { target: "./src/features", from: "./src/app" },
            // Shared code imports neither features nor routes.
            {
              target: [
                "./src/components",
                "./src/config",
                "./src/lib",
                "./src/types",
                "./src/utils",
              ],
              from: ["./src/features", "./src/app"],
            },
          ],
        },
      ],
      "import/no-cycle": "error",
    },
  },
];

export default config;
