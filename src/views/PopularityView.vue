<script setup>
import { onMounted, ref, watch } from 'vue';
import { useI18n } from '../composables/i18n';

const props = defineProps({
  refreshToken: {
    type: Number,
    required: true
  }
});

const emit = defineEmits(['notify']);
const { t, formatDateTime } = useI18n();

const groups = ref([]);
const openGroupKeys = ref([]);
const selectedItem = ref(null);
const matchingRequests = ref([]);
const demotingGroup = ref('');

async function loadPopularity() {
  groups.value = await window.twitchOrders.getPopularityGroups(200);

  if (selectedItem.value) {
    await inspectItem(selectedItem.value.normalizedText, selectedItem.value.label, selectedItem.value.groupLabel);
  }
}

async function inspectItem(normalizedText, label, groupLabel) {
  selectedItem.value = {
    normalizedText,
    label,
    groupLabel
  };
  matchingRequests.value = await window.twitchOrders.getItemRequests(normalizedText);
}

async function demoteGroup(groupKey, label) {
  demotingGroup.value = groupKey;

  try {
    await window.twitchOrders.demotePopularityGroup(groupKey);
    await loadPopularity();
    emit('notify', t('movedDown'), t('groupMovedDownBody', { label }), 'info');
  } catch (error) {
    emit('notify', t('moveGroupDownError'), error.message, 'danger');
  } finally {
    demotingGroup.value = '';
  }
}

onMounted(loadPopularity);
watch(() => props.refreshToken, loadPopularity);
</script>

<template>
  <v-row>
    <v-col cols="12" xl="7">
      <v-card color="surface">
        <v-card-title>
          <div class="text-h6 my-4">{{ t('popularityGroups') }}</div>
        </v-card-title>
        <v-divider />
        <v-card-text>
          <v-alert
            v-if="!groups.length"
            type="info"
            variant="tonal"
            rounded="xl"
          >
            {{ t('popularityEmpty') }}
          </v-alert>
          <v-expansion-panels
            v-else
            v-model="openGroupKeys"
            multiple
            variant="accordion"
          >
            <v-expansion-panel
              v-for="group in groups"
              :key="group.key"
              :value="group.key"
            >
              <v-expansion-panel-title>
                <div class="group-summary">
                  <div class="group-summary-copy">
                    <strong class="group-label">{{ group.label }}</strong>
                    <div class="group-meta">
                      {{ group.totalRequestCount }} {{ t('requestsWord') }}
                      <span v-if="group.directRequestCount" class="direct-count"> · {{ group.directRequestCount }} {{ t('seriesOnly') }}</span>
                    </div>
                  </div>
                  <div class="group-summary-actions">
                    <v-chip size="small" variant="elevated" color="primary" class="count-pill">{{ group.items.length }}</v-chip>
                    <v-btn
                      size="small"
                      variant="text"
                      color="info"
                      icon="mdi-arrow-down-bold"
                      :loading="demotingGroup === group.key"
                      :disabled="demotingGroup === group.key"
                      @click.stop="demoteGroup(group.key, group.label)"
                    />
                  </div>
                </div>
              </v-expansion-panel-title>
              <v-expansion-panel-text>
                <div class="group-items">
                  <v-card
                    v-for="item in group.items"
                    :key="item.normalizedText"
                    variant="outlined"
                    class="item-card"
                    :class="{ active: selectedItem && selectedItem.normalizedText === item.normalizedText }"
                    @click="inspectItem(item.normalizedText, item.label, group.label)"
                  >
                    <v-card-text class="d-flex justify-space-between align-center ga-4">
                      <div>
                        <div class="text-subtitle-2">
                          {{ item.isDirect ? `${group.label} (${t('seriesOnly')})` : item.label }}
                        </div>
                        <div class="text-body-2 text-medium-emphasis">{{ item.normalizedText }}</div>
                      </div>
                      <v-chip size="small" variant="elevated" color="primary" class="count-pill">{{ item.requestCount }}</v-chip>
                    </v-card-text>
                  </v-card>
                </div>
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>
        </v-card-text>
      </v-card>
    </v-col>

    <v-col cols="12" xl="5">
      <v-card color="surface">
        <v-card-title>
          <div class="text-h6 my-4">{{ t('matchingRawRequests') }}</div>
        </v-card-title>
        <v-divider />
        <v-card-text>
          <v-alert
            v-if="!selectedItem"
            type="info"
            variant="tonal"
            rounded="xl"
          >
            {{ t('popularitySelectHint') }}
          </v-alert>
          <v-table v-else density="comfortable">
            <thead>
              <tr>
                <th>{{ t('time') }}</th>
                <th>{{ t('user') }}</th>
                <th>{{ t('rawRequest') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="request in matchingRequests" :key="request.id">
                <td>{{ formatDateTime(request.created_at) }}</td>
                <td>{{ request.chatter_user_name }}</td>
                <td>{{ request.raw_message }}</td>
              </tr>
            </tbody>
          </v-table>
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>
</template>

<style scoped>
.group-summary {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding-right: 16px;
}

.group-summary-copy {
  min-width: 0;
}

.group-summary-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.group-label {
  display: block;
}

.group-meta {
  margin-top: 8px;
  color: rgba(235, 240, 246, 0.8);
  font-size: 0.92rem;
}

.direct-count {
  color: rgba(235, 240, 246, 0.92);
}

.count-pill {
  min-width: 32px;
  justify-content: center;
  font-weight: 700;
  color: #07111b;
}

.group-items {
  display: grid;
  gap: 10px;
}

.item-card {
  cursor: pointer;
  transition: border-color 160ms ease, background-color 160ms ease;
}

.item-card.active {
  border-color: rgba(98, 196, 255, 0.32);
  background: rgba(98, 196, 255, 0.08);
}
</style>
