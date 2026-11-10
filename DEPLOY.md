# Deploy the GAIGS API to your Cloudflare account

GitHub Pages keeps serving the site. This Worker is only the account API (`gaigs-api`): sign-up, login, profiles, posts, wallet, governance, and messaging. It uses D1 for records and R2 for uploads.

`account_id` is not in the repo. `database_id` is the placeholder `00000000-0000-0000-0000-000000000000` until you replace it.

## Values to fill in

| Where | Name | Required | Notes |
| --- | --- | --- | --- |
| Cloudflare dashboard or `wrangler whoami` | Account ID | yes | GitHub secret `CLOUDFLARE_ACCOUNT_ID`. Do not commit it. |
| GitHub repo secret | `CLOUDFLARE_API_TOKEN` | yes for Actions | API token with Workers Scripts Edit, D1 Edit, and Workers R2 Storage Edit. |
| `wrangler.toml` | `database_id` | yes | Printed by `npx wrangler d1 create gaigs`. This id is not a secret. |
| Worker secret | `APP_KYC_PEPPER` | no | Optional leftover secret. Sign-up does not read it and does not collect CNIC or phone. Never commit it. |
| `config.js` | `platformApiBase` | set | `https://gaigs-api.gaigs.workers.dev` with no trailing slash. A placeholder such as `YOUR_SUBDOMAIN` still falls back to the older host. |
| `wrangler.toml` `[vars]` | `GAIGS_ALLOWED_ORIGINS` | no | Comma-separated extra origins for a custom domain. No `*`. |
| R2 | bucket `gaigs-uploads` | yes for media | Account routes work after the bucket exists because the binding is declared. |

`GEMINI_KEY` is not used by this Worker. JARVIS assist stays on `jarvisProxyUrl` (the current host) until you point that separate value at a host you control.

## Commands

From the repository root, after `npx wrangler login` (or with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` exported):

```bash
npx wrangler d1 create gaigs
```

Paste the printed database id into `database_id` in `wrangler.toml`.

```bash
npx wrangler r2 bucket create gaigs-uploads
npx wrangler d1 migrations apply gaigs --remote
openssl rand -hex 32 | npx wrangler secret put APP_KYC_PEPPER
npx wrangler deploy
```

`config.js` already points `platformApiBase` at `https://gaigs-api.gaigs.workers.dev`. A placeholder such as `YOUR_SUBDOMAIN` still falls back to the older host. Do not deploy from this change until the D1 schema is confirmed; existing rows keep any identity hashes already stored.

Local check:

```bash
cp cloudflare/.dev.vars.example .dev.vars
npx wrangler d1 migrations apply gaigs --local
npx wrangler dev
```

`.dev.vars` is gitignored. `APP_KYC_PEPPER` is not required for sign-up.

## GitHub Actions

`.github/workflows/deploy-cloudflare.yml` runs only from the Actions tab (**Run workflow**). It applies the remote D1 migrations, then runs `wrangler deploy`. Set repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` first, and commit the real `database_id`. Create the R2 bucket and `APP_KYC_PEPPER` before the first run (`wrangler secret put` once; later deploys keep the secret).

## CORS and cookies

Allowed browser origins:

- the Worker’s own origin
- `https://futureworldvision842-lgtm.github.io`
- `http://localhost`, `https://localhost`, `http://127.0.0.1`, and `https://127.0.0.1`, any port
- `capacitor://localhost` and `ionic://localhost`
- each origin in `GAIGS_ALLOWED_ORIGINS`

Any other `Origin` is rejected and is not reflected. Responses that allow an origin set `Access-Control-Allow-Credentials: true`. Preflight allows `authorization`, `content-type`, `x-gaigs-request`, and `x-gaigs-client`, so bearer tokens from the Android app pass the preflight.

Web sign-in stores an HttpOnly cookie. On a cross-site call the cookie is `Secure; SameSite=None; Partitioned`, which is what a Pages page needs in order to send it to `workers.dev`. Same-origin calls keep `Secure; SameSite=Lax`. The native app also receives `sessionToken` and sends `Authorization: Bearer`.
