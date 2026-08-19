import assert from "node:assert";
import { generateKeyPairSync, createHash, sign } from "node:crypto";
import { verifySignature, flatten } from "./api/webhook.js";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const jwk = publicKey.export({ format: "jwk" });

const body = JSON.stringify({
  deliveryId: "whd_01",
  event: { type: "pull_request.merged", eventTime: "2026-08-20T00:00:00Z" },
});
const id = "whd_01";
const timestamp = String(Math.floor(Date.now() / 1000));
const digest = createHash("sha256")
  .update(`${id}.${timestamp}.`)
  .update(body)
  .digest("hex");
const signature =
  "v1ed," + sign(null, Buffer.from(digest), privateKey).toString("base64");

assert(verifySignature({ id, timestamp, signature }, body, [jwk]), "valid signature verifies");
assert(!verifySignature({ id, timestamp, signature }, body + "x", [jwk]), "tampered body rejected");
assert(!verifySignature({ id, timestamp: "0", signature }, body, [jwk]), "stale timestamp rejected");
assert(!verifySignature({ id, timestamp, signature: "v1ed,AAAA" }, body, [jwk]), "bad signature rejected");

// _time mapping: action timestamps win over eventTime; pushes fan out per ref
const merged = flatten({
  deliveryId: "whd_m", appId: "a", installationId: "i",
  event: {
    id: "evt_m", type: "pull_request.merged", eventTime: "2026-08-20T12:00:05Z",
    payload: { pullRequest: { mergedAt: "2026-08-20T12:00:00Z", createdAt: "2026-08-20T10:00:00Z" } },
  },
});
assert.equal(merged.length, 1);
assert.equal(merged[0]._time, "2026-08-20T12:00:00Z", "merged PR uses mergedAt");

const push = flatten({
  deliveryId: "whd_p", appId: "a", installationId: "i",
  event: {
    id: "evt_p", type: "repository.pushed", eventTime: "2026-08-20T12:00:05Z",
    payload: {
      pushedAt: "2026-08-20T12:00:04Z",
      repository: { name: "pilr" }, pusher: { user: { email: "seif@axiom.co" } },
      refUpdates: [
        { ref: "refs/heads/main", after: "abc", headCommit: { sha: "abc", committer: { date: "2026-08-20T11:55:00+03:00" } } },
        { ref: "refs/heads/dev", after: "def" }, // best-effort tip metadata may be absent
      ],
      refUpdatesCount: 2,
    },
  },
});
assert.equal(push.length, 3, "parent + one per refUpdate");
assert.equal(push[0]._time, "2026-08-20T12:00:04Z", "parent uses pushedAt");
assert.equal(push[1].type, "repository.pushed.ref");
assert.equal(push[1]._time, "2026-08-20T11:55:00+03:00", "ref record uses commit time");
assert.equal(push[2]._time, "2026-08-20T12:00:04Z", "missing headCommit falls back to pushedAt");
assert.equal(push[1].payload.repository.name, "pilr", "ref record keeps repo context");

console.log("ok");
