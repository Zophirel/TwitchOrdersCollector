<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from '../composables/i18n';

const props = defineProps({
  refreshToken: {
    type: Number,
    required: true
  }
});

const { t, formatDateTime } = useI18n();

const filters = ref({
  userId: '',
  itemText: ''
});
const users = ref([]);
const requests = ref([]);
const loading = ref(true);
const sortBy = ref('created_at');
const sortDirection = ref('desc');

const sortableColumns = computed(() => [
  { key: 'created_at', label: t('time') },
  { key: 'chatter_user_name', label: t('user') },
  { key: 'raw_message', label: t('rawRequest') },
  { key: 'normalized_requested_text', label: t('normalizedItem') }
]);

const sortedRequests = computed(() => {
  const direction = sortDirection.value === 'asc' ? 1 : -1;

  return [...requests.value].sort((left, right) => {
    let leftValue = left[sortBy.value];
    let rightValue = right[sortBy.value];

    if (sortBy.value === 'created_at') {
      leftValue = new Date(leftValue).getTime();
      rightValue = new Date(rightValue).getTime();
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

async function loadUsers() {
  users.value = await window.twitchOrders.getUsers();
}

async function loadRequests() {
  loading.value = true;
  requests.value = await window.twitchOrders.getRecentRequests(snapshotFilters());
  loading.value = false;
}

async function refreshData() {
  await loadUsers();
  await loadRequests();
}

onMounted(refreshData);
watch(() => props.refreshToken, refreshData);
</script>

<template>
  <v-card color="surface">
    <v-card-title class="requests-header">
      <div>{{ t('requestLog') }}</div>
      <div class="filters-row">
        <v-select
          v-model="filters.userId"
          :label="t('user')"
          :items="users.map((user) => ({ title: user.chatter_user_name, value: user.chatter_user_id }))"
          clearable
          @update:model-value="loadRequests"
        />
        <v-text-field
          v-model="filters.itemText"
          :label="t('filterByItem')"
          clearable
          @update:model-value="loadRequests"
        />
      </div>
    </v-card-title>
    <v-divider />
    <v-card-text>
      <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />
      <v-alert
        v-else-if="!requests.length"
        type="info"
        variant="tonal"
        rounded="xl"
      >
        {{ t('waitForRequestCommands') }}
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
          </tr>
        </thead>
        <tbody>
          <tr v-for="request in sortedRequests" :key="request.id">
            <td>{{ formatDateTime(request.created_at) }}</td>
            <td>{{ request.chatter_user_name }}</td>
            <td>{{ request.raw_message }}</td>
            <td>{{ request.normalized_requested_text }}</td>
          </tr>
        </tbody>
      </v-table>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.requests-header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.header-title {
  display: flex;
  align-items: center;
  
}

.filters-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(220px, 1fr));
  align-items: start;
  gap: 12px;
  width: min(100%, 520px);
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

@media (max-width: 960px) {
  .filters-row {
    grid-template-columns: 1fr;
    width: 100%;
  }
}
</style>
