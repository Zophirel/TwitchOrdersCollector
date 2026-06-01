const EventEmitter = require('events');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const https = require('https');

const TWITCH_AUTHORIZE_URL = 'https://id.twitch.tv/oauth2/authorize';
const TWITCH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const TWITCH_VALIDATE_URL = 'https://id.twitch.tv/oauth2/validate';
const PENDING_FLOW_TIMEOUT_MS = 5 * 60 * 1000;

class TwitchOAuthService extends EventEmitter {
  constructor({ settingsRepository, openExternal }) {
    super();
    this.settingsRepository = settingsRepository;
    this.openExternal = openExternal;
    this.server = null;
    this.pendingFlow = null;
    this.pendingFlowTimeout = null;
  }

  getRedirectUrl(settings) {
    const protocol = String(settings.oauthRedirectProtocol || 'http').trim().toLowerCase() === 'https' ? 'https' : 'http';
    const host = String(settings.oauthRedirectHost || 'localhost').trim() || 'localhost';
    const port = Number(settings.oauthRedirectPort || 3443);
    let callbackPath = String(settings.oauthRedirectPath || '/oauth/twitch/callback').trim() || '/oauth/twitch/callback';

    if (!callbackPath.startsWith('/')) {
      callbackPath = `/${callbackPath}`;
    }

    return `${protocol}://${host}:${port}${callbackPath}`;
  }

  ensureRequiredSettings(settings) {
    const required = ['twitchClientId', 'twitchClientSecret'];
    const missing = required.filter((field) => !String(settings[field] || '').trim());

    if (missing.length) {
      throw new Error(`Missing OAuth settings: ${missing.join(', ')}`);
    }

    const protocol = String(settings.oauthRedirectProtocol || 'http').trim().toLowerCase();
    if (protocol === 'https') {
      const httpsMissing = ['mkcertCertPath', 'mkcertKeyPath'].filter((field) => !String(settings[field] || '').trim());
      if (httpsMissing.length) {
        throw new Error(`Missing HTTPS OAuth settings: ${httpsMissing.join(', ')}`);
      }
    }
  }

  async beginAuthorization(partialSettings = {}) {
    if (this.pendingFlow) {
      await this.cleanup();
    }

    const settings = {
      ...this.settingsRepository.getSettings(),
      ...partialSettings
    };

    this.ensureRequiredSettings(settings);

    const redirectUri = this.getRedirectUrl(settings);
    const state = crypto.randomBytes(24).toString('hex');
    const authorizationUrl = new URL(TWITCH_AUTHORIZE_URL);
    authorizationUrl.searchParams.set('response_type', 'code');
    authorizationUrl.searchParams.set('client_id', settings.twitchClientId);
    authorizationUrl.searchParams.set('redirect_uri', redirectUri);
    authorizationUrl.searchParams.set('state', state);
    authorizationUrl.searchParams.set('force_verify', 'true');

    const scopes = String(settings.oauthScopes || '').trim();
    if (scopes) {
      authorizationUrl.searchParams.set('scope', scopes);
    }

    this.pendingFlow = {
      state,
      redirectUri,
      settings
    };
    this.schedulePendingFlowTimeout();

    try {
      await this.startServer();
      await this.openExternal(authorizationUrl.toString());

      this.emit('status', {
        phase: 'waiting_for_callback',
        redirectUri
      });

      return {
        redirectUri,
        authorizationUrl: authorizationUrl.toString()
      };
    } catch (error) {
      await this.cleanup();
      throw error;
    }
  }

  async startServer() {
    const { settings } = this.pendingFlow;
    const protocol = new URL(this.pendingFlow.redirectUri).protocol;
    const callbackPath = new URL(this.pendingFlow.redirectUri).pathname;
    const requestHandler = async (request, response) => {
      try {
        const requestUrl = new URL(request.url, this.pendingFlow.redirectUri);

        if (request.method !== 'GET' || requestUrl.pathname !== callbackPath) {
          response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          response.end('Not found');
          return;
        }

        const state = requestUrl.searchParams.get('state');
        if (state !== this.pendingFlow.state) {
          response.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          response.end(this.renderHtml('OAuth state mismatch', 'The OAuth callback state did not match the pending request.'));
          await this.fail(new Error('OAuth state mismatch.'));
          return;
        }

        const oauthError = requestUrl.searchParams.get('error');
        if (oauthError) {
          const description = requestUrl.searchParams.get('error_description') || oauthError;
          response.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          response.end(this.renderHtml('Twitch authorization failed', description));
          await this.fail(new Error(`Twitch authorization failed: ${description}`));
          return;
        }

        const code = requestUrl.searchParams.get('code');
        if (!code) {
          response.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          response.end(this.renderHtml('Missing code', 'No authorization code was returned by Twitch.'));
          await this.fail(new Error('Missing authorization code in callback.'));
          return;
        }

        const tokenPayload = await this.exchangeCodeForToken(code);
        const validation = await this.validateToken(tokenPayload.access_token);
        const nextSettings = this.settingsRepository.saveSettings({
          oauthToken: tokenPayload.access_token,
          refreshToken: tokenPayload.refresh_token || '',
          botUserId: validation.user_id || this.pendingFlow.settings.botUserId,
          oauthScopes: Array.isArray(tokenPayload.scope)
            ? tokenPayload.scope.join(' ')
            : String(this.pendingFlow.settings.oauthScopes || '')
        });

        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end(this.renderHtml('Authorization complete', 'You can close this window and return to Twitch Orders Collector.'));

        this.emit('complete', {
          login: validation.login,
          userId: validation.user_id,
          scopes: validation.scopes || [],
          settings: nextSettings
        });

        await this.cleanup();
      } catch (error) {
        if (!response.headersSent) {
          response.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
          response.end(this.renderHtml('OAuth failed', error.message));
        }
        await this.fail(error);
      }
    };

    if (protocol === 'https:') {
      const cert = fs.readFileSync(settings.mkcertCertPath);
      const key = fs.readFileSync(settings.mkcertKeyPath);
      this.server = https.createServer({ cert, key }, requestHandler);
    } else {
      this.server = http.createServer(requestHandler);
    }

    await new Promise((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(
        Number(this.pendingFlow.settings.oauthRedirectPort),
        String(this.pendingFlow.settings.oauthRedirectHost || 'localhost'),
        resolve
      );
    });
  }

  async exchangeCodeForToken(code) {
    const body = new URLSearchParams({
      client_id: this.pendingFlow.settings.twitchClientId,
      client_secret: this.pendingFlow.settings.twitchClientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: this.pendingFlow.redirectUri
    });

    const response = await fetch(TWITCH_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body
    });

    if (!response.ok) {
      throw new Error(`OAuth token exchange failed: ${await response.text()}`);
    }

    return response.json();
  }

  async validateToken(accessToken) {
    const token = String(accessToken || '').replace(/^Bearer\s+/i, '').trim();
    const response = await fetch(TWITCH_VALIDATE_URL, {
      headers: {
        Authorization: `OAuth ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('OAuth token validation failed after authorization.');
    }

    return response.json();
  }

  async fail(error) {
    this.emit('error', error);
    await this.cleanup();
  }

  async cancelPendingAuthorization() {
    if (!this.pendingFlow && !this.server) {
      return {
        cancelled: false
      };
    }

    await this.cleanup();
    return {
      cancelled: true
    };
  }

  schedulePendingFlowTimeout() {
    this.clearPendingFlowTimeout();
    this.pendingFlowTimeout = setTimeout(async () => {
      try {
        await this.fail(new Error('OAuth authorization expired. Start OAuth again.'));
      } catch (error) {
        this.emit('error', error);
      }
    }, PENDING_FLOW_TIMEOUT_MS);
  }

  clearPendingFlowTimeout() {
    if (this.pendingFlowTimeout) {
      clearTimeout(this.pendingFlowTimeout);
      this.pendingFlowTimeout = null;
    }
  }

  async cleanup() {
    this.clearPendingFlowTimeout();
    this.pendingFlow = null;

    if (!this.server) {
      return;
    }

    const server = this.server;
    this.server = null;
    await new Promise((resolve) => server.close(() => resolve()));
  }

  renderHtml(title, message) {
    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #0d1117;
        color: #ebf0f6;
        font-family: Segoe UI, sans-serif;
      }
      article {
        width: min(560px, calc(100vw - 48px));
        background: #151b23;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 18px;
        padding: 28px;
      }
      h1 { margin: 0 0 10px; font-size: 1.35rem; }
      p { margin: 0; color: #95a5b7; line-height: 1.5; }
    </style>
  </head>
  <body>
    <article>
      <h1>${title}</h1>
      <p>${message}</p>
    </article>
  </body>
</html>`;
  }
}

module.exports = {
  TwitchOAuthService
};
