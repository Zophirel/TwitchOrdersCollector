<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from '../composables/i18n';
import OrdersView from './OrdersView.vue';
import RequestsView from './RequestsView.vue';
import PopularityView from './PopularityView.vue';

const props = defineProps({
  connectionState: {
    type: Object,
    required: true
  },
  refreshToken: {
    type: Number,
    required: true
  },
  tabMessageCounts: {
    type: Object,
    default: () => ({
      orders: 0,
      requests: 0,
      popularity: 0
    })
  }
});

const emit = defineEmits(['notify', 'clear-tab-counter']);
const { t, formatDateTime, formatCurrency } = useI18n();

const summary = ref({
  totalRequests: 0,
  uniqueItems: 0,
  uniqueChatters: 0,
  totalOrders: 0,
  grossOrderValue: 0,
  latestRequests: [],
  latestOrders: [],
  topItems: []
});
const loading = ref(true);
const activeTab = ref('overview');
const botActionBusy = ref(false);

function getLocalizedConnectionStatus(status) {
  switch (status) {
    case 'Connected':
      return t('statusConnected');
    case 'connecting':
      return t('statusConnecting');
    case 'error':
      return t('statusError');
    default:
      return t('statusDisconnected');
  }
}

const statCards = computed(() => [
  { label: t('statTotalRequests'), value: summary.value.totalRequests, icon: 'mdi-format-list-bulleted-square' },
  { label: t('statUniqueItems'), value: summary.value.uniqueItems, icon: 'mdi-cube-outline' },
  { label: t('statUniqueChatters'), value: summary.value.uniqueChatters, icon: 'mdi-account-group-outline' },
  { label: t('statTotalOrders'), value: summary.value.totalOrders, icon: 'mdi-cart-outline' },
  { label: t('statOrderValue'), value: formatCurrency(summary.value.grossOrderValue || 0), icon: 'mdi-cash-multiple' },
  { label: t('statBotStatus'), value: getLocalizedConnectionStatus(props.connectionState.status), icon: 'mdi-robot-outline' }
]);

const dashboardTabs = computed(() => [
  { key: 'overview', label: t('tabOverview') },
  { key: 'orders', label: t('tabOrders') },
  { key: 'requests', label: t('tabRequests') },
  { key: 'popularity', label: t('tabPopularity') }
]);

function forwardNotify(...args) {
  emit('notify', ...args);
}

async function testBotConnectionFromOverview() {
  botActionBusy.value = true;

  try {
    const settings = await window.twitchOrders.getSettings();
    const result = await window.twitchOrders.testConnection(settings);

    emit('notify', t('connectionOk'), t('connectionOkBody', {
      login: result.login
    }), 'success');
  } catch (error) {
    emit('notify', t('connectionFailed'), error.message, 'danger');
  } finally {
    botActionBusy.value = false;
  }
}

async function startBotFromOverview() {
  botActionBusy.value = true;

  try {
    await window.twitchOrders.startBot();
    emit('notify', t('botStarted'), t('botStartedBody'), 'success');
  } catch (error) {
    emit('notify', t('unableToStartBot'), error.message, 'danger');
  } finally {
    botActionBusy.value = false;
  }
}

async function stopBotFromOverview() {
  botActionBusy.value = true;

  try {
    await window.twitchOrders.stopBot();
    emit('notify', t('botStopped'), t('botStoppedBody'), 'info');
  } catch (error) {
    emit('notify', t('unableToStopBot'), error.message, 'danger');
  } finally {
    botActionBusy.value = false;
  }
}

function getTabCount(tabKey) {
  return Number(props.tabMessageCounts?.[tabKey] || 0);
}

function clearCurrentTabCounter(tabKey) {
  if (tabKey === 'orders' || tabKey === 'requests' || tabKey === 'popularity') {
    emit('clear-tab-counter', tabKey);
  }
}

async function loadSummary() {
  loading.value = true;
  summary.value = await window.twitchOrders.getDashboardSummary();
  loading.value = false;
}

onMounted(async () => {
  await loadSummary();
  clearCurrentTabCounter(activeTab.value);
});

watch(() => props.refreshToken, loadSummary);
watch(activeTab, (nextTab) => {
  clearCurrentTabCounter(nextTab);
});
</script>

<template>
  <v-card color="surface">
    <v-card-text class="px-0 pt-0">
      <v-tabs
        v-model="activeTab"
        color="primary"
        align-tabs="start"
        class="dashboard-tabs"
      >
        <v-tab
          class=""
          v-for="tab in dashboardTabs"
          :key="tab.key"
          :value="tab.key"
        >
          <span>{{ tab.label }}</span>
          <v-chip
            v-if="getTabCount(tab.key)"
            size="x-small"
            color="error"
            variant="elevated"
            class="tab-counter"
          >
            {{ getTabCount(tab.key) }}
          </v-chip>
        </v-tab>
      </v-tabs>

      <v-window v-model="activeTab" class="px-4 pb-4">
        <v-window-item value="overview">
          <div class="pt-4">
            <v-card color="surface" class="bot-actions-card mb-4">
              <v-card-text class="d-flex flex-wrap align-center justify-space-between ga-4">
                <div>
                  <div class="text-subtitle-1 font-weight-bold">{{ t('statBotStatus') }}</div>
                  <div class="text-body-2 text-medium-emphasis">{{ t('botPanelCopy') }}</div>
                </div>
                <div class="bot-actions-row">
                  <v-btn
                    color="info"
                    variant="elevated"
                    :loading="botActionBusy"
                    :disabled="botActionBusy"
                    @click="testBotConnectionFromOverview"
                  >
                    {{ t('testBotConnection') }}
                  </v-btn>
                  <v-btn
                    color="primary"
                    variant="elevated"
                    :loading="botActionBusy"
                    :disabled="botActionBusy"
                    @click="startBotFromOverview"
                  >
                    {{ t('startBot') }}
                  </v-btn>
                  <v-btn
                    color="error"
                    variant="tonal"
                    :loading="botActionBusy"
                    :disabled="botActionBusy"
                    @click="stopBotFromOverview"
                  >
                    {{ t('stopBot') }}
                  </v-btn>
                </div>
              </v-card-text>
            </v-card>

            <v-row>
              <v-col
                v-for="card in statCards"
                :key="card.label"
                cols="12"
                sm="6"
                xl="4"
              >
                <v-card color="surface" variant="flat" class="fill-height stat-card">
                  <v-card-text class="d-flex align-center ga-4">
                    <v-avatar color="primary" variant="tonal" size="48">
                      <v-icon :icon="card.icon" />
                    </v-avatar>
                    <div>
                      <div class="text-caption text-medium-emphasis">{{ card.label }}</div>
                      <div class="text-h5 font-weight-bold">{{ card.value }}</div>
                    </div>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>

            <v-row class="mt-1">
              <v-col cols="12" xl="6">
                <v-card color="surface" class="mt-4">
                  <v-card-title class="d-flex justify-space-between align-center my-4">
                    <span>{{ t('latestRequests') }}</span>
                    <v-chip size="small" variant="elevated" color="primary" class="count-pill">{{ summary.latestRequests.length }}</v-chip>
                  </v-card-title>
                  <v-divider />
                  <v-card-text>
                    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />
                    <v-alert
                      v-else-if="!summary.latestRequests.length"
                      type="info"
                      variant="tonal"
                      rounded="xl"
                    >
                      {{ t('waitForRequestCommands') }}
                    </v-alert>
                    <v-table v-else density="comfortable">
                      <thead>
                        <tr>
                          <th>{{ t('time') }}</th>
                          <th>{{ t('user') }}</th>
                          <th>{{ t('request') }}</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="request in summary.latestRequests" :key="request.id">
                          <td>{{ formatDateTime(request.created_at) }}</td>
                          <td>{{ request.chatter_user_name }}</td>
                          <td>{{ request.requested_text }}</td>
                        </tr>
                      </tbody>
                    </v-table>
                  </v-card-text>
                </v-card>
              </v-col>

              <v-col cols="12" xl="6">
                <v-card color="surface" class="mt-4">
                  <v-card-title class="d-flex justify-space-between align-center my-4">
                    <span>{{ t('latestOrders') }}</span>
                    <v-chip size="small" variant="elevated" color="primary" class="count-pill">{{ summary.latestOrders.length }}</v-chip>
                  </v-card-title>
                  <v-divider />
                  <v-card-text>
                    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />
                    <v-alert
                      v-else-if="!summary.latestOrders.length"
                      type="info"
                      variant="tonal"
                      rounded="xl"
                    >
                      {{ t('waitForOrderCommands') }}
                    </v-alert>
                    <v-table v-else density="comfortable">
                      <thead>
                        <tr>
                          <th>{{ t('time') }}</th>
                          <th>{{ t('user') }}</th>
                          <th>{{ t('item') }}</th>
                          <th>{{ t('price') }}</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="order in summary.latestOrders" :key="order.id">
                          <td>{{ formatDateTime(order.created_at) }}</td>
                          <td>{{ order.chatter_user_name }}</td>
                          <td>{{ order.ordered_text }}</td>
                          <td>{{ formatCurrency(order.price_amount || 0) }}</td>
                        </tr>
                      </tbody>
                    </v-table>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>

            <v-row class="mt-1">
              <v-col cols="12">
                <v-card color="surface" class="mt-4">
                  <v-card-title class="d-flex justify-space-between align-center my-4">
                    <span>{{ t('topRequestedItems') }}</span>
                    <v-chip size="small" variant="elevated" color="primary" class="count-pill">{{ summary.topItems.length }}</v-chip>
                  </v-card-title>
                  <v-divider />
                  <v-card-text>
                    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />
                    <v-alert
                      v-else-if="!summary.topItems.length"
                      type="info"
                      variant="tonal"
                      rounded="xl"
                    >
                      {{ t('popularityEmpty') }}
                    </v-alert>
                    <v-table v-else density="comfortable">
                      <thead>
                        <tr>
                          <th>{{ t('item') }}</th>
                          <th>{{ t('count') }}</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="item in summary.topItems" :key="item.normalized_requested_text">
                          <td>{{ item.normalized_requested_text }}</td>
                          <td>{{ item.request_count }}</td>
                        </tr>
                      </tbody>
                    </v-table>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>
          </div>
        </v-window-item>

        <v-window-item value="orders">
          <div class="pt-4">
            <OrdersView :refresh-token="refreshToken" @notify="forwardNotify" />
          </div>
        </v-window-item>

        <v-window-item value="requests">
          <div class="pt-4">
            <RequestsView :refresh-token="refreshToken" />
          </div>
        </v-window-item>

        <v-window-item value="popularity">
          <div class="pt-4">
            <PopularityView :refresh-token="refreshToken" @notify="forwardNotify" />
          </div>
        </v-window-item>
      </v-window>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.dashboard-tabs {
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.tab-counter {
  margin-left: 8px;
  min-width: 24px;
  justify-content: center;
  font-weight: 700;
}

.stat-card {
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.count-pill {
  min-width: 32px;
  justify-content: center;
  font-weight: 700;
  color: #07111b;
}

.bot-actions-card {
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.bot-actions-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
</style>
