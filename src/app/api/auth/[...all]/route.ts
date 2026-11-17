import { getAuth } from "@/lib/auth";
import { readBody, BodyTooLarge } from "@/lib/request-body";
export const runtime = "nodejs";
async function handler(request: Request) {
  try {
    if (request.method === "POST") {
      const bytes = await readBody(request, 16384);
      const headers = new Headers(request.headers);
      headers.delete("content-length");
      request = new Request(request.url, { method: request.method, headers, body: Buffer.from(bytes) });
    }
    return await (await getAuth()).handler(request);
  } catch (error) {
    if (error instanceof BodyTooLarge) return Response.json({ message: "Request too large." }, { status: 413 });
    console.error("Authentication request failed.");
    return Response.json({ message: "Login is temporarily unavailable. Please try again shortly." }, { status: 503 });
  }
}
export { handler as GET, handler as POST };
