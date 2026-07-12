# Cloudflare Pages deployment for Overnight Newsroom

## Quick deploy

### 1. Deploy Convex (production backend)

```bash
npx convex deploy
```

Copy the production Convex URL from the output (e.g. `https://happy-animal-123.convex.cloud`).

### 2. Deploy the public site to Cloudflare Pages

```bash
# Build the static site
npm run web:build
```

Then in the Cloudflare Dashboard:

- **Project name**: `overnight-newsroom`
- **Build command**: `npm run web:build`
- **Build output directory**: `apps/public-site/dist`
- **Environment variable**: `VITE_CONVEX_URL` = `<production Convex URL from step 1>`

Or deploy via Wrangler:

```bash
npx wrangler pages deploy apps/public-site/dist \
  --project-name overnight-newsroom \
  --branch main
```

### 3. Verify the deployment

```bash
# Open the public URL
curl -sS "https://overnight-newsroom.pages.dev" | head -5
```

## R2 media placeholder

### Create an R2 bucket

```bash
npx wrangler r2 bucket create overnight-newsroom-media
```

### Upload a placeholder receipt

```bash
echo "{\"edition\":\"placeholder\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > receipt.json
npx wrangler r2 object put overnight-newsroom-media/receipts/placeholder.json --file receipt.json
```

### Store the R2 URL in Convex

After creating the bucket, store the public URL via the `addPublicationReceipt` mutation:

```bash
# Using the Convex dashboard or a mutation call:
# mutation: public.addPublicationReceipt
# args: {
#   secret: "<INGESTION_API_SECRET>",
#   editionKey: "<edition-key>",
#   receiptType: "media",
#   receiptUrl: "https://<your-r2-public-url>/receipts/placeholder.json",
#   status: "published"
# }
```

## Environment variables checklist

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_CONVEX_URL` | Cloudflare Pages env | Production Convex URL |
| `CONVEX_DEPLOYMENT` | `.env.local` (dev) | Local Convex deployment key |
| `INGESTION_API_SECRET` | Convex env vars | Shared secret for mutations |
| `HERMES_BASE_URL` | `services/ingestion/.env` | Hermes LLM endpoint |
| `HERMES_API_KEY` | `services/ingestion/.env` | Hermes API key |

## Build verification

```bash
# From repo root
npm install
npm run web:build     # should produce apps/public-site/dist/
npm test               # should pass
```
