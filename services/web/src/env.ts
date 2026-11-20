import { defineEnvVars } from "@sveltejs/kit/env";

export const variables = defineEnvVars({
  VECTOR_CONFIG_URL: {
    description: "OFREP base URL of the platform's vector-data-service",
    schema: (value) => value || "http://vector-data-service",
  },
});
