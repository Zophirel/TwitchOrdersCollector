<script setup>
import { onMounted, ref, watch } from 'vue';
import { useI18n } from '../composables/i18n';

const props = defineProps({
  refreshToken: {
    type: Number,
    required: true
  }
});

const { t, formatDateTime } = useI18n();

const users = ref([]);
const selectedUser = ref(null);
const selectedRequests = ref([]);

async function loadUsers() {
  users.value = await window.twitchOrders.getUsers();
  if (selectedUser.value) {
    await inspectUser(selectedUser.value.chatter_user_id);
  }
}

async function inspectUser(userId) {
  selectedUser.value = users.value.find((user) => user.chatter_user_id === userId) || null;
  selectedRequests.value = await window.twitchOrders.getUserRequests(userId);
}

onMounted(loadUsers);
watch(() => props.refreshToken, loadUsers);
</script>

<template>
  <v-row>
    <v-col cols="12" xl="5">
      <v-card color="surface">
        <v-card-title>
          <div class="text-h6 my-4">{{ t('chatters') }}</div>
        </v-card-title>
        <v-divider />
        <v-card-text>
          <v-alert
            v-if="!users.length"
            type="info"
            variant="tonal"
            rounded="xl"
          >
            {{ t('usersEmpty') }}
          </v-alert>
          <v-table v-else density="comfortable">
            <thead>
              <tr>
                <th>{{ t('user') }}</th>
                <th>{{ t('requestsColumn') }}</th>
                <th>{{ t('latest') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="user in users"
                :key="user.chatter_user_id"
                :class="{ active: selectedUser && user.chatter_user_id === selectedUser.chatter_user_id }"
                @click="inspectUser(user.chatter_user_id)"
              >
                <td>{{ user.chatter_user_name }}</td>
                <td>{{ user.request_count }}</td>
                <td>{{ formatDateTime(user.latest_request_at) }}</td>
              </tr>
            </tbody>
          </v-table>
        </v-card-text>
      </v-card>
    </v-col>

    <v-col cols="12" xl="7">
      <v-card color="surface">
        <v-card-title>
          <div class="text-h6">{{ t('userHistory') }}</div>
          <div class="text-body-2 text-medium-emphasis">
            {{ selectedUser ? selectedUser.chatter_user_name : t('selectChatter') }}
          </div>
        </v-card-title>
        <v-divider />
        <v-card-text>
          <v-alert
            v-if="!selectedUser"
            type="info"
            variant="tonal"
            rounded="xl"
          >
            {{ t('chooseChatter') }}
          </v-alert>
          <v-table v-else density="comfortable">
            <thead>
              <tr>
                <th>{{ t('time') }}</th>
                <th>{{ t('rawRequest') }}</th>
                <th>{{ t('normalizedItem') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="request in selectedRequests" :key="request.id">
                <td>{{ formatDateTime(request.created_at) }}</td>
                <td>{{ request.raw_message }}</td>
                <td>{{ request.normalized_requested_text }}</td>
              </tr>
            </tbody>
          </v-table>
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>
</template>

<style scoped>
tbody tr {
  cursor: pointer;
}

tbody tr.active {
  background: rgba(98, 196, 255, 0.08);
}
</style>
