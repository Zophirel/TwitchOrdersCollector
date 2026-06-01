<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from '../composables/i18n';

const props = defineProps({
  connectionState: {
    type: Object,
    required: true
  },
  refreshToken: {
    type: Number,
    required: true
  }
});

const emit = defineEmits(['notify']);
const { t } = useI18n();

const form = ref({
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
  locale: 'it',
  triggerWord: '!request',
  orderTriggerWord: '!order',
  stripEdgePunctuation: true
});

const busy = ref(false);
const redirectUrl = ref('');
const openPanels = ref([0, 2]);

const hasOAuthCredentials = computed(() => {
  return Boolean(
    String(form.value.twitchClientId || '').trim() &&
    String(form.value.twitchClientSecret || '').trim()
  );
});

const hasOAuthTokens = computed(() => {
  return Boolean(
    String(form.value.oauthToken || '').trim() &&
    String(form.value.refreshToken || '').trim()
  );
});

const shouldShowCertificatePanel = computed(() => form.value.oauthRedirectProtocol === 'https');

function snapshotForm() {
  return JSON.parse(JSON.stringify({
    ...form.value,
    oauthScopes: 'channel:bot user:read:chat'
  }));
}

async function refreshRedirectUrl() {
  redirectUrl.value = await window.twitchOrders.getOAuthRedirectUrl(snapshotForm());
}

async function loadSettings() {
  form.value = {
    ...(await window.twitchOrders.getSettings()),
    oauthScopes: 'channel:bot user:read:chat'
  };
  await refreshRedirectUrl();
}

async function saveSettings() {
  busy.value = true;
  form.value = await window.twitchOrders.saveSettings(snapshotForm());
  form.value.oauthScopes = 'channel:bot user:read:chat';
  await refreshRedirectUrl();
  busy.value = false;
  emit('notify', t('settingsSaved'), t('settingsSavedBody'), 'success');
}

async function beginOAuthLogin() {
  busy.value = true;
  try {
    await window.twitchOrders.beginOAuthLogin(snapshotForm());
    await refreshRedirectUrl();
    emit('notify', t('oauthStarted'), t('oauthStartedBody', { url: redirectUrl.value }), 'success');
  } catch (error) {
    emit('notify', t('oauthStartFailed'), error.message, 'danger');
  } finally {
    busy.value = false;
  }
}

async function cancelOAuthLogin() {
  busy.value = true;
  try {
    const result = await window.twitchOrders.cancelOAuthLogin();
    emit(
      'notify',
      result.cancelled ? t('oauthReset') : t('noActiveOAuthFlow'),
      result.cancelled ? t('oauthResetBody') : t('noActiveOAuthFlowBody'),
      'info'
    );
  } catch (error) {
    emit('notify', t('oauthResetFailed'), error.message, 'danger');
  } finally {
    busy.value = false;
  }
}

async function ensureMkcertCertificate(forceMkcertRegenerate = false) {
  busy.value = true;
  try {
    const result = await window.twitchOrders.ensureMkcertCertificate({
      ...snapshotForm(),
      forceMkcertRegenerate
    });
    form.value = {
      ...result.settings,
      oauthScopes: 'channel:bot user:read:chat'
    };
    await refreshRedirectUrl();
    emit(
      'notify',
      forceMkcertRegenerate ? t('mkcertRegenerated') : t('mkcertReady'),
      `${result.host} -> ${result.certPath}`,
      'success'
    );
  } catch (error) {
    emit('notify', t('mkcertFailed'), error.message, 'danger');
  } finally {
    busy.value = false;
  }
}

async function resolveChannelFromLogin() {
  busy.value = true;
  try {
    const result = await window.twitchOrders.resolveChannelFromLogin(snapshotForm());
    form.value = {
      ...result.settings,
      oauthScopes: 'channel:bot user:read:chat'
    };
    emit('notify', t('channelResolved'), t('channelResolvedBody', {
      name: result.user.display_name,
      id: result.user.id
    }), 'success');
  } catch (error) {
    emit('notify', t('channelResolveFailed'), error.message, 'danger');
  } finally {
    busy.value = false;
  }
}

onMounted(loadSettings);
watch(() => form.value.oauthRedirectHost, refreshRedirectUrl);
watch(() => form.value.oauthRedirectPort, refreshRedirectUrl);
watch(() => form.value.oauthRedirectPath, refreshRedirectUrl);
watch(() => form.value.oauthRedirectProtocol, refreshRedirectUrl);
watch(() => props.refreshToken, loadSettings);
</script>

<template>
  <v-card class="settings-card" color="surface">
    <v-card-title class="text-h5 font-weight-semibold my-4">{{ t('settingsTitle') }}</v-card-title>
    <v-card-text class="d-grid ga-4">
      <v-expansion-panels v-model="openPanels" multiple variant="accordion">
        <v-expansion-panel :value="0">
          <v-expansion-panel-title>
            <div>
              <strong>{{ t('oauthPanel') }}</strong>
              <div class="caption-copy">{{ t('oauthPanelCopy') }}</div>
            </div>
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            <v-row>
              <v-col cols="12" md="6">
                <v-text-field v-model="form.twitchClientId" :label="t('twitchClientId')" />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field v-model="form.twitchClientSecret" :label="t('twitchClientSecret')" type="password" />
              </v-col>
            </v-row>

            <v-card variant="flat" color="surface-bright" class="mt-2 redirect-card">
              <v-card-text>
                <div class="caption-copy">{{ t('oauthRedirectUrl') }}</div>
                <div class="redirect-url">
                  <code>{{ redirectUrl }}</code>
                </div>
                <div class="caption-copy mt-2">
                  {{ t('oauthRedirectHelp') }}
                </div>
              </v-card-text>
            </v-card>

            <div class="actions-row mt-4">
              <v-btn color="primary" :disabled="busy || !hasOAuthCredentials" @click="beginOAuthLogin">{{ t('startOAuth') }}</v-btn>
              <v-btn color="info" variant="elevated" :disabled="busy" @click="cancelOAuthLogin">{{ t('resetOAuth') }}</v-btn>
            </div>

            <v-row v-if="hasOAuthTokens" class="mt-2">
              <v-col cols="12" md="6">
                <v-card variant="tonal" color="success" class="token-status-card">
                  <v-card-text class="d-flex align-center justify-space-between ga-4">
                    <div>
                      <div class="text-caption text-medium-emphasis">{{ t('oauthToken') }}</div>
                      <div class="text-subtitle-1 font-weight-bold">{{ t('available') }}</div>
                      <div class="token-status-copy">{{ t('oauthTokenCopy') }}</div>
                    </div>
                    <v-icon icon="mdi-shield-check" size="28" />
                  </v-card-text>
                </v-card>
              </v-col>
              <v-col cols="12" md="6">
                <v-card variant="tonal" color="success" class="token-status-card">
                  <v-card-text class="d-flex align-center justify-space-between ga-4">
                    <div>
                      <div class="text-caption text-medium-emphasis">{{ t('refreshToken') }}</div>
                      <div class="text-subtitle-1 font-weight-bold">{{ t('available') }}</div>
                      <div class="token-status-copy">{{ t('refreshTokenCopy') }}</div>
                    </div>
                    <v-icon icon="mdi-refresh-circle" size="28" />
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>
          </v-expansion-panel-text>
        </v-expansion-panel>

        <v-expansion-panel v-if="shouldShowCertificatePanel" :value="1">
          <v-expansion-panel-title>
            <div>
              <strong>{{ t('certificatePanel') }}</strong>
              <div class="caption-copy">{{ t('certificatePanelCopy') }}</div>
            </div>
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            <v-row>
              <v-col cols="12" md="4">
                <v-text-field v-model="form.mkcertBinaryPath" :label="t('mkcertBinaryPath')" />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field v-model="form.mkcertCertPath" :label="t('mkcertCertPath')" @update:model-value="refreshRedirectUrl" />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field v-model="form.mkcertKeyPath" :label="t('mkcertKeyPath')" @update:model-value="refreshRedirectUrl" />
              </v-col>
            </v-row>

            <div class="actions-row mt-2">
              <v-btn color="info" variant="elevated" :disabled="busy" @click="ensureMkcertCertificate(false)">{{ t('createOrUpdateMkcert') }}</v-btn>
              <v-btn color="warning" variant="elevated" :disabled="busy" @click="ensureMkcertCertificate(true)">{{ t('regenerateMkcert') }}</v-btn>
            </div>
          </v-expansion-panel-text>
        </v-expansion-panel>

        <v-expansion-panel :value="2">
          <v-expansion-panel-title>
            <div>
              <strong>{{ t('channelPanel') }}</strong>
              <div class="caption-copy">{{ t('channelPanelCopy') }}</div>
            </div>
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            <v-row>
              <v-col cols="12" md="4">
                <v-text-field v-model="form.channelLogin" :label="t('channelLogin')" />
              </v-col>
              <v-col v-if="form.channelName || form.channelLogin" cols="12" md="4">
                <v-text-field
                  v-model="form.channelName"
                  :label="t('channelDisplayName')"
                  readonly
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field v-model="form.triggerWord" :label="t('triggerWord')" />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field v-model="form.orderTriggerWord" :label="t('orderTriggerWord')" />
              </v-col>
              <v-col cols="12" md="6" class="d-flex align-center">
                <v-switch
                  v-model="form.stripEdgePunctuation"
                  inset
                  color="primary"
                  :label="t('stripPunctuation')"
                />
              </v-col>
            </v-row>

            <div class="actions-row mt-2">
              <v-btn color="info" variant="elevated" :disabled="busy || !form.channelLogin" @click="resolveChannelFromLogin">{{ t('resolveChannelId') }}</v-btn>
            </div>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
    </v-card-text>

    <v-card-actions class="px-6 pb-6 pt-0 d-flex flex-wrap ga-3">
      <v-btn color="primary" variant="elevated" :loading="busy" @click="saveSettings">{{ t('saveSettings') }}</v-btn>
    </v-card-actions>
  </v-card>
</template>

<style scoped>
.settings-card {
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.caption-copy {
  color: rgba(235, 240, 246, 0.68);
  font-size: 0.9rem;
  margin-top: 4px;
}

.redirect-url {
  margin-top: 10px;
}

.redirect-url code {
  display: block;
  padding: 12px 14px;
  border-radius: 12px;
  background: #07111b;
  border: 1px solid rgba(98, 196, 255, 0.28);
  color: #ffffff;
  font-family: Consolas, monospace;
  font-size: 0.98rem;

  line-height: 1.5;
  letter-spacing: 0.01em;
  word-break: break-all;
}

.redirect-card {
  border: 1px solid rgba(98, 196, 255, 0.22);
  background: rgba(24, 36, 49, 0.98);
}

.actions-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.token-status-card {
  border: 1px solid rgba(71, 194, 125, 0.22);
}

.token-status-copy {
  margin-top: 6px;
  color: rgba(235, 240, 246, 0.76);
  font-size: 0.9rem;
}
</style>
