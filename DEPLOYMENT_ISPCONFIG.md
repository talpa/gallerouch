# Deployment Gallerouch na ISPConfig 3.3.0 (Ubuntu + Apache)

## Automaticky skript (install + update)

V repozitari je pripraveny skript `scripts/ispconfig-deploy.sh`, ktery umi:
- prvni instalaci (`install`)
- nasledne aktualizace na novou verzi (`update`)

### Rychle pouziti

```bash
cd /path/to/gallerouch
chmod +x scripts/ispconfig-deploy.sh

sudo ./scripts/ispconfig-deploy.sh install \
    --repo-url https://github.com/talpa/gallerouch.git \
    --domain gallerouch.com \
    --db-password 'SILNE_HESLO' \
    --github-token 'ghp_xxxxxxxxxxxx' \
    --isp-docroot /var/www/clients/client1/web1/web
```

**GitHub Personal Access Token** (pro private repozitáře):
1. Jděte na https://github.com/settings/tokens/new
2. Vygenerujte nový token s rozsahem `repo` (plný přístup k repozitářům)
3. Zkopírujte token a předejte ho skriptu přes `--github-token`
4. Token se bezpečně uloží do `$APP_DIR/.git-credentials` s právy `600`

Aktualizace:

```bash
cd /path/to/gallerouch
sudo ./scripts/ispconfig-deploy.sh update
```

Po prvním úspěšném `install` si skript uloží všechny parametry do `.deploy-config` souboru, takže při `update` modu je stačí právě jen spustit bez argumentů. Pokud chcete přepsat některou hodnotu:

```bash
sudo ./scripts/ispconfig-deploy.sh update \
    --isp-docroot /path/to/new/web   # Přepíše uloženou cestu
```

### Uložení konfiguraci

Po úspěšném `install` modu se všechny důležité parametry uloží do souboru:
```
$APP_DIR/.deploy-config
```

Při `update` modu se tento soubor automaticky načte. Parametry zadané v příkazové řádce přepisují uložené hodnoty. Konfigurační soubor je chráněn (`chmod 600`).

### Parametry skriptu

Dulezite parametry:
- `--repo-url URL` (install povinny) – Git URL repozitare
- `--db-password PASSWORD` (install povinny) – Heslo pro PostgreSQL uzivatele `gallerouch`
- `--github-token TOKEN` (optional) – GitHub Personal Access Token pro private repozitare
- `--domain DOMAIN` – Domenove jmeno (default: gallerouch.com)
- `--app-dir PATH` – Aplikacni slozka (default: /var/www/gallerouch)
- `--isp-docroot PATH` – ISPConfig web root; pokud nastaven, frontend build se zkopiruje sem
- `--skip-system` – Preskoci instalaci systemu balicku (pouzij pri druhem deploy na stejnem serveru)

**GitHub Token vytváreni a bezpecnost:**
- Token se generuje na GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
- Vytvořte nový token s rozsahem `repo` (full control of private repositories)
- **Nikdy** neukládejte token do verzovacího systému (git)
- Skript bezpečně uloží token do `$APP_DIR/.git-credentials` s právy `600` (čitelný jen pro vlastníka)
- Při update modu se token načte ze uložené konfigurace, takže jej nemusíte znovu zadávat
- Z bezpečnostních důvodů nezadávejte token přímo do historie shellu; použijte raději `read -s GITHUB_TOKEN`

**Dulezite pri update modu:**
- Pokud neprovedl `--db-password`, skript zachova existujici DATABASE_URL v `.env` souboru.
- Pokud je DATABASE_URL chybejici, skript selze.
- GitHub token se automaticky načte z `$APP_DIR/.git-credentials` souboru

Poznamky:
- Skript instaluje systemove balicky, Node.js, PM2, nastavi PostgreSQL, provede build frontendu, nastavi Apache reverse proxy a spusti backend pres PM2.
- Migrace databaze se spusti automaticky pri startu backendu (backend/src/migrate.js); uz existujici migrace se nespusti znovu.
- Pokud ISPConfig prepisuje Apache vhost, zkopiruj direktivy z vygenerovaneho souboru `/etc/apache2/sites-available/gallerouch.com.conf` do pole Apache Directives u daneho webu v ISPConfig.
- Pokud chcete upgradrovat heslo DB pri dalsi aktualizaci, pouzijte `--db-password` s novym heslem a skript jej aktualizuje.

### Troubleshooting npm EACCES

Pokud narazite na chybu typu `npm ERR! EACCES ... /var/www/.npm`, opravte prava jednorazove:

```bash
sudo chown -R www-data:www-data /var/www/.npm
```

Aktualni verze skriptu uz pouziva vlastni cache v `$APP_DIR/.npm-cache`, takze se chyba pri dalsich deployich nema opakovat.

### Troubleshooting npm EUSAGE (lockfile mismatch)

Pokud narazite na chybu `npm ci can only install packages when your package.json and package-lock.json are in sync`,
skript automaticky zkusí fallback na `npm install` a deploy pokračuje.

Doporuceni:
- V repozitari držte `package-lock.json` commitnuty spolu se změnami v `package.json`.
- Pokud backend dependencies chybi (napr. `Cannot find package 'express'`), zkontrolujte log:
    - `$APP_DIR/.npm-cache/npm-install-backend.log`

### Troubleshooting PM2 EACCES

Pokud narazite na chybu typu `EACCES: permission denied, mkdir '/var/www/.pm2/...'`,
aktualni skript uz PM2 nasmeruje do aplikační slozky:
- `$APP_DIR/.pm2`

Jednorazovy fix pro existujici server:

```bash
sudo mkdir -p /var/www/gallerouch/.pm2
sudo chown -R www-data:www-data /var/www/gallerouch/.pm2
```

Pak spustte deploy znovu.

### Troubleshooting backend health check (curl 127.0.0.1:4777)

Pokud deploy skonci chybou typu `curl: (7) Failed to connect to 127.0.0.1 port 4777`,
znamena to, ze backend nenabehl vcas nebo po startu spadl.

Aktualni skript uz:
- ceka na start backendu opakovane (retry),
- pri selhani automaticky vypise PM2 status a posledni PM2 logy.

Rucni kontrola:

```bash
sudo -u www-data PM2_HOME=/var/www/gallerouch/.pm2 pm2 status
sudo -u www-data PM2_HOME=/var/www/gallerouch/.pm2 pm2 logs gallerouch --lines 150 --nostream
```

## Příprava na serveru

### 1. Instalace Node.js a npm
```bash
sudo apt update
sudo apt install -y curl git
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version
npm --version
```

### 2. Instalace PostgreSQL
```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Ověření
sudo -u postgres psql --version
```

### 3. Instalace PM2 (správce Node.js procesů)
```bash
sudo npm install -g pm2
pm2 --version
```

## Příprava databáze

### 1. Vytvoření uživatele a databáze
```bash
sudo -u postgres psql

-- V PostgreSQL shellu:
CREATE USER gallerouch WITH PASSWORD 'silne_heslo_123';
CREATE DATABASE gallerouch WITH OWNER gallerouch;
ALTER USER gallerouch CREATEDB;
\q
```

### 2. Migrace databáze
Až budou soubory nahrajeme, spustíme migrace.

## Nasazení kódu na server

### 1. Ve svém počítači - příprava
```bash
# Frontend build
cd frontend
npm run build
# Vytvoří se: frontend/build/ s statickými soubory
```

### 2. Na serveru - vytvoření složky
```bash
sudo mkdir -p /var/www/gallerouch
sudo chown -R www-data:www-data /var/www/gallerouch
cd /var/www/gallerouch
```

### 3. Nahrání kódu (přes SCP nebo git)
```bash
# Varianta 1: GIT (doporučeno)
cd /var/www/gallerouch
sudo -u www-data git clone https://github.com/talpa/gallerouch.git .

# Varianta 2: SCP
# Z místního počítače:
# scp -r backend user@server:/var/www/gallerouch/
# scp -r frontend/build user@server:/var/www/gallerouch/
```

## Instalace balíčků

### 1. Backend
```bash
cd /var/www/gallerouch/backend
sudo -u www-data npm install --production
```

### 2. Migrace databáze
```bash
cd /var/www/gallerouch/backend
sudo -u www-data node migrate.js
```

## Konfigurace `.env` souboru

### Na serveru vytvořit: `/var/www/gallerouch/backend/.env`
```bash
sudo nano /var/www/gallerouch/backend/.env
```

**Obsah:**
```
NODE_ENV=production
DATABASE_URL=postgres://gallerouch:silne_heslo_123@localhost:5432/gallerouch
SESSION_SECRET=vygeneruj_random_string
OAUTH_GITHUB_ID=tvoj_github_id
OAUTH_GITHUB_SECRET=tvoj_github_secret
UPLOAD_DIR=/var/www/gallerouch/backend/uploads
```

Uložit: `Ctrl+O` → `Enter` → `Ctrl+X`

## Spuštění Backend s PM2

### 1. PM2 konfigurace
```bash
cd /var/www/gallerouch/backend
sudo -u www-data pm2 start src/index.js --name gallerouch --interpreter=node
```

### 2. Nastavení autostupu
```bash
sudo pm2 startup
sudo pm2 save
```

### 3. Ověření
```bash
pm2 status
pm2 logs gallerouch
```

## Konfigurace Apache

### 1. Povolení modulů
```bash
sudo a2enmod proxy
sudo a2enmod proxy_http
sudo a2enmod rewrite
sudo systemctl reload apache2
```

### 2. Vytvoření VirtualHost konfigurace
```bash
sudo nano /etc/apache2/sites-available/gallerouch.conf
```

**Obsah (nahraď example.com):**
```apache
<VirtualHost *:80>
    ServerName example.com
    ServerAlias www.example.com
    DocumentRoot /var/www/gallerouch/frontend/build

    # Frontend - statické soubory
    <Directory /var/www/gallerouch/frontend/build>
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
        
        # React Router - přesměruj na index.html
        <IfModule mod_rewrite.c>
            RewriteEngine On
            RewriteBase /
            RewriteRule ^index\.html$ - [L]
            RewriteCond %{REQUEST_FILENAME} !-f
            RewriteCond %{REQUEST_FILENAME} !-d
            RewriteRule . /index.html [L]
        </IfModule>
    </Directory>

    # Backend API - reverse proxy
    ProxyPreserveHost On
    ProxyPass /api http://127.0.0.1:4777/api
    ProxyPassReverse /api http://127.0.0.1:4777/api
    
    ProxyPass /auth http://127.0.0.1:4777/auth
    ProxyPassReverse /auth http://127.0.0.1:4777/auth
    
    ProxyPass /uploads http://127.0.0.1:4777/uploads
    ProxyPassReverse /uploads http://127.0.0.1:4777/uploads

    ErrorLog ${APACHE_LOG_DIR}/gallerouch_error.log
    CustomLog ${APACHE_LOG_DIR}/gallerouch_access.log combined
</VirtualHost>
```

Uložit: `Ctrl+O` → `Enter` → `Ctrl+X`

### 3. Aktivace
```bash
sudo a2ensite gallerouch.conf
sudo a2dissite 000-default.conf  # Pokud chceš
sudo apache2ctl configtest       # Ověření syntaxe
sudo systemctl reload apache2
```

## SSL Certifikát (Let's Encrypt)

### Přes ISPConfig
1. Jdi na **Websites → example.com**
2. **SSL** → zaškrtni "Let's Encrypt"
3. Ulož

Nebo ručně:
```bash
sudo apt install certbot python3-certbot-apache
sudo certbot certonly --apache -d example.com
```

## Ověření nasazení

### 1. Backend běží?
```bash
curl http://localhost:4777/api/health
```

### 2. Web server běží?
```bash
curl http://example.com
```

### 3. Logy
```bash
# Backend
pm2 logs gallerouch

# Apache
sudo tail -f /var/log/apache2/gallerouch_error.log
```

## Údržba

### Aktualizace kódu z git
```bash
cd /var/www/gallerouch
sudo -u www-data git pull origin main
cd backend
sudo -u www-data npm install --production
pm2 restart gallerouch
```

### Restart backendu
```bash
pm2 restart gallerouch
```

### Kontrola diskového prostoru
```bash
du -sh /var/www/gallerouch
df -h
```

## Troubleshooting

### Backend nereaguje
```bash
pm2 logs gallerouch
netstat -tlnp | grep 4777
```

### Databáze není dosažitelná
```bash
sudo -u postgres psql -d gallerouch -c "SELECT 1"
```

### Apache chyby
```bash
sudo apache2ctl configtest
sudo systemctl restart apache2
tail -50 /var/log/apache2/error.log
```

### Práva k souborům
```bash
sudo chown -R www-data:www-data /var/www/gallerouch
sudo find /var/www/gallerouch -type d -exec chmod 755 {} \;
sudo find /var/www/gallerouch -type f -exec chmod 644 {} \;
```

## Bezpečnost

- Nastav firewall: `sudo ufw allow 22,80,443/tcp`
- Vypni HTTP a používej HTTPS
- Nastav strong passwordy v DB
- Chráni `.env` soubor: `sudo chmod 600 /var/www/gallerouch/backend/.env`
- Pravidelné backupy DB: `sudo -u postgres pg_dump gallerouch > backup.sql`
