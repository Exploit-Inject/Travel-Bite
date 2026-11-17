import { api } from "@/lib/api";
import { endpoint } from "@/lib/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const handler = endpoint(api);
export { handler as GET, handler as POST, handler as PATCH };
