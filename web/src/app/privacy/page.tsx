import type { Metadata } from "next";
import { readFileSync } from "node:fs";
import path from "node:path";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | Kanvise",
  description: "How Kanvise collects, uses, shares, and protects personal data.",
  alternates: { canonical: "/privacy" },
  robots: { index: true, follow: true },
};

function getPolicy() {
  return readFileSync(path.join(process.cwd(), "public", "privacy-policy.md"), "utf8");
}

export default function PrivacyPolicyPage() {
  const policy = getPolicy();

  return (
    <main className="min-h-screen bg-[#f7f5f2] px-5 py-10 text-[#25202d] sm:px-8 sm:py-16">
      <article className="mx-auto max-w-4xl rounded-3xl border border-[#e1d9d2] bg-white p-6 shadow-sm sm:p-10">
        <Link href="/" className="text-sm font-semibold text-[#2e2877] hover:underline">
          ← Back to Kanvise
        </Link>
        <pre className="mt-8 whitespace-pre-wrap font-sans text-sm leading-7 text-[#474551] sm:text-[15px]">
          {policy}
        </pre>
      </article>
    </main>
  );
}
