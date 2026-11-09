#!/usr/bin/env node
// Copia os arquivos do Supabase Storage para o disco da VPS. NUNCA apaga nem
// altera nada no Supabase: lá fica a cópia de segurança até alguém decidir
// apagar à mão (docs/deploy-vps.md). Pode rodar quantas vezes quiser: o que
// já está no disco com o mesmo tamanho é pulado.
//
// Uso (na VPS, com o contêiner de pé):
//   docker compose exec app node scripts/migrar-arquivos.mjs              copia o que falta
//   docker compose exec app node scripts/migrar-arquivos.mjs --simular    só lista o que faria
//   docker compose exec app node scripts/migrar-arquivos.mjs --conferir   confere tudo (não baixa)
//   ... --bucket=os                                                       só um bucket
//
// Lê do ambiente NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e
// ARQUIVOS_DIR. Grava no disco com a mesma organização de
// src/server/arquivos/disco.ts:
//   <raiz>/<bucket>/<caminho>  e  <raiz>/.meta/<bucket>/<caminho>.json
// O relatório de cada execução fica em <raiz>/.migracao/<data>.jsonl.
// Sai com código 1 se algum arquivo faltar, divergir ou falhar.

import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const conferir = args.includes("--conferir");
const simular = args.includes("--simular");
const soBucket = args.find((a) => a.startsWith("--bucket="))?.slice(9);
const CONCORRENCIA = 4;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const raiz = process.env.ARQUIVOS_DIR?.trim();
if (!url || !chave || !raiz) {
  console.error(
    "Defina NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e ARQUIVOS_DIR.",
  );
  process.exit(2);
}
const base = path.resolve(raiz);
const autorizacao = { Authorization: `Bearer ${chave}`, apikey: chave };

const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));

/** Chamada à API do Storage, com até 4 tentativas em falha de rede/5xx/429. */
async function api(rota, init = {}) {
  for (let tentativa = 1; ; tentativa++) {
    let r;
    let falha;
    try {
      r = await fetch(`${url}/storage/v1${rota}`, {
        ...init,
        headers: { ...autorizacao, ...init.headers },
      });
      if (r.ok) return r;
      falha = `${r.status} ${(await r.text().catch(() => "")).slice(0, 200)}`;
    } catch (e) {
      falha = String(e);
    }
    const definitiva = r && r.status < 500 && r.status !== 429;
    if (definitiva || tentativa >= 4)
      throw new Error(`${init.method ?? "GET"} ${rota}: ${falha}`);
    await esperar(1000 * 2 ** tentativa);
  }
}

const rotaDoObjeto = (bucket, caminho) =>
  `/object/${encodeURIComponent(bucket)}/${caminho
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;

/** Mesma regra de src/server/arquivos/caminho.ts (caminhoValido). */
function caminhoValido(c) {
  if (!c || c.length > 1024 || c.startsWith("/")) return false;
  for (const ch of c) {
    const n = ch.charCodeAt(0);
    if (n < 32 || n === 127 || ch === "\\") return false;
  }
  return c
    .split("/")
    .every((s) => s.length > 0 && s.length <= 255 && !s.startsWith("."));
}

async function listarBuckets() {
  const r = await api("/bucket");
  return (await r.json()).map((b) => b.id).sort();
}

/** Todos os objetos do bucket, descendo nas pastas. */
async function listarObjetos(bucket, prefixo = "", saida = []) {
  for (let offset = 0; ; offset += 1000) {
    const r = await api(`/object/list/${encodeURIComponent(bucket)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prefix: prefixo,
        limit: 1000,
        offset,
        sortBy: { column: "name", order: "asc" },
      }),
    });
    const itens = await r.json();
    for (const i of itens) {
      const caminho = prefixo ? `${prefixo}/${i.name}` : i.name;
      if (i.id === null) await listarObjetos(bucket, caminho, saida);
      else
        saida.push({
          caminho,
          tamanho:
            typeof i.metadata?.size === "number" ? i.metadata.size : null,
          tipo: i.metadata?.mimetype ?? null,
          etag: i.metadata?.eTag ?? null,
        });
    }
    if (itens.length < 1000) return saida;
  }
}

function locais(bucket, caminho) {
  const partes = caminho.split("/");
  const dados = path.join(base, bucket, ...partes);
  const meta = `${path.join(base, ".meta", bucket, ...partes)}.json`;
  if (!dados.startsWith(base + path.sep)) throw new Error("fora da raiz");
  return { dados, meta };
}

async function sha256DoArquivo(arquivo) {
  return createHash("sha256")
    .update(await fs.readFile(arquivo))
    .digest("hex");
}

async function lerJson(arquivo) {
  try {
    return JSON.parse(await fs.readFile(arquivo, "utf8"));
  } catch {
    return null;
  }
}

async function gravarAtomico(destino, bytes, exclusivo) {
  const tmpDir = path.join(base, ".tmp");
  await fs.mkdir(tmpDir, { recursive: true });
  await fs.mkdir(path.dirname(destino), { recursive: true });
  const tmp = path.join(
    tmpDir,
    `mig-${Date.now()}-${randomBytes(6).toString("hex")}`,
  );
  try {
    await fs.writeFile(tmp, bytes, { flag: "wx", flush: true });
    // link() falha se o destino existe (nunca sobrescreve um arquivo).
    if (exclusivo) await fs.link(tmp, destino);
    else await fs.rename(tmp, destino);
  } finally {
    await fs.rm(tmp, { force: true });
  }
}

/** Um objeto: devolve o status para o relatório. */
async function processar(bucket, o) {
  if (!caminhoValido(o.caminho))
    return o.caminho.endsWith(".emptyFolderPlaceholder")
      ? { status: "ignorado" }
      : { status: "caminho_invalido" };
  const { dados, meta } = locais(bucket, o.caminho);
  const st = await fs.stat(dados).catch(() => null);

  if (conferir) {
    if (!st) return { status: "falta" };
    if (o.tamanho !== null && st.size !== o.tamanho)
      return {
        status: "divergente",
        erro: `disco ${st.size} × supabase ${o.tamanho}`,
      };
    const m = await lerJson(meta);
    if (m?.sha256 && m.sha256 !== (await sha256DoArquivo(dados)))
      return { status: "corrompido", erro: "sha256 do disco ≠ metadados" };
    return { status: "ok" };
  }

  if (st) {
    if (o.tamanho !== null && st.size !== o.tamanho)
      return {
        status: "divergente",
        erro: `disco ${st.size} × supabase ${o.tamanho}`,
      };
    return { status: "ja_estava" };
  }
  if (simular) return { status: "copiaria" };

  const r = await api(rotaDoObjeto(bucket, o.caminho));
  const bytes = new Uint8Array(await r.arrayBuffer());
  if (o.tamanho !== null && bytes.length !== o.tamanho)
    return {
      status: "erro",
      erro: `baixou ${bytes.length} de ${o.tamanho} bytes`,
    };
  // eTag de envio simples é o MD5 do conteúdo; com "-" é envio em partes.
  const etag = o.etag?.replaceAll('"', "");
  if (etag && /^[0-9a-f]{32}$/i.test(etag)) {
    const md5 = createHash("md5").update(bytes).digest("hex");
    if (md5 !== etag.toLowerCase())
      return { status: "erro", erro: "MD5 do download ≠ eTag do Supabase" };
  }
  try {
    await gravarAtomico(dados, bytes, true);
  } catch (e) {
    if (e.code === "EEXIST") return { status: "ja_estava" };
    throw e;
  }
  const registro = {
    tipo: o.tipo || "application/octet-stream",
    tamanho: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    criadoEm: new Date().toISOString(),
    origem: "supabase",
  };
  await gravarAtomico(meta, JSON.stringify(registro), false);
  return { status: "copiado" };
}

async function emParalelo(itens, n, fn) {
  let proximo = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, itens.length) }, async () => {
      while (proximo < itens.length) await fn(itens[proximo++]);
    }),
  );
}

const modo = conferir ? "conferência" : simular ? "simulação" : "cópia";
console.log(`Migração de arquivos (${modo}) → ${base}`);
await fs.mkdir(path.join(base, ".migracao"), { recursive: true });
const relatorio = path.join(
  base,
  ".migracao",
  `${new Date().toISOString().replace(/[:.]/g, "-")}-${conferir ? "conferir" : simular ? "simular" : "copiar"}.jsonl`,
);
const linhas = [];
const total = {};
let ruins = 0;

const buckets = (await listarBuckets()).filter(
  (b) => !soBucket || b === soBucket,
);
if (soBucket && !buckets.length) {
  console.error(`Bucket ${soBucket} não existe no Supabase.`);
  process.exit(2);
}
for (const bucket of buckets) {
  const objetos = await listarObjetos(bucket);
  const contagem = {};
  let bytes = 0;
  let feitos = 0;
  await emParalelo(objetos, CONCORRENCIA, async (o) => {
    let r;
    try {
      r = await processar(bucket, o);
    } catch (e) {
      r = { status: "erro", erro: String(e?.message ?? e) };
    }
    contagem[r.status] = (contagem[r.status] ?? 0) + 1;
    total[r.status] = (total[r.status] ?? 0) + 1;
    if (r.status === "copiado") bytes += o.tamanho ?? 0;
    if (
      !["ok", "ja_estava", "copiado", "copiaria", "ignorado"].includes(r.status)
    )
      ruins++;
    linhas.push(
      JSON.stringify({ bucket, caminho: o.caminho, tamanho: o.tamanho, ...r }),
    );
    if (++feitos % 200 === 0)
      console.log(`  ${bucket}: ${feitos}/${objetos.length}`);
  });
  const mb = (bytes / 1024 / 1024).toFixed(1);
  console.log(
    `${bucket}: ${objetos.length} arquivos — ${Object.entries(contagem)
      .map(([k, v]) => `${k} ${v}`)
      .join(", ")}${bytes ? ` (${mb} MB copiados)` : ""}`,
  );
}
await fs.writeFile(relatorio, linhas.join("\n") + (linhas.length ? "\n" : ""));
console.log(
  `Total: ${
    Object.entries(total)
      .map(([k, v]) => `${k} ${v}`)
      .join(", ") || "nenhum arquivo"
  }`,
);
console.log(`Relatório: ${relatorio}`);
if (ruins) {
  console.error(`${ruins} arquivo(s) com problema: veja o relatório.`);
  process.exit(1);
}
