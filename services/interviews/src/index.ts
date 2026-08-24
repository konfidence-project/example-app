import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { getVectorId } from "./vectorid.js";
import { initOpenFeature, isEnabled } from "./openfeature.js";
import { insertInterview, listInterviews } from "./db.js";
import { candidateExists, fetchCandidate } from "./candidatesClient.js";

const PORT = Number(process.env.LISTEN_PORT ?? 8080);
const DEFAULT_SLOT_TYPES = new Set(["onsite", "phone"]);

interface CreateInterviewBody {
  candidateId?: string;
  slotTime?: string;
  slotType?: string;
}

async function main() {
  await initOpenFeature();

  const app = Fastify({ logger: true });

  // Log every incoming request with the vector-id it carries (skip health probes).
  app.addHook("onRequest", async (req) => {
    if (req.url === "/healthz") return;
    req.log.info({ method: req.method, url: req.url, vectorId: getVectorId(req) }, "incoming request");
  });

  app.get("/healthz", { logLevel: "silent" }, async () => ({ status: "ok" }));

  app.post("/interviews", async (req: FastifyRequest<{ Body: CreateInterviewBody }>, reply: FastifyReply) => {
    const { candidateId, slotTime, slotType } = req.body ?? {};
    if (!candidateId || !slotTime || !slotType) {
      return reply.code(400).send({ error: "candidateId, slotTime and slotType are required" });
    }

    const vectorId = getVectorId(req);
    const allowed = new Set(DEFAULT_SLOT_TYPES);
    if (await isEnabled(vectorId, "allow-video-slots", false)) {
      allowed.add("video");
    }
    if (!allowed.has(slotType)) {
      return reply.code(400).send({ error: `slot type ${slotType} is not enabled for this vector` });
    }

    req.log.info({ vectorId, candidateId }, "verifying candidate via service-to-service call");
    let exists = false;
    try {
      exists = await candidateExists(candidateId, vectorId);
    } catch (err) {
      req.log.error(err, "candidates lookup failed");
      return reply.code(502).send({ error: "candidates service unavailable" });
    }
    if (!exists) {
      return reply.code(400).send({ error: "candidate not found" });
    }

    const id = await insertInterview(candidateId, slotTime, slotType);
    return reply.code(201).send({ id, candidateId, slotTime, slotType });
  });

  // Service-to-service GET: resolves candidates from the vector's deployment results and fetches the candidate.
  app.get("/candidates/:id", async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const vectorId = getVectorId(req);
    const { id } = req.params;
    req.log.info({ vectorId, candidateId: id }, "fetching candidate via service-to-service call");
    try {
      const candidate = await fetchCandidate(id, vectorId);
      if (!candidate) return reply.code(404).send({ error: "candidate not found" });
      return candidate;
    } catch (err) {
      req.log.error(err, "candidates lookup failed");
      return reply.code(502).send({ error: "candidates service unavailable" });
    }
  });

  // List interviews, enriching each with its candidate fetched on the fly (service-to-service).
  app.get("/interviews", async (req: FastifyRequest) => {
    const vectorId = getVectorId(req);
    const interviews = await listInterviews();
    return Promise.all(
      interviews.map(async (iv) => {
        try {
          const candidate = await fetchCandidate(iv.candidate_id, vectorId);
          return { ...iv, candidate };
        } catch (err) {
          req.log.warn(err, "candidate enrichment failed");
          return { ...iv, candidate: null };
        }
      }),
    );
  });

  await app.listen({ port: PORT, host: "0.0.0.0" });
}

process.on("unhandledRejection", (reason) => console.error("unhandledRejection:", reason));
process.on("uncaughtException", (err) => console.error("uncaughtException:", err));

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
