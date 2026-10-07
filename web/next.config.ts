import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost", "172.24.91.206"],
  experimental: {
    // The CLI-backed checker can lose `tsc --showConfig` output under some
    // Node/Next combinations. The compiler API performs the same check without
    // spawning that fragile subprocess.
    useTypeScriptCli: false,
  },
  async headers() {
    return [{
      source: '/sw.js',
      headers: [
        { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'" },
        { key: 'Service-Worker-Allowed', value: '/' },
      ],
    }]
  },
};

export default withSentryConfig(nextConfig, {
  org: "kanvise",
  project: "kanvise-web",
  silent: !process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
});
