<script setup>
defineProps({
  toasts: {
    type: Array,
    required: true
  }
});
</script>

<template>
  <div class="toast-stack">
    <article
      v-for="toast in toasts"
      :key="toast.id"
      class="toast"
      :class="toast.tone"
    >
      <strong>{{ toast.title }}</strong>
      <p>{{ toast.body }}</p>
    </article>
  </div>
</template>

<style scoped>
.toast-stack {
  position: fixed;
  right: 24px;
  bottom: 24px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  z-index: 20;
}

.toast {
  width: 300px;
  background: rgba(18, 24, 32, 0.94);
  border: 1px solid var(--border);
  border-left: 3px solid var(--accent);
  border-radius: 14px;
  box-shadow: var(--shadow);
  padding: 14px;
}

.toast strong,
.toast p {
  margin: 0;
}

.toast p {
  color: var(--text-muted);
  margin-top: 6px;
}

.toast.success {
  border-left-color: var(--success);
}

.toast.danger {
  border-left-color: var(--danger);
}
</style>
