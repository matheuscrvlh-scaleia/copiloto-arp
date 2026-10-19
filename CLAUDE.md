@AGENTS.md

# copiloto-arp

Visão geral, stack e arquitetura: ver README.md.

- Conectores de sistemas externos não importam nada do Next.
- Credenciais e `service_role` só no servidor; nunca `NEXT_PUBLIC_` para segredos.
- Antes de concluir: `npm run check`.
