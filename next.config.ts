import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  experimental: {
    // Envio do Extrato Mensal (PDF) pela Server Action da folha.
    serverActions: { bodySizeLimit: "10mb" },
  },
  // Telas que viraram abas de RH › Configurações (links e favoritos antigos).
  redirects() {
    return [
      {
        source: "/rh/folha",
        destination: "/rh/configuracoes/importacoes",
        permanent: false,
      },
      {
        source: "/rh/parametros",
        destination: "/rh/configuracoes/parametros",
        permanent: false,
      },
      {
        source: "/rh/beneficios",
        destination: "/rh/configuracoes/cadastros#beneficios",
        permanent: false,
      },
    ];
  },
  headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
