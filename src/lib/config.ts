export function authSettings(
  env: {
    NODE_ENV?: string;
    BETTER_AUTH_SECRET?: string;
    BETTER_AUTH_URL?: string;
    VERCEL?: string;
  } = process.env,
) {
  const production = env.NODE_ENV === "production";
  const localSecret = "travel-bite-local-development-secret-only-2026";
  if (
    production &&
    (!env.BETTER_AUTH_SECRET ||
      env.BETTER_AUTH_SECRET.length < 32 ||
      env.BETTER_AUTH_SECRET === localSecret)
  )
    throw new Error(
      "Set a unique BETTER_AUTH_SECRET of at least 32 characters for production.",
    );
  if (production && !env.BETTER_AUTH_URL)
    throw new Error("BETTER_AUTH_URL is required in production.");
  const url = new URL(env.BETTER_AUTH_URL || "http://localhost:3000");
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error("BETTER_AUTH_URL must be a plain HTTP(S) origin.");
  if (production && url.protocol !== "https:" && (!loopback || env.VERCEL))
    throw new Error("The deployed authentication origin must use HTTPS.");
  return {
    origin: url.origin,
    secret: env.BETTER_AUTH_SECRET || localSecret,
    secureCookies: url.protocol === "https:",
  };
}
