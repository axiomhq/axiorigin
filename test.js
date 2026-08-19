import assert from "node:assert";
import { generateKeyPairSync, createHash, sign } from "node:crypto";
import { verifySignature } from "./api/webhook.js";

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

console.log("ok");
