import { describe, expect, it } from "vitest";
import conf from "../nginx.conf?raw";

// O Cache-Control que o nginx do contêiner escreve (apps/web/nginx.conf).
// O teste lê o `map` do arquivo e aplica as regras como o nginx: as
// expressões regulares na ordem em que aparecem; sem nenhuma, o `default`.
// Não substitui `nginx -t`, mas segura a regra que importa: cache longo só
// para resposta boa de arquivo do build.

interface Regra {
  padrao: string;
  valor: string;
}

function regrasDoMapa(cabecalho: string): Regra[] {
  const inicio = conf.indexOf(`map ${cabecalho} {`);
  if (inicio < 0) throw new Error(`map ${cabecalho} não está no nginx.conf`);
  const corpo = conf.slice(conf.indexOf("{", inicio) + 1);
  return corpo
    .slice(0, corpo.indexOf("}"))
    .split("\n")
    .map((linha) => linha.trim())
    .filter((linha) => linha && !linha.startsWith("#"))
    .map((linha) => {
      const [, padrao, valor] = /^(\S+)\s+(.+);$/.exec(linha) ?? [];
      if (!padrao || valor === undefined)
        throw new Error(`linha do map fora do formato: ${linha}`);
      return { padrao, valor: valor.replace(/^"(.*)"$/, "$1") };
    });
}

function aplicar(regras: Regra[], chave: string): string {
  for (const { padrao, valor } of regras)
    if (padrao.startsWith("~") && new RegExp(padrao.slice(1)).test(chave))
      return valor;
  const padrao = regras.find((r) => r.padrao === "default");
  if (!padrao) throw new Error("map sem default");
  return padrao.valor;
}

const CACHE = regrasDoMapa('"$status:$uri" $arp_cache');
const cacheDe = (status: number, uri: string) =>
  aplicar(CACHE, `${status}:${uri}`);

describe("nginx.conf: Cache-Control", () => {
  it("arquivo do build que existe: um ano, imutável", () => {
    const longo = "public, max-age=31536000, immutable";
    expect(cacheDe(200, "/assets/index-abc123.js")).toBe(longo);
    expect(cacheDe(304, "/assets/index-abc123.js")).toBe(longo);
    expect(cacheDe(206, "/assets/video-abc123.mp4")).toBe(longo);
  });

  it("arquivo do build que não existe (404) nunca fica guardado", () => {
    expect(cacheDe(404, "/assets/index-velho.js")).toBe("no-store");
    expect(cacheDe(403, "/assets/")).toBe("no-store");
    expect(cacheDe(500, "/assets/index-abc123.js")).toBe("no-store");
    expect(cacheDe(404, "/brand/logo-que-nao-existe.svg")).toBe("no-store");
  });

  it("marca: um dia, só quando existe", () => {
    expect(cacheDe(200, "/brand/logo.svg")).toBe("public, max-age=86400");
  });

  it("index.html e os endereços de tela: o navegador sempre confere", () => {
    // Endereço de tela cai em /index.html (try_files): é esse o $uri.
    for (const uri of ["/index.html", "/tema.js", "/icon.png", "/saude-web"])
      expect(cacheDe(200, uri)).toBe("no-cache");
    expect(cacheDe(304, "/index.html")).toBe("no-cache");
  });

  it("/api: vale o cabeçalho da API; sem resposta dela, no-store", () => {
    for (const status of [200, 401, 404, 502, 504])
      expect(cacheDe(status, "/api/v1/auth/eu")).toBe("$arp_cache_api");
    const daApi = regrasDoMapa("$upstream_http_cache_control $arp_cache_api");
    expect(daApi).toEqual([
      { padrao: '""', valor: "no-store" },
      { padrao: "default", valor: "" },
    ]);
  });

  it("o cabeçalho é escrito uma vez, no server, e a API não é guardada", () => {
    expect(conf.match(/add_header Cache-Control/g)).toHaveLength(1);
    expect(conf).toContain("add_header Cache-Control $arp_cache always;");
    expect(conf).toContain("proxy_cache off;");
    // 404 de verdade em /assets/, nunca o index.html no lugar de um .js.
    expect(conf).toMatch(/location \/assets\/ \{\s*try_files \$uri =404;/);
  });
});
