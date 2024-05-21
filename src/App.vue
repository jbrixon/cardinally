<script setup>
import TheMap from './components/TheMap.vue'
</script>

<template>
  <main>
    <TheMap />

    <div id="hint">
      <div>MyTRAVELBOX</div>
      <p>Double-click to mark a point as "visited".</p>
    </div>
  </main>
</template>

<style scoped>
main {
  position: fixed;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
}

#hint {
  position: fixed;
  bottom: 16px;
  left: 16px;
  background: gray;
  color: rgba(0, 0, 0, 0.87);
  padding: 24px 16px 32px;
  border-radius: 4px;
}
</style>
