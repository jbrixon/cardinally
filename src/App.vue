<script setup>
import TheMap from './components/TheMap.vue'
</script>

<template>
  <main class="app-shell">
    <TheMap />
  </main>
</template>

<style>
html,
body,
#app,
.app-shell {
  width: 100%;
  height: 100%;
  min-height: 100%;
}

body {
  min-width: 320px;
  overflow: hidden;
}
</style>
