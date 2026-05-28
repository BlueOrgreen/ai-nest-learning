#!/bin/bash
# Docker 首次初始化（空数据卷）时由 entrypoint 调用；本地开发请用: pnpm db:init
set -euo pipefail

seeds_dir="/docker-entrypoint-initdb.d/seeds"

import_if_exists() {
  local db="$1"
  local file="$2"
  if [[ -f "${file}" ]]; then
    echo "[mysql] Importing ${file} -> ${db}"
    mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" "${db}" < "${file}"
  fi
}

import_if_exists nest_user_service "${seeds_dir}/nest_user_service.sql"
import_if_exists nest_order_service "${seeds_dir}/nest_order_service.sql"
