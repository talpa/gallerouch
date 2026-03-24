# Systém nastavení aplikace

## Přehled

Systém pro ukládání konfiguračních parametrů aplikace Gallerouch do databáze. Umožňuje administrátorům spravovat klíčové hodnoty jako bankovní účty, DPH, kontaktní údaje atd.

## Databázová struktura

### Tabulka: `settings`

| Sloupec | Typ | Popis |
|---------|-----|-------|
| key | VARCHAR(255) | Unikátní klíč nastavení (primární klíč) |
| value | TEXT | Hodnota nastavení |
| description | TEXT | Popis nastavení |
| created_at | TIMESTAMP | Datum vytvoření |
| updated_at | TIMESTAMP | Datum poslední aktualizace |

## Přednastavené hodnoty

Po migraci `012_settings_table.sql` jsou v databázi následující nastavení:

| Klíč | Výchozí hodnota | Popis |
|------|----------------|-------|
| `gallery_bank_account` | 123456789/0100 | Číslo bankovního účtu pro platby |
| `gallery_name` | Gallerouch | Název galerie |
| `gallery_email` | info@gallerouch.cz | Kontaktní email |
| `gallery_phone` | +420 123 456 789 | Kontaktní telefon |
| `vat_rate` | 21 | Sazba DPH (%) |
| `currency` | CZK | Měna |
| `min_order_amount` | 0 | Minimální částka objednávky |
| `shipping_enabled` | true | Povolit dopravu |
| `payment_gateway_enabled` | false | Povolit platební bránu |
| `registration_enabled` | true | Povolit registraci |

## API Endpoints

Všechny endpointy vyžadují autentizaci a admin roli.

### GET /api/auth/settings
Vrátí seznam všech nastavení.

**Response:**
```json
{
  "settings": [
    {
      "key": "gallery_bank_account",
      "value": "123456789/0100",
      "description": "Číslo bankovního účtu galerie",
      "created_at": "2025-12-08T...",
      "updated_at": "2025-12-08T..."
    }
  ]
}
```

### GET /api/auth/settings/:key
Vrátí konkrétní nastavení.

### PUT /api/auth/settings/:key
Aktualizuje nastavení.

**Request:**
```json
{
  "value": "987654321/0800",
  "description": "Nový bankovní účet"
}
```

### POST /api/auth/settings
Vytvoří nové nastavení.

**Request:**
```json
{
  "key": "new_setting",
  "value": "hodnota",
  "description": "Popis"
}
```

### DELETE /api/auth/settings/:key
Smaže nastavení.

## Frontend komponenta

### Umístění
`/admin/settings` - dostupné pouze pro administrátory

### Funkce
- ✅ Zobrazení všech nastavení v tabulce
- ✅ Editace existujících nastavení
- ✅ Vytváření nových nastavení
- ✅ Mazání nastavení (s potvrzením)
- ✅ Vyhledávání a filtrování
- ✅ Česká a anglická lokalizace

## Použití v kódu

Pro čtení nastavení v backendu:

```javascript
const result = await client.query(
  'SELECT value FROM settings WHERE key = $1',
  ['gallery_bank_account']
);
const bankAccount = result.rows[0]?.value;
```

Pro čtení nastavení ve frontendu:

```typescript
import { getSetting } from '../api/settings';

const setting = await getSetting(token, 'gallery_bank_account');
console.log(setting.value);
```

## Bezpečnost

- ⚠️ Pouze administrátoři mají přístup k nastavením
- ⚠️ Každý klíč je unikátní (primární klíč)
- ⚠️ Automatická aktualizace `updated_at` triggrem
- ⚠️ Validace na backendu i frontendu

## Migrace

Migrace se spustí automaticky při startu backendu. Pro manuální spuštění:

```bash
docker-compose exec backend node src/migrate.js
```
