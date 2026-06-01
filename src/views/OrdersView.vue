<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from '../composables/i18n';

const props = defineProps({
  refreshToken: {
    type: Number,
    required: true
  }
});

const emit = defineEmits(['notify']);
const { t, formatCurrency, formatDateLabel } = useI18n();

const filters = ref({
  userId: '',
  itemText: ''
});
const users = ref([]);
const orders = ref([]);
const loading = ref(true);
const sortBy = ref('created_at');
const sortDirection = ref('desc');
const editingOrderId = ref(null);
const editForm = ref({
  orderedText: '',
  priceAmount: ''
});
const savingOrderId = ref(null);
const deletingOrderId = ref(null);

const sortableColumns = computed(() => [
  { key: 'stream_elapsed_seconds', label: t('streamTime') },
  { key: 'chatter_user_name', label: t('user') },
  { key: 'ordered_text', label: t('orderedItem') },
  { key: 'price_amount', label: t('price') }
]);

const sortedOrders = computed(() => {
  const direction = sortDirection.value === 'asc' ? 1 : -1;

  return [...orders.value].sort((left, right) => {
    let leftValue = left[sortBy.value];
    let rightValue = right[sortBy.value];

    if (sortBy.value === 'created_at') {
      leftValue = new Date(leftValue).getTime();
      rightValue = new Date(rightValue).getTime();
    } else if (sortBy.value === 'price_amount' || sortBy.value === 'stream_elapsed_seconds') {
      leftValue = Number(leftValue ?? -1);
      rightValue = Number(rightValue ?? -1);
    } else {
      leftValue = String(leftValue || '').toLocaleLowerCase();
      rightValue = String(rightValue || '').toLocaleLowerCase();
    }

    if (leftValue < rightValue) {
      return -1 * direction;
    }

    if (leftValue > rightValue) {
      return 1 * direction;
    }

    return 0;
  });
});

const groupedRows = computed(() => {
  const rows = [];
  let previousDateKey = '';

  sortedOrders.value.forEach((order) => {
    const dateKey = getDateKey(order.created_at);

    if (dateKey !== previousDateKey) {
      rows.push({
        type: 'date',
        key: `date-${dateKey}`,
        dateKey,
        label: formatDateLabel(order.created_at)
      });
      previousDateKey = dateKey;
    }

    rows.push({
      type: 'order',
      key: `order-${order.id}`,
      order
    });
  });

  return rows;
});

function escapeCsvCell(value) {
  const stringValue = String(value ?? '');
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }

  return stringValue;
}

function buildOrdersCsv(orderRows) {
  const header = [
    t('createdAt'),
    t('streamTime'),
    t('user'),
    t('userLogin'),
    t('orderedItem'),
    t('price'),
    t('rawCommand')
  ];

  const lines = [
    header.map(escapeCsvCell).join(',')
  ];

  orderRows.forEach((order) => {
    lines.push([
      order.created_at,
      formatStreamTime(order.stream_elapsed_seconds),
      order.chatter_user_name,
      order.chatter_user_login,
      order.ordered_text,
      Number(order.price_amount || 0).toFixed(2),
      order.raw_message
    ].map(escapeCsvCell).join(','));
  });

  return lines.join('\n');
}

function downloadCsv(csvContent, fileName) {
  const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(objectUrl);
}

function exportOrdersCsv(orderRows, fileName) {
  if (!orderRows.length) {
    emit('notify', t('exportOrdersEmpty'), t('exportOrdersEmptyBody'), 'warning');
    return;
  }

  downloadCsv(buildOrdersCsv(orderRows), fileName);
  emit('notify', t('exportOrdersSuccess'), t('exportOrdersSuccessBody', {
    count: orderRows.length,
    fileName
  }), 'success');
}

function exportVisibleOrders() {
  exportOrdersCsv(sortedOrders.value, 'orders-visible.csv');
}

function exportOrdersByDate(dateKey) {
  const dayOrders = sortedOrders.value.filter((order) => getDateKey(order.created_at) === dateKey);
  exportOrdersCsv(dayOrders, `orders-${dateKey}.csv`);
}

function snapshotFilters() {
  return JSON.parse(JSON.stringify(filters.value));
}

function toggleSort(columnKey) {
  if (sortBy.value === columnKey) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
    return;
  }

  sortBy.value = columnKey;
  sortDirection.value = columnKey === 'created_at' ? 'desc' : 'asc';
}

function getSortIcon(columnKey) {
  if (sortBy.value !== columnKey) {
    return 'mdi-unfold-more-horizontal';
  }

  return sortDirection.value === 'asc' ? 'mdi-arrow-up' : 'mdi-arrow-down';
}

function startEditing(order) {
  editingOrderId.value = order.id;
  editForm.value = {
    orderedText: order.ordered_text,
    priceAmount: String(Number(order.price_amount || 0))
  };
}

function cancelEditing() {
  editingOrderId.value = null;
  editForm.value = {
    orderedText: '',
    priceAmount: ''
  };
}

async function saveOrder(order) {
  const parsedPrice = Number(String(editForm.value.priceAmount || '').replace(',', '.'));

  savingOrderId.value = order.id;
  try {
    const updatedOrder = await window.twitchOrders.updateOrder({
      id: order.id,
      orderedText: editForm.value.orderedText,
      priceAmount: parsedPrice
    });

    orders.value = orders.value.map((entry) => (entry.id === updatedOrder.id ? updatedOrder : entry));
    emit('notify', t('orderUpdated'), t('orderUpdatedBody', { item: updatedOrder.ordered_text }), 'success');
    cancelEditing();
  } catch (error) {
    emit('notify', t('unableToUpdateOrder'), error.message, 'danger');
  } finally {
    savingOrderId.value = null;
  }
}

async function deleteOrder(order) {
  deletingOrderId.value = order.id;

  try {
    await window.twitchOrders.deleteOrder(order.id);
    orders.value = orders.value.filter((entry) => entry.id !== order.id);
    emit('notify', t('orderDeleted'), t('orderDeletedBody', { item: order.ordered_text }), 'info', {
      timeout: 7000,
      restoreOrder: JSON.parse(JSON.stringify(order))
    });
    if (editingOrderId.value === order.id) {
      cancelEditing();
    }
  } catch (error) {
    emit('notify', t('unableToDeleteOrder'), error.message, 'danger');
  } finally {
    deletingOrderId.value = null;
  }
}

function formatStreamTime(seconds) {
  if (!Number.isFinite(Number(seconds)) || Number(seconds) < 0) {
    return t('offlineUnavailable');
  }

  const total = Math.floor(Number(seconds));
  const hours = String(Math.floor(total / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const remainder = String(total % 60).padStart(2, '0');
  return `${hours}:${minutes}:${remainder}`;
}

function getDateKey(value) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function loadUsers() {
  users.value = await window.twitchOrders.getOrderUsers();
}

async function loadOrders() {
  loading.value = true;
  orders.value = await window.twitchOrders.getRecentOrders(snapshotFilters());
  loading.value = false;
}

async function refreshData() {
  await loadUsers();
  await loadOrders();
}

onMounted(refreshData);
watch(() => props.refreshToken, refreshData);
</script>

<template>
  <v-card color="surface">
    <v-card-title class="orders-header">
      <div>{{ t('ordersTitle') }}</div>
      <div class="orders-toolbar">
        <div class="filters-row">
          <v-select
            v-model="filters.userId"
            :label="t('user')"
            :items="users.map((user) => ({ title: user.chatter_user_name, value: user.chatter_user_id }))"
            clearable
            @update:model-value="loadOrders"
          />
          <v-text-field
            v-model="filters.itemText"
            :label="t('filterByItem')"
            clearable
            @update:model-value="loadOrders"
          />
        </div>
        <v-btn
          color="primary"
          variant="text"
          size="small"
          class="text-title-small"
          prepend-icon="mdi-download"
          :disabled="loading || !orders.length"
          @click="exportVisibleOrders"
        >
          {{ t('exportCsv') }}
        </v-btn>
      </div>
    </v-card-title>
    <v-divider />
    <v-card-text>
      <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />
      <v-alert
        v-else-if="!orders.length"
        type="info"
        variant="tonal"
        rounded="xl"
      >
        {{ t('waitForOrderCommands') }}
      </v-alert>
      <v-table v-else density="comfortable">
        <thead>
          <tr>
            <th v-for="column in sortableColumns" :key="column.key">
              <button class="sort-button" type="button" @click="toggleSort(column.key)">
                <span>{{ column.label }}</span>
                <v-icon :icon="getSortIcon(column.key)" size="16" />
              </button>
            </th>
            <th>{{ t('rawCommand') }}</th>
            <th>{{ t('actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in groupedRows" :key="row.key">
            <template v-if="row.type === 'date'">
              <td colspan="6" class="date-row">
                <div class="date-row-content">
                  <span>{{ row.label }}</span>
                  <v-btn
                    size="small"
                    color="primary"
                    variant="text"
                    prepend-icon="mdi-download"
                    @click.stop="exportOrdersByDate(row.dateKey)"
                  >
                    {{ t('exportDayCsv') }}
                  </v-btn>
                </div>
              </td>
            </template>
            <template v-else>
              <td>{{ formatStreamTime(row.order.stream_elapsed_seconds) }}</td>
              <td>{{ row.order.chatter_user_name }}</td>
              <td>
                <v-text-field
                  v-if="editingOrderId === row.order.id"
                  v-model="editForm.orderedText"
                  density="compact"
                  hide-details
                  variant="outlined"
                />
                <template v-else>
                  {{ row.order.ordered_text }}
                </template>
              </td>
              <td>
                <v-text-field
                  v-if="editingOrderId === row.order.id"
                  v-model="editForm.priceAmount"
                  class="price-input"
                  density="compact"
                  hide-details
                  variant="outlined"
                  type="number"
                  min="0"
                  step="0.01"
                />
                <template v-else>
                  {{ formatCurrency(row.order.price_amount) }}
                </template>
              </td>
              <td>{{ row.order.raw_message }}</td>
              <td>
                <div class="row-actions">
                  <template v-if="editingOrderId === row.order.id">
                    <v-btn
                      size="small"
                      color="primary"
                      variant="elevated"
                      icon="mdi-content-save"
                      :loading="savingOrderId === row.order.id"
                      :disabled="savingOrderId === row.order.id"
                      @click.stop="saveOrder(row.order)"
                    />
                    <v-btn
                      size="small"
                      color="warning"
                      variant="elevated"
                      icon="mdi-close"
                      :disabled="savingOrderId === row.order.id"
                      @click.stop="cancelEditing"
                    />
                  </template>
                  <v-btn
                    v-else
                    size="small"
                    color="info"
                    variant="text"
                    icon="mdi-pencil"
                    :disabled="deletingOrderId === row.order.id"
                    @click.stop="startEditing(row.order)"
                  />
                  <v-btn
                    v-if="editingOrderId !== row.order.id"
                    size="small"
                    color="error"
                    variant="text"
                    icon="mdi-delete"
                    :loading="deletingOrderId === row.order.id"
                    :disabled="deletingOrderId === row.order.id"
                    @click.stop="deleteOrder(row.order)"
                  />
                </div>
              </td>
            </template>
          </tr>
        </tbody>
      </v-table>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.orders-header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.filters-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(220px, 1fr));
  align-items: start;
  gap: 12px;
  width: min(100%, 520px);
}

.orders-toolbar {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
}

.sort-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: 600;
}

.sort-button:hover {
  color: rgb(var(--v-theme-primary));
}

.date-row {
  padding: 12px 16px;
  font-weight: 700;
  color: rgb(var(--v-theme-primary));
  background: rgba(98, 196, 255, 0.08);
}

.date-row-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.row-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.price-input {
  max-width: 120px;
}

@media (max-width: 960px) {
  .filters-row {
    grid-template-columns: 1fr;
    width: 100%;
  }

  .orders-toolbar {
    width: 100%;
    justify-content: stretch;
  }
}
</style>
