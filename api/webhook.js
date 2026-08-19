import { createHash, createPublicKey, verify } from "node:crypto";

const JWKS_URL = "https://api.cursor.com/v1/origin/keys";
const TOLERANCE_SECONDS = 5 * 60;

let jwksCache = null;

async function getJwks() {
  if (jwksCache && Date.now() - jwksCache.fetchedAt < 5 * 60 * 1000) {
    return jwksCache.keys;
  }
  const res = await fetch(JWKS_URL);
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
  const { keys } = await res.json();
  jwksCache = { keys, fetchedAt: Date.now() };
  return keys;
}

export function verifySignature({ id, timestamp, signature }, body, keys) {
  if (!id || !timestamp || !signature) return false;
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!(age <= TOLERANCE_SECONDS)) return false;

  const digest = createHash("sha256")
    .update(`${id}.${timestamp}.`)
    .update(body)
    .digest("hex");

  const candidates = signature.split(" ").filter((s) => s.startsWith("v1ed,"));
  for (const candidate of candidates) {
    const sig = Buffer.from(candidate.slice(5), "base64");
    for (const jwk of keys) {
      try {
        const key = createPublicKey({ key: jwk, format: "jwk" });
        if (verify(null, Buffer.from(digest), key, sig)) return true;
      } catch {
        // skip malformed keys
      }
    }
  }
  return false;
}

// _time = when the thing happened, not when Origin told us about it
const ACTION_TIME = {
  "repository.pushed": (p) => p.pushedAt,
  "pull_request.created": (p) => p.pullRequest?.createdAt,
  "pull_request.merged": (p) => p.pullRequest?.mergedAt,
  "pull_request.closed": (p) => p.pullRequest?.closedAt,
  "pull_request.comment.created": (p) => p.comment?.createdAt,
};

export function flatten({ deliveryId, appId, installationId, event }) {
  const base = { type: event.type, eventId: event.id, deliveryId, appId, installationId };
  const actionTime = ACTION_TIME[event.type]?.(event.payload);
  const records = [
    { ...base, _time: actionTime || event.eventTime, payload: event.payload },
  ];
  if (event.type === "repository.pushed") {
    // fan out one record per ref update so commit timestamps become _time
    for (const ru of event.payload.refUpdates ?? []) {
      records.push({
        ...base,
        type: "repository.pushed.ref",
        _time: ru.headCommit?.committer?.date || actionTime || event.eventTime,
        payload: {
          repository: event.payload.repository,
          pusher: event.payload.pusher,
          ...ru,
        },
      });
    }
  }
  return records;
}

export async function POST(request) {
  const body = await request.text();
  const headers = {
    id: request.headers.get("webhook-id"),
    timestamp: request.headers.get("webhook-timestamp"),
    signature: request.headers.get("webhook-signature"),
  };

  const keys = await getJwks();
  if (!verifySignature(headers, body, keys)) {
    return new Response("invalid signature", { status: 401 });
  }

  const records = flatten(JSON.parse(body));

  const axiomUrl = process.env.AXIOM_URL || "https://api.axiom.co";
  const res = await fetch(
    `${axiomUrl}/v1/datasets/${process.env.AXIOM_DATASET}/ingest`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.AXIOM_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(records),
    }
  );
  // 5xx makes Origin retry the delivery; webhook-id dedup keeps it safe
  if (!res.ok) return new Response("axiom ingest failed", { status: 502 });
  return new Response("ok");
}
