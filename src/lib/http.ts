import { headers } from "next/headers";
import { ObjectId } from "mongodb";
import { ZodError } from "zod";
import { getAuth } from "./auth";
import { getDb } from "./db";
import type { Role } from "./types";
import { readBody, BodyTooLarge } from "./request-body";
export async function readJson(request: Request) {
  return JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(
      await readBody(request, 32768),
    ),
  );
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function currentUser() {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  if (!ObjectId.isValid(session.user.id)) return null;
  const db = await getDb();
  const user = await db
    .collection("user")
    .findOne({ _id: new ObjectId(session.user.id) });
  if (!user) return null;
  return {
    id: session.user.id,
    name: user.name as string,
    email: user.email as string,
    phone: typeof user.phoneNumber === "string" ? user.phoneNumber : "",
    role: (user.role || "passenger") as Role,
    phoneVerified: user.phoneNumberVerified === true,
    passwordEnabled: user.passwordEnabled === true,
  };
}
export async function requireUser(roles?: Role[]) {
  const user = await currentUser();
  if (!user) throw new HttpError(401, "Please log in to continue.");
  if (roles && !roles.includes(user.role))
    throw new HttpError(403, "You don't have access to this action.");
  return user;
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = process.env.BETTER_AUTH_URL || new URL(request.url).origin;
  if (!origin || origin !== new URL(expected).origin)
    throw new HttpError(403, "Invalid request origin.");
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new HttpError(415, "Send an application/json request.");
}
export function endpoint(
  fn: (request: Request) => Promise<Response>,
  mutation = false,
) {
  return async (request: Request) => {
    try {
      if (mutation) sameOrigin(request);
      return await fn(request);
    } catch (error) {
      if (error instanceof BodyTooLarge)
        return Response.json(
          { error: "Request too large." },
          { status: 413, headers: { "Cache-Control": "no-store" } },
        );
      if (error instanceof ZodError)
        return Response.json(
          { error: error.issues[0]?.message || "Check your details." },
          { status: 400 },
        );
      if (error instanceof HttpError)
        return Response.json(
          { error: error.message },
          { status: error.status },
        );
      if (error instanceof SyntaxError)
        return Response.json(
          { error: "Invalid JSON request." },
          { status: 400 },
        );
      console.error("Travel Bite request failed.");
      return Response.json(
        { error: "Something went wrong. Please try again shortly." },
        { status: 500 },
      );
    }
  };
}
