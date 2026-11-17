# Deploy Travel Bite to Vercel

Use the Next.js framework preset, Node.js 24, `npm ci`, and `npm run build`. Keep the server runtime; do not export a static website. Connect the GitHub repository after the final code push.

## Private configuration

All environment files, including `.env.example`, are ignored and must stay out of GitHub. Run `npm run setup:env` to generate a local `.env.local` without overwriting an existing file. The command generates a random authentication secret and does not print it.

Enter deployment values directly under Vercel Project Settings → Environment Variables. Select the intended deployment environment and redeploy after changes.

| Variable                                                               | Value to supply                                                                                                                                                            |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MONGODB_URI`                                                          | A reachable MongoDB Atlas or replica-set URI with its own application database user. Localhost is unavailable from Vercel.                                                 |
| `MONGODB_DB`                                                           | The database intended for this deployment; separate client-review and real-business data.                                                                                  |
| `BETTER_AUTH_URL`                                                      | The exact HTTPS origin given to customers. Do not include a path or use a localhost URL on Vercel.                                                                         |
| `BETTER_AUTH_SECRET`                                                   | A unique, persistent random secret of at least 32 characters. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and save privately. |
| `DEV_SMS`                                                              | `false` for deployed SMS. Production always refuses terminal OTP mode.                                                                                                     |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID` | Needed for real OTP delivery. Password login remains available without SMS. Follow [Twilio setup](twilio-setup.md).                                                        |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`                               | Test keys for review; approved live keys only for live orders. COD works without these.                                                                                    |
| `RAZORPAY_WEBHOOK_SECRET`                                              | A separate random secret matching the Razorpay webhook configuration.                                                                                                      |
| `SUPPORT_EMAIL`                                                        | The actual customer-support address.                                                                                                                                       |
| `SEED_SAMPLE_DATA`                                                     | `false` for live setup. Sample data is not inserted by production seed unless explicitly enabled.                                                                          |

Keep credentials server-side: no `NEXT_PUBLIC_` prefix, no values in `next.config.ts`, and no secrets in GitHub workflow files. The public Razorpay key is intentionally returned to its checkout; API and webhook secrets stay on the server. Vercel deploy access protection must allow Razorpay to reach the webhook endpoint, without making admin APIs public.

## Database and admin setup

The application awaits required unique indexes on first database access. The database user needs permissions to create indexes; fix duplicate records or permissions rather than disabling those constraints. Authentication requires transactions and therefore a replica set.

Run `npm run seed` from a controlled checkout configured for the intended database, with `SEED_SAMPLE_DATA=false`. Review the supplied route data before enabling routes. This flag does not remove sample records already present in a database.

Create an administrator from that same checkout using private `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and optional `ADMIN_NAME` settings, then run `npm run admin`. These setup credentials need not remain in the Vercel runtime environment. They are hashed into MongoDB; setting the variables alone does not create the account. To rotate the password, change the private setting and run `npm run admin -- --reset-password`, which revokes prior sessions. Never share the local development admin password as the production credential.

## Payments and delivery

In the matching Razorpay mode, register `https://your-domain/api/payments/webhook` for `payment.captured` and `refund.processed`. Use the same webhook secret in Razorpay and Vercel. Confirm payment capture settings, signature verification, a successful payment, a failed payment, and a refund with the actual provider account before taking real orders.

Refunds with uncertain provider outcomes remain pending for manual reconciliation. Do not retry an uncertain refund blindly. The refund webhook checks the matching payment and full refund amount, including when the webhook arrives before the API response is saved.

Restaurant approval, real menus, routes/stops, food-business information, delivery staffing, support, and legal policies must be completed by the business. The included policy text and sample imagery are drafts, not verified business details. Bus arrival is passenger-supplied; no bus-operator tracking or automatic restaurant settlement is implemented.

## Verification and operations

Run `npm run typecheck`, `npm test`, `npm run test:e2e`, `npm run build`, and `npm run check:production` sequentially for the browser/build steps. The production check uses an isolated local database and tests nonce CSP, mobile password signup, session cookies, private caching, and blocking an injected inline script. It never uses live SMS or payment accounts. Ensure ports 3100, 3200, and 27028 are available.

Run `npm run check:secrets -- --history --client` before publishing. It checks tracked/unignored files, committed history, browser build output, common credential patterns, and private values from local env files without printing those values. The GitHub workflow runs checks without deployment secrets. Secret scanning reduces accidental disclosure; it does not replace reviewing the exact staged files.

For a fresh clone, enable the included local pre-commit secret check with `git config core.hooksPath .githooks`. GitHub checks remain independent of local hooks. If a real credential is ever published, revoke or rotate it first; deleting the current file does not remove it from history.

Check `/api/health` after deployment. Configure database backups, error monitoring, refund/payment reconciliation, and an operational support channel. Current lists show bounded recent records; plan pagination and audit logging as the business grows. Review proxy/IP trust if hosting anywhere other than Vercel. Real third-party delivery and payment tests remain separate from local automated checks.
