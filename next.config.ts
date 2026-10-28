import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Geolocalização só no próprio site: o terceirizado registra onde estava
  // ao tocar "Cheguei" e "Terminei" no link da OS (se ele permitir).
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self)",
  },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Perfis de cache dos dados (src/server/cache.ts). Toda gravação chama
  // updateTag na tag do que mudou; o tempo é só a rede de segurança.
  cacheLife: {
    // Perfil e permissões de quem está logado.
    sessao: { stale: 60, revalidate: 60, expire: 300 },
    // Configuração dos módulos: setores, catálogo, parâmetros, empresa.
    referencia: { stale: 300, revalidate: 3600, expire: 86400 },
  },
  poweredByHeader: false,
  experimental: {
    // Envio do Extrato Mensal (PDF) pela Server Action da folha.
    serverActions: { bodySizeLimit: "10mb" },
  },
  // Telas que viraram abas ou filtros (links e favoritos antigos).
  redirects() {
    return [
      {
        source: "/os/abertos-por-mim",
        destination: "/os?aberto_por=eu",
        permanent: false,
      },
      {
        source: "/os/configuracoes/modelos",
        destination: "/os/modelos",
        permanent: false,
      },
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
