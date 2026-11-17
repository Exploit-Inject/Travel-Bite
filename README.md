# Travel Bite

A food-ordering web application for bus passengers, built with Next.js App Router, TypeScript, Better Auth, and MongoDB. The interface uses orange, cream, and white, and adapts to mobile screens.

Passengers choose their route and upcoming stop, browse restaurant menus, save dishes, add food to their bag, verify their mobile number, and place an order. Restaurant partners apply for approval, maintain their menu, and process incoming orders. Admins approve or suspend restaurants, coordinate deliveries, review customers, manage routes, and generate seat-specific QR codes.

The application runs locally with a real MongoDB instance. Live SMS delivery, Razorpay transactions, and public deployment need your service credentials and operational setup. Sample restaurants and draft legal pages are included for development; they are not real onboarded partners or final legal policies.

## Run locally

Requires Node.js 22 or newer and npm. Node.js 24 is used by the Dockerfile.

```sh
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

When no `MONGODB_URI` is supplied, the development runner starts a local MongoDB replica set, creates the required indexes, and inserts sample routes and menus. Its first run downloads a MongoDB binary. Data persists in `.data/mongo`. Stop the process cleanly before starting another local instance.

Run `npm run setup:env` to create an ignored `.env.local`, then provide a MongoDB Atlas or replica-set connection string if using your own database. The scripts read `.env.local` before `.env`. All env files, including `.env.example`, stay out of GitHub. Better Auth uses MongoDB transactions, so a standalone server without a replica set is insufficient.

The development runner enables terminal SMS delivery by default when `DEV_SMS` is unset. After requesting a login code, read it from the server terminal. There is no fixed login code and no browser endpoint exposing codes. Production cannot use this mode.

Set a persistent `BETTER_AUTH_SECRET` in `.env.local` if you want sessions to survive restarting the development runner. Otherwise, a random secret is generated for the current run.

## Configuration

| Variable                                  | Purpose                                                                                          |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `MONGODB_URI`                             | MongoDB Atlas or replica-set connection string. Required outside the development runner.         |
| `MONGODB_DB`                              | Database name; defaults to `travel_bite`.                                                        |
| `BETTER_AUTH_URL`                         | Exact application origin, including scheme. Use the production HTTPS URL when deploying.         |
| `BETTER_AUTH_SECRET`                      | Persistent secret of at least 32 characters. Required in production.                             |
| `DEV_SMS`                                 | `true` prints development OTPs to the terminal. Ignored in production.                           |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` | Account credentials for real SMS delivery.                                                       |
| `TWILIO_VERIFY_SERVICE_SID`               | Verify service SID (starts with `VA`). Recommended for OTP and trial accounts.                   |
| `TWILIO_FROM_NUMBER`                      | Optional legacy Programmable Messaging sender when Verify is not configured.                     |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`  | Server-side Razorpay credentials. Online checkout is disabled when absent.                       |
| `RAZORPAY_WEBHOOK_SECRET`                 | Secret for validating signed Razorpay events.                                                    |
| `SUPPORT_EMAIL`                           | Actual customer-support address displayed on the help page.                                      |
| `SEED_SAMPLE_DATA`                        | Set `false` to create indexes and initial routes without inserting sample restaurants or dishes. |

Generate an authentication secret locally:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Keep that value in your environment or secret manager. Never commit it.

## Accounts and permissions

The customer login dialog keeps OTP as its default and provides **Login with password** underneath. New users can choose **Create an account**, enter their full name, Indian mobile number, and a password of at least 12 characters, then order without sending an SMS. Returning users log in with their mobile number and password.

Existing OTP users can log in with OTP once, then add a password in **My account**. Registration cannot overwrite an account that already uses the number, and password setup requires that account's authenticated session. Password signup does not prove phone ownership: the number remains unverified until OTP is completed. Account and checkout badges distinguish being logged in from having a verified phone. Restaurant applicants still require admin approval. The separate administrator email/password login is unchanged.

For real OTP delivery, follow [Twilio setup](docs/twilio-setup.md). New trial accounts should use the Verify integration, with the client's phone number added as a verified trial recipient.

Passenger and restaurant login uses Better Auth's phone-number plugin for OTP or password sign-in. The current implementation accepts Indian mobile numbers in `+91` format. New users receive the `passenger` role. Administrators have a separate email-and-password login at `/admin/login`. The server reads the current role from MongoDB for protected operations.

To create a dedicated administrator, set these values privately in `.env.local` or the server environment, then run the setup command against the application's database:

```dotenv
ADMIN_EMAIL=your-admin-email
ADMIN_PASSWORD=your-unique-password-at-least-12-characters
ADMIN_NAME=Travel Bite Admin
```

```sh
npm run admin
```

Open `/admin/login` and use the email and password you configured. The account is created through a command-line-only Better Auth instance, which hashes the password and stores the account in MongoDB. The HTTP application disables public email/password registration. Admin credentials are never bundled into client code, and no default password is built into the application. Existing customer accounts are not promoted by this command.

Keep the development runner running if it manages your MongoDB instance. The setup script reads its loopback connection from `.data/local-db.json`; configured environment values take priority. Re-running setup preserves an existing admin password. To rotate it, update `ADMIN_PASSWORD` privately and run:

```sh
npm run admin -- --reset-password
```

Rotation revokes existing sessions. There is no email-based password recovery configured; use this server-side command to reset an admin password. Use a real operational admin email when deploying and keep `.env.local` out of version control. A credential-only administrator must use a separate mobile account when testing passenger ordering or restaurant applications.

Restaurant applicants can prepare a menu while awaiting approval. Their restaurant and dishes become public only after an admin approves the application. Suspension hides the restaurant from the public catalog and prevents menu or order mutations. Partners cannot modify another restaurant's menu or manage another restaurant's orders.

## Screens

| Path                                               | Purpose                                                                                         |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `/`                                                | Home, journey setup, popular dishes, and ordering instructions.                                 |
| `/menu`                                            | Search, categories, restaurant filtering, vegetarian filter, favourites, and sorting.           |
| `/checkout`                                        | Customer details, bus and stop details, order summary, and payment.                             |
| `/orders`                                          | The passenger's orders, fulfillment updates, delivery contact, cancellation, and payment retry. |
| `/account`                                         | Account details and links to available workspaces.                                              |
| `/partner`                                         | Restaurant partner application.                                                                 |
| `/partner/dashboard`                               | Menu creation/editing, availability, incoming orders, and restaurant details.                   |
| `/admin`                                           | Orders, delivery assignments, restaurants, customers, routes, and seat QR codes.                |
| `/admin/login`                                     | Dedicated administrator email-and-password login.                                               |
| `/help`                                            | Help content and configured support contact.                                                    |
| `/legal/terms`, `/legal/privacy`, `/legal/refunds` | Draft launch policies requiring operator review.                                                |

## QR ordering

Admins generate downloadable QR images in the **Seat QR codes** tab. QR links include a route, bus, seat, and suggested delivery stop:

```text
/menu?route=delhi-jaipur&bus=DL01AB1234&seat=12A&stop=behror
```

Scanning opens the web menu and journey dialog without installing an app. Passengers confirm their current location and arrival estimate. All QR-supplied values remain untrusted and are validated again when placing an order. Generate final codes on the public HTTPS domain; localhost codes will not work on passengers' phones.

## Order rules

Money is stored as integer paise. The server reads current menu prices and availability and recalculates all totals. If the total differs from the amount the passenger reviewed, checkout refreshes the catalog and asks them to review their bag again. Orders contain dishes from one restaurant, and the selected restaurant must serve the chosen stop on an active route. Expected arrival must allow preparation time plus a ten-minute delivery buffer and be within 24 hours.

Delivery is ₹29, with free delivery for an item total of ₹499 or more. Prices in the sample menus are illustrative and must be reviewed with real restaurants. No additional tax is calculated at checkout; displayed restaurant prices are treated as tax-inclusive. Review your tax, invoicing, and settlement requirements before launch.

Cash orders progress through `placed → accepted → preparing → out_for_delivery → delivered`. Admins supply the delivery person's name and phone number when dispatching. Delivery confirmation records cash collection for COD orders. Passengers can cancel a COD order only while it is still `placed`.

Online orders begin as `pending_payment`. A verified, captured payment moves them to `placed`. Browser callbacks and signed webhooks verify the provider order, amount, and currency; retries do not reverse a fulfilled order's status. Creation requests use a per-user idempotency key backed by a unique MongoDB index.

Arrival times are passenger estimates. There is no bus-operator integration, live GPS tracking, automatic stop-arrival detection, driver app, automatic restaurant settlement, or automated customer-notification service beyond login SMS. Delivery coordination is handled by the admin and the contact recorded on the order.

## Razorpay setup

1. Configure test keys for staging and your approved live account for production.
2. Enable payment capture as required by your Razorpay account configuration.
3. Add an HTTPS webhook for `/api/payments/webhook` with the same secret as `RAZORPAY_WEBHOOK_SECRET`.
4. Subscribe to `payment.captured` and `refund.processed`.
5. Exercise successful, declined, abandoned, repeated, and delayed payments and complete a test refund before enabling public orders.

The browser uses Razorpay Standard Checkout; secrets and provider API calls stay on the server. A successful checkout signature alone is insufficient: the server also fetches the payment and checks that it is captured and matches the stored order.

Admins can cancel and request a full refund for paid orders before preparation. A conditional database update claims the refund first. If a network failure leaves the provider outcome uncertain, the order stays `refund_pending` for manual reconciliation in Razorpay. Do not retry such refunds blindly. Resolve ambiguous refunds in the provider dashboard and update the matching application record only after checking the provider reference and amount.

## Checks

```sh
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

Unit tests cover total calculation, fees, order transitions, delivery timing, and input validation. Playwright tests run a separate Next.js server on port 3100 and an isolated MongoDB replica set on port 27028. They exercise authentication, API authorization, idempotent checkout, restaurant approval and ownership, delivery updates, signed payment events, and mobile ordering. They also capture desktop/mobile screenshots and check images and horizontal overflow. The tests never use your configured production database or live payment/SMS accounts.

The test suite uses a separate `.data/next-e2e` output directory and removes its temporary database after stopping. Stop any process already using the test ports first. Test screenshots and traces are saved under `test-results/` and are ignored by Git.

## Deployment

For Vercel, follow [production setup](docs/production.md). Run `npm run check:secrets -- --history --client` after a build before pushing. All environment files are intentionally excluded from the repository; use `npm run setup:env` for local configuration.

This application needs a Node.js server with MongoDB connectivity. A static export will not provide authentication, ordering, or payments. A Dockerfile is included, or use a hosting service that supports the complete Next.js server runtime.

```sh
npm ci
npm run build
npm run start
```

For a container:

```sh
docker build -t travel-bite .
docker run --env-file .env.production -p 3000:3000 travel-bite
```

Supply production settings at runtime, configure HTTPS at the hosting layer, and use a managed replica set or MongoDB Atlas. Run `SEED_SAMPLE_DATA=false npm run seed` with the same environment before accepting orders; on PowerShell, set `$env:SEED_SAMPLE_DATA='false'` before invoking the seed command. Review and replace the initial sample routes separately. This flag does not remove sample data already inserted into a database. The Docker runner contains the standalone Next.js server, not the development CLI scripts; run setup scripts from the source checkout or a controlled release job.

`GET /api/health` checks database connectivity. Set up request/error monitoring, database backups, payment and refund reconciliation, and an operational support contact. Decide retention periods for accounts, OTP-related records, and orders before launch.

Before going live, onboard real restaurants and bus operators, verify food-business registrations and delivery coverage, replace sample photos with authorised restaurant images, finalise business and policy details, and validate the actual SMS and Razorpay integrations. Build and local-test success do not establish those external requirements.

## Assets and agent instructions

Food photos are downloaded from Unsplash and stored locally. `scripts/assets.mjs` records the source image identifiers; its sample photos are illustrative. The hero photo shows paneer curry, and the seed photo used for chicken biryani is an illustrative rice dish rather than a verified restaurant product photo. Review image permissions and replace sample photography with actual menu imagery before launch.

Read [AGENT.MD](./AGENT.MD) for instructions for future coding agents. [AGENTS.md](./AGENTS.md) is the conventional discovery entry point and also retains framework-generated guidance.
