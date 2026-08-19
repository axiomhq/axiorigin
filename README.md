# cursor-origin-axiom

Send [Cursor Origin](https://cursor.com/docs/api/origin) webhook events straight into [Axiom](https://axiom.co). One serverless function, zero dependencies. Deploy your own copy for free — your data never touches anyone else's infrastructure.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Faxiomhq%2Fcursor-origin-axiom&env=AXIOM_TOKEN,AXIOM_DATASET&project-name=cursor-origin-axiom&repository-name=cursor-origin-axiom&envDescription=Axiom%20API%20token%20with%20ingest%20permission%20and%20the%20dataset%20name%20to%20send%20events%20to)

## Setup

1. In Axiom: create a dataset (e.g. `origin`) and an API token with ingest permission for it.
2. Click the deploy button above and set:
   - `AXIOM_TOKEN` — the Axiom API token
   - `AXIOM_DATASET` — the dataset name
   - `AXIOM_URL` — optional, defaults to `https://api.axiom.co` (set for EU region)
3. Open `https://<your-deployment>.vercel.app` — the setup page checks your config live and shows your webhook URL.
4. In [Origin app settings](https://cursor.com/codebase/settings/apps), set your app's webhook URL to:
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

Field paths below are verified against real Origin events. `pull_request.merged` events carry both `createdAt` and `mergedAt`, so cycle time needs no joins:

```apl
['origin']
| where type == 'pull_request.merged'
| extend cycle_min = datetime_diff('minute',
    todatetime(['payload.pullRequest.mergedAt']),
    todatetime(['payload.pullRequest.createdAt']))
| summarize avg(cycle_min) by bin_auto(_time)
```

Push activity by author:

```apl
['origin']
| where type == 'repository.pushed'
| summarize count() by author = tostring(['payload.pusher.user.email']), bin_auto(_time)
```

## Test

```sh
npm test
```
