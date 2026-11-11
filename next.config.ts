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
  // Imagem Docker enxuta para a VPS (Dockerfile, docs/deploy-vps.md).
  output: "standalone",
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
        source: "/os/modelos",
        destination: "/os/disparos",
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
      // Endomarketing virou Planejamento orçamentário (07/11/2026).
      {
        source: "/rh/endomarketing",
        destination: "/rh/planejamento-orcamentario",
        permanent: false,
      },
      {
        source: "/rh/beneficios",
        destination: "/rh/configuracoes/cadastros#beneficios",
        permanent: false,
      },
      // Diário de Obra entrou na tela única de Obras (11/11/2026).
      {
        source: "/operacoes/diario",
        destination: "/operacoes/obras",
        permanent: false,
      },
      {
        source: "/operacoes/obras/diario",
        destination: "/operacoes/obras",
        permanent: false,
      },
      {
        source: "/operacoes/diario/:path+",
        destination: "/operacoes/obras/diario/:path+",
        permanent: false,
      },
      // Cadastros, Importações e Parâmetros de Operações viraram abas de
      // Configurações (11/11/2026); o ?tipo= segue junto.
      {
        source: "/operacoes/importacoes/nova",
        destination: "/operacoes/configuracoes/importacoes",
        permanent: false,
      },
      ...["importacoes", "cadastros", "parametros"].flatMap((aba) => [
        {
          source: `/operacoes/${aba}`,
          destination: `/operacoes/configuracoes/${aba}`,
          permanent: false,
        },
        {
          source: `/operacoes/${aba}/:path+`,
          destination: `/operacoes/configuracoes/${aba}/:path+`,
          permanent: false,
        },
      ]),
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
