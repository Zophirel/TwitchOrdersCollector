<script setup>
import { computed, onBeforeUnmount, onMounted, provide, ref } from 'vue';
import AppShell from './components/AppShell.vue';
import { createI18nContext, I18N_KEY, localeOptions } from './composables/i18n';
import DashboardView from './views/DashboardView.vue';
import UsersView from './views/UsersView.vue';
import SettingsView from './views/SettingsView.vue';

const views = {
  dashboard: DashboardView,
  users: UsersView,
  settings: SettingsView
};

const activeView = ref('dashboard');
const currentLocale = ref('it');
const connectionState = ref({
  status: 'Disconnected',
  detail: 'Idle'
});
const refreshToken = ref(0);
const snackbarQueue = ref([]);
const activeSnackbar = ref(null);
const isSnackbarVisible = ref(false);
const snackbarTimerRatio = ref(100);
const tabMessageCounts = ref({
  orders: 0,
  requests: 0,
  popularity: 0
});

let snackbarTimeoutHandle = null;
let snackbarIntervalHandle = null;
let snackbarStartedAt = 0;
let snackbarRemainingMs = 0;
let snackbarPaused = false;

const i18n = createI18nContext(currentLocale);

provide(I18N_KEY, i18n);

const navigationItems = computed(() => [
  { key: 'dashboard', label: i18n.t('navDashboard') },
  { key: 'users', label: i18n.t('navUsers') },
  { key: 'settings', label: i18n.t('navSettings') }
]);

const activeComponent = computed(() => views[activeView.value]);

function toneToColor(tone) {
  if (tone === 'danger') {
    return 'error';
  }

  if (tone === 'success') {
    return 'success';
  }

  if (tone === 'warning') {
    return 'warning';
  }

  return 'info';
}

function toneToTimerColor(tone, options = {}) {
  if (tone === 'success') {
    return '#7ee2a7';
  }

  if (tone === 'danger') {
    return '#ff9aa5';
  }

  if (tone === 'warning') {
    return '#ffd27a';
  }

  return '#8fd3ff';
}

function pushToast(title, body, tone = 'info', options = {}) {
  const nextSnackbar = {
    title,
    text: body,
    color: toneToColor(tone),
    timerColor: toneToTimerColor(tone, options),
    timeout: options.timeout ?? 4200,
    restoreOrder: options.restoreOrder ? JSON.parse(JSON.stringify(options.restoreOrder)) : null
  };

  if (nextSnackbar.restoreOrder) {
    snackbarQueue.value = [];

    if (activeSnackbar.value) {
      snackbarQueue.value = [nextSnackbar, ...snackbarQueue.value];
      dismissSnackbar();
      return;
    }
  }

  snackbarQueue.value = [...snackbarQueue.value, nextSnackbar];

  if (!activeSnackbar.value) {
    showNextSnackbar();
  }
}

function clearSnackbarTimers() {
  if (snackbarTimeoutHandle !== null) {
    window.clearTimeout(snackbarTimeoutHandle);
    snackbarTimeoutHandle = null;
  }

  if (snackbarIntervalHandle !== null) {
    window.clearInterval(snackbarIntervalHandle);
    snackbarIntervalHandle = null;
  }
}

function updateSnackbarTimerRatio() {
  if (!activeSnackbar.value || activeSnackbar.value.timeout <= 0) {
    snackbarTimerRatio.value = 100;
    return;
  }

  const elapsed = performance.now() - snackbarStartedAt;
  const remaining = Math.max(snackbarRemainingMs - elapsed, 0);
  snackbarTimerRatio.value = Math.max((remaining / activeSnackbar.value.timeout) * 100, 0);
}

function startSnackbarTimer(durationMs) {
  clearSnackbarTimers();

  if (!activeSnackbar.value || durationMs <= 0) {
    snackbarTimerRatio.value = 100;
    return;
  }

  snackbarPaused = false;
  snackbarRemainingMs = durationMs;
  snackbarStartedAt = performance.now();
  snackbarTimerRatio.value = Math.max((durationMs / activeSnackbar.value.timeout) * 100, 0);

  snackbarIntervalHandle = window.setInterval(() => {
    updateSnackbarTimerRatio();
  }, 50);

  snackbarTimeoutHandle = window.setTimeout(() => {
    dismissSnackbar();
  }, durationMs);
}

function pauseSnackbarTimer() {
  if (!activeSnackbar.value || snackbarPaused || activeSnackbar.value.timeout <= 0) {
    return;
  }

  const elapsed = performance.now() - snackbarStartedAt;
  snackbarRemainingMs = Math.max(snackbarRemainingMs - elapsed, 0);
  snackbarPaused = true;
  clearSnackbarTimers();
  snackbarTimerRatio.value = Math.max((snackbarRemainingMs / activeSnackbar.value.timeout) * 100, 0);
}

function resumeSnackbarTimer() {
  if (!activeSnackbar.value || !snackbarPaused || activeSnackbar.value.timeout <= 0) {
    return;
  }

  startSnackbarTimer(snackbarRemainingMs);
}

function showNextSnackbar() {
  if (activeSnackbar.value || !snackbarQueue.value.length) {
    return;
  }

  const [nextSnackbar, ...rest] = snackbarQueue.value;
  snackbarQueue.value = rest;
  activeSnackbar.value = nextSnackbar;
  isSnackbarVisible.value = true;

  if (nextSnackbar.timeout > 0) {
    startSnackbarTimer(nextSnackbar.timeout);
  } else {
    snackbarTimerRatio.value = 100;
  }
}

function finalizeSnackbar() {
  clearSnackbarTimers();
  snackbarPaused = false;
  activeSnackbar.value = null;
  isSnackbarVisible.value = false;
  snackbarTimerRatio.value = 100;
  window.setTimeout(showNextSnackbar, 0);
}

function dismissSnackbar() {
  if (!activeSnackbar.value) {
    return;
  }

  clearSnackbarTimers();
  isSnackbarVisible.value = false;
}

function onSnackbarModelValueChange(value) {
  if (value) {
    isSnackbarVisible.value = true;
  }
}

function onSnackbarAfterLeave() {
  if (!activeSnackbar.value || isSnackbarVisible.value) {
    return;
  }

  finalizeSnackbar();
}

async function restoreDeletedOrder(order, dismiss) {
  try {
    const restorePayload = {
      id: Number(order.id),
      created_at: String(order.created_at || ''),
      channel_name: order.channel_name == null ? null : String(order.channel_name),
      channel_user_id: order.channel_user_id == null ? null : String(order.channel_user_id),
      chatter_user_id: String(order.chatter_user_id || ''),
      chatter_user_login: String(order.chatter_user_login || ''),
      chatter_user_name: String(order.chatter_user_name || ''),
      raw_message: String(order.raw_message || ''),
      trigger_word: String(order.trigger_word || ''),
      ordered_text: String(order.ordered_text || ''),
      normalized_ordered_text: String(order.normalized_ordered_text || ''),
      price_amount: Number(order.price_amount || 0),
      stream_started_at: order.stream_started_at == null ? null : String(order.stream_started_at),
      stream_elapsed_seconds: order.stream_elapsed_seconds == null ? null : Number(order.stream_elapsed_seconds)
    };

    await window.twitchOrders.restoreOrder(restorePayload);
    pushToast(i18n.t('orderRestored'), i18n.t('orderRestoredBody', {
      item: restorePayload.ordered_text
    }), 'success', {
      timeout: 1800
    });
    refreshToken.value += 1;
    dismiss();
  } catch (error) {
    pushToast(i18n.t('unableToRestoreOrder'), error.message, 'danger');
  }
}

function incrementTabCounter(tabKey) {
  tabMessageCounts.value = {
    ...tabMessageCounts.value,
    [tabKey]: Number(tabMessageCounts.value[tabKey] || 0) + 1
  };
}

function clearTabCounter(tabKey) {
  if (!tabKey || !(tabKey in tabMessageCounts.value)) {
    return;
  }

  tabMessageCounts.value = {
    ...tabMessageCounts.value,
    [tabKey]: 0
  };
}

async function hydrateConnectionState() {
  const summary = await window.twitchOrders.getDashboardSummary();
  connectionState.value = summary.connectionState;
}

async function loadLocalePreference() {
  const settings = await window.twitchOrders.getSettings();
  currentLocale.value = settings.locale || 'it';
}

async function updateLocale(locale) {
  currentLocale.value = locale;
  await window.twitchOrders.saveSettings({ locale });
}

let unsubscribe;

onMounted(async () => {
  await loadLocalePreference();
  await hydrateConnectionState();
  unsubscribe = window.twitchOrders.subscribeToEvents((event) => {
    if (event.type === 'bot:state') {
      connectionState.value = event.payload;
    }

    if (event.type === 'bot:error') {
      pushToast(i18n.t('twitchError'), event.payload.message, 'danger');
    }

    if (event.type === 'oauth:error') {
      pushToast(i18n.t('oauthError'), event.payload.message, 'danger');
    }

    if (event.type === 'oauth:complete') {
      pushToast(i18n.t('oauthComplete'), i18n.t('oauthCompleteBody', {
        login: event.payload.login
      }), 'success');
      refreshToken.value += 1;
    }

    if (event.type === 'request:new') {
      pushToast(i18n.t('newRequest'), i18n.t('newRequestBody', {
        user: event.payload.chatter_user_name,
        item: event.payload.requested_text
      }), 'success');
      incrementTabCounter('requests');
      incrementTabCounter('popularity');
      refreshToken.value += 1;
    }

    if (event.type === 'order:new') {
      pushToast(i18n.t('newOrder'), i18n.t('newOrderBody', {
        user: event.payload.chatter_user_name,
        item: event.payload.ordered_text,
        price: Number(event.payload.price_amount || 0).toFixed(2)
      }), 'success');
      incrementTabCounter('orders');
      refreshToken.value += 1;
    }

    if (event.type === 'dashboard:summary') {
      refreshToken.value += 1;
    }
  });
});

onBeforeUnmount(() => {
  clearSnackbarTimers();

  if (unsubscribe) {
    unsubscribe();
  }
});
</script>

<template>
  <AppShell
    :items="navigationItems"
    :active-view="activeView"
    :connection-state="connectionState"
    :current-locale="currentLocale"
    :locale-options="localeOptions"
    @navigate="activeView = $event"
    @locale-change="updateLocale"
  >
    <component
      :is="activeComponent"
      :connection-state="connectionState"
      :refresh-token="refreshToken"
      :tab-message-counts="tabMessageCounts"
      @notify="pushToast"
      @clear-tab-counter="clearTabCounter"
    />
  </AppShell>

  <v-snackbar
    v-model="isSnackbarVisible"
    location="bottom center"
    :color="activeSnackbar?.color || 'info'"
    variant="elevated"
    min-width="320"
    class="snackbar-queue"
    @update:model-value="onSnackbarModelValueChange"
    @after-leave="onSnackbarAfterLeave"
  >
    <div
      class="snackbar-surface"
      @mouseenter="pauseSnackbarTimer"
      @mouseleave="resumeSnackbarTimer"
    >
      <div class="snackbar-title">{{ activeSnackbar?.title }}</div>
      <div class="snackbar-text">{{ activeSnackbar?.text }}</div>
      <div
        v-if="activeSnackbar?.timeout > 0"
        class="snackbar-timer-track"
      >
        <div
          class="snackbar-timer-fill"
          :style="{
            width: `${snackbarTimerRatio}%`,
            backgroundColor: activeSnackbar?.timerColor || '#8fd3ff'
          }"
        />
      </div>
    </div>

    <template #actions>
      <button
        v-if="activeSnackbar?.restoreOrder"
        type="button"
        class="snackbar-action-label"
        @click="restoreDeletedOrder(activeSnackbar.restoreOrder, dismissSnackbar)"
      >
        {{ i18n.t('restore') }}
      </button>
    </template>
  </v-snackbar>
</template>

<style scoped>
.snackbar-queue :deep(.v-snackbar) {
  justify-content: center;
}

.snackbar-queue :deep(.v-snackbar__content) {
  overflow: hidden;
  padding: 0;
}

.snackbar-queue :deep(.v-snackbar__wrapper) {
  min-width: 360px;
}

.snackbar-surface {
  padding: 14px 16px 10px;
}

.snackbar-title {
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.2;
}

.snackbar-text {
  margin-top: 4px;
  font-size: 0.9rem;
  opacity: 0.94;
}

.snackbar-action-label {
  border: 0;
  background: transparent;
  color: #ffffff;
  font: inherit;
  font-weight: 700;
  letter-spacing: 0.01em;
  cursor: pointer;
  padding: 2px 6px;
  text-transform: uppercase;
}

.snackbar-timer-track {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 4px;
  background: rgba(255, 255, 255, 0.08);
}

.snackbar-timer-fill {
  height: 100%;
  transition: width 50ms linear;
}
</style>
