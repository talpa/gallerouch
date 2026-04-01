# Fio Bank API Setup - Gallerouch

Návod na nastavení Fio Bank API pro automatické párování příchozích plateb.

## Přehled

Gallerouch generuje **platební příkazy s variabilním symbolem** pro identifikaci plateb. Pomocí Fio Bank API lze automaticky kontrolovat příchozí platby a párovat je s objednávkami.

## Jak to funguje

1. 📋 Při vytvoření objednávky se vygeneruje **unikátní variabilní symbol** (5-10 číslic)
2. 🏦 Uživatel zaplatí přes QR kód s variabilním symbolem  
3. 🔄 Admin periodicky spustí `/api/payments/sync-fio` endpoint
4. ✅ Platby se automaticky párují a objednávka se označí jako zaplacená

## Nastavení Fio Bank API

### 1. Vytvořte si Fio účet (je-li nemáte)
- Jděte na [Fio banka](https://www.fio.cz)
- Otevřete si bezplatný účet "Podnikatelský" nebo "Osobní"

### 2. Vygenerujte API Token

1. Přihlaste se do [Fio online bankingu](https://ib.fio.cz)
2. Jděte na **Nastavení** → **API** (nebo **Správa** → **API**)
3. Klikněte na **Vytvořit nový token**
4. Vyberte **REST API**
5. Nastavte **Čtení transakcí** (min přístup)
6. Zkopírujte si token (dlouhý řetězec)

Alternativně (starší rozhraní):
- Menu → **Běžné nastavení** → **API**
- Klikněte na **Vygenerovat token**

### 3. Nakonfigurujte backend

V souboru `backend/.env` přidejte:

```env
# Fio Bank API
FIO_API_TOKEN=your-token-here
FIO_ACCOUNT_NUMBER=1234567890/2010
# Volitelné přepsání API URL (default: https://www.fio.cz/ib_api/rest)
# FIO_API_BASE_URL=https://www.fio.cz/ib_api/rest
```

Příklady tokenů:
```
# Token vypadá takto (super dlouhý řetězec):
FIO_API_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 4. Restartujte backend

```bash
docker compose restart backend
# nebo lokálně:
npm run dev
```

## Použití

### Ruční synchronizace (admin)

```bash
# Admin portálu si otevře URL:
POST 

https://gallerouch.cz/api/payments/sync-fio
```

Nebo curl:
```bash
curl -X POST http://localhost:4777/api/payments/sync-fio \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "success": true,
  "message": "Synced 3 payments, 1 unmatched",
  "matched": [
    {
      "paymentId": 42,
      "variableSymbol": "12345",
      "amount": 5000,
      "senderName": "Jan Novák",
      "date": "2024-03-24"
    }
  ],
  "unmatched": [
    {
      "variableSymbol": "99999",
      "amount": 2000,
      "reason": "No matching payment or already paid",
      "senderName": "Petr Svoboda",
      "date": "2024-03-24"
    }
  ],
  "totalProcessed": 4
}
```

### Automatická synchronizace (doporučeno)

Nastavit cron job pro pravidelnou kontrolu (např. každé 2 hodiny):

**Na lokálním serveru (PM2):**
```bash
# Přidej do ecosystem.config.js:
{
  "name": "gallerouch-fio-sync",
  "script": "backend/sync-fio.js",
  "instances": 1,
  "exec_mode": "cluster",
  "cron_restart": "0 */2 * * *", // Každé 2 hodiny
  "env": {
    "NODE_ENV": "production"
  }
}
```

**Na produkčním serveru s cron:**
```bash
# /etc/cron.d/gallerouch-fio-sync
# Spouštět sync každé 2 hodiny
0 */2 * * * curl -X POST https://gallerouch.cz/api/payments/sync-fio \
  -H "Authorization: Bearer <SERVICE_TOKEN>" \
  -H "Content-Type: application/json"
```

**Nebo v Dockeru:**
```bash
# Přidej do docker-compose.yml nový service:
  fio-sync:
    image: curlimages/curl:latest
    container_name: gallerouch-fio-sync
    command: |
      /bin/sh -c "while true; do
        curl -X POST http://backend:4777/api/payments/sync-fio \
          -H 'Authorization: Bearer YOUR_BACKEND_TOKEN' \
          -H 'Content-Type: application/json'
        sleep 7200
      done"
    depends_on:
      - backend
```

## Problémy a řešení

### ❌ "FIO_API_TOKEN not configured in .env"

✅ Řešení:
- Zkontroluj že token je v `backend/.env`
- Zkontroluj že backend je restartovaný `docker compose restart backend`
- Zkontroluj logy: `docker logs gallerouch-backend`

### ❌ "No matching payment or already paid"

✅ Možné příčiny:
- Variabilní symbol neodpovídá - zkontroluj QR kód
- Platba je už zaplacená (status = paid)
- Jiné payment ID - zkontroluj DB

### ❌ "Amount mismatch"

✅ Řešení:
- Fio Bank API zatím nematches částku - je tolerance 1 CZK pro bankovní poplatky
- Pokud je rozdíl větší, je to chyba v objednávce - zkontroluj manuálně

### ❌ "Connection timeout"

✅ Řešení:
- Zkontroluj že backend má přístup k internetu
- Zkontroluj Fio API status na https://www.fio.cz/
- Zkontroluj JWT token expiraci

## Bezpečnost

⚠️ Důležité:
- **Token je citlivá data** - nikdy jej nesdílej
- Uchuj jej v `.env` mimo verzi kontrolu (v `.gitignore`)
- Na produkci používej **silné heslo** pro Fio účet
- NIKDY nesdílej token v emailech nebo v Slacku
- Zálohuj si token na bezpečném místě

## Dokumentace Fio Bank API

- 📖 https://www.fio.cz/bank-services/api-bankovnictvi
- 📋 https://www.fio.cz/assets/files/rest-api-v2.0.pdf
- 🆘 Podpora: https://www.fio.cz/kontakt

## Příklad - Kompletní flow

```
1. Uživatel vytvoří objednávku
   POST /api/payments 
   → Response: { variableSymbol: "12345", ... }

2. Frontend zobrazí QR kód s variabilním symbolem "12345"
   - IBAN: CZ1234567890/2010
   - Variabilní symbol: 12345
   - Částka: 5000 CZK

3. Uživatel zaplatí přes QR kód v bankovnictví Fio

4. Admin (každé 2 hodiny) spustí sync
   POST /api/payments/sync-fio
   → Fio API vrátí transakci se symbol "12345"
   → Payments tabulka se aktualizuje (status = paid)
   → Artwork se předá novému majiteli

5. Frontend vidí payment.status = paid
   → Zobrazí potvrzení

✅ Hotovo!
```

## Poznámky

- Dokumentace Fio API: https://www.fio.cz/bank-services/api-bankovnictvi
- Rate limit: max 60 requestů za minutu
- Transakcemi jsou dostupné v API s max 90 denním zpožděním
- Pro testování: použij vlastní Fio účet s malými částkami
