import { OpenFeature } from "@openfeature/server-sdk";
import { OFREPProvider } from "@openfeature/ofrep-provider";
import { VECTOR_CONFIG_URL } from "$app/env/private";

// A Service exposed as a deployment result, keyed by its stable konfidence.cloud/deployment-result name.
interface DeploymentResult {
  name: string;
  type: string;
  spec: {
    Namespace: string;
    K8sName: string;
    ServicePorts: { name?: string; port: number }[];
  };
}

let ready: Promise<void> | undefined;

// Set lazily so `vite build`, which imports server modules, never dials OFREP.
function init(): Promise<void> {
  ready ??= OpenFeature.setProviderAndWait(new OFREPProvider({ baseUrl: VECTOR_CONFIG_URL })).then(() =>
    console.log(`openfeature: OFREP provider ready at ${VECTOR_CONFIG_URL}`),
  );
  return ready;
}

// Vector data is immutable per routing key, so resolved authorities can live for the whole process.
const hostCache = new Map<string, string>();

// resolveServiceHost returns the cluster authority (host:port) of the deployment result with the given stable name.
// Evaluating the routing key as a flag key returns the whole vector config, including its deployment results.
export async function resolveServiceHost(routingKey: string, resultName: string): Promise<string> {
  if (!routingKey) throw new Error(`cannot resolve ${resultName}: request has no routing key`);

  const key = `${routingKey}::${resultName}`;
  const cached = hostCache.get(key);
  if (cached !== undefined) return cached;

  await init();
  console.log(`[discovery] resolving result=${resultName} for routingKey=${routingKey}`);
  const config = await OpenFeature.getClient("web").getObjectValue(routingKey, {}, { targetingKey: routingKey });
  const { deploymentResults = {} } = config as unknown as { deploymentResults?: Record<string, DeploymentResult[]> };

  const match = Object.values(deploymentResults)
    .flat()
    .find((r) => r.name === resultName);
  if (!match) throw new Error(`vector ${routingKey} exposes no deployment result named ${resultName}`);

  const { Namespace, K8sName, ServicePorts } = match.spec;
  if (ServicePorts.length === 0) throw new Error(`deployment result ${resultName} exposes no port`);

  const authority = `${K8sName}.${Namespace}.svc.cluster.local:${ServicePorts[0].port}`;
  console.log(`[discovery] resolved result=${resultName} routingKey=${routingKey} -> ${authority}`);
  hostCache.set(key, authority);
  return authority;
}

export function cachedAuthority(routingKey: string, resultName: string): string | null {
  return hostCache.get(`${routingKey}::${resultName}`) ?? null;
}
