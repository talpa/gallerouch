import dotenv from 'dotenv';
dotenv.config();

import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import pkg from 'pg';
const { Client } = pkg;

function normalizeUsername(value, fallback) {
  const normalized = (value || fallback || 'user')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return normalized || fallback || 'user';
}

async function ensureUniqueUsername(client, preferred) {
  const base = normalizeUsername(preferred, 'user');
  let candidate = base;
  let attempt = 1;

  while (attempt <= 50) {
    const exists = await client.query('SELECT 1 FROM users WHERE username = $1 LIMIT 1', [candidate]);
    if (exists.rows.length === 0) {
      return candidate;
    }
    attempt += 1;
    candidate = `${base}_${attempt}`;
  }

  return `${base}_${Date.now()}`;
}

async function findOrCreateOAuthUser(client, { email, preferredUsername, provider, passwordHash }) {
  const normalizedEmail = (email || '').trim().toLowerCase();
  const fallbackEmail = `${provider}_${Date.now()}@${provider}.local`;
  const safeEmail = normalizedEmail || fallbackEmail;

  const existingByEmail = await client.query('SELECT * FROM users WHERE email = $1 LIMIT 1', [safeEmail]);
  if (existingByEmail.rows.length > 0) {
    const user = existingByEmail.rows[0];
    if (!user.provider) {
      await client.query('UPDATE users SET provider = $1 WHERE id = $2', [provider, user.id]);
      user.provider = provider;
    }
    return user;
  }

  let username = await ensureUniqueUsername(client, preferredUsername);

  for (let attempt = 1; attempt <= 10; attempt += 1) {
    try {
      const insertResult = await client.query(
        'INSERT INTO users (username, email, password_hash, role, provider) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [username, safeEmail, passwordHash, 'user', provider]
      );
      return insertResult.rows[0];
    } catch (err) {
      // 23505 = unique_violation
      if (err?.code === '23505') {
        if (err?.constraint === 'users_email_key') {
          const emailResult = await client.query('SELECT * FROM users WHERE email = $1 LIMIT 1', [safeEmail]);
          if (emailResult.rows.length > 0) {
            return emailResult.rows[0];
          }
        }

        if (err?.constraint === 'users_username_key') {
          username = await ensureUniqueUsername(client, `${preferredUsername}_${attempt}`);
          continue;
        }
      }

      throw err;
    }
  }

  throw new Error(`Unable to create OAuth user for provider ${provider}`);
}

// Google OAuth Strategy (pouze pokud jsou nastavené credentials)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:4777/api/auth/google/callback'
  },
  async (accessToken, refreshToken, profile, done) => {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    try {
      await client.connect();
      const googleEmail = (profile.emails?.[0]?.value || '').trim().toLowerCase() || `google_${profile.id}@google.local`;
      const googleUsername = profile.displayName || googleEmail.split('@')[0] || `google_${profile.id}`;

      const user = await findOrCreateOAuthUser(client, {
        email: googleEmail,
        preferredUsername: googleUsername,
        provider: 'google',
        passwordHash: 'oauth-google',
      });

      await client.end();
      done(null, user);
    } catch (err) {
      await client.end();
      done(err, null);
    }
  }
  ));
  console.log('Google OAuth enabled');
} else {
  console.log('Google OAuth disabled (missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET)');
}

// Facebook OAuth Strategy (pouze pokud jsou nastavené credentials)
if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
  passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID || '',
    clientSecret: process.env.FACEBOOK_APP_SECRET || '',
    callbackURL: process.env.FACEBOOK_CALLBACK_URL || 'http://localhost:4777/api/auth/facebook/callback',
    profileFields: ['id', 'displayName', 'emails']
  },
  async (accessToken, refreshToken, profile, done) => {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    try {
      await client.connect();
      const facebookEmail = (profile.emails?.[0]?.value || '').trim().toLowerCase() || `facebook_${profile.id}@facebook.local`;
      const facebookUsername = profile.displayName || facebookEmail.split('@')[0] || `facebook_${profile.id}`;

      const user = await findOrCreateOAuthUser(client, {
        email: facebookEmail,
        preferredUsername: facebookUsername,
        provider: 'facebook',
        passwordHash: 'oauth-facebook',
      });

      await client.end();
      done(null, user);
    } catch (err) {
      await client.end();
      done(err, null);
    }
  }
  ));
  console.log('Facebook OAuth enabled');
} else {
  console.log('Facebook OAuth disabled (missing FACEBOOK_APP_ID or FACEBOOK_APP_SECRET)');
}

export default passport;
