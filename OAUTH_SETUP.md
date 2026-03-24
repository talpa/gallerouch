# OAuth Setup - Gallerouch

Tento projekt podporuje přihlášení přes Google a Facebook OAuth.

## Nastavení Google OAuth

1. Jděte na [Google Cloud Console](https://console.cloud.google.com/)
2. Vytvořte nový projekt nebo vyberte existující
3. Přejděte na **APIs & Services** → **Credentials**
4. Klikněte na **Create Credentials** → **OAuth client ID**
5. Vyberte **Web application**
6. Nastavte:
   - **Authorized JavaScript origins**: `http://localhost:4777`
   - **Authorized redirect URIs**: `http://localhost:4777/api/auth/google/callback`
7. Zkopírujte **Client ID** a **Client Secret**
8. V souboru `backend/.env` přidejte:
   ```
   GOOGLE_CLIENT_ID=your-client-id
   GOOGLE_CLIENT_SECRET=your-client-secret
   GOOGLE_CALLBACK_URL=http://localhost:4777/api/auth/google/callback
   ```

## Nastavení Facebook OAuth

1. Jděte na [Facebook Developers](https://developers.facebook.com/)
2. Klikněte na **My Apps** → **Create App**
3. Vyberte **Consumer** typ aplikace
4. Přidejte **Facebook Login** produkt
5. V nastavení **Facebook Login** přidejte:
   - **Valid OAuth Redirect URIs**: `http://localhost:4777/api/auth/facebook/callback`
6. V **Settings** → **Basic** zkopírujte **App ID** a **App Secret**
7. V souboru `backend/.env` přidejte:
   ```
   FACEBOOK_APP_ID=your-app-id
   FACEBOOK_APP_SECRET=your-app-secret
   FACEBOOK_CALLBACK_URL=http://localhost:4777/api/auth/facebook/callback
   ```

## Restart serveru

Po přidání OAuth credentials restartujte backend:

```bash
docker compose restart backend
```

Uvidíte v logách:
```
Google OAuth enabled
Facebook OAuth enabled
```

## Testování

1. Jděte na http://localhost:3000/login
2. Klikněte na tlačítko "Přihlásit se přes Google" nebo "Přihlásit se přes Facebook"
3. Budete přesměrováni na OAuth stránku
4. Po úspěšném přihlášení budete přesměrováni zpět do aplikace

## Poznámky

- Bez nastavených OAuth credentials funguje pouze klasické přihlášení username/password
- OAuth tlačítka jsou viditelná vždy, ale nefungují bez správné konfigurace
- Uživatelé vytvoření přes OAuth nemají heslo (password_hash = 'oauth-google' nebo 'oauth-facebook')
