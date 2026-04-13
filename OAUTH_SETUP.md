# OAuth Setup - Gallerouch

Tento projekt podporuje přihlášení přes Google a Facebook OAuth.

## Nastavení Google OAuth

1. Jděte na [Google Cloud Console](https://console.cloud.google.com/).
1. Vytvořte nový projekt nebo vyberte existující.
1. Přejděte na **APIs & Services** -> **Credentials**.
1. Klikněte na **Create Credentials** -> **OAuth client ID**.
1. Vyberte **Web application**.
1. Nastavte Authorized JavaScript origins na `http://localhost:4777`.
1. Nastavte Authorized redirect URIs na `http://localhost:4777/api/auth/google/callback`.
1. Zkopírujte **Client ID** a **Client Secret**.
1. V souboru `backend/.env` přidejte:

```env
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALLBACK_URL=http://localhost:4777/api/auth/google/callback
```

## Produkční nastavení Google OAuth (gallerouch.cz)

V Google Cloud Console u stejného OAuth clienta přidej (nepřepisuj localhost, jen přidej):

- **Authorized JavaScript origins**:
  - `https://gallerouch.cz`
- **Authorized redirect URIs**:
  - `https://gallerouch.cz/api/auth/google/callback`

Na serveru v `/var/www/gallerouch/backend/.env` nastav:

```env
GOOGLE_CALLBACK_URL=https://gallerouch.cz/api/auth/google/callback
FRONTEND_URL=https://gallerouch.cz
```

Pak restart: `pm2 restart gallerouch`.

## Nastavení Facebook OAuth

1. Jděte na [Facebook Developers](https://developers.facebook.com/).
1. Klikněte na **My Apps** -> **Create App**.
1. Vyberte **Consumer** typ aplikace.
1. Přidejte **Facebook Login** produkt.
1. V nastavení **Facebook Login** nastavte Valid OAuth Redirect URIs na `http://localhost:4777/api/auth/facebook/callback`.
1. V **Settings** -> **Basic** zkopírujte **App ID** a **App Secret**.
1. V souboru `backend/.env` přidejte:

```env
FACEBOOK_APP_ID=your-app-id
FACEBOOK_APP_SECRET=your-app-secret
FACEBOOK_CALLBACK_URL=http://localhost:4777/api/auth/facebook/callback
```

## Produkční nastavení Facebook OAuth (gallerouch.cz)

Ve Facebook Developers Console přidej k Valid OAuth Redirect URIs:

```text
https://gallerouch.cz/api/auth/facebook/callback
```

Na serveru v `/var/www/gallerouch/backend/.env` nastav:

```env
FACEBOOK_CALLBACK_URL=https://gallerouch.cz/api/auth/facebook/callback
FRONTEND_URL=https://gallerouch.cz
```

## Restart serveru

Po přidání OAuth credentials restartujte backend:

```bash
docker compose restart backend
```

Uvidíte v logách:

```text
Google OAuth enabled
Facebook OAuth enabled
```

## Testování

1. Jděte na [http://localhost:3000/login](http://localhost:3000/login).
1. Klikněte na tlačítko "Přihlásit se přes Google" nebo "Přihlásit se přes Facebook".
1. Budete přesměrováni na OAuth stránku.
1. Po úspěšném přihlášení budete přesměrováni zpět do aplikace.

## Rychlý produkční checklist (gallerouch.cz)

1. V souboru `backend/.env` na serveru nastav:

```env
FRONTEND_URL=https://gallerouch.cz
GOOGLE_CALLBACK_URL=https://gallerouch.cz/api/auth/google/callback
FACEBOOK_CALLBACK_URL=https://gallerouch.cz/api/auth/facebook/callback
```

1. Google Cloud Console (OAuth Client):
   - Authorized JavaScript origins:
     - `https://gallerouch.cz`
   - Authorized redirect URIs:
     - `https://gallerouch.cz/api/auth/google/callback`

1. Facebook Developers:
   - Settings -> Basic -> App Domains:
     - `gallerouch.cz`
   - Settings -> Basic -> Website -> Site URL:
     - `https://gallerouch.cz`
   - Facebook Login -> Settings -> Valid OAuth Redirect URIs:
     - `https://gallerouch.cz/api/auth/facebook/callback`

1. Pokud je aplikace ve Facebooku v Live režimu, zkontroluj také:
   - Privacy Policy URL
   - Terms of Service URL
   - Contact email

1. Restart backendu po změně `.env`:

```bash
pm2 restart gallerouch
```

1. Ověření endpointů v browseru:
   - `https://gallerouch.cz/api/auth/google`
   - `https://gallerouch.cz/api/auth/facebook`

## Troubleshooting podle logů

### `duplicate key value violates unique constraint "users_username_key"`

- Toto je ošetřeno v `backend/src/oauth.js` robustním create/find flow a retry při kolizi username.
- Pokud se chyba objeví i po deployi, běží starý build backendu. Restartni proces a ověř logy při startu.

### `TokenError: Bad Request`

Nejčastější důvody:

- Callback URL v provider konzoli neodpovídá přesně hodnotě v `.env` (včetně schématu `https`, bez/with trailing slash).
- Používáš špatný OAuth client (jiné credentials pro jinou doménu).
- Clock skew nebo stale authorization code při opakovaném callback requestu.

### `FacebookAuthorizationError: Doména ... není součástí domén aplikací`

Chybí nebo nesedí `App Domains` ve Facebook appce. Musí obsahovat `gallerouch.cz`.
