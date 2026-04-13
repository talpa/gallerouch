# Runbook stabilizace po rebootu

Cil:
- overit, ze backend bezi stabilne
- overit, ze API vraci JSON a ne frontend HTML fallback
- rychle opravit nejcastejsi stavy (port conflict, PM2 prava, pad procesu)

Pouzivej tento runbook na serveru.

## A. Rychly 6-krokovy check

1. PM2 pod www-data
   sudo -u www-data env PM2_HOME=/var/www/.pm2 pm2 list

2. Port backendu
   ss -ltnp | grep 4777

3. Backend health
   curl -sS -i https://gallerouch.cz/api/test-db | head -n 20

4. OAuth endpointy
   curl -sS -i https://gallerouch.cz/api/auth/google | head -n 20
   curl -sS -i https://gallerouch.cz/api/auth/facebook | head -n 20

5. Frontend -> API route check
   curl -sS -i https://gallerouch.cz/api/artworks/approved | head -n 20

6. Logy backendu
   sudo -u www-data env PM2_HOME=/var/www/.pm2 pm2 logs gallerouch --lines 80 --nostream

Pozadovany stav:
- PM2 status online
- port 4777 drzi jen jedna node instance
- /api vraci JSON, ne HTML

## B. Kdyz backend nejede (rychla obnova)

1. Vycistit bezici backend procesy
   sudo pkill -f "/var/www/gallerouch/backend/src/index.js" || true

2. PM2 home + prava
   sudo mkdir -p /var/www/.pm2/logs /var/www/.pm2/pids /var/www/.pm2/modules
   sudo touch /var/www/.pm2/module_conf.json /var/www/.pm2/pm2.log /var/www/.pm2/dump.pm2
   sudo chown -R www-data:www-data /var/www/.pm2
   sudo chmod -R 775 /var/www/.pm2

3. Spustit backend pouze pod www-data PM2
   sudo -u www-data env PM2_HOME=/var/www/.pm2 pm2 delete all || true
   sudo -u www-data env PM2_HOME=/var/www/.pm2 pm2 start npm --name gallerouch --cwd /var/www/gallerouch/backend -- start
   sudo -u www-data env PM2_HOME=/var/www/.pm2 pm2 save

4. Overit
   sudo -u www-data env PM2_HOME=/var/www/.pm2 pm2 list
   ss -ltnp | grep 4777

Dulezite:
- nespoustej backend rucne pres npm run start, pokud pouzivas PM2
- pouzivej jen jeden PM2 kontext (www-data)

## C. Kdyz frontend hlasi Unexpected response shape + HTML

Priznak:
- endpoint /api/... vraci html dokument (index.html)

Pricina:
- reverse proxy neposila /api na backend
- nebo backend nebezi

Kontrola:
- krok A3 a A5
- zkontrolovat webserver proxy konfiguraci pro /api -> 127.0.0.1:4777

### Pokud ISPConfig přegeneruje konfiguraci a zmizí ProxyPass /api

1. Otevři konfiguraci webserveru (např. /etc/apache2/sites-enabled/gallerouch.conf nebo v ISPConfig GUI).
2. Do sekce VirtualHost přidej před přesměrování na frontend:
   ProxyPass /api http://127.0.0.1:4777
   ProxyPassReverse /api http://127.0.0.1:4777
3. Ulož změny a reloaduj Apache:
   sudo systemctl reload apache2
4. Otestuj znovu curl na /api/test-db – musí vracet JSON, ne HTML.

Poznámka: Pokud ISPConfig přegeneruje konfiguraci znovu, je nutné tento blok vždy po změně znovu přidat, nebo použít vlastní šablonu v ISPConfig, kde ProxyPass pro /api zůstane.

## D. Login nefunguje ani pro admina

1. API login test
   curl -sS -X POST http://127.0.0.1:4777/api/auth/login -H "Content-Type: application/json" -d '{"username":"admin","password":"admin123"}'

2. Overeni admin uctu v DB
   select id, username, email, role, provider from users where role = 'admin';

3. Poznamka k OAuth uctum
- provider google/facebook + oauth password hash se neprihlasi pres klasicky username/password formular

## E. OAuth specificke chyby

TokenError Bad Request:
- nesedi callback URL mezi provider konzoli a backend env

Facebook domena neni v app domains:
- v Facebook app musi byt App Domains: gallerouch.cz
- valid redirect URI musi byt presna URL callbacku

Pouzij dokument OAuth setup:
- OAUTH_SETUP.md
