import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { getVectorId } from "./vectorid.js";
import { initOpenFeature, isEnabled } from "./openfeature.js";
import { insertInterview, listInterviews } from "./db.js";
import { candidateExists } from "./candidatesClient.js";

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

  app.get("/healthz", async () => ({ status: "ok" }));

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

  app.get("/interviews", async () => listInterviews());

  await app.listen({ port: PORT, host: "0.0.0.0" });
}

process.on("unhandledRejection", (reason) => console.error("unhandledRejection:", reason));
process.on("uncaughtException", (err) => console.error("uncaughtException:", err));

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
