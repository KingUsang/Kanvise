import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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

export default nextConfig;
