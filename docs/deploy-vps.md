# Deploy na VPS (Docker) e arquivos no disco

O sistema roda numa VPS com Docker desde 09/11/2026 (antes era na Vercel).
O banco e o login continuam no Supabase. Os arquivos (fotos da OS, PDFs,
planilhas) ficam só no disco da VPS: o sistema não consulta mais o
Supabase Storage.

```
Internet ─▶ nginx do servidor (HTTPS, certbot) ─▶ 127.0.0.1:8081
              :8081  web   (nginx)  ─▶ app:3000
              :3001  app   (Next)   ─▶ Supabase (banco, login)
                                    └▶ /srv/copiloto-arp/arquivos (volume)
                     cron  (alpine) ─▶ app:3000/api/sync/*, /api/cron/*
```

| Serviço | Porta (servidor → contêiner) | O que faz |
|---|---|---|
| `app` | 3001 → 3000 | o sistema (Next em modo standalone) |
| `web` | 8081 → 80 | nginx na frente: limite de envio, tempo das rotinas, streaming |
| `cron` | — | as 8 rotinas diárias que eram do Vercel Cron (`deploy/cron/crontab`) |

A porta 3001 fala com o Next direto, sem o nginx. Deixe aberta só se outro
serviço precisar dela; o caminho do público é o HTTPS → 8081.

## Onde está, hoje

| O quê | Onde |
|---|---|
| Código (branch `main`) | `/var/www/copiloto-arp` |
| Variáveis | `/var/www/copiloto-arp/.env` (fora do Git) |
| Arquivos | `/srv/copiloto-arp/arquivos` (dono uid 1001, o usuário do contêiner) |
| HTTPS | nginx do servidor, `/etc/nginx/sites-available/arp.copiloto.scaleia.ai`, proxy para `127.0.0.1:8081` com `proxy_read_timeout 330s` e `proxy_buffering off` |

## Dia a dia

```sh
cd /var/www/copiloto-arp
git pull && docker compose up -d --build        # atualizar (o build leva minutos)
docker compose ps                               # app "healthy"
docker compose logs -f app                      # logs do sistema
docker compose logs cron                        # resultado das rotinas
docker compose exec cron sh /etc/copiloto/chamar.sh /api/cron/os   # rodar uma rotina agora
du -sh /srv/copiloto-arp/arquivos               # espaço usado
```

## Requisitos (para montar outra VPS)

- Linux x64 com Docker Engine 24+ e o plugin `docker compose`; 2 vCPU e
  4 GB de memória (ou swap) para o build.
- **Em São Paulo, de preferência.** O Supabase está em `sa-east-1`; cada
  consulta ao banco saindo de longe custa dezenas a centenas de ms.
- **HTTPS na frente da 8081.** Os cookies de sessão são `secure` em
  produção: por `http://ip:8081` o login não se mantém. O proxy do HTTPS
  precisa de `client_max_body_size` de 30 MB ou mais, tempo de leitura de
  330 s e `proxy_buffering off`.
- Disco para os arquivos com folga e **backup fora da VPS** (abaixo).

### Montar do zero

```sh
cd /var/www
git clone -b main https://github.com/matheuscrvlh-scaleia/copiloto-arp.git
cd copiloto-arp
cp .env.example .env && nano .env              # valores de produção

mkdir -p /srv/copiloto-arp/arquivos
chown -R 1001:1001 /srv/copiloto-arp/arquivos  # usuário do contêiner

docker compose up -d --build
curl -s localhost:8081/api/saude               # {"ok":true}
```

No `.env`, além do Supabase, sessão e integrações:

| Variável | Valor |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://arp.copiloto.scaleia.ai` (links do WhatsApp e dos arquivos) |
| `ARQUIVOS_CHAVE` | 32 bytes em base64 (comando no `.env.example`) |
| `ARQUIVOS_HOST_DIR` | `/srv/copiloto-arp/arquivos` |
| `CRON_SECRET` | segredo das rotinas |

`ARQUIVOS_DIR` não precisa ir no `.env`: o `docker-compose.yml` já define
`/dados/arquivos` dentro do contêiner. Para restaurar arquivos numa VPS
nova, copie o backup para a pasta antes do `docker compose up`.

## Migração do Supabase Storage (feita em 09/11/2026)

Os 49 arquivos que estavam no Supabase Storage (14 de importações e 35 da
OS) foram copiados e conferidos com `scripts/migrar-arquivos.mjs`
(tamanho, MD5 do Supabase e SHA-256 gravado). Depois disso o código deixou
de consultar o Supabase Storage.

A cópia de lá ficou intacta, como backup. Para conferir de novo se tudo o
que está no Supabase também está no disco:

```sh
docker compose exec app node scripts/migrar-arquivos.mjs --conferir
```

Se aparecer `falta` (algo enviado pela Vercel depois da migração), rode a
cópia, que pula o que já existe e nunca sobrescreve:

```sh
docker compose exec app node scripts/migrar-arquivos.mjs
```

**Apagar do Supabase Storage é opcional e decisão do dono.** Só depois de
16/11/2026 (os laudos de vistoria enviados pelo WhatsApp antes da virada
levam link do Supabase que vale 7 dias) e com o backup do disco testado.
Pelo painel do Supabase (Storage), bucket por bucket.

## Backup dos arquivos

O disco da VPS é a cópia principal. Backup diário para fora da VPS, da
pasta inteira (inclui `.meta`, com tipo e SHA-256 de cada arquivo; pode
excluir `.tmp`). Exemplo com restic num bucket S3 (Backblaze B2, R2, etc.):

```sh
# /etc/cron.d/copiloto-backup  (03h, todo dia)
0 3 * * * root restic -r s3:<endpoint>/<bucket> backup /srv/copiloto-arp/arquivos --exclude .tmp --quiet
```

Teste a restauração uma vez antes de apagar algo do Supabase.

## Notas técnicas

- **Onde os arquivos ficam:** `<pasta>/<bucket>/<caminho>`, com os
  metadados em `<pasta>/.meta/<bucket>/<caminho>.json`. São os mesmos
  buckets e caminhos que existiam no Supabase, então o banco não mudou.
- **Links:** `/api/arquivos/<token>`, com HMAC-SHA256 (`ARQUIVOS_CHAVE`) e
  prazo, gerado só depois de conferida a permissão. Envio direto do
  navegador: PUT no mesmo endereço, com limite de tamanho no token.
- **Segurança dos arquivos:** saem do mesmo domínio do sistema. Só imagem,
  PDF, vídeo e texto abrem na aba; SVG, HTML e o resto sempre baixam, com
  `nosniff` e CSP `sandbox`.
- **Uma instância só:** o cache do Next fica na memória e no disco do
  contêiner, o que é o normal para uma VPS. Para rodar mais de uma cópia
  seria preciso um cache compartilhado (Redis) e a mesma
  `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` em todas.
- **`maxDuration`** das rotas não vale fora da Vercel; o limite é o do
  nginx (330 s) e o do `wget` do cron (330 s).
- **Desenvolvimento:** sem `ARQUIVOS_DIR`, os arquivos vão para
  `./dados/arquivos` (fora do Git) e, sem `ARQUIVOS_CHAVE`, os links usam
  uma chave que muda a cada reinício. Atenção: o banco de desenvolvimento
  é o de produção; um arquivo enviado localmente fica só na sua máquina.
