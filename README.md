# TOKEN RADAR — GitHub Root + Supabase

A static GitHub Pages frontend with a Supabase Edge Function backend. Designed for Robinhood Chain mainnet (chain ID 4663), with Pons V1 factory checks and optional market-data fallbacks.

## What's included

- `index.html`, `styles.css`, `app.js`, `config.js`: static frontend, all in the repository root.
- `supabase/functions/token-scan/index.ts`: Edge Function that reads ERC-20 metadata from Robinhood Chain, checks Pons V1 factory state, reads optional token getters, checks Blockscout, tries DexScreener, and builds an explainable heuristic score.
- `supabase-schema.sql`: scan history, private rate-limit table, and optional outcome tracking schema.
- `supabase/config.toml`: Edge Function configuration.

## Important limitations (read before launch)

1. **This is an initial working integration, not an audited trading system.** Public RPCs, Blockscout, DexScreener and price providers can fail, rate-limit, or return incomplete/stale data.
2. **Market data must be chain-confirmed.** The code marks DexScreener data as unconfirmed if its returned pair does not identify Robinhood Chain. Do not use unconfirmed USD liquidity/volume as a buy signal.
3. Pons V1 detection reads the documented active and legacy V1 factories. V2/V3 generations can have different factory/pool architecture; the scanner does not falsely claim full V2/V3 support where an ABI path is not verified. Add those adapters only after testing the current deployed contracts and event ABIs.
4. The score is a transparent rules-based heuristic, **not** a 70–80% success probability and not a 10x/50x guarantee.
5. This scanner does not perform a full honeypot simulation or security audit. Generic owner getters do not prove that mint, blacklist, proxy, or transfer-tax controls exist or do not exist.
6. The public IP-based rate limit is a basic abuse-control layer, not strong identity. For a paid service, add Supabase Auth, payment verification, per-user quotas, CAPTCHA/anti-bot controls, and server-side entitlement checks before charging customers.
7. Never put `SUPABASE_SERVICE_ROLE_KEY` in `config.js` or any GitHub-hosted frontend file.

## Step 1 — Run SQL in Supabase

1. Open Supabase Dashboard → SQL Editor → New query.
2. Paste all of `supabase-schema.sql`.
3. Run it and confirm there are no errors.

The schema enables RLS and denies browser roles access to scan history and rate-limit data. Only the Edge Function service role can write scan history.

## Step 2 — Configure Edge Function secrets

In Supabase Dashboard → Edge Functions → Secrets, add:

- `SUPABASE_URL` = `https://YOUR_PROJECT_REF.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` = the **secret/service_role** key from Project Settings → API Keys. Keep it secret.
- `RH_RPC_URL` = `https://rpc.mainnet.chain.robinhood.com` (optional; this is the default public RPC)

Use the current Supabase API key UI and keep the service-role/secret key server-side only.

## Step 3 — Deploy the Edge Function

### Option A: Supabase Dashboard editor
Create an Edge Function named `token-scan`. Copy the contents of `supabase/functions/token-scan/index.ts` into its `index.ts` editor and deploy. If the Dashboard editor doesn't accept the `npm:viem@2.21.0` import, use the CLI option below.

### Option B: Supabase CLI (recommended for repeatable deploys)
Install the Supabase CLI, then from this repository root:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy token-scan --use-api
```

The `supabase/config.toml` project_id can be replaced with your actual project ref. The CLI deployment does not require GitHub Actions and does not require Render.

## Step 4 — Configure the frontend

Open `config.js` and replace only these placeholders:

```js
window.TOKEN_RADAR_CONFIG = {
  SUPABASE_URL: "https://YOUR_PROJECT_REF.supabase.co",
  SUPABASE_ANON_KEY: "YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY",
  SCAN_FUNCTION: "token-scan"
};
```

Use the Supabase publishable key (or legacy anon key). It is expected to be public in a static frontend. Never use a service-role key here.

## Step 5 — Upload to GitHub main root

Upload these files/folders into the **repository root** (not a subfolder):

```text
index.html
styles.css
app.js
config.js
README.md
supabase-schema.sql
.nojekyll
supabase/
  config.toml
  functions/
    token-scan/
      index.ts
```

Enable GitHub Pages → Deploy from a branch → `main` → `/ (root)`. Wait for the Pages URL to publish, then open it and scan a known contract.

## Step 6 — Test

1. Scan the documented PONS reference token:
   `0x39dBED3a2bd333467115dE45665cC57F813C4571`
2. Confirm name/symbol/supply are read from RPC.
3. Confirm the Edge Function response has `sourceStatus.rpc=true`.
4. Check Supabase → Edge Functions → Logs if the page reports a server error.
5. Check `token_scans` after a successful request if `persisted: true`.
6. Test a random address without bytecode; it should return a clear 404 message, not a fake token result.

## Data and scoring notes

- The token's address is the identifier; names/symbols can be copied.
- Price, liquidity, and volume are separate from contract metadata and can be missing.
- DexScreener data is selected for Robinhood Chain when it returns a chain-matching pair; if only a non-matching pair is returned, it is marked unconfirmed.
- The Pons V1 `liquidityPool()` spot quote uses the pool's `slot0`. Concentrated-liquidity raw units are not mislabeled as USD liquidity.
- A missing risk check is shown as unknown. It is not treated as safe.
- High score means more checks/data passed, not "buy", "safe", or predicted profit.

## Sources used for the integration

- Robinhood Chain developer docs: https://docs.robinhood.com/chain/connecting/
- Pons integration docs: https://docs.ponsfamily.com/
- Pons V2 docs: https://docs.ponsfamily.com/v2
- Supabase Edge Functions: https://supabase.com/docs/guides/functions/quickstart

Pons contracts and ABI can change by generation. Always verify live contract calls and the current official documentation before presenting a launch as confirmed.
