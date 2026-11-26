<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import MapCanvas from './MapCanvas.vue'
import PlaceSearch from './PlaceSearch.vue'
import RangeMetrics from './RangeMetrics.vue'
import { addVisit, createTravelBox, parseStoredVisits } from '../lib/travelbox.js'

const STORAGE_KEY = 'travelbox.visits.v1'
const baseUrl = import.meta.env.BASE_URL
const mapCanvas = ref(null)
const placeSearch = ref(null)
const controlsPanel = ref(null)
const sheetExpanded = ref(false)
const sheetOffset = ref(null)
let sheetDrag = null
let dragged = false
const isMobile = () => window.matchMedia('(max-width: 640px)').matches

function startSheetDrag(event) {
  dragged = false
  if (!isMobile() || !event.isPrimary || event.button !== 0) return
  const handle = event.target.closest('.sheet-handle')
  if (!handle && (sheetExpanded.value || event.target.closest('input, button, a, [role="option"]'))) return
  const panel = controlsPanel.value
  const collapsedOffset = panel.offsetHeight - panel.querySelector('.sheet-handle').offsetHeight - parseFloat(getComputedStyle(panel).paddingBottom)
  sheetDrag = { pointerId: event.pointerId, y: event.clientY, offset: sheetExpanded.value ? 0 : collapsedOffset, collapsedOffset }
  event.target.setPointerCapture(event.pointerId)
}

function moveSheet(event) {
  if (!sheetDrag || event.pointerId !== sheetDrag.pointerId) return
  const delta = event.clientY - sheetDrag.y
  if (Math.abs(delta) > 6) dragged = true
  if (dragged) sheetOffset.value = Math.max(0, Math.min(sheetDrag.collapsedOffset, sheetDrag.offset + delta))
}

function endSheetDrag(event) {
  if (!sheetDrag || event.pointerId !== sheetDrag.pointerId) return
  if (dragged && event.type === 'pointerup') {
    const delta = event.clientY - sheetDrag.y
    sheetExpanded.value = Math.abs(delta) > 40 ? delta < 0 : sheetOffset.value < sheetDrag.collapsedOffset / 2
  }
  sheetDrag = null
  sheetOffset.value = null
}

function handleSheetClick(event) {
  if (!dragged) return
  event.preventDefault()
  event.stopPropagation()
  dragged = false
}

function expandForFocus() {
  if (isMobile()) sheetExpanded.value = true
}

const points = ref([])
const formError = ref('')
const storageMode = ref('saved')
const travelBox = computed(() => createTravelBox(points.value))
let canPersist = true

function loadVisits() {
  let savedValue
  try {
    savedValue = window.localStorage.getItem(STORAGE_KEY)
  } catch {
    storageMode.value = 'unavailable'
    canPersist = false
    return
  }

  if (savedValue === null) return

  const result = parseStoredVisits(savedValue)
  if (result.error) {
    storageMode.value = 'unreadable'
    canPersist = false
    return
  }

  points.value = result.points
}

function persistVisits() {
  if (!canPersist || storageMode.value !== 'saved') return

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(points.value))
  } catch {
    storageMode.value = 'unavailable'
    canPersist = false
  }
}

function addCoordinates(latitude, longitude) {
  const result = addVisit(points.value, latitude, longitude)
  if (result.error) {
    formError.value = result.error
    return false
  }

  points.value = result.points
  formError.value = ''
  return true
}

function chooseSuggestion(suggestion) {
  if (!addCoordinates(suggestion.coordinates[1], suggestion.coordinates[0])) return
  placeSearch.value.reset()
  nextTick(fitBox)
}

async function fitBox() {
  if (isMobile() && sheetExpanded.value) {
    sheetExpanded.value = false
    await nextTick()
    await Promise.allSettled(controlsPanel.value.getAnimations().map((animation) => animation.finished))
  }
  mapCanvas.value.fitBox()
}

function removeVisit(index) {
  points.value = points.value.filter((_, pointIndex) => pointIndex !== index)
  formError.value = ''
}

function clearVisits() {
  if (!window.confirm('Clear all visits from this browser?')) return
  points.value = []
  formError.value = ''
}

function replaceUnreadableVisits() {
  if (!window.confirm('Replace the unreadable saved visits with the list shown here?')) return
  canPersist = true
  storageMode.value = 'saved'
  persistVisits()
}

watch(points, persistVisits, { deep: true })

onMounted(() => {
  loadVisits()
  if (points.value.length > 0) nextTick(fitBox)
})
</script>

<template>
  <header class="app-header">
    <a class="brand" :href="baseUrl" aria-label="Cardinally home">
      <img :src="`${baseUrl}cardinally-mark.svg`" alt="" width="44" height="44" />
      <h1>Cardinally<span class="brand-period">.</span></h1>
    </a>
    <span class="brand-tagline">Expand your range.</span>
    <div class="header-caption"><span class="header-rule"></span>Your personal travel atlas</div>
  </header>
  <MapCanvas
    ref="mapCanvas"
    :points="points"
    :travel-box="travelBox"
    :controls-panel="controlsPanel"
    @add="addCoordinates"
    @remove="removeVisit"
  />

  <aside
    ref="controlsPanel"
    class="controls-panel"
    :class="{ 'sheet-expanded': sheetExpanded, 'sheet-dragging': sheetOffset !== null }"
    :style="sheetOffset !== null ? { '--sheet-offset': `${sheetOffset}px` } : undefined"
    aria-label="Cardinally controls"
    @pointerdown="startSheetDrag"
    @pointermove="moveSheet"
    @pointerup="endSheetDrag"
    @pointercancel="endSheetDrag"
    @lostpointercapture="endSheetDrag"
    @click.capture="handleSheetClick"
  >
    <button
      type="button"
      class="sheet-handle"
      :aria-label="sheetExpanded ? 'Collapse menu' : 'Expand menu'"
      :aria-expanded="sheetExpanded"
      aria-controls="sheet-content"
      @click="sheetExpanded = !sheetExpanded"
      @keydown.up.prevent="sheetExpanded = true"
      @keydown.down.prevent="sheetExpanded = false"
      @keydown.esc.prevent="sheetExpanded = false"
    ><span aria-hidden="true"></span></button>
    <div id="sheet-content" class="panel-content" @focusin="expandForFocus">
      <header class="panel-header">
        <h2>The places you go.<br /><em>The world you make.</em></h2>
        <p>A little further, a little wider. See the world you’ve explored, one place at a time.</p>
      </header>

      <PlaceSearch
        ref="placeSearch"
        :error="formError"
        @select="chooseSuggestion"
        @clear-error="formError = ''"
      />
      <RangeMetrics
        :travel-box="travelBox"
        :has-visits="points.length > 0"
        @fit="fitBox"
        @clear="clearVisits"
      />

      <p v-if="storageMode === 'saved'" class="storage-status" role="status">
        Visits are saved in this browser.
      </p>
      <div v-else-if="storageMode === 'unavailable'" class="storage-warning" role="status">
        Browser storage is unavailable. Visits will stay only for this session.
      </div>
      <div v-else class="storage-warning" role="alert" data-testid="storage-warning">
        <p>Saved visits could not be read. This session will not replace them automatically.</p>
        <button type="button" @click="replaceUnreadableVisits">Replace unreadable saved data</button>
      </div>
      <p class="source-links">
        <a href="https://github.com/jbrixon/cardinally">Source code</a>
        · <a href="https://github.com/jbrixon/cardinally/blob/main/LICENSE">AGPL-3.0</a>
      </p>
    </div>
  </aside>
  <div class="map-compass" aria-hidden="true"><span>N</span><img :src="`${baseUrl}cardinally-mark.svg`" alt="" width="56" height="56" /></div>
  <div class="map-note"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 3 11 9-6 1-3 6Z"/></svg>Double-click anywhere to mark a place</div>
</template>

<style scoped>
.app-header {
  position: absolute; inset: 0 0 auto; height: 80px; z-index: 1200;
  display: flex; align-items: center; gap: 28px; padding: 0 32px;
  background: var(--paper); border-bottom: 1px solid var(--line);
}
.brand { display: flex; align-items: center; gap: 10px; color: var(--ink); text-decoration: none; }
.brand h1 { font-size: 29px; font-weight: 750; letter-spacing: -1.1px; line-height: 1; }
.brand-period { color: var(--red); }
.brand-tagline { padding-left: 28px; border-left: 1px solid var(--line); color: var(--muted); font-size: 14px; letter-spacing: .025em; }
.header-caption { margin-left: auto; display: flex; align-items: center; gap: 12px; color: var(--green); font-size: 13px; }
.header-rule { width: 26px; height: 1px; background: var(--green); }
.controls-panel {
  position: absolute; z-index: 1100; top: 104px; bottom: 24px; left: 24px;
  display: flex; width: 352px; height: fit-content; max-height: calc(100dvh - 128px);
  flex-direction: column; overflow-y: auto; padding: 28px;
  border-radius: 12px; background: var(--paper); color: var(--ink);
  box-shadow: 0 8px 32px rgb(39 43 28 / 14%); overscroll-behavior: contain;
}
.panel-content { min-height: 0; }
.sheet-handle { display: none; }
.panel-header { padding-bottom: 26px; border-bottom: 1px solid var(--line); }
.panel-header h2 { font-family: Georgia, 'Times New Roman', serif; font-size: 28px; font-weight: 400; line-height: 1.22; letter-spacing: -.7px; }
.panel-header em { color: var(--green); font-weight: 400; }
.panel-header p { margin-top: 12px; color: var(--muted); font-size: 14px; line-height: 1.65; }
button { min-height: 36px; padding: 6px 10px; border: 1px solid var(--line); border-radius: 5px; background: transparent; color: var(--green); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; transition: background-color 150ms ease; }
button:hover:not(:disabled) { background: #eaeadd; }
button:disabled { cursor: not-allowed; opacity: .45; }
button:focus-visible, input:focus-visible, a:focus-visible { outline: 2px solid var(--green); outline-offset: 3px; }
.storage-status, .storage-warning { margin-top: 22px; font-size: 12px; }
.storage-status { padding-top: 16px; border-top: 1px solid var(--line); color: var(--muted); text-align: center; }
.storage-warning { display: grid; gap: 8px; padding: 10px; border: 1px solid var(--red); border-radius: 5px; background: #fff0e7; color: #80231b; }
.storage-warning button { justify-self: start; }
.source-links { margin-top: 8px; color: var(--muted); font-size: 12px; text-align: center; }
.source-links a { display: inline-block; padding: 6px 2px; color: var(--green); text-underline-offset: 3px; }
.map-compass { position: absolute; z-index: 500; right: 28px; bottom: 55px; display: grid; justify-items: center; gap: 3px; pointer-events: none; }
.map-compass span { color: var(--green); font-size: 12px; font-weight: 700; }
.map-note { position: absolute; z-index: 500; bottom: 24px; left: calc(50% + 176px); transform: translateX(-50%); display: flex; align-items: center; gap: 8px; white-space: nowrap; padding: 10px 16px; border-radius: 5px; background: var(--paper); color: var(--green); box-shadow: 0 3px 12px rgb(39 43 28 / 10%); font-size: 12px; pointer-events: none; }
.map-note svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.5; }
@media (max-width: 800px) { .header-caption { display: none; } .map-note { display: none; } }
@media (max-width: 640px) {
  .app-header { height: 72px; padding: 0 16px; gap: 12px; }
  .brand { gap: 6px; } .brand img { width: 36px; height: 36px; } .brand h1 { font-size: 25px; }
  .brand-tagline { margin-left: auto; padding-left: 0; border: 0; font-size: 12px; }
  .controls-panel {
    top: auto; right: 0; bottom: 0; left: 0; width: auto;
    height: calc(100dvh - 92px); max-height: none; padding: 0 0 env(safe-area-inset-bottom); overflow: hidden;
    border-radius: 28px 28px 0 0;
    transform: translateY(var(--sheet-offset, calc(100% - 56px - env(safe-area-inset-bottom))));
    transition: transform 280ms cubic-bezier(0.16, 1, 0.3, 1);
    touch-action: none;
  }
  .controls-panel.sheet-expanded { --sheet-offset: 0px; }
  .controls-panel.sheet-dragging { transition: none; user-select: none; }
  .sheet-handle {
    display: flex; flex: 0 0 56px; align-items: center; justify-content: center;
    width: 100%; padding: 0; border: 0; border-radius: 0; cursor: grab; touch-action: none;
  }
  .sheet-handle:active { cursor: grabbing; }
  .sheet-handle span { width: 32px; height: 4px; border-radius: 2px; background: var(--muted); }
  .sheet-handle:focus-visible { outline-offset: -4px; }
  .panel-content { flex: 1; padding: 0 20px 20px; overflow: hidden; }
  .sheet-expanded { touch-action: pan-y; }
  .sheet-expanded .panel-content { overflow-y: auto; overscroll-behavior: contain; touch-action: pan-y; }
  .panel-header { padding-bottom: 18px; } .panel-header h2 { font-size: 25px; }
  .panel-header p { margin-top: 8px; }
  .map-compass { right: 16px; bottom: calc(56px + env(safe-area-inset-bottom) + 16px); }
  .map-compass img { width: 40px; height: 40px; }
}
@media (prefers-reduced-motion: reduce) { .controls-panel { transition: none; } }
</style>
