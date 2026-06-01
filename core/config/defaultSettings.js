const defaultSettings = {
  twitchClientId: '',
  twitchClientSecret: '',
  oauthToken: '',
  refreshToken: '',
  oauthScopes: 'channel:bot user:read:chat',
  oauthRedirectProtocol: 'http',
  oauthRedirectHost: 'localhost',
  oauthRedirectPort: 3443,
  oauthRedirectPath: '/oauth/twitch/callback',
  mkcertBinaryPath: 'mkcert',
  mkcertCertPath: '',
  mkcertKeyPath: '',
  botUserId: '',
  channelUserId: '',
  channelLogin: '',
  channelName: '',
  popularityDemotions: {},
  popularityGroupTailOrder: [],
  locale: 'it',
  triggerWord: '!request',
  orderTriggerWord: '!order',
  stripEdgePunctuation: true
};

module.exports = {
  defaultSettings
};
