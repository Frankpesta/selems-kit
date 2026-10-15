import { draftMode } from "next/headers";
import { redirect } from "next/navigation";
import { verifyPreviewToken } from "@/convex/lib/preview";
import { pageSchema } from "@/lib/content-schemas";

// Opens a page with its unpublished draft (admin "Preview", docs/06). The token
// is signed by Convex with REVALIDATE_SECRET and lasts 30 minutes; draft mode
// then makes the cached page loaders read the draft (lib/data.ts getPage).
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const secret = process.env.REVALIDATE_SECRET;
  const key = secret ? await verifyPreviewToken(secret, token, Date.now()) : null;
  const schema = key ? pageSchema(key) : null;
  if (!schema) return new Response("This preview link is invalid or has expired. Open Preview again from the admin.", { status: 401 });
  (await draftMode()).enable();
  redirect(schema.path);
}
