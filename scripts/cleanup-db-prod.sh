#!/usr/bin/env bash
# =============================================================================
# cleanup-db-prod.sh – Vyčistí produkční DB: smaže transakční data,
#                      ponechá jen admina (id=1) a číselníky (settings,
#                      artwork_types).
#
# Použití (na produkčním serveru):
#   sudo -u www-data bash /var/www/gallerouch/scripts/cleanup-db-prod.sh
#   # nebo ručně se zadáním hesla:
#   bash /var/www/gallerouch/scripts/cleanup-db-prod.sh --db-password 'HESLO'
# =============================================================================
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/gallerouch}"
DB_HOST="127.0.0.1"
DB_PORT="5432"
DB_NAME="gallerouch"
DB_USER="gallerouch"
DB_PASSWORD=""

# ---------------------------------------------------------------------------
# Načti heslo z deploy-config nebo backend/.env (pokud nebylo zadáno ručně)
# ---------------------------------------------------------------------------
load_password() {
  local deploy_cfg="$APP_DIR/.deploy-config"
  local env_file="$APP_DIR/backend/.env"

  if [[ -n "$DB_PASSWORD" ]]; then
    return  # bylo zadáno přes --db-password
  fi

  # 1) .deploy-config
  if [[ -f "$deploy_cfg" ]]; then
    local url
    url=$(grep -E '^DATABASE_URL=' "$deploy_cfg" 2>/dev/null | cut -d'=' -f2- || true)
    if [[ -n "$url" ]]; then
      # postgres://user:password@host:port/db
      DB_PASSWORD=$(echo "$url" | sed -E 's|postgres://[^:]+:([^@]+)@.*|\1|')
    fi
  fi

  # 2) backend/.env
  if [[ -z "$DB_PASSWORD" && -f "$env_file" ]]; then
    local url
    url=$(grep -E '^DATABASE_URL=' "$env_file" 2>/dev/null | cut -d'=' -f2- || true)
    if [[ -n "$url" ]]; then
      DB_PASSWORD=$(echo "$url" | sed -E 's|postgres://[^:]+:([^@]+)@.*|\1|')
    fi
  fi

  if [[ -z "$DB_PASSWORD" ]]; then
    echo "CHYBA: Nelze načíst DB heslo. Zadejte ho ručně přes --db-password." >&2
    exit 1
  fi
}

# ---------------------------------------------------------------------------
# Parsování argumentů
# ---------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --db-password) DB_PASSWORD="$2"; shift 2 ;;
    --db-host)     DB_HOST="$2";     shift 2 ;;
    --db-port)     DB_PORT="$2";     shift 2 ;;
    --db-name)     DB_NAME="$2";     shift 2 ;;
    --db-user)     DB_USER="$2";     shift 2 ;;
    --app-dir)     APP_DIR="$2";     shift 2 ;;
    -h|--help)
      echo "Použití: $0 [--db-password HESLO] [--app-dir /var/www/gallerouch]"
      exit 0
      ;;
    *) echo "Neznámý argument: $1" >&2; exit 1 ;;
  esac
done

load_password

# ---------------------------------------------------------------------------
# Potvrzení před destruktivní operací
# ---------------------------------------------------------------------------
echo "=========================================================="
echo "  VAROVÁNÍ: DESTRUKTIVNÍ OPERACE NA PRODUKČNÍ DATABÁZI"
echo "=========================================================="
echo ""
echo "  DB: $DB_NAME @ $DB_HOST:$DB_PORT"
echo ""
echo "  Bude SMAZÁNO:"
echo "    - všechna díla (artworks) + jejich events, images, payments, nabídky"
echo "    - všichni uživatelé kromě admina (id=1)"
echo "    - author_bio profily"
echo ""
echo "  Bude ZACHOVÁNO:"
echo "    - Admin (id=1)"
echo "    - settings (číselník)"
echo "    - artwork_types (číselník)"
echo "    - user_artwork_types pro admina (znovu přiřazeny)"
echo ""
read -r -p "Opravdu chcete pokračovat? Napište 'ano' a stiskněte Enter: " CONFIRM
if [[ "$CONFIRM" != "ano" ]]; then
  echo "Operace zrušena."
  exit 0
fi

echo ""
echo "Spouštím čištění databáze..."

# ---------------------------------------------------------------------------
# SQL skript
# ---------------------------------------------------------------------------
SQL=$(cat <<'EOSQL'
BEGIN;

-- 1. Artworks – CASCADE odstraní events, artwork_events, artwork_images,
--    payments, price_offers
DELETE FROM artworks;

-- 2. Author bio
DELETE FROM author_bio;

-- 3. Smazat uživatele kromě admina (CASCADE odstraní user_artwork_types)
DELETE FROM users WHERE id != 1;

-- 4. Obnovit typy děl pro admina
DELETE FROM user_artwork_types WHERE user_id = 1;
INSERT INTO user_artwork_types (user_id, artwork_type_id, approved, approved_by, approved_at)
SELECT 1, id, true, 1, NOW() FROM artwork_types;

-- 5. Resetovat sekvence
ALTER SEQUENCE artworks_id_seq RESTART WITH 1;
ALTER SEQUENCE artwork_events_id_seq RESTART WITH 1;
ALTER SEQUENCE events_id_seq RESTART WITH 1;
ALTER SEQUENCE artwork_images_id_seq RESTART WITH 1;
ALTER SEQUENCE payments_id_seq RESTART WITH 1;
ALTER SEQUENCE price_offers_id_seq RESTART WITH 1;
ALTER SEQUENCE author_bio_id_seq RESTART WITH 1;
ALTER SEQUENCE user_artwork_types_id_seq RESTART WITH 1;

SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 1));

COMMIT;

-- Ověření
SELECT tabulka, pocet FROM (
  SELECT 'users'                       AS tabulka, COUNT(*) AS pocet FROM users
  UNION ALL
  SELECT 'artworks',                              COUNT(*)              FROM artworks
  UNION ALL
  SELECT 'events',                                COUNT(*)              FROM events
  UNION ALL
  SELECT 'artwork_events',                        COUNT(*)              FROM artwork_events
  UNION ALL
  SELECT 'artwork_images',                        COUNT(*)              FROM artwork_images
  UNION ALL
  SELECT 'payments',                              COUNT(*)              FROM payments
  UNION ALL
  SELECT 'price_offers',                          COUNT(*)              FROM price_offers
  UNION ALL
  SELECT 'author_bio',                            COUNT(*)              FROM author_bio
  UNION ALL
  SELECT 'user_artwork_types (admin)',             COUNT(*)              FROM user_artwork_types WHERE user_id = 1
  UNION ALL
  SELECT 'artwork_types (zachováno)',              COUNT(*)              FROM artwork_types
  UNION ALL
  SELECT 'settings (zachováno)',                   COUNT(*)              FROM settings
) t ORDER BY tabulka;
EOSQL
)

# ---------------------------------------------------------------------------
# Spuštění
# ---------------------------------------------------------------------------
PGPASSWORD="$DB_PASSWORD" psql \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -v ON_ERROR_STOP=1 \
  <<< "$SQL"

echo ""
echo "Hotovo. Databáze vyčištěna."
