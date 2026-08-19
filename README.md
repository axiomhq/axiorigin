# axiorigin

Send [Cursor Origin](https://cursor.com/docs/api/origin) webhook events straight into [Axiom](https://axiom.co). One serverless function, zero dependencies. Deploy your own copy for free — your data never touches anyone else's infrastructure.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Faxiomhq%2Faxiorigin&env=AXIOM_TOKEN,AXIOM_DATASET&project-name=axiorigin&repository-name=axiorigin&envDescription=Axiom%20API%20token%20with%20ingest%20permission%20and%20the%20dataset%20name%20to%20send%20events%20to)

## Setup

1. In Axiom: create a dataset (e.g. `origin`) and an API token with ingest permission for it.
2. Click the deploy button above and set:
   - `AXIOM_TOKEN` — the Axiom API token
   - `AXIOM_DATASET` — the dataset name
   - `AXIOM_URL` — optional, defaults to `https://api.axiom.co` (set for EU region)
3. In [Origin app settings](https://cursor.com/codebase/settings/apps), set your app's webhook URL to:
   `https://<your-deployment>.vercel.app/api/webhook`
4. Subscribe to the events you want. They land in your dataset within seconds.

## What lands in Axiom

Each delivery is verified (Ed25519 signature against Origin's JWKS, 5-minute timestamp window) and flattened to:

```json
{
  "_time": "<event.eventTime>",
  "type": "pull_request.merged",
  "eventId": "evt_01...",
  "deliveryId": "whd_01...",
  "appId": "app_01...",
  "installationId": "i_01...",
  "payload": { ... }
}
```

Failed Axiom ingests return 5xx so Origin redelivers (up to 6 retries). Deliveries are at-least-once — dedup on `deliveryId` in queries if exactness matters.

## Starter queries (APL)

PR cycle time (created → merged):

```apl
['origin']
| where type in ('pull_request.created', 'pull_request.merged')
| summarize created = minif(_time, type == 'pull_request.created'),
            merged  = minif(_time, type == 'pull_request.merged')
            by pr = tostring(payload.pullRequest.id)
| where isnotnull(merged)
| summarize avg(merged - created) by bin_auto(merged)
```

Check-run pass rate:

```apl
['origin']
| where type == 'repository.check_run.completed'
| summarize passRate = countif(tostring(payload.checkRun.conclusion) == 'success') * 100.0 / count()
            by check = tostring(payload.checkRun.name), bin_auto(_time)
```

## Test

```sh
npm test
```
