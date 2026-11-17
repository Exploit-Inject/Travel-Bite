# Travel Bite: guide for coding agents

Read this file before changing the project. It applies to the whole repository. Follow the user's current instructions if they conflict with this guide.

## What we are building

Travel Bite is a food-ordering platform for bus passengers in India. Passengers open a seat-specific QR link, choose food from a restaurant serving their upcoming stop, provide their bus and seat details, and pay online or with cash on delivery. Restaurant partners manage their menus and incoming orders. Admins approve restaurants and manage orders, delivery assignments, routes, stops, and customers.

The requested result is a working application backed by real services. Do not replace database writes, authentication, payments, or order management with static pages, browser-only simulations, fake success messages, or mock production data.

The project is under active development. Check the files and run the relevant commands before assuming that a feature is complete or verified.

## Current handoff context

The user plans to host Travel Bite on Vercel and share the link with the client for review. They have created a Twilio free-trial account. Twilio Verify support is implemented, but do not assume that credentials have been configured, that a deployment exists, or that a real SMS has been delivered without checking.

Dedicated administrator email/password login is implemented. Customers and restaurant partners can use mobile OTP or mobile-number/password login. The user explicitly requested password signup and login while OTP delivery is being configured. This is a real account flow, not a review-only bypass. Separate email/password review accounts were discussed but have not been implemented.

## Required stack

- Next.js App Router with TypeScript and React.
- Better Auth for authentication, using its MongoDB adapter, phone-number plugin for passengers/partners, and email/password authentication for dedicated administrators.
- MongoDB for accounts, sessions, restaurants, menus, routes, and orders.
- Razorpay Standard Checkout for online payments; cash on delivery is also supported.
- Twilio Verify for OTP delivery and verification, with legacy Programmable Messaging support. Keep the provider behind server-side Better Auth callbacks. Read `docs/twilio-setup.md` for setup.
- Plain CSS in `src/app/globals.css` and Lucide icons for the interface.

Next.js, Better Auth, and MongoDB are explicit user choices. Do not substitute another framework, authentication library, or database without the user's instruction.

## Repository layout

- `src/app/`: App Router pages, metadata, global styles, and route handlers.
- `src/app/api/auth/[...all]/route.ts`: Better Auth's HTTP handler.
- `src/app/api/[...path]/route.ts`: Application API entry point.
- `src/components/`: Passenger screens, dialogs, shared application state, and management screens.
- `src/lib/api.ts`: Server-side application endpoints and authorization checks.
- `src/lib/auth.ts`: Better Auth configuration and SMS delivery.
- `src/lib/phone-otp.ts`: Local OTP logging, Twilio Verify send/check calls, and the optional legacy SMS sender. In Verify mode, accept only provider-approved codes; never fall back to Better Auth's internal placeholder code.
- `src/lib/auth-client.ts`: Browser authentication client.
- `src/lib/phone-password.ts`: Better Auth endpoints for customer mobile/password signup and authenticated password setup. New accounts always receive the passenger role. Never overwrite an existing account or password through signup.
- `src/lib/admin-account.ts`: Command-line-only administrator provisioning and password rotation. Never mount its provisioning auth instance as an HTTP handler.
- `src/lib/db.ts`: MongoDB connection reuse, collections, and public catalog queries.
- `src/lib/types.ts`: Shared domain types. Monetary values are integer paise.
- `src/lib/validation.ts`: Zod schemas for untrusted input.
- `src/lib/order-rules.ts`: Price calculation, delivery fees, order transitions, and arrival validation.
- `src/lib/payments.ts`: Server-side Razorpay requests and signature verification.
- `src/lib/checkout.ts`: Browser checkout integration. Never put payment secrets here.
- `src/lib/seed-data.ts`: Clearly identified sample restaurants, dishes, and initial routes.
- `scripts/`: Local development, database setup, account administration, and asset utilities.
- `public/images/`: Local food photography used by the application.
- `tests/`: Domain tests and browser or API integration tests as they are added.

Keep business rules in server-side modules or pure shared helpers. A client component is never an authorization boundary.

## Local development

Use the package manager matching `package-lock.json`:

```sh
npm ci
npm run dev
```

Run `npm run setup:env` to create an ignored `.env.local` when configuring external services. All environment files, including `.env.example`, must remain outside GitHub. The development runner reads `.env.local`. If `MONGODB_URI` is absent, it starts a local MongoDB replica set through `mongodb-memory-server`, stores its data in `.data/mongo`, creates application indexes, and inserts sample data without overwriting existing records. The first run needs network access to download the MongoDB binary.

`npm run dev:next` starts Next.js directly and requires an already configured database. Use it when managing MongoDB separately.

Development SMS mode prints OTPs in the server terminal. It is allowed only when `NODE_ENV` is not `production` and `DEV_SMS=true`. Do not add a fixed OTP, an HTTP endpoint that reveals OTPs, or a production authentication bypass.

Useful commands:

```sh
npm run typecheck
npm test
npm run test:e2e
npm run build
npm run seed
npm run admin
npm run admin -- --reset-password
```

The admin command creates a dedicated email-and-password administrator using private `ADMIN_EMAIL` and `ADMIN_PASSWORD` settings. It does not promote a customer account and does not require an SMS login. The password must have at least 12 characters and is hashed by Better Auth. Re-running setup preserves existing credentials; `--reset-password` explicitly rotates the password and revokes prior sessions. Keep credentials in ignored environment files or a secret manager. Do not create a public endpoint that grants privileged roles or enables email/password registration. Read the test configuration before running browser tests; report missing browser or service dependencies accurately.

## Authentication and authorization

- Verify mobile numbers through Better Auth. Current phone validation accepts Indian `+91` mobile numbers.
- Derive identity from the server session and look up the current role in MongoDB. Never trust a role, user ID, customer phone number, restaurant owner, or payment status supplied by the browser.
- Account roles are `passenger`, `restaurant`, and `admin`.
- Administrator sign-in lives at `/admin/login`. Keep public email/password signup disabled and rate-limit password attempts. Do not replace the dedicated admin credentials with promotion of a phone account or a hardcoded default password.
- New restaurant applications start as pending. Registration alone must not grant restaurant privileges or publish the menu. Admin approval is required.
- Partners may edit only their own menus and manage only their own restaurant's orders. Suspended partners must not retain operational access.
- Passengers may read only their own orders. Customer contact details are private and must not appear in the public catalog.
- Check authorization in every protected API operation, even if the corresponding page also has an authentication gate.
- Keep mutation origin checks, request validation, OTP attempt limits, and request rate limits intact.
- Password signup collects full name, Indian mobile number, and a password of at least 12 characters. Login uses mobile number and password; full names are not unique identifiers. The OTP dialog retains a password-login option below it.
- Password signup does not verify ownership of the supplied phone number. Keep `phoneNumberVerified=false` until OTP verification. Mobile accounts can order and register restaurants without requiring that flag; label them accurately as password accounts or logged-in accounts rather than verified phones.
- Existing OTP users must log in before adding a password in My account. Signup cannot attach a password to an existing number. Authenticated password setup targets only the session user and cannot replace an existing credential. Passwords are hashed through Better Auth; do not expose public admin/email registration.

## OTP modes and Twilio setup

Read [the Twilio setup guide](docs/twilio-setup.md) before configuring SMS delivery or changing authentication callbacks.

- Local terminal mode runs only when `NODE_ENV` is not `production` and `DEV_SMS=true`. Better Auth generates and checks the six-digit code; the code is printed in the terminal running the server. The login dialog should direct the developer to that terminal. Codes expire after five minutes.
- Real Verify mode uses `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_VERIFY_SERVICE_SID`. Set `DEV_SMS=false` when testing real SMS locally. The service SID starts with `VA`; an individual verification SID starting with `VE` is not a service SID.
- Twilio Verify generates and checks the SMS code. Accept only an `approved` verification response. Reject pending, expired, consumed, malformed, and provider-error responses. Never accept Better Auth's internal placeholder as a fallback. Use six-digit codes in the Verify service; the integration assumes the default ten-minute Verify validity window.
- Verify does not require `TWILIO_FROM_NUMBER`. Without a Verify service SID, the legacy Programmable Messaging path uses that sender and Better Auth's five-minute code. New trial accounts restrict custom message bodies, so do not direct the user to that legacy path for trial OTP testing.
- The trial requires verified recipient numbers. The client's number must be verified in Twilio before they can receive review OTPs. Trial quotas, supported destinations, recipient limits, and account restrictions can change; check the current Console and official Twilio documentation before quoting them.
- For delivery failures, inspect Verify logs and Verify Geo Permissions. Do not log provider credentials, complete provider responses containing private information, or live OTPs. Do not send chargeable test messages without an intended recipient and authorization.

`tests/phone-otp.test.ts` covers provider behavior with mocked network requests. `tests/phone-auth.test.ts` checks the Verify callbacks through Better Auth against an isolated MongoDB replica set, including rejection of the internal placeholder and code replay. These tests do not establish actual carrier delivery.

## Orders and delivery

- Recompute totals from current database menu prices. Browser totals are estimates, never payment authority.
- Keep prices, fees, payment amounts, and refunds as integer paise. Format rupees only for display.
- One order belongs to one restaurant. Reject duplicate dish IDs, invalid quantities, unavailable dishes, unapproved restaurants, unsupported stops, and invalid route/stop combinations.
- Validate that the selected restaurant serves the stop and that expected arrival leaves enough preparation and delivery time.
- Arrival times are passenger estimates unless a real bus-tracking integration is added. Do not present simulated positions, invented ETAs, or fake live tracking.
- Use the order status transition rules in `order-rules.ts`. Do not allow arbitrary state changes or regressions.
- Use conditional MongoDB updates when changing order or payment states so concurrent requests cannot silently overwrite one another.
- Order creation must remain idempotent for the same account and request key.
- Admins coordinate delivery assignments. Require delivery contact details before dispatch.
- For cash orders, record cash collection when delivery is confirmed. Do not mark an online order paid merely because it was delivered.

## Payments and refunds

- Create Razorpay orders on the server using the stored order amount and INR currency.
- Only the public Razorpay key may reach the browser. Keep the API secret and webhook secret server-side.
- Verify checkout signatures with the stored provider order ID and use constant-time signature comparison.
- Confirm the provider payment is captured and that its amount, currency, and order ID match before marking the application order paid.
- Verify webhooks against the raw request body. Do not apply browser-origin checks to signed provider webhooks.
- Webhook retries and browser callbacks must be safe to repeat and must not move a fulfilled or refunded order backward.
- Claim a refund atomically before calling the provider. If a network error makes the outcome uncertain, keep the refund pending and require reconciliation; do not blindly retry a potentially successful refund.
- Do not claim that live payments, real SMS delivery, or refunds have been verified unless the corresponding service was actually exercised.

## Interface and accessibility

Use orange, white, and warm neutral tones with clear typography and generous spacing. Keep the design clean and usable on a phone. Prioritize finding food for a stop, adding it to the bag, and completing checkout.

Use semantic elements, visible keyboard focus, labels on inputs, descriptive button names, accessible dialogs, and readable contrast. Avoid nested interactive controls. Support loading, empty, error, disabled, and success states. Every visible action should work or explain a real service limitation.

Persist non-sensitive preferences such as the bag and journey locally. Never store session credentials, payment secrets, or privileged account data in local storage. Treat locally stored values as untrusted input.

Do not invent restaurant ratings, customer counts, testimonials, delivery guarantees, or partner endorsements. Sample restaurants and images must be identified in documentation and replaced or reviewed before launch. Do not add invented legal, refund, or support promises.

## Verification

Run checks appropriate to the change. For server or payment changes, include meaningful tests covering authorization, price tampering, invalid order transitions, repeated requests, and failure paths. Do not add tests that merely repeat implementation details.

Before handing off a substantial change, run TypeScript checks, relevant tests, and a production build. For interface changes, inspect desktop and mobile layouts when browser tooling is available. Test the passenger checkout and management actions against MongoDB rather than assuming that a successful render proves the backend works.

Report exactly what passed, what failed, and what could not be checked. A local development server, sample seed data, or a successful build alone does not make the platform production-ready.

## Secrets and deployment

- Never commit any env files (including `.env.example`), database files, credentials, OTP logs, or production data. The user explicitly requested that all env files stay out of GitHub. Preserve the generator and secret checks; do not add an ignore exception for templates.
- Production requires MongoDB, a strong persistent Better Auth secret, and the correct HTTPS origin. OTP delivery requires configured SMS; customer password login works without it. Online payments require Razorpay credentials and a verified webhook endpoint; Cash on Delivery remains available without online payment credentials.
- Keep sample-data seeding separate from production setup. `SEED_SAMPLE_DATA=false` disables sample restaurants and dishes; review the initial routes separately.
- Do not silently change the deployment target or publish a static export that drops authentication and API functionality.
- Document unresolved infrastructure, operational, legal-copy, and third-party onboarding requirements. Do not label the application production-ready while those requirements remain open.

## Vercel client review

Keep the full Next.js server runtime. A Vercel deployment does not run `scripts/dev.ts`, and setting `DEV_SMS=true` does not enable terminal OTPs in a production build. Do not change `NODE_ENV` or weaken authentication to make a hosted review work.

Configure the following privately for the intended Vercel deployment environment:

| Setting                                                                | Requirement                                                                                                                             |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `MONGODB_URI`, `MONGODB_DB`                                            | A reachable MongoDB replica set or Atlas database. Localhost and the development runner's local database are not available from Vercel. |
| `BETTER_AUTH_URL`                                                      | The exact HTTPS origin shared with the client. Account for changing preview URLs when selecting a review URL.                           |
| `BETTER_AUTH_SECRET`                                                   | A strong, persistent server-side secret.                                                                                                |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID` | Actual account credentials and the Verify service used for OTP delivery.                                                                |
| `DEV_SMS`                                                              | Set `false` for real SMS testing.                                                                                                       |

Redeploy after changing Vercel environment variables. Never use `NEXT_PUBLIC_` for credentials. Administrator setup must run against the same database used by the deployment; setting `ADMIN_EMAIL` and `ADMIN_PASSWORD` in Vercel alone does not create an account.

Use separate review data when practical and Cash on Delivery to exercise ordering without live payments. Keep Razorpay in test mode if demonstrating online payment. A successful client review is not evidence that real restaurant onboarding, delivery operations, business policies, SMS, or live payments are ready for launch.

## Working with this repository

Inspect the current files before editing. Preserve unrelated user changes. Search with `rg` where available, use the existing patterns, and keep changes within the authorized task. Do not reset or delete work you do not own.

The workspace may use PowerShell on Windows. Use native file operations with literal paths and verify target paths before recursive deletion or moving. Keep shell quoting safe; do not interpolate secrets into commands or output.

Do not spawn other agents unless the user or an applicable instruction explicitly requests delegation. This file provides guidance for agents working on the project; it does not itself authorize parallel agent work.

Write like a real person. Be specific, direct, and concise. Avoid generic introductions, repeated explanations, promotional language, decorative headings, and exaggerated claims. Never invent details or sources. Explain what changed, why it matters, and how it was verified.
