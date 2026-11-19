import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: ["localhost", "127.0.0.1", "*.e2b.app"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: 'camera=(), microphone=(), geolocation=(), payment=(), clipboard-read=(self), clipboard-write=(self "https://*.e2b.app")' },
        ],
      },
    ];
  },
};

export default nextConfig;
