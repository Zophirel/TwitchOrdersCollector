<script setup>
defineProps({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  }
});
</script>

<template>
  <section class="empty-state">
    <h3>{{ title }}</h3>
    <p>{{ description }}</p>
  </section>
</template>

<style scoped>
.empty-state {
  display: grid;
  place-items: center;
  min-height: 180px;
  border: 1px dashed rgba(255, 255, 255, 0.14);
  border-radius: 18px;
  color: var(--text-muted);
  text-align: center;
  padding: 24px;
}

.empty-state h3,
.empty-state p {
  margin: 0;
}

.empty-state p {
  margin-top: 6px;
}
</style>
