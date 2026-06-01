<script setup>
import { computed } from 'vue';
import { useI18n } from '../composables/i18n';
import StatusPill from './StatusPill.vue';

const props = defineProps({
  items: {
    type: Array,
    required: true
  },
  activeView: {
    type: String,
    required: true
  },
  currentLocale: {
    type: String,
    required: true
  },
  localeOptions: {
    type: Array,
    required: true
  },
  connectionState: {
    type: Object,
    required: true
  }
});

defineEmits(['navigate', 'locale-change']);

const { t } = useI18n();

const currentTitle = computed(() => {
  const current = props.items.find((item) => item.key === props.activeView);
  return current ? current.label : t('navDashboard');
});
</script>

<template>
  <div class="shell">
    <aside class="sidebar">
      <div class="brand">
        <div>
          <h1>Twitch Orders Collector</h1>
          <p>{{ t('brandSubtitle') }}</p>
        </div>
      </div>

      <nav class="nav">
        <button
          v-for="item in items"
          :key="item.key"
          class="nav-item"
          :class="{ active: item.key === activeView }"
          @click="$emit('navigate', item.key)"
        >
          {{ item.label }}
        </button>
      </nav>
    </aside>

    <div class="content">
      <header class="topbar">
        <div>
          <h2>{{ currentTitle }}</h2>
        </div>
        <div class="topbar-actions">
          <v-select
            :model-value="currentLocale"
            :items="localeOptions"
            :label="t('language')"
            density="compact"
            variant="outlined"
            hide-details
            class="locale-select"
            @update:model-value="$emit('locale-change', $event)"
          />
          <StatusPill :state="connectionState" />
        </div>
      </header>

      <main class="main">
        <slot />
      </main>
    </div>
  </div>
</template>

<style scoped>
.shell {
  display: grid;
  grid-template-columns: 260px 1fr;
  min-height: 100vh;
}

.sidebar {
  border-right: 1px solid var(--border);
  background: linear-gradient(180deg, rgba(21, 27, 35, 0.98), rgba(15, 21, 28, 0.98));
  padding: 28px 22px;
}

.brand {
  display: flex;
  gap: 14px;
  align-items: center;
  margin-bottom: 34px;
}

.brand h1,
.topbar h2 {
  margin: 0;
  font-size: 1.05rem;
}

.brand p,
.topbar p {
  margin: 4px 0 0;
  color: var(--text-muted);
  font-size: 0.92rem;
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.nav-item {
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-muted);
  text-align: left;
  padding: 12px 14px;
  border-radius: 14px;
  transition: 180ms ease;
}

.nav-item:hover,
.nav-item.active {
  color: var(--text);
  border-color: rgba(98, 196, 255, 0.18);
  background: rgba(98, 196, 255, 0.08);
}

.content {
  display: flex;
  flex-direction: column;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 26px 32px 18px;
  border-bottom: 1px solid var(--border);
  backdrop-filter: blur(18px);
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.locale-select {
  width: 170px;
}

.main {
  padding: 24px 32px 32px;
}

@media (max-width: 980px) {
  .shell {
    grid-template-columns: 1fr;
  }

  .sidebar {
    border-right: 0;
    border-bottom: 1px solid var(--border);
  }

  .topbar {
    align-items: flex-start;
    flex-direction: column;
    gap: 12px;
  }

  .topbar-actions {
    width: 100%;
    flex-direction: column;
    align-items: stretch;
  }

  .locale-select {
    width: 100%;
  }
}
</style>
