import type { FastifyRequest, FastifyReply } from "fastify";

const EVENT_MIN_INTERVAL_MS = 60_000; // 1 event per minute
const MAX_EVENTS_PER_DAY = 50;

export async function eventRateLimit(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const runtime = request.runtime;
  if (!runtime) return;

  // Check 1/min rate limit
  if (runtime.lastEventAt) {
    const elapsed = Date.now() - new Date(runtime.lastEventAt).getTime();
    if (elapsed < EVENT_MIN_INTERVAL_MS) {
      return reply.code(429).send({
        error: "Rate limit exceeded. Max 1 event/min.",
        retryAfterMs: EVENT_MIN_INTERVAL_MS - elapsed,
      });
    }
  }

  // Check daily limit
  const today = new Date().toISOString().slice(0, 10);
  const eventsToday =
    runtime.eventsTodayDate === today ? (runtime.eventsToday ?? 0) : 0;

  if (eventsToday >= MAX_EVENTS_PER_DAY) {
    return reply.code(429).send({
      error: `Daily limit exceeded. Max ${MAX_EVENTS_PER_DAY} events/day.`,
    });
  }
}
