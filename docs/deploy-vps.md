# Deploy na VPS (Docker) e migração dos arquivos

O sistema sai da Vercel e roda numa VPS com Docker. O banco e o login
continuam no Supabase. Os arquivos (fotos da OS, PDFs, planilhas) passam a
ficar no disco da VPS em vez do Supabase Storage.

```
Internet ─▶ HTTPS (proxy do servidor ou Cloudflare)
              └▶ :8081  web   (nginx)  ─▶ app:3000
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

## Requisitos

- Linux x64 com Docker Engine 24+ e o plugin `docker compose`.
- **Em São Paulo.** O Supabase está em `sa-east-1`; cada consulta ao banco
  saindo de outra região custa ~120 ms, e uma tela faz várias.
- **HTTPS na frente da 8081.** Os cookies de sessão são `secure` em
  produção: por `http://ip:8081` o login não se mantém. Use o proxy que o
  servidor já tem (Caddy, nginx, Traefik) ou o Cloudflare, apontando para
  `http://127.0.0.1:8081`.
- Disco para os arquivos com folga e **backup fora da VPS** (abaixo).

## Primeira subida

```sh
# 1. Código (branch develop até ser aprovado; depois main)
sudo mkdir -p /srv/copiloto-arp && cd /srv/copiloto-arp
git clone -b develop <repo> app && cd app

# 2. Variáveis: copie as de produção da Vercel e complete as novas
cp .env.example .env && nano .env

# 3. Pasta dos arquivos, do usuário do contêiner (uid 1001)
sudo mkdir -p /srv/copiloto-arp/arquivos
sudo chown -R 1001:1001 /srv/copiloto-arp/arquivos

# 4. Sobe (o build leva alguns minutos)
docker compose up -d --build

# 5. Confere
docker compose ps                          # app "healthy"
curl -s localhost:8081/api/saude           # {"ok":true}
docker compose logs --tail=50 app cron
```

No `.env`, além das variáveis que já estão na Vercel:

| Variável | Valor |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://<domínio da VPS>` (links do WhatsApp e dos arquivos) |
| `ARQUIVOS_CHAVE` | 32 bytes em base64, novo (comando no `.env.example`) |
| `ARQUIVOS_HOST_DIR` | `/srv/copiloto-arp/arquivos` |
| `ARQUIVOS_RESERVA_SUPABASE` | vazio na transição; `0` no fim |
| `CRON_SECRET` | o mesmo da Vercel ou um novo |

`ARQUIVOS_DIR` não precisa ir no `.env`: o `docker-compose.yml` já define
`/dados/arquivos` dentro do contêiner.

Depois que o domínio responder:

1. **Supabase › Authentication › URL Configuration:** trocar o Site URL e
   incluir o domínio novo nas Redirect URLs (senão, o e-mail de definir
   senha leva para o endereço antigo).
2. **Integrações com OAuth** (RD Station CRM e Marketing, Google, TikTok):
   se o domínio mudou, cadastrar o endereço de retorno novo no painel de
   cada uma e conectar de novo em Administração › Integrações.
3. **Vercel:** desligar os Crons do projeto (ou o projeto inteiro) depois
   da virada, para as rotinas não rodarem duas vezes.

## Migração dos arquivos, sem perder nada

Princípio: **o Supabase continua com tudo até o fim.** O script só copia e
confere; nunca apaga nem altera nada lá. Hoje são 49 arquivos (14 de
importações e 35 da OS, em 09/11/2026).

**Fase 1 — subir com a reserva ligada.** Com a VPS no ar, tudo que é
enviado vai para o disco. O que ainda não está no disco é lido do Supabase
sem ninguém perceber (e, quando é lido inteiro, já fica copiado).

**Fase 2 — copiar.**

```sh
docker compose exec app node scripts/migrar-arquivos.mjs --simular   # o que faria
docker compose exec app node scripts/migrar-arquivos.mjs             # copia
```

Para cada arquivo: baixa pela service role, confere o tamanho e o MD5
(eTag do Supabase), grava num arquivo temporário, sincroniza com o disco e
só então põe no lugar, sem sobrescrever nada. Pode rodar quantas vezes
quiser: o que já está no disco é pulado. Sai com código 1 se algo falhou;
o relatório fica em `/srv/copiloto-arp/arquivos/.migracao/`.

**Fase 3 — virar o DNS e copiar de novo.** O que alguém enviou pela
Vercel até a virada está só no Supabase: rode a Fase 2 mais uma vez depois
que o DNS apontar para a VPS.

**Fase 4 — conferir.**

```sh
docker compose exec app node scripts/migrar-arquivos.mjs --conferir
```

Confere, para cada arquivo do Supabase, se está no disco com o mesmo
tamanho e se o conteúdo bate com o SHA-256 gravado. Tudo `ok` é a condição
para seguir.

**Fase 5 — desligar a reserva** (uns 30 dias depois, com backup rodando):
`ARQUIVOS_RESERVA_SUPABASE=0` no `.env` e `docker compose up -d`. Nos dias
seguintes, procurar `não encontrado` em `docker compose logs app`.

**Fase 6 — apagar do Supabase (opcional, decisão do dono).** Só depois do
backup conferido e de 7 dias da Fase 3: os laudos de vistoria enviados pelo
WhatsApp antes da virada levam link do Supabase que vale 7 dias. Apagar
pelo painel do Supabase (Storage), bucket por bucket.

### Voltar para a Vercel

Até a Fase 5, é trocar o DNS de volta: a Vercel continua lendo do
Supabase. Só os arquivos enviados na VPS nesse intervalo ficam de fora
(estão no disco, não no Supabase) e teriam de ser reenviados à mão. Por
isso a virada deve ser curta e combinada.

## Backup dos arquivos

Depois da Fase 6 o disco é a única cópia. Backup diário para fora da VPS,
da pasta inteira (inclui `.meta`, com tipo e SHA-256 de cada arquivo; pode
excluir `.tmp`). Exemplo com restic num bucket S3 (Backblaze B2, R2, etc.):

```sh
# /etc/cron.d/copiloto-backup  (03h, todo dia)
0 3 * * * root restic -r s3:<endpoint>/<bucket> backup /srv/copiloto-arp/arquivos --exclude .tmp --quiet
```

Teste a restauração uma vez antes da Fase 6.

## Dia a dia

```sh
cd /srv/copiloto-arp/app
git pull && docker compose up -d --build        # atualizar (alguns segundos fora do ar)
docker compose logs -f app                      # logs do sistema
docker compose logs cron                        # resultado das rotinas
docker compose exec cron sh /etc/copiloto/chamar.sh /api/cron/os   # rodar uma rotina agora
du -sh /srv/copiloto-arp/arquivos               # espaço usado
```

## Notas técnicas

- **Onde os arquivos ficam:** `<pasta>/<bucket>/<caminho>`, com os
  metadados em `<pasta>/.meta/<bucket>/<caminho>.json`. São os mesmos
  buckets e caminhos do Supabase, então o banco não muda.
- **Links:** `/api/arquivos/<token>`, com HMAC-SHA256 (`ARQUIVOS_CHAVE`) e
  prazo, gerado só depois de conferida a permissão. Envio direto do
  navegador: PUT no mesmo endereço, com limite de tamanho no token.
- **Segurança dos arquivos:** agora saem do mesmo domínio do sistema. Só
  imagem, PDF, vídeo e texto abrem na aba; SVG, HTML e o resto sempre
  baixam, com `nosniff` e CSP `sandbox`.
- **Uma instância só:** o cache do Next fica na memória e no disco do
  contêiner, o que é o normal para uma VPS. Para rodar mais de uma cópia
  seria preciso um cache compartilhado (Redis) e a mesma
  `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` em todas.
- **`maxDuration`** das rotas não vale fora da Vercel; o limite passa a ser
  o do nginx (330 s) e o do `wget` do cron (330 s).
- **Desenvolvimento** continua igual: sem `ARQUIVOS_DIR`, os arquivos vão
  para o Supabase Storage. Para testar o disco local, defina
  `ARQUIVOS_DIR=./dados/arquivos` e `ARQUIVOS_CHAVE` no `.env.local`.
