import type { Metadata } from "next";
import { readFileSync } from "node:fs";
import path from "node:path";
import Link from "next/link";
import { MarkdownDocument } from "@/components/legal/markdown-document";

export const metadata: Metadata = {
  title: "Terms of Service | Kanvise",
  description: "Terms governing use of Kanvise.",
  alternates: { canonical: "/terms" },
  robots: { index: true, follow: true },
};

export default function TermsOfServicePage() {
  const terms = readFileSync(path.join(process.cwd(), "public", "terms-of-service.md"), "utf8");

  return <main className="min-h-screen bg-[#f7f5f2] px-5 py-10 text-[#25202d] sm:px-8 sm:py-16"><article className="mx-auto max-w-4xl rounded-3xl border border-[#e1d9d2] bg-white p-6 shadow-sm sm:p-10"><Link href="/" className="text-sm font-semibold text-[#2e2877] hover:underline">← Back to Kanvise</Link><div className="mt-8"><MarkdownDocument source={terms} /></div></article></main>;
}
