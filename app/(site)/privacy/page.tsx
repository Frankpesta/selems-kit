import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/site/LegalPage";
import { getPage } from "@/lib/data";
import { arr, str } from "@/lib/fields";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage("privacy");
  return pageMetadata({
    title: page?.seoTitle ?? "Privacy notice | Selems Exclusive Hotel & Suites, Akure",
    description: page?.seoDescription ?? "",
    path: "/privacy",
  });
}

export default async function PrivacyPage() {
  const page = await getPage("privacy");
  const f = page?.fields ?? {};
  return (
    <LegalPage
      path="/privacy"
      crumb="Privacy"
      title={str(f.h1, "Privacy notice")}
      intro={str(f.intro)}
      sections={arr<LegalSection>(f.sections).filter((s) => s.id && s.heading && s.body)}
      updatedAt={page?.updatedAt ?? null}
    />
  );
}
