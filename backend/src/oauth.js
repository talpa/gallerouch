import dotenv from 'dotenv';
dotenv.config();

import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import pkg from 'pg';
const { Client } = pkg;

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
      
      // Zkontroluj jestli uživatel existuje
      const result = await client.query(
        'SELECT * FROM users WHERE email = $1',
        [googleEmail]
      );
      
      let user;
      if (result.rows.length > 0) {
        // Uživatel již existuje
        user = result.rows[0];
      } else {
        // Vytvoř nového uživatele
        const insertResult = await client.query(
          'INSERT INTO users (username, email, password_hash, role, provider) VALUES ($1, $2, $3, $4, $5) RETURNING *',
          [
            googleUsername,
            googleEmail,
            'oauth-google',
            'user',
            'google'
          ]
        );
        user = insertResult.rows[0];
      }
      // ensure provider is set for existing users
      if (user && !user.provider) {
        await client.query('UPDATE users SET provider = $1 WHERE id = $2', ['google', user.id]);
      }
      
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
      
      // Zkontroluj jestli uživatel existuje
      const result = await client.query(
        'SELECT * FROM users WHERE email = $1',
        [facebookEmail]
      );
      
      let user;
      if (result.rows.length > 0) {
        // Uživatel již existuje
        user = result.rows[0];
      } else {
        // Vytvoř nového uživatele
        const insertResult = await client.query(
          'INSERT INTO users (username, email, password_hash, role, provider) VALUES ($1, $2, $3, $4, $5) RETURNING *',
          [
            facebookUsername,
            facebookEmail,
            'oauth-facebook',
            'user',
            'facebook'
          ]
        );
        user = insertResult.rows[0];
      }
      if (user && !user.provider) {
        await client.query('UPDATE users SET provider = $1 WHERE id = $2', ['facebook', user.id]);
      }
      
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
