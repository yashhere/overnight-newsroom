# Cloudflare Pages deployment for Overnight Newsroom

## Quick deploy

### 1. Deploy Convex (production backend)

```bash
npx convex deploy
```

Copy the production Convex URL from the output (e.g. `https://happy-animal-123.convex.cloud`).

### 2. Set VITE_CONVEX_URL and deploy to Cloudflare Pages

**Important**: `VITE_CONVEX_URL` is a **build-time** environment variable.
Vite inlines all `VITE_*` variables into the static bundle during `npm run web:build`.
It is NOT a runtime variable — changing it after deployment does nothing
until you rebuild.

**Option A: Cloudflare Dashboard (recommended)**

1. Go to Cloudflare Dashboard → Workers & Pages → `overnight-newsroom`
2. Settings → Environment variables → **Production** (or Preview)
3. Add variable:
   - Name: `VITE_CONVEX_URL`
   - Value: `<production Convex URL from step 1>`
4. Trigger a new deployment: Deployments → Retry/Deploy

The build command (`npm run web:build`) runs during the Cloudflare build step
and picks up the env var automatically.

**Option B: Wrangler CLI**

```bash
# Build with the VITE_CONVEX_URL set at build time
VITE_CONVEX_URL="https://your-project.convex.cloud" npm run web:build

# Deploy the built assets
npx wrangler pages deploy apps/public-site/dist \
  --project-name overnight-newsroom \
  --branch main
```

**Option C: GitHub Integration (auto-deploy)**

1. Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git
2. Select `yashhere/overnight-newsroom`
3. Build settings:
   - **Build command**: `npm run web:build`
   - **Build output directory**: `apps/public-site/dist`
4. Add environment variable: `VITE_CONVEX_URL` = `<production Convex URL>`
5. Every push auto-deploys with the env var injected at build time.

### 3. Verify the deployment

```bash
curl -sS "https://main.overnight-newsroom-5mu.pages.dev" | head -5
```

The page loads but shows "No edition published yet" until you seed data.

## Environment variables

| Variable | Scope | Set in | Built into bundle? |
|---|---|---|---|
| `VITE_CONVEX_URL` | public | Cloudflare Pages build env | **Yes** — at build time by Vite |
| `CONVEX_DEPLOYMENT` | dev only | `.env.local` | No |
| `INGESTION_API_SECRET` | server | Convex dashboard → Environment Variables | No |
| `HERMES_BASE_URL` | server | `services/ingestion/.env` | No |
| `HERMES_API_KEY` | server | `services/ingestion/.env` | No |

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

## Build verification

```bash
# From repo root — builds and runs codegen automatically
npm install
npm run web:build     # produces apps/public-site/dist/
npm test               # 11/11 pass
```
