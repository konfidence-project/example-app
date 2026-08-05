import { OpenFeature } from "@openfeature/server-sdk";
import { OFREPProvider } from "@openfeature/ofrep-provider";

const OFREP_URL = process.env.VECTOR_CONFIG_URL ?? "http://vector-data-service";

// Vector data is immutable per vector-id, so caching per (vector-id, flag) is safe.
const cache = new Map<string, boolean>();

export async function initOpenFeature(): Promise<void> {
  await OpenFeature.setProviderAndWait(new OFREPProvider({ baseUrl: OFREP_URL }));
  console.log(`openfeature: OFREP provider ready at ${OFREP_URL}`);
}

export async function isEnabled(
  vectorId: string,
  flag: string,
  defaultValue: boolean,
): Promise<boolean> {
  if (!vectorId) return defaultValue;
  const key = `${vectorId}::${flag}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  const value = await OpenFeature.getClient("interviews").getBooleanValue(flag, defaultValue, {
    targetingKey: vectorId,
  });
  cache.set(key, value);
  return value;
}
