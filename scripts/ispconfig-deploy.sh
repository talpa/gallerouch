#!/usr/bin/env bash
set -euo pipefail

# Gallerouch deploy script for ISPConfig/Apache hosts.
# Supports first-time installation and safe updates.

MODE=""
DOMAIN="gallerouch.cz"
APP_DIR="/var/www/gallerouch"
REPO_URL=""
BRANCH="main"
RUN_USER="www-data"
RUN_GROUP="www-data"
BACKEND_PORT="4777"
PM2_NAME="gallerouch"
NODE_MAJOR="20"
DB_NAME="gallerouch"
DB_USER="gallerouch"
DB_PASSWORD=""
DB_HOST="127.0.0.1"
DB_PORT="5432"
APACHE_SITE_CONF=""
ISP_DOCROOT=""
SKIP_SYSTEM="0"
GITHUB_TOKEN=""

usage() {
  cat <<EOF
Usage:
  sudo ./scripts/ispconfig-deploy.sh install [options]
  sudo ./scripts/ispconfig-deploy.sh update [options]

Required for install:
  --repo-url URL            Git repository URL
  --db-password PASSWORD    PostgreSQL password for --db-user

Optional (for GitHub private repos):
  --github-token TOKEN      GitHub Personal Access Token (for https cloning)

Options:
  --domain DOMAIN           Domain name (default: gallerouch.cz)
  --app-dir PATH            App directory on server (default: /var/www/gallerouch)
  --branch NAME             Git branch (default: main)
  --run-user USER           Runtime user for app/pm2 (default: www-data)
  --run-group GROUP         Runtime group (default: www-data)
  --backend-port PORT       Backend port (default: 4777)
  --pm2-name NAME           PM2 process name (default: gallerouch)
  --node-major VERSION      Node major version (default: 20)
  --db-name NAME            PostgreSQL DB name (default: gallerouch)
  --db-user USER            PostgreSQL DB user (default: gallerouch)
  --db-password PASSWORD    PostgreSQL DB user password
  --db-host HOST            PostgreSQL host (default: 127.0.0.1)
  --db-port PORT            PostgreSQL port (default: 5432)
  --apache-site-conf PATH   Apache vhost file path (default: /etc/apache2/sites-available/<domain>.conf)
  --isp-docroot PATH        Existing ISPConfig web root; if set, frontend build is deployed there
  --skip-system             Skip apt/node/pm2 package setup
  -h, --help                Show this help

Examples:
  sudo ./scripts/ispconfig-deploy.sh install \
    --repo-url https://github.com/your-org/gallerouch.git \
    --domain gallerouch.cz \
    --db-password 'StrongPassword123' \
    --github-token 'ghp_xxxxxxxxxxxx' \
    --isp-docroot /var/www/clients/client1/web1/web

  sudo ./scripts/ispconfig-deploy.sh update
EOF
}

log() {
  printf "\n[%s] %s\n" "$(date +"%Y-%m-%d %H:%M:%S")" "$1"
}

die() {
  echo "ERROR: $1" >&2
  exit 1
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1"
}

get_run_user_home() {
  local home_dir
  home_dir="$(getent passwd "$RUN_USER" | cut -d: -f6)"
  [[ -n "$home_dir" ]] || die "Unable to resolve home directory for user: $RUN_USER"
  echo "$home_dir"
}

load_config() {
  local config_file="$APP_DIR/.deploy-config"
  if [[ -f "$config_file" ]]; then
    log "Loading saved configuration from $config_file"
    # Source the config file to load saved variables
    # Use subshell to prevent exiting on errors
    (
      set -a
      . "$config_file"
      set +a
    ) || true
    # Export the loaded variables
    DOMAIN="$(grep '^DOMAIN=' "$config_file" 2>/dev/null | cut -d= -f2- | tr -d "'")"
    BRANCH="$(grep '^BRANCH=' "$config_file" 2>/dev/null | cut -d= -f2- | tr -d "'")"
    RUN_USER="$(grep '^RUN_USER=' "$config_file" 2>/dev/null | cut -d= -f2- | tr -d "'")"
    RUN_GROUP="$(grep '^RUN_GROUP=' "$config_file" 2>/dev/null | cut -d= -f2- | tr -d "'")"
    BACKEND_PORT="$(grep '^BACKEND_PORT=' "$config_file" 2>/dev/null | cut -d= -f2- | tr -d "'")"
    PM2_NAME="$(grep '^PM2_NAME=' "$config_file" 2>/dev/null | cut -d= -f2- | tr -d "'")"
    NODE_MAJOR="$(grep '^NODE_MAJOR=' "$config_file" 2>/dev/null | cut -d= -f2- | tr -d "'")"
    DB_NAME="$(grep '^DB_NAME=' "$config_file" 2>/dev/null | cut -d= -f2- | tr -d "'")"
    DB_USER="$(grep '^DB_USER=' "$config_file" 2>/dev/null | cut -d= -f2- | tr -d "'")"
    DB_HOST="$(grep '^DB_HOST=' "$config_file" 2>/dev/null | cut -d= -f2- | tr -d "'")"
    DB_PORT="$(grep '^DB_PORT=' "$config_file" 2>/dev/null | cut -d= -f2- | tr -d "'")"
    ISP_DOCROOT="$(grep '^ISP_DOCROOT=' "$config_file" 2>/dev/null | cut -d= -f2- | tr -d "'")"
  fi
}

save_config() {
  local config_file="$APP_DIR/.deploy-config"
  log "Saving configuration to $config_file"
  cat > "$config_file" <<CONF
# Deployment configuration saved on $(date)
DOMAIN='$DOMAIN'
BRANCH='$BRANCH'
RUN_USER='$RUN_USER'
RUN_GROUP='$RUN_GROUP'
BACKEND_PORT='$BACKEND_PORT'
PM2_NAME='$PM2_NAME'
NODE_MAJOR='$NODE_MAJOR'
DB_NAME='$DB_NAME'
DB_USER='$DB_USER'
DB_HOST='$DB_HOST'
DB_PORT='$DB_PORT'
ISP_DOCROOT='$ISP_DOCROOT'
CONF
  chmod 600 "$config_file"
  log "Configuration saved successfully"
}

parse_args() {
  [[ $# -ge 1 ]] || { usage; exit 1; }
  MODE="$1"
  shift

  # For update mode, try to load saved config first
  if [[ "$MODE" == "update" ]] && [[ -d "$APP_DIR" ]]; then
    load_config
  fi

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --domain) DOMAIN="$2"; shift 2 ;;
      --app-dir) APP_DIR="$2"; shift 2 ;;
      --repo-url) REPO_URL="$2"; shift 2 ;;
      --branch) BRANCH="$2"; shift 2 ;;
      --run-user) RUN_USER="$2"; shift 2 ;;
      --run-group) RUN_GROUP="$2"; shift 2 ;;
      --backend-port) BACKEND_PORT="$2"; shift 2 ;;
      --pm2-name) PM2_NAME="$2"; shift 2 ;;
      --node-major) NODE_MAJOR="$2"; shift 2 ;;
      --db-name) DB_NAME="$2"; shift 2 ;;
      --db-user) DB_USER="$2"; shift 2 ;;
      --db-password) DB_PASSWORD="$2"; shift 2 ;;
      --db-host) DB_HOST="$2"; shift 2 ;;
      --db-port) DB_PORT="$2"; shift 2 ;;
      --apache-site-conf) APACHE_SITE_CONF="$2"; shift 2 ;;
      --isp-docroot) ISP_DOCROOT="$2"; shift 2 ;;
      --skip-system) SKIP_SYSTEM="1"; shift ;;
      --github-token) GITHUB_TOKEN="$2"; shift 2 ;;
      -h|--help) usage; exit 0 ;;
      *) die "Unknown argument: $1" ;;
    esac
  done

  [[ "$MODE" == "install" || "$MODE" == "update" ]] || die "Mode must be 'install' or 'update'"

  if [[ -z "$APACHE_SITE_CONF" ]]; then
    APACHE_SITE_CONF="/etc/apache2/sites-available/${DOMAIN}.conf"
  fi

  if [[ "$MODE" == "install" ]]; then
    [[ -n "$REPO_URL" ]] || die "--repo-url is required for install"
    [[ -n "$DB_PASSWORD" ]] || die "--db-password is required for install"
  fi
}

install_system_packages() {
  [[ "$SKIP_SYSTEM" == "1" ]] && return 0

  log "Installing system dependencies"
  need_cmd apt-get
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get install -y ca-certificates curl gnupg lsb-release git rsync apache2 postgresql postgresql-contrib

  if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | sed 's/^v//' | cut -d. -f1)" != "$NODE_MAJOR" ]]; then
    log "Installing Node.js ${NODE_MAJOR}.x"
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
    apt-get install -y nodejs
  fi

  if ! command -v pm2 >/dev/null 2>&1; then
    log "Installing PM2"
    npm install -g pm2
  fi

  a2enmod proxy proxy_http rewrite headers >/dev/null
  systemctl enable apache2 postgresql >/dev/null
  systemctl restart postgresql
}

prepare_app_dir() {
  log "Preparing application directory"
  local run_home
  run_home="$(get_run_user_home)"

  mkdir -p "$APP_DIR"
  chown -R "$RUN_USER:$RUN_GROUP" "$APP_DIR"

  # Configure git credentials if token provided
  if [[ -n "$GITHUB_TOKEN" ]]; then
    log "Configuring git credentials for GitHub token authentication"
    local git_creds_file="$APP_DIR/.git-credentials"
    local git_config_file="$APP_DIR/.gitconfig"
    local cred_line
    
    # Extract GitHub hostname from repo URL
    local github_host="github.com"
    if [[ "$REPO_URL" =~ https://([^/]+)/ ]]; then
      github_host="${BASH_REMATCH[1]}"
    fi
    cred_line="https://x-access-token:${GITHUB_TOKEN}@${github_host}"
    
    mkdir -p "$APP_DIR"
    touch "$git_creds_file"
    touch "$git_config_file"
    # Keep a single credential line per host to avoid duplicates.
    sed -i "\\|@${github_host}$|d" "$git_creds_file"
    echo "$cred_line" >> "$git_creds_file"
    chmod 600 "$git_creds_file"
    chmod 600 "$git_config_file"
    chown "$RUN_USER:$RUN_GROUP" "$git_creds_file"
    chown "$RUN_USER:$RUN_GROUP" "$git_config_file"
    
    # Configure git to use credentials helper
    sudo -u "$RUN_USER" env HOME="$run_home" git config --file "$git_config_file" credential.helper "store --file $git_creds_file"
  fi

  if [[ ! -d "$APP_DIR/.git" ]]; then
    log "Cloning repository"
    sudo -u "$RUN_USER" env HOME="$run_home" GIT_CONFIG_GLOBAL="$APP_DIR/.gitconfig" bash -c "cd '$APP_DIR' && git clone --branch '$BRANCH' '$REPO_URL' ."
  else
    log "Repository already exists, fetching latest branch"
    sudo -u "$RUN_USER" env HOME="$run_home" GIT_CONFIG_GLOBAL="$APP_DIR/.gitconfig" bash -c "cd '$APP_DIR' && git fetch origin '$BRANCH' && git checkout '$BRANCH' && git pull --ff-only origin '$BRANCH'"
  fi
}

update_code() {
  log "Updating source code"
  local run_home
  run_home="$(get_run_user_home)"
  [[ -d "$APP_DIR/.git" ]] || die "App directory does not contain a git repository: $APP_DIR"
  sudo -u "$RUN_USER" env HOME="$run_home" GIT_CONFIG_GLOBAL="$APP_DIR/.gitconfig" bash -c "cd '$APP_DIR' && git fetch origin '$BRANCH' && git checkout '$BRANCH' && git pull --ff-only origin '$BRANCH'"
}

setup_database() {
  log "Ensuring PostgreSQL user and database"
  sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO
\$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}';
  ELSE
    ALTER ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASSWORD}';
  END IF;
END
\$\$;
SQL

  sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"

  sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"
}

upsert_env_key() {
  local file="$1"
  local key="$2"
  local value="$3"

  if grep -qE "^${key}=" "$file"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$file"
  else
    echo "${key}=${value}" >> "$file"
  fi
}

ensure_backend_env() {
  local env_file="$APP_DIR/backend/.env"
  log "Configuring backend .env"

  if [[ ! -f "$env_file" ]]; then
    if [[ -f "$APP_DIR/backend/.env.example" ]]; then
      cp "$APP_DIR/backend/.env.example" "$env_file"
    else
      touch "$env_file"
    fi
  fi

  upsert_env_key "$env_file" "NODE_ENV" "production"
  upsert_env_key "$env_file" "PORT" "$BACKEND_PORT"

  # Update DB connection only when password is explicitly provided.
  # This prevents accidental overwrite during update mode.
  if [[ -n "$DB_PASSWORD" ]]; then
    upsert_env_key "$env_file" "DATABASE_URL" "postgres://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
  elif ! grep -qE '^DATABASE_URL=' "$env_file"; then
    die "DATABASE_URL is missing in $env_file. Provide --db-password or add DATABASE_URL manually."
  fi

  upsert_env_key "$env_file" "GOOGLE_CALLBACK_URL" "https://${DOMAIN}/api/auth/google/callback"
  upsert_env_key "$env_file" "FACEBOOK_CALLBACK_URL" "https://${DOMAIN}/api/auth/facebook/callback"
  upsert_env_key "$env_file" "FRONTEND_URL" "https://${DOMAIN}"

  chmod 600 "$env_file"
  chown "$RUN_USER:$RUN_GROUP" "$env_file"
}

install_node_dependencies_and_build() {
  local run_home
  local npm_cache
  run_home="$(get_run_user_home)"
  npm_cache="$APP_DIR/.npm-cache"

  mkdir -p "$npm_cache"
  chown -R "$RUN_USER:$RUN_GROUP" "$npm_cache"

  # Repair legacy npm cache ownership from previous root runs.
  if [[ -d "/var/www/.npm" ]]; then
    chown -R "$RUN_USER:$RUN_GROUP" "/var/www/.npm" || true
  fi

  npm_install_resilient() {
    local workdir="$1"
    local npm_args="$2"
    local log_file
    log_file="$npm_cache/npm-install-$(basename "$workdir").log"

    if sudo -u "$RUN_USER" env HOME="$run_home" NPM_CONFIG_CACHE="$npm_cache" bash -c "set -o pipefail; cd '$workdir' && npm ci $npm_args 2>&1 | tee '$log_file'"; then
      return 0
    fi

    # npm ci can fail when package-lock is out of sync with package.json.
    if grep -q "npm error code EUSAGE" "$log_file" 2>/dev/null; then
      log "npm ci failed due to lockfile mismatch in $workdir, falling back to npm install"
    else
      log "npm ci failed in $workdir, trying npm install fallback"
    fi

    sudo -u "$RUN_USER" env HOME="$run_home" NPM_CONFIG_CACHE="$npm_cache" bash -c "set -o pipefail; cd '$workdir' && npm install $npm_args 2>&1 | tee '$log_file'"
  }

  log "Installing backend dependencies"
  npm_install_resilient "$APP_DIR/backend" "--omit=dev --no-audit --no-fund"

  # Fail early with a clear message if critical runtime deps are still missing.
  if [[ ! -f "$APP_DIR/backend/node_modules/express/package.json" ]]; then
    die "Backend dependencies are incomplete: express was not installed in $APP_DIR/backend/node_modules. Check $npm_cache/npm-install-backend.log"
  fi

  log "Installing frontend dependencies"
  npm_install_resilient "$APP_DIR/frontend" "--no-audit --no-fund"

  log "Building frontend"
  sudo -u "$RUN_USER" env HOME="$run_home" NPM_CONFIG_CACHE="$npm_cache" bash -c "cd '$APP_DIR/frontend' && npm run build"

  if [[ -n "$ISP_DOCROOT" ]]; then
    log "Deploying frontend build to ISPConfig docroot: $ISP_DOCROOT"
    mkdir -p "$ISP_DOCROOT"
    rsync -a --delete "$APP_DIR/frontend/build/" "$ISP_DOCROOT/"

    cat > "$ISP_DOCROOT/.htaccess" <<HTACCESS
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
HTACCESS

    chown -R "$RUN_USER:$RUN_GROUP" "$ISP_DOCROOT"
  fi
}

write_apache_vhost() {
  local docroot
  if [[ -n "$ISP_DOCROOT" ]]; then
    docroot="$ISP_DOCROOT"
  else
    docroot="$APP_DIR/frontend/build"
  fi

  log "Writing Apache vhost: $APACHE_SITE_CONF"
  cat > "$APACHE_SITE_CONF" <<APACHE
<VirtualHost *:80>
    ServerName ${DOMAIN}
    ServerAlias www.${DOMAIN}
    DocumentRoot ${docroot}

    ProxyPreserveHost On
    ProxyPass /api http://127.0.0.1:${BACKEND_PORT}/api
    ProxyPassReverse /api http://127.0.0.1:${BACKEND_PORT}/api

    ProxyPass /uploads http://127.0.0.1:${BACKEND_PORT}/uploads
    ProxyPassReverse /uploads http://127.0.0.1:${BACKEND_PORT}/uploads

    <Directory ${docroot}>
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted

        <IfModule mod_rewrite.c>
            RewriteEngine On
            RewriteBase /
            RewriteRule ^index\\.html$ - [L]
            RewriteCond %{REQUEST_URI} !^/api
            RewriteCond %{REQUEST_URI} !^/uploads
            RewriteCond %{REQUEST_FILENAME} !-f
            RewriteCond %{REQUEST_FILENAME} !-d
            RewriteRule . /index.html [L]
        </IfModule>
    </Directory>

    ErrorLog \${APACHE_LOG_DIR}/${DOMAIN}_error.log
    CustomLog \${APACHE_LOG_DIR}/${DOMAIN}_access.log combined
</VirtualHost>
APACHE

  a2ensite "$(basename "$APACHE_SITE_CONF")" >/dev/null
  apache2ctl configtest
  systemctl reload apache2
}

configure_pm2() {
  local ecosystem_file="$APP_DIR/backend/ecosystem.config.cjs"
  local run_home
  local pm2_home
  run_home="$(get_run_user_home)"
  pm2_home="$APP_DIR/.pm2"

  mkdir -p "$pm2_home"
  chown -R "$RUN_USER:$RUN_GROUP" "$pm2_home"

  log "Creating PM2 ecosystem config"

  cat > "$ecosystem_file" <<PM2
module.exports = {
  apps: [
    {
      name: "${PM2_NAME}",
      script: "src/index.js",
      cwd: "${APP_DIR}/backend",
      env: {
        NODE_ENV: "production",
        PORT: "${BACKEND_PORT}"
      }
    }
  ]
};
PM2

  chown "$RUN_USER:$RUN_GROUP" "$ecosystem_file"

  log "Starting/reloading PM2 process"
  sudo -u "$RUN_USER" env HOME="$run_home" PM2_HOME="$pm2_home" bash -c "cd '$APP_DIR/backend' && pm2 startOrReload ecosystem.config.cjs --update-env"
  sudo -u "$RUN_USER" env HOME="$run_home" PM2_HOME="$pm2_home" pm2 save

  if [[ -d "$run_home" ]]; then
    env PM2_HOME="$pm2_home" pm2 startup systemd -u "$RUN_USER" --hp "$run_home" >/dev/null || true
  fi
}

run_health_checks() {
  log "Running health checks"
  local run_home
  local pm2_home
  local max_attempts
  local attempt
  run_home="$(get_run_user_home)"
  pm2_home="$APP_DIR/.pm2"
  max_attempts=20
  attempt=1

  sudo -u "$RUN_USER" env HOME="$run_home" PM2_HOME="$pm2_home" pm2 status "$PM2_NAME" || true

  if command -v curl >/dev/null 2>&1; then
    while [[ $attempt -le $max_attempts ]]; do
      if curl -fsS "http://127.0.0.1:${BACKEND_PORT}/" >/dev/null; then
        echo "Backend responded on port ${BACKEND_PORT}."
        return 0
      fi

      if [[ $attempt -eq 1 ]]; then
        log "Backend is not ready yet, waiting for startup"
      fi

      sleep 2
      attempt=$((attempt + 1))
    done

    log "Backend did not start in time on port ${BACKEND_PORT}. Showing PM2 diagnostics"
    sudo -u "$RUN_USER" env HOME="$run_home" PM2_HOME="$pm2_home" pm2 status || true
    sudo -u "$RUN_USER" env HOME="$run_home" PM2_HOME="$pm2_home" pm2 logs "$PM2_NAME" --lines 120 --nostream || true
    die "Health check failed: backend is not reachable on 127.0.0.1:${BACKEND_PORT}"
  fi
}

main() {
  parse_args "$@"

  [[ "$EUID" -eq 0 ]] || die "Run this script as root (sudo)."

  need_cmd sudo
  need_cmd sed
  need_cmd grep

  if [[ "$MODE" == "install" ]]; then
    install_system_packages
    prepare_app_dir
    setup_database
    ensure_backend_env
    install_node_dependencies_and_build
    write_apache_vhost
    configure_pm2
    run_health_checks
    save_config

    log "Install completed"
    echo "Next steps:"
    echo "1) In ISPConfig, ensure domain ${DOMAIN} points to this server."
    echo "2) Enable Let's Encrypt SSL for ${DOMAIN}."
    echo "3) If ISPConfig overwrites Apache vhost, copy directives from ${APACHE_SITE_CONF} into the site's Apache Directives field."
  else
    update_code
    ensure_backend_env
    install_node_dependencies_and_build
    write_apache_vhost
    configure_pm2
    run_health_checks

    log "Update completed"
  fi
}

main "$@"
