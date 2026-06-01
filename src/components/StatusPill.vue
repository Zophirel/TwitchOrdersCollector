<script setup>
import { computed } from 'vue';
import { useI18n } from '../composables/i18n';

const props = defineProps({
  state: {
    type: Object,
    required: true
  }
});

const { t } = useI18n();

const toneClass = computed(() => {
  switch (props.state.status) {
    case 'Connected':
      return 'Connected';
    case 'connecting':
      return 'connecting';
    case 'error':
      return 'error';
    default:
      return 'Disconnected';
  }
});

const localizedStatus = computed(() => {
  switch (props.state.status) {
    case 'Connected':
      return t('statusConnected');
    case 'connecting':
      return t('statusConnecting');
    case 'error':
      return t('statusError');
    default:
      return t('statusDisconnected');
  }
});

const localizedDetail = computed(() => {
  if (!props.state.detail || props.state.detail === 'Idle') {
    return t('statusIdle');
  }

  return props.state.detail;
});
</script>

<template>
  <div class="status-pill" :class="toneClass">
    <span class="status-dot" />
    <div>
      <strong>{{ localizedStatus }}</strong>
      <p>{{ localizedDetail }}</p>
    </div>
  </div>
</template>

<style scoped>
.status-pill {
  display: inline-flex;
  gap: 10px;
  align-items: center;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 10px 14px;
  min-width: 220px;
}

.status-pill strong,
.status-pill p {
  margin: 0;
}

.status-pill p {
  font-size: 0.82rem;
  color: var(--text-muted);
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #627487;
  box-shadow: 0 0 0 5px rgba(98, 116, 135, 0.12);
}

.status-pill.Connected .status-dot {
  background: var(--success);
  box-shadow: 0 0 0 5px rgba(71, 194, 125, 0.16);
}

.status-pill.connecting .status-dot {
  background: var(--warning);
  box-shadow: 0 0 0 5px rgba(245, 183, 74, 0.16);
}

.status-pill.error .status-dot {
  background: var(--danger);
  box-shadow: 0 0 0 5px rgba(239, 107, 115, 0.16);
}
</style>
