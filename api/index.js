const check = (ok, label, hint) =>
  `<li class="${ok ? "ok" : "bad"}">${ok ? "✅" : "❌"} ${label}${
    ok || !hint ? "" : ` — <span class="hint">${hint}</span>`
  }</li>`;

export async function GET(request) {
  const dataset = process.env.AXIOM_DATASET;
  const token = process.env.AXIOM_TOKEN;
  const axiomUrl = process.env.AXIOM_URL || "https://api.axiom.co";

  let axiomOk = false;
  let axiomHint = "set AXIOM_TOKEN and AXIOM_DATASET first";
  if (token && dataset) {
    try {
      // empty batch: verifies token + dataset ingest permission, writes nothing
      const res = await fetch(`${axiomUrl}/v1/datasets/${dataset}/ingest`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: "[]",
      });
      axiomOk = res.ok;
      if (!res.ok) axiomHint = `Axiom said ${res.status}: check the token has ingest permission for '${dataset}'`;
    } catch {
      axiomHint = "could not reach Axiom";
    }
  }

  const webhookUrl = `https://${new URL(request.url).host}/api/webhook`;
  const html = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>axiorigin setup</title>
<style>
  body { font: 16px/1.6 system-ui, sans-serif; max-width: 640px; margin: 3rem auto; padding: 0 1rem; color: #1a1a1a; background: #fff; }
  @media (prefers-color-scheme: dark) { body { color: #e6e6e6; background: #111; } code, .url { background: #222; } }
  h1 { font-size: 1.5rem; }
  ul { list-style: none; padding: 0; }
  li { margin: .5rem 0; }
  .hint { opacity: .75; }
  code, .url { background: #f0f0f0; padding: .15em .4em; border-radius: 4px; }
  .url { display: block; padding: .75em 1em; margin: .5rem 0; font-family: monospace; word-break: break-all; }
  a { color: inherit; }
</style>
<h1>axiorigin — Cursor Origin → Axiom</h1>
<p>This instance forwards <a href="https://cursor.com/docs/api/origin">Cursor Origin</a> webhook events into your <a href="https://axiom.co">Axiom</a> dataset.</p>
<h2>Status</h2>
<ul>
  ${check(!!token, "<code>AXIOM_TOKEN</code> is set", 'create an API token with ingest permission in <a href="https://app.axiom.co/settings/api-tokens">Axiom settings</a>, then add it in your Vercel project settings and redeploy')}
  ${check(!!dataset, `<code>AXIOM_DATASET</code> is set${dataset ? ` (<code>${dataset}</code>)` : ""}`, "add it in your Vercel project settings and redeploy")}
  ${check(axiomOk, "Axiom accepts events from this instance", axiomHint)}
</ul>
<h2>Hook up Cursor Origin</h2>
<p>In your <a href="https://cursor.com/codebase/settings/apps">Origin app settings</a>, set the webhook URL to:</p>
<span class="url">${webhookUrl}</span>
<p>Subscribe to the events you want (e.g. all <code>pull_request.*</code>, <code>repository.pushed</code>, <code>repository.check_run.*</code>), install the app on your repos, and events land in your dataset within seconds.</p>
<p><a href="https://github.com/axiomhq/axiorigin">Source on GitHub</a></p>`;

  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
