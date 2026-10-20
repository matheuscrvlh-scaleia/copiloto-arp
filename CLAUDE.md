@AGENTS.md

# ARP Centralizador

Visão geral, stack e arquitetura: ver README.md. Integrações: docs/integracoes.md.
Especificações dos módulos (RH e Financeiro), atas e arquivos de exemplo:
`C:\Users\Matheus Carvalho\Desktop\ARP\WEB` (fora do repo; tem dados reais).

- Conectores de sistemas externos não importam nada do Next e só fazem leitura.
- Toda resposta externa passa por schema Zod antes de ser usada.
- Credenciais e `service_role` só no servidor; nunca `NEXT_PUBLIC_` para segredos.
- Nada de valor de negócio fixo no código (metas, encargos, jornadas, faixas): vira parâmetro.
- Protótipo de RH nunca grava nem mostra salário real (usa R$ 2.000,00).
- Nunca copiar dados reais de clientes, funcionários ou credenciais para o repo.
- Banco: mudanças só por nova migration em `supabase/migrations` (nunca editar uma já aplicada);
  toda tabela nova com RLS e coberta em `supabase/tests`. Modelo: docs/modelo-de-dados.md.
- Antes de concluir: `npm run check` e `npm test`.
