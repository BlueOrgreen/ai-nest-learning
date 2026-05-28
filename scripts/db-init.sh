#!/usr/bin/env bash
# 初始化 nest_user_service / nest_order_service：建库 + 导入 mysql/seeds/*.sql
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

WAIT_FOR_MYSQL=false
RESET=false

for arg in "$@"; do
  case "${arg}" in
    --wait) WAIT_FOR_MYSQL=true ;;
    --reset) RESET=true ;;
    -h | --help)
      echo "Usage: pnpm db:init [--wait] [--reset]"
      echo "  --wait   Start mysql via compose and wait until ready"
      echo "  --reset  DROP databases before import (destructive)"
      exit 0
      ;;
    *)
      echo "Unknown option: ${arg}" >&2
      exit 1
      ;;
  esac
done

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-root}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_USERNAME="${DB_USERNAME:-root}"
export MYSQL_ROOT_PASSWORD

MYSQL_DIR="${ROOT}/mysql"
SCHEMA_SQL="${MYSQL_DIR}/00-create-databases.sql"
SEEDS_DIR="${MYSQL_DIR}/seeds"

if [[ ! -f "${SCHEMA_SQL}" ]]; then
  echo "Missing ${SCHEMA_SQL}" >&2
  exit 1
fi

use_docker=false
if docker compose ps mysql 2>/dev/null | grep -qE 'running|Up'; then
  use_docker=true
fi

if [[ "${WAIT_FOR_MYSQL}" == true ]]; then
  echo "Starting mysql (and redis)..."
  docker compose up -d mysql redis
  use_docker=true
fi

mysql_exec() {
  if [[ "${use_docker}" == true ]]; then
    docker compose exec -T mysql mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" "$@"
  else
    mysql -h"${DB_HOST}" -P"${DB_PORT}" -u"${DB_USERNAME}" -p"${MYSQL_ROOT_PASSWORD}" "$@"
  fi
}

mysql_source() {
  if [[ "${use_docker}" == true ]]; then
    docker compose exec -T mysql mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" "$@"
  else
    mysql -h"${DB_HOST}" -P"${DB_PORT}" -u"${DB_USERNAME}" -p"${MYSQL_ROOT_PASSWORD}" "$@"
  fi
}

wait_for_mysql() {
  local i
  echo "Waiting for MySQL..."
  for i in $(seq 1 60); do
    if mysql_exec -e "SELECT 1" &>/dev/null; then
      echo "MySQL is ready."
      return 0
    fi
    sleep 2
  done
  echo "MySQL did not become ready in time." >&2
  exit 1
}

if [[ "${use_docker}" == true ]] || [[ "${WAIT_FOR_MYSQL}" == true ]]; then
  wait_for_mysql
elif ! command -v mysql &>/dev/null; then
  echo "mysql client not found. Start Docker MySQL first:" >&2
  echo "  docker compose up -d mysql && pnpm db:init --wait" >&2
  exit 1
fi

if [[ "${RESET}" == true ]]; then
  echo "Dropping databases nest_user_service, nest_order_service..."
  mysql_exec -e "
    SET FOREIGN_KEY_CHECKS=0;
    DROP DATABASE IF EXISTS nest_user_service;
    DROP DATABASE IF EXISTS nest_order_service;
    SET FOREIGN_KEY_CHECKS=1;
  "
fi

echo "Creating databases..."
mysql_source < "${SCHEMA_SQL}"

shopt -s nullglob
seed_files=("${SEEDS_DIR}"/*.sql)
shopt -u nullglob

if [[ ${#seed_files[@]} -eq 0 ]]; then
  echo "No seed files in ${SEEDS_DIR}" >&2
  exit 1
fi

for file in "${seed_files[@]}"; do
  db="$(basename "${file}" .sql)"
  echo "Importing ${file} -> ${db}"
  mysql_source "${db}" < "${file}"
done

echo ""
echo "Done. Databases initialized:"
echo "  - nest_user_service"
echo "  - nest_order_service"
if [[ "${use_docker}" == true ]]; then
  echo ""
  echo "Mode: docker (my-firstnest-mysql-1)"
else
  echo ""
  echo "Mode: local mysql (${DB_HOST}:${DB_PORT})"
fi
