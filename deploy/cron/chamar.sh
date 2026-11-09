#!/bin/sh
# Chama uma rota do sistema como o Vercel Cron fazia: GET com
# "Authorization: Bearer <CRON_SECRET>". A saída vai para `docker compose logs cron`.
rota="$1"
inicio=$(date -u +%Y-%m-%dT%H:%M:%SZ)
if wget -q -O /dev/null -T 330 \
  --header "Authorization: Bearer $(cat /run/cron-secret)" \
  "http://app:3000$rota"; then
  echo "$inicio ok $rota"
else
  echo "$inicio FALHOU $rota (wget saiu com $?)"
fi
