#!/bin/bash
# 仅在 MySQL 首次初始化（空数据卷）时执行；已有数据的 volume 不会再次运行
set -euo pipefail

dumps_dir="/docker-entrypoint-initdb.d/dumps"

import_if_exists() {
  local db="$1"
  local file="$2"
  if [ -f "${file}" ]; then
    echo "Importing ${file} -> ${db}"
    mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" "${db}" < "${file}"
  fi
}

import_if_exists nest_user_service "${dumps_dir}/nest_user_service.sql"
import_if_exists nest_order_service "${dumps_dir}/nest_order_service.sql"
