#!/bin/sh
# Sobe o crond com as rotinas diárias (deploy/cron/crontab). O CRON_SECRET
# vem do .env pelo docker compose e fica num arquivo só do root.
set -eu
: "${CRON_SECRET:?defina CRON_SECRET no .env}"
umask 077
printf '%s' "$CRON_SECRET" > /run/cron-secret
cp /etc/copiloto/crontab /etc/crontabs/root
echo "cron: $(grep -c '^[0-9]' /etc/crontabs/root) rotinas, horário UTC"
exec crond -f -d 8
