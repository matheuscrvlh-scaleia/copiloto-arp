import { randomBytes } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { carregarAmbiente } from "./ambiente";

// Roda antes de cada arquivo de teste, antes de qualquer import do código:
// monta o ambiente. Com apps/api/.env, vale o banco de homologação; sem
// ele, entram valores de mentira para os testes de unidade rodarem (os de
// integração são pulados: ver banco-disponivel.ts).

carregarAmbiente();

const chave = () => randomBytes(32).toString("base64");
process.env.SITE_URL ??= "http://localhost:5173";
process.env.DATABASE_URL ??= "postgres://ninguem:nada@127.0.0.1:1/nada";
process.env.JWT_CHAVE ??= chave();
process.env.INTEGRACOES_CHAVE ??= chave();
process.env.ARQUIVOS_CHAVE ??= chave();

// Sempre, mesmo com .env: teste não grava na pasta de arquivos de verdade,
// não liga rotinas, não enche o terminal e bloqueia o login cedo (o teste
// do limite precisa de poucas tentativas).
process.env.NODE_ENV = "test";
process.env.ARQUIVOS_DIR = path.join(os.tmpdir(), `arp-testes-${process.pid}`);
process.env.AGENDADOR = "0";
process.env.LOG_LEVEL = "silent";
process.env.LOGIN_TENTATIVAS = "3";
