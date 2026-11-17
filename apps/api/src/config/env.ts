import { z } from "zod";

// Variáveis de ambiente da API, validadas na subida: faltou ou está errada,
// o processo não sobe e diz qual (nunca o valor). Modelo em .env.example.

const bytesEmBase64 = (v: string) => Buffer.from(v, "base64").length;

/** Chave de exatamente 32 bytes em base64 (AES-256 e HMAC-SHA256). */
const chave32 = z
  .string()
  .trim()
  .refine((v) => bytesEmBase64(v) === 32, "precisa ter 32 bytes em base64");

const inteiro = (padrao: number, min: number, max: number) =>
  z.coerce.number().int().min(min).max(max).default(padrao);

const esquema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    HOST: z.string().min(1).default("127.0.0.1"),
    PORT: inteiro(3000, 1, 65535),
    /** Endereço público do sistema: origem aceita nas gravações e base dos links. */
    SITE_URL: z.url().transform((v) => new URL(v).origin),
    /** Papel `arp_api` (LOGIN NOINHERIT): sozinho não lê nada. */
    DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, "URL do Postgres"),
    BANCO_CONEXOES: inteiro(10, 1, 100),
    /** Assina o JWT de acesso (HS256): no mínimo 32 bytes em base64. */
    JWT_CHAVE: z
      .string()
      .trim()
      .refine(
        (v) => bytesEmBase64(v) >= 32,
        "precisa ter no mínimo 32 bytes em base64",
      ),
    /** Cofre das credenciais das integrações (AES-256-GCM). */
    INTEGRACOES_CHAVE: chave32,
    /** Assina os links dos arquivos (HMAC-SHA256). */
    ARQUIVOS_CHAVE: chave32,
    ARQUIVOS_DIR: z.string().trim().min(1).optional(),
    /** "0" desliga as rotinas agendadas (testes, segunda instância). */
    AGENDADOR: z
      .enum(["0", "1"])
      .default("1")
      .transform((v) => v === "1"),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    /**
     * De quem a API aceita X-Forwarded-For/Proto: o nginx do host e o do
     * contêiner web (loopback e redes privadas do Docker).
     */
    PROXIES_CONFIAVEIS: z
      .string()
      .default("127.0.0.0/8,::1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16")
      .transform((v) =>
        v
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    /** Erros de senha do mesmo e-mail e IP, na janela, antes de bloquear. */
    LOGIN_TENTATIVAS: inteiro(10, 1, 1000),
    LOGIN_JANELA_MINUTOS: inteiro(15, 1, 1440),
    // Acesso das integrações quando não há credencial salva na tela
    // (Administração › Integrações). Opcionais.
    SECULLUM_USUARIO: z.string().min(1).optional(),
    SECULLUM_SENHA: z.string().min(1).optional(),
    SECULLUM_BANCO_ID: z.string().min(1).optional(),
    WPS_BASE_URL: z.url().optional(),
    WPS_USUARIO: z.string().min(1).optional(),
    WPS_SENHA: z.string().min(1).optional(),
    WPS_ESTACIONAMENTO_ID: z.coerce.number().int().positive().optional(),
    COPILOTO_RH_BASE_URL: z.url().optional(),
    COPILOTO_RH_USUARIO: z.string().min(1).optional(),
    COPILOTO_RH_SENHA: z.string().min(1).optional(),
    ANTHROPIC_API_KEY: z.string().min(1).optional(),
    CLAUDE_MODELO: z.string().min(1).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.NODE_ENV !== "production") return;
    if (!v.SITE_URL.startsWith("https://"))
      ctx.addIssue({
        code: "custom",
        path: ["SITE_URL"],
        message: "em produção precisa ser https",
      });
    if (!v.ARQUIVOS_DIR)
      ctx.addIssue({
        code: "custom",
        path: ["ARQUIVOS_DIR"],
        message: "obrigatória em produção",
      });
  });

export type Env = Omit<z.infer<typeof esquema>, "ARQUIVOS_DIR"> & {
  ARQUIVOS_DIR: string;
  /**
   * Cookies com `Secure` e prefixos `__Host-`/`__Secure-`: sempre que o site
   * é https (produção e homologação). Em http (desenvolvimento local) o
   * navegador recusaria esses cookies, então saem sem prefixo e sem Secure.
   */
  COOKIES_SEGUROS: boolean;
};

export function lerEnv(fonte: Record<string, string | undefined>): Env {
  const r = esquema.safeParse(fonte);
  if (!r.success) {
    const linhas = r.error.issues.map(
      (i) => `  ${i.path.join(".") || "(env)"}: ${i.message}`,
    );
    throw new Error(
      `Configuração inválida (apps/api/.env):\n${linhas.join("\n")}`,
    );
  }
  return {
    ...r.data,
    ARQUIVOS_DIR: r.data.ARQUIVOS_DIR ?? "./dados/arquivos",
    COOKIES_SEGUROS: r.data.SITE_URL.startsWith("https://"),
  };
}

export const env = lerEnv(process.env);
