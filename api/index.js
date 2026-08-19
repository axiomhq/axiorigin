const row = (ok, label, detail) => `
  <li>
    <span class="dot ${ok ? "ok" : "bad"}" aria-hidden="true"></span>
    <div>
      <strong>${label}</strong>
      <span class="detail">${detail}</span>
    </div>
  </li>`;

export async function GET(request) {
  const dataset = process.env.AXIOM_DATASET;
  const token = process.env.AXIOM_TOKEN;
  const axiomUrl = process.env.AXIOM_URL || "https://api.axiom.co";

  let axiomOk = false;
  let ingestDetail = "Set the token and dataset first.";
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
      ingestDetail = res.ok
        ? "A test call just succeeded — events will be accepted."
        : `Axiom responded ${res.status}. Give the token ingest permission for “${dataset}”, then reload.`;
    } catch {
      ingestDetail = "Could not reach Axiom. Check AXIOM_URL if you overrode it.";
    }
  }

  const host = new URL(request.url).host;
  const webhookUrl = `https://${host}/api/webhook`;
  const allOk = !!token && !!dataset && axiomOk;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>cursor-origin-axiom</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root {
    --bg: #0b0c0e; --surface: #121316; --surface-2: #0e0f12;
    --border: #24262c; --text: #e8eaee; --muted: #8b909c;
    --accent: #6c9bfa; --ok: #34d399; --bad: #f87171;
    --mono: ui-monospace, "SF Mono", SFMono-Regular, Menlo, monospace;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--text);
    font: 15px/1.6 Inter, system-ui, -apple-system, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  main { max-width: 620px; margin: 0 auto; padding: 4.5rem 1.25rem 3rem; }
  .eyebrow { font: 12px/1 var(--mono); color: var(--muted); letter-spacing: .02em; margin: 0 0 1.25rem; }
  h1 { font-size: 26px; font-weight: 600; letter-spacing: -.02em; margin: 0 0 .5rem; }
  h1 .arrow { color: var(--accent); font-weight: 400; }
  .lede { color: var(--muted); margin: 0 0 2rem; }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }

  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
  .pipe {
    display: flex; align-items: center; gap: .75rem;
    padding: .9rem 1.1rem; border-bottom: 1px solid var(--border);
    font: 12px/1 var(--mono); color: var(--muted); background: var(--surface-2);
    white-space: nowrap; overflow-x: auto;
  }
  .pipe .line { flex: 1; min-width: 1.5rem; height: 1px; background: linear-gradient(90deg, var(--border), #3a3d46); }
  .pipe .live { color: ${allOk ? "var(--ok)" : "var(--bad)"}; }
  .checks { list-style: none; margin: 0; padding: 0; }
  .checks li { display: flex; gap: .8rem; align-items: baseline; padding: .85rem 1.1rem; }
  .checks li + li { border-top: 1px solid var(--border); }
  .checks strong { display: block; font-weight: 500; font-size: 14px; }
  .detail { font-size: 13px; color: var(--muted); }
  .dot { flex: none; width: 8px; height: 8px; border-radius: 50%; position: relative; top: -1px; }
  .dot.ok  { background: var(--ok);  box-shadow: 0 0 0 3px rgba(52, 211, 153, .14); }
  .dot.bad { background: var(--bad); box-shadow: 0 0 0 3px rgba(248, 113, 113, .14); }

  h2 { font-size: 15px; font-weight: 600; margin: 2.5rem 0 1rem; }
  .steps { list-style: none; counter-reset: step; margin: 0; padding: 0; }
  .steps > li { counter-increment: step; position: relative; padding: 0 0 1.4rem 2.2rem; }
  .steps > li::before {
    content: counter(step, decimal-leading-zero);
    position: absolute; left: 0; top: .2em;
    font: 12px/1 var(--mono); color: var(--muted);
  }
  .steps p { margin: 0 0 .6rem; }
  .urlbox {
    display: flex; align-items: center; gap: .5rem;
    background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px;
    padding: .55rem .55rem .55rem .9rem;
  }
  .urlbox code { flex: 1; font: 13px/1.4 var(--mono); color: var(--text); word-break: break-all; }
  .urlbox button {
    flex: none; font: 12px/1 var(--mono); color: var(--text);
    background: var(--surface); border: 1px solid var(--border); border-radius: 6px;
    padding: .45rem .7rem; cursor: pointer;
  }
  .urlbox button:hover { border-color: #3a3d46; }
  .urlbox button:focus-visible, a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .chips { display: flex; flex-wrap: wrap; gap: .4rem; }
  .chips code {
    font: 12px/1 var(--mono); color: var(--text);
    background: var(--surface-2); border: 1px solid var(--border); border-radius: 6px;
    padding: .35rem .55rem;
  }
  footer { margin-top: 2.5rem; padding-top: 1.25rem; border-top: 1px solid var(--border);
    font-size: 13px; color: var(--muted); display: flex; gap: 1.25rem; }
</style>
</head>
<body>
<main>
  <p class="eyebrow">axiomhq / cursor-origin-axiom</p>
  <h1>Cursor Origin <span class="arrow">&rarr;</span> Axiom</h1>
  <p class="lede">Every webhook event from your Cursor Origin app, streamed into an Axiom dataset you can query, chart, and alert on.</p>

  <section class="card" aria-label="Pipeline status">
    <div class="pipe">
      <span>cursor origin</span><span class="line"></span><span class="live">${host}</span><span class="line"></span><span>${dataset || "no dataset"}</span>
    </div>
    <ul class="checks">
      ${row(!!token, "Axiom token", token ? "AXIOM_TOKEN is set." : "Create an API token with ingest permission in Axiom settings, add it as AXIOM_TOKEN in Vercel, and redeploy.")}
      ${row(!!dataset, "Dataset", dataset ? `Events write to “${dataset}”.` : "Add AXIOM_DATASET in Vercel and redeploy.")}
      ${row(axiomOk, "Axiom accepts events", ingestDetail)}
    </ul>
  </section>

  <h2>Connect your Origin app</h2>
  <ol class="steps">
    <li>
      <p>In your <a href="https://cursor.com/codebase/settings/apps">Origin app settings</a>, set the webhook URL:</p>
      <div class="urlbox"><code id="whurl">${webhookUrl}</code><button id="copy" type="button">Copy</button></div>
    </li>
    <li>
      <p>Subscribe to the events you want:</p>
      <div class="chips"><code>pull_request.*</code><code>repository.pushed</code><code>repository.check_run.*</code></div>
    </li>
    <li>
      <p>Install the app on your repos. Events land within seconds — <a href="https://app.axiom.co">query them in Axiom</a>.</p>
    </li>
  </ol>

  <footer>
    <a href="https://github.com/axiomhq/cursor-origin-axiom">GitHub</a>
    <a href="https://github.com/axiomhq/cursor-origin-axiom#setup">Deploy your own</a>
    <a href="https://cursor.com/docs/api/origin">Origin docs</a>
  </footer>
</main>
<script>
  document.getElementById("copy").addEventListener("click", async (e) => {
    await navigator.clipboard.writeText(document.getElementById("whurl").textContent);
    e.target.textContent = "Copied";
    setTimeout(() => (e.target.textContent = "Copy"), 1500);
  });
</script>
</body>
</html>`;

  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
