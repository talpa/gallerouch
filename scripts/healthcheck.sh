#!/bin/bash
# Gallerouch production healthcheck script
# Testuje nejčastější důvody proč nefunguje backend (BE) a frontend (FE)

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

function print_ok() { echo -e "${GREEN}[OK]${NC} $1"; }
function print_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
function print_err() { echo -e "${RED}[ERR]${NC} $1"; }

# 1. PM2 stav
if sudo -u www-data env PM2_HOME=/var/www/.pm2 pm2 list | grep -q 'online'; then
  print_ok "PM2 běží a má online procesy."
else
  print_err "PM2 neběží nebo žádný proces není online!"
fi

# 2. Port backendu
if ss -ltnp | grep -q ':4777'; then
  print_ok "Port 4777 je otevřen (backend naslouchá)."
else
  print_err "Port 4777 není otevřen – backend neběží!"
fi

# 3. Test backendu přímo
if curl -s http://127.0.0.1:4777/api/test-db | grep -q 'status'; then
  print_ok "Backend API odpovídá na 127.0.0.1:4777/api/test-db."
else
  print_err "Backend API neodpovídá na 127.0.0.1:4777/api/test-db!"
fi

# 4. Test backendu přes proxy
if curl -s https://gallerouch.cz/api/test-db | grep -q 'status'; then
  print_ok "Backend API odpovídá přes proxy (https://gallerouch.cz/api/test-db)."
else
  print_err "Backend API neodpovídá přes proxy! Zkontroluj ProxyPass a certifikát."
fi

# 5. Test FE (index.html)
if curl -s https://gallerouch.cz | grep -q '<!doctype html>'; then
  print_ok "Frontend (index.html) je dostupný."
else
  print_err "Frontend (index.html) není dostupný!"
fi

# 6. Kontrola práv na backend složky
if sudo -u www-data test -r /var/www/gallerouch/backend/src/index.js; then
  print_ok "www-data má právo číst backend index.js."
else
  print_err "www-data NEMÁ právo číst backend index.js!"
fi

# 7. Kontrola spustitelnosti node
if sudo -u www-data /usr/bin/node -v >/dev/null 2>&1; then
  print_ok "www-data může spustit /usr/bin/node."
else
  print_err "www-data NEMŮŽE spustit /usr/bin/node!"
fi

# 8. Kontrola ProxyPass v Apache
if grep -q 'ProxyPass /api' /etc/apache2/sites-enabled/*.conf; then
  print_ok "ProxyPass /api je v Apache konfiguraci."
else
  print_err "ProxyPass /api chybí v Apache konfiguraci!"
fi

# 9. Kontrola HTTPS certifikátu
if openssl s_client -connect gallerouch.cz:443 -servername gallerouch.cz < /dev/null 2>/dev/null | grep -q 'Verify return code: 0 (ok)'; then
  print_ok "HTTPS certifikát je platný."
else
  print_warn "HTTPS certifikát není platný nebo je problém s SSL!"
fi

echo -e "\n${YELLOW}Zkontroluj výše uvedené chyby a varování.${NC}"
