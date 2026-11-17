# Security

Report suspected vulnerabilities privately to the repository owner. Include the affected path, reproduction steps, and a description of impact. Do not put passwords, payment details, OTPs, database records, or service credentials into a public issue.

All env files and private keys are excluded from Git. Use `npm run setup:env` locally and a hosting secret manager for deployments. Run `npm run check:secrets -- --history --client` after a build before pushing. Enable the local hook with `git config core.hooksPath .githooks`.

The application checks account roles and restaurant/order ownership on the server, hashes passwords with Better Auth, validates origins for browser mutations, rate-limits authentication, limits request body sizes, and verifies Razorpay signatures and payment totals. Password signup does not prove ownership of the supplied mobile number; only successful OTP verification marks a number verified.

See [production setup](docs/production.md) for hosting, credentials, database constraints, provider verification, and operational limits. A passing build or automated scan does not certify a live business operation.
