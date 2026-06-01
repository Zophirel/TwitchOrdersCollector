const EventEmitter = require('events');
const WebSocket = require('ws');

const EVENTSUB_WS_URL = 'wss://eventsub.wss.twitch.tv/ws';
const OAUTH_VALIDATE_URL = 'https://id.twitch.tv/oauth2/validate';
const OAUTH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const HELIX_SUBSCRIPTIONS_URL = 'https://api.twitch.tv/helix/eventsub/subscriptions';
const HELIX_USERS_URL = 'https://api.twitch.tv/helix/users';
const HELIX_STREAMS_URL = 'https://api.twitch.tv/helix/streams';
const STREAM_CONTEXT_TTL_MS = 30 * 1000;

class TwitchEventSubClient extends EventEmitter {
  constructor({ requestService, orderService, settingsRepository }) {
    super();
    this.requestService = requestService;
    this.orderService = orderService;
    this.settingsRepository = settingsRepository;
    this.socket = null;
    this.state = {
      status: 'Disconnected',
      detail: 'Idle'
    };
    this.sessionId = null;
    this.streamContextCache = null;
  }

  getState() {
    return this.state;
  }

  setState(nextState) {
    this.state = {
      ...this.state,
      ...nextState,
      updatedAt: new Date().toISOString()
    };
    this.emit('state', this.state);
  }

  ensureRequiredSettings(settings) {
    const requiredFields = [
      'twitchClientId',
      'oauthToken',
      'botUserId',
      'channelUserId'
    ];

    const missing = requiredFields.filter((field) => !String(settings[field] || '').trim());
    if (missing.length) {
      throw new Error(`Missing Twitch settings: ${missing.join(', ')}`);
    }
  }

  async testConnection(settings) {
    const { tokenData, settings: validatedSettings } = await this.validateAndRefreshToken(settings);
    const hydratedSettings = await this.resolveRuntimeSettings(validatedSettings, tokenData);
    return {
      ok: true,
      login: tokenData.login,
      userId: tokenData.user_id,
      scopes: tokenData.scopes || [],
      botUserId: hydratedSettings.botUserId,
      channelUserId: hydratedSettings.channelUserId,
      channelLogin: hydratedSettings.channelLogin,
      channelName: hydratedSettings.channelName
    };
  }

  async start(settings) {
    if (this.socket) {
      return this.getState();
    }

    try {
      this.setState({
        status: 'connecting',
        detail: 'Validating Twitch token'
      });
      const { tokenData, settings: validatedSettings } = await this.validateAndRefreshToken(settings);
      const runtimeSettings = await this.resolveRuntimeSettings(validatedSettings, tokenData);
      await this.openWebSocket(runtimeSettings);
      return this.getState();
    } catch (error) {
      this.setState({
        status: 'error',
        detail: error.message
      });
      throw error;
    }
  }

  async stop() {
    if (this.socket) {
      const socketToClose = this.socket;
      this.socket = null;
      await new Promise((resolve) => {
        if (socketToClose.readyState === WebSocket.CLOSED) {
          resolve();
          return;
        }
        socketToClose.once('close', resolve);
        socketToClose.close();
      });
    }

    this.sessionId = null;
    this.streamContextCache = null;
    this.setState({
      status: 'Disconnected',
      detail: 'Stopped'
    });

    return this.getState();
  }

  async validateToken(oauthToken) {
    const token = String(oauthToken || '').replace(/^Bearer\s+/i, '').trim();
    const response = await fetch(OAUTH_VALIDATE_URL, {
      headers: {
        Authorization: `OAuth ${token}`
      }
    });

    if (!response.ok) {
      const responseBody = await response.text();
      const error = new Error(`Twitch token validation failed: ${responseBody || response.status}`);
      error.status = response.status;
      throw error;
    }

    return response.json();
  }

  async validateAndRefreshToken(settings) {
    try {
      const tokenData = await this.validateToken(settings.oauthToken);
      return {
        tokenData,
        settings
      };
    } catch (error) {
      if (error.status !== 401) {
        throw error;
      }

      const refreshedSettings = await this.refreshAccessToken(settings);
      const tokenData = await this.validateToken(refreshedSettings.oauthToken);
      return {
        tokenData,
        settings: refreshedSettings
      };
    }
  }

  async refreshAccessToken(settings) {
    const refreshToken = String(settings.refreshToken || '').trim();
    const clientId = String(settings.twitchClientId || '').trim();
    const clientSecret = String(settings.twitchClientSecret || '').trim();

    if (!refreshToken) {
      throw new Error('Twitch token validation failed and no refresh token is available. Run OAuth again.');
    }

    if (!clientId || !clientSecret) {
      throw new Error('Twitch token refresh requires twitchClientId and twitchClientSecret.');
    }

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret
    });

    const response = await fetch(OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body
    });

    if (!response.ok) {
      throw new Error(`Twitch token refresh failed: ${await response.text()}`);
    }

    const payload = await response.json();
    const refreshedSettings = this.settingsRepository.saveSettings({
      oauthToken: payload.access_token || settings.oauthToken,
      refreshToken: payload.refresh_token || settings.refreshToken,
      oauthScopes: Array.isArray(payload.scope)
        ? payload.scope.join(' ')
        : String(settings.oauthScopes || '')
    });

    return {
      ...settings,
      ...refreshedSettings
    };
  }

  async resolveRuntimeSettings(settings, tokenData) {
    const resolvedSettings = {
      ...settings
    };

    const validatedToken = tokenData || (await this.validateToken(settings.oauthToken));
    resolvedSettings.botUserId = validatedToken.user_id || resolvedSettings.botUserId;

    if (resolvedSettings.botUserId && String(validatedToken.user_id) !== String(resolvedSettings.botUserId)) {
      throw new Error('The provided OAuth token does not belong to the configured bot user ID.');
    }

    if (!String(resolvedSettings.channelUserId || '').trim()) {
      const channelLogin = String(resolvedSettings.channelLogin || '').trim();
      if (!channelLogin) {
        throw new Error('Missing Twitch settings: channelUserId or channelLogin');
      }

      const channelUser = await this.getUserByLogin(channelLogin, resolvedSettings);
      if (!channelUser) {
        throw new Error(`The configured channel login "${channelLogin}" does not exist on Twitch.`);
      }

      resolvedSettings.channelUserId = channelUser.id;
      resolvedSettings.channelLogin = channelUser.login;
      resolvedSettings.channelName = channelUser.display_name;
      this.settingsRepository.saveSettings({
        channelUserId: channelUser.id,
        channelLogin: channelUser.login,
        channelName: channelUser.display_name
      });
    } else {
      const channelUser = await this.getUserById(resolvedSettings.channelUserId, resolvedSettings);
      if (!channelUser) {
        throw new Error(`The configured channelUserId "${resolvedSettings.channelUserId}" does not exist on Twitch.`);
      }

      resolvedSettings.channelUserId = channelUser.id;
      resolvedSettings.channelLogin = channelUser.login;
      resolvedSettings.channelName = channelUser.display_name;
      this.settingsRepository.saveSettings({
        channelUserId: channelUser.id,
        channelLogin: channelUser.login,
        channelName: channelUser.display_name
      });
    }

    this.ensureRequiredSettings(resolvedSettings);
    return resolvedSettings;
  }

  async getUserByLogin(login, settings) {
    const response = await this.fetchHelixUsers(`login=${encodeURIComponent(login)}`, settings);
    return response[0] || null;
  }

  async getUserById(userId, settings) {
    const response = await this.fetchHelixUsers(`id=${encodeURIComponent(userId)}`, settings);
    return response[0] || null;
  }

  async fetchHelixUsers(query, settings) {
    const token = String(settings.oauthToken || '').replace(/^Bearer\s+/i, '').trim();
    const response = await fetch(`${HELIX_USERS_URL}?${query}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Client-Id': settings.twitchClientId
      }
    });

    if (!response.ok) {
      throw new Error(`Unable to resolve Twitch user: ${await response.text()}`);
    }

    const payload = await response.json();
    return payload.data || [];
  }

  async getCurrentStreamContext(settings) {
    const now = Date.now();
    if (
      this.streamContextCache
      && this.streamContextCache.channelUserId === settings.channelUserId
      && (now - this.streamContextCache.fetchedAt) < STREAM_CONTEXT_TTL_MS
    ) {
      return this.toLiveStreamContext(this.streamContextCache.startedAt, now);
    }

    const token = String(settings.oauthToken || '').replace(/^Bearer\s+/i, '').trim();
    const response = await fetch(`${HELIX_STREAMS_URL}?user_id=${encodeURIComponent(settings.channelUserId)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Client-Id': settings.twitchClientId
      }
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    const stream = (payload.data || [])[0];
    const startedAt = stream && stream.started_at ? stream.started_at : null;

    this.streamContextCache = {
      channelUserId: settings.channelUserId,
      fetchedAt: now,
      startedAt
    };

    return this.toLiveStreamContext(startedAt, now);
  }

  toLiveStreamContext(startedAt, now = Date.now()) {
    if (!startedAt) {
      return null;
    }

    const startedAtMs = new Date(startedAt).getTime();
    if (!Number.isFinite(startedAtMs)) {
      return null;
    }

    return {
      streamStartedAt: startedAt,
      streamElapsedSeconds: Math.max(0, Math.floor((now - startedAtMs) / 1000))
    };
  }

  async openWebSocket(settings) {
    await new Promise((resolve, reject) => {
      const socket = new WebSocket(EVENTSUB_WS_URL);
      let welcomeResolved = false;
      let settled = false;

      const fail = (error) => {
        this.socket = null;
        this.sessionId = null;
        this.setState({
          status: 'error',
          detail: error.message
        });

        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
          socket.close();
        }

        if (!settled) {
          settled = true;
          reject(error);
        } else {
          this.emit('error', error);
        }
      };

      socket.on('open', () => {
        this.socket = socket;
        this.setState({
          status: 'connecting',
          detail: 'Waiting for EventSub session welcome'
        });
      });

      socket.on('message', async (data) => {
        try {
          const payload = JSON.parse(data.toString());
          await this.handleSocketMessage(payload, settings);

          if (!welcomeResolved && payload.metadata && payload.metadata.message_type === 'session_welcome') {
            welcomeResolved = true;
            settled = true;
            resolve();
          }
        } catch (error) {
          fail(error);
        }
      });

      socket.on('error', (error) => {
        if (!welcomeResolved) {
          fail(error);
          return;
        }

        this.emit('error', error);
      });

      socket.on('close', () => {
        this.socket = null;
        this.sessionId = null;
        if (this.state.status !== 'error') {
          this.setState({
            status: 'Disconnected',
            detail: 'WebSocket closed'
          });
        }
      });
    });
  }

  async handleSocketMessage(payload, settings) {
    const messageType = payload.metadata && payload.metadata.message_type;

    if (messageType === 'session_welcome') {
      this.sessionId = payload.payload.session.id;
      await this.createChatSubscription(settings);
      this.setState({
        status: 'Connected',
        detail: `Listening to ${settings.channelLogin || settings.channelName || settings.channelUserId}`
      });
      return;
    }

    if (messageType === 'session_reconnect') {
      this.setState({
        status: 'connecting',
        detail: 'Reconnect requested by Twitch'
      });
      return;
    }

    if (messageType === 'revocation') {
      this.setState({
        status: 'error',
        detail: 'Twitch subscription was revoked'
      });
      return;
    }

    if (messageType !== 'notification') {
      return;
    }

    const event = payload.payload.event;
    if (!event || !event.message || !event.message.text) {
      return;
    }

    const messagePayload = {
      channelName: event.broadcaster_user_name || settings.channelName || settings.channelLogin,
      channelUserId: event.broadcaster_user_id || settings.channelUserId,
      chatterUserId: event.chatter_user_id,
      chatterUserLogin: event.chatter_user_login,
      chatterUserName: event.chatter_user_name,
      rawMessage: event.message.text
    };

    const storedRequest = this.requestService.processChatMessage(
      messagePayload,
      settings
    );

    if (storedRequest) {
      this.emit('request:stored', storedRequest);
    }

    const orderTrigger = String(settings.orderTriggerWord || '').trim();
    let storedOrder = null;

    if (orderTrigger && messagePayload.rawMessage.startsWith(`${orderTrigger} `)) {
      const streamContext = await this.getCurrentStreamContext(settings);
      storedOrder = this.orderService.processChatMessage(
        {
          ...messagePayload,
          streamStartedAt: streamContext ? streamContext.streamStartedAt : null,
          streamElapsedSeconds: streamContext ? streamContext.streamElapsedSeconds : null
        },
        settings
      );
    }

    if (storedOrder) {
      this.emit('order:stored', storedOrder);
    }
  }

  async createChatSubscription(settings) {
    const token = String(settings.oauthToken || '').replace(/^Bearer\s+/i, '').trim();
    const response = await fetch(HELIX_SUBSCRIPTIONS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Client-Id': settings.twitchClientId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'channel.chat.message',
        version: '1',
        condition: {
          broadcaster_user_id: settings.channelUserId,
          user_id: settings.botUserId
        },
        transport: {
          method: 'websocket',
          session_id: this.sessionId
        }
      })
    });

    if (!response.ok) {
      const responseBody = await response.text();
      throw new Error(`Unable to create EventSub subscription: ${responseBody}`);
    }

    return response.json();
  }
}

module.exports = {
  TwitchEventSubClient
};
