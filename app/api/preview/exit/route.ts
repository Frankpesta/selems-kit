import { draftMode } from "next/headers";
import { redirect } from "next/navigation";

/** Leaves preview: pages show published content again. */
export async function GET() {
  (await draftMode()).disable();
  redirect("/");
}
