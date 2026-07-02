#!/usr/bin/env bash
set -euo pipefail
ssh dd 'docker tag colanode-server:prev colanode-server:dd &&
        docker tag colanode-web:prev    colanode-web:dd &&
        cd ~/colanode && docker compose -f docker-compose.prod.yml up -d'
curl -fsS https://chat.kvotaflow.ru/config >/dev/null && echo "rolled back"
