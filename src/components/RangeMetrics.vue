<script setup>
defineProps({
  travelBox: { type: Object, default: null },
  hasVisits: { type: Boolean, required: true }
})
defineEmits(['fit', 'clear'])

const formatMetric = (value, digits = 1) =>
  value.toLocaleString(undefined, { maximumFractionDigits: digits })
</script>

<template>
  <section class="metrics-section" aria-labelledby="box-heading">
    <div class="section-heading-row">
      <h2 id="box-heading">Your range</h2>
      <button class="text-button" type="button" :disabled="!travelBox" @click="$emit('fit')">Fit box</button>
    </div>
    <p class="section-note">Approximate geographic measurements</p>
    <dl class="metrics-list">
      <div>
        <dt>Range area</dt>
        <dd data-testid="box-area">{{ formatMetric(travelBox?.areaKm2 ?? 0) }} km²</dd>
      </div>
      <div>
        <dt>North–south span</dt>
        <dd data-testid="north-south-span">
          {{ formatMetric(travelBox?.northSouthKm ?? 0) }} km
        </dd>
      </div>
      <div>
        <dt>East–west span</dt>
        <dd data-testid="east-west-span">
          {{ formatMetric(travelBox?.eastWestKm ?? 0) }} km
        </dd>
      </div>
    </dl>
    <button class="text-button clear-visits" type="button" :disabled="!hasVisits" @click="$emit('clear')">
      Clear all
    </button>
  </section>
</template>

<style scoped>
.metrics-section { display: grid; gap: 12px; padding-top: 22px; margin-top: 24px; border-top: 1px solid var(--line); }
.section-heading-row h2 { font-size: 16px; font-weight: 650; }
.section-note { color: var(--muted); font-size: 12px; margin-top: -7px; }
button { min-height: 36px; padding: 6px 10px; border: 1px solid var(--line); border-radius: 5px; background: transparent; color: var(--green); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; transition: background-color 150ms ease; }
button:hover:not(:disabled) { background: #eaeadd; }
button:disabled { cursor: not-allowed; opacity: .45; }
button:focus-visible { outline: 2px solid var(--green); outline-offset: 3px; }
.section-heading-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.text-button { min-height: 30px; padding: 3px 0 3px 8px; border: 0; font-size: 12px; text-decoration: underline; text-underline-offset: 3px; }
.metrics-list { display: grid; gap: 10px; margin: 2px 0 0; }
.metrics-list > div { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.metrics-list dt { color: var(--muted); font-size: 13px; }
.metrics-list dd { margin: 0; color: var(--green); font-size: 14px; font-weight: 650; font-variant-numeric: tabular-nums; text-align: right; }
.clear-visits { justify-self: end; }
@media (max-width: 640px) { .metrics-section { padding-top: 18px; margin-top: 18px; } }
</style>
