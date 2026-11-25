<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import L from 'leaflet'
import {
  addVisit,
  createTravelBox,
  isBoundaryVisit,
  parseStoredVisits,
  unwrapLongitude
} from '../lib/travelbox.js'

const STORAGE_KEY = 'travelbox.visits.v1'

const mapElement = ref(null)
const controlsPanel = ref(null)
const points = ref([])
const latitudeInput = ref('')
const longitudeInput = ref('')
const formError = ref('')
const storageMode = ref('saved')
const travelBox = computed(() => createTravelBox(points.value))

let map = null
let pointLayer = null
let boxLayer = null
let canPersist = true

const formatMetric = (value, digits = 1) =>
  value.toLocaleString(undefined, { maximumFractionDigits: digits })

const formatCoordinate = (value) => Number(value.toFixed(4)).toString()

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

function renderPoints() {
  if (!pointLayer || !boxLayer) return

  pointLayer.clearLayers()
  boxLayer.clearLayers()

  const box = travelBox.value
  if (!box) return

  points.value.forEach((point, index) => {
    const [longitude, latitude] = point
    const highlighted = isBoundaryVisit(point, box)
    const marker = L.circleMarker([latitude, unwrapLongitude(longitude, box.west)], {
      radius: highlighted ? 7 : 5,
      color: highlighted ? '#b82019' : '#234c39',
      weight: 2,
      fillColor: highlighted ? '#c42a20' : '#52735a',
      fillOpacity: 0.9
    }).addTo(pointLayer)
    const coordinates = `${formatCoordinate(latitude)}°, ${formatCoordinate(longitude)}°`
    marker.bindPopup(() => {
      Object.assign(marker.getPopup().options, popupPadding())
      const card = document.createElement('div')
      card.className = 'visit-popup-card'
      const details = document.createElement('div')
      const heading = document.createElement('h2')
      heading.textContent = 'Place visited'
      const location = document.createElement('p')
      location.textContent = coordinates
      details.append(heading, location)
      const remove = document.createElement('button')
      remove.type = 'button'
      remove.className = 'remove-visit-button'
      remove.setAttribute('aria-label', `Remove visit at ${coordinates}`)
      remove.title = 'Remove place'
      remove.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6"/></svg>'
      remove.addEventListener('click', () => removeVisit(index))
      card.append(details, remove)
      L.DomEvent.disableClickPropagation(card)
      return card
    }, {
      className: 'visit-popup'
    })
    const element = marker.getElement()
    element.setAttribute('tabindex', '0')
    element.setAttribute('role', 'button')
    element.setAttribute('aria-label', `Place visited at ${coordinates}`)
    element.setAttribute('aria-haspopup', 'dialog')
    marker.on('keydown', (event) => {
      if (event.originalEvent.key === 'Enter' || event.originalEvent.key === ' ') {
        L.DomEvent.preventDefault(event.originalEvent)
        marker.openPopup()
      }
    })
    marker.on('dblclick', L.DomEvent.stopPropagation)
  })

  const polygon = [
    [box.south, box.west],
    [box.south, box.east],
    [box.north, box.east],
    [box.north, box.west]
  ]
  L.polygon(polygon, {
    color: '#b82019',
    weight: 2,
    fillColor: '#bc211b',
    fillOpacity: 0.07,
    dashArray: '6 5',
    interactive: false
  }).addTo(boxLayer)
}

function addCoordinates(latitude, longitude, clearInputs = false) {
  const result = addVisit(points.value, latitude, longitude)
  if (result.error) {
    formError.value = result.error
    return false
  }

  points.value = result.points
  formError.value = ''
  if (clearInputs) {
    latitudeInput.value = ''
    longitudeInput.value = ''
    nextTick(fitBox)
  }
  return true
}

function handleFormSubmit() {
  addCoordinates(latitudeInput.value, longitudeInput.value, true)
}

function handleDoubleClick(event) {
  addCoordinates(event.latlng.lat, event.latlng.lng)
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

function popupPadding() {
  const mapRect = map.getContainer().getBoundingClientRect()
  const panelRect = controlsPanel.value.getBoundingClientRect()
  const mobile = window.matchMedia('(max-width: 640px)').matches
  return {
    autoPanPaddingTopLeft: [mobile ? 16 : panelRect.right - mapRect.left + 16, 16],
    autoPanPaddingBottomRight: [16, mobile ? mapRect.bottom - panelRect.top + 16 : 16]
  }
}

function fitBox() {
  if (!map || !travelBox.value) return
  const box = travelBox.value

  if (box.north === box.south && box.east === box.west) {
    map.setView([box.north, box.west], 4, { animate: false })
    return
  }

  const mapRect = map.getContainer().getBoundingClientRect()
  const panelRect = controlsPanel.value.getBoundingClientRect()
  const paddingTopLeft = [32, 32]
  const paddingBottomRight = [32, 32]

  if (window.matchMedia('(max-width: 640px)').matches) {
    paddingBottomRight[1] = Math.min(mapRect.bottom - panelRect.top + 24, mapRect.height * 0.45)
  } else {
    paddingTopLeft[0] = Math.min(panelRect.right - mapRect.left + 24, mapRect.width * 0.45)
  }

  map.fitBounds(
    [
      [box.south, box.west],
      [box.north, box.east]
    ],
    { paddingTopLeft, paddingBottomRight, maxZoom: 8, animate: false }
  )
}

watch(
  points,
  () => {
    renderPoints()
    persistVisits()
  },
  { deep: true }
)

onMounted(() => {
  loadVisits()

  map = L.map(mapElement.value, {
    center: [18, 0],
    zoom: 2,
    zoomControl: false
  })
  L.control.zoom({ position: 'topright' }).addTo(map)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
    crossOrigin: true
  }).addTo(map)
  map.attributionControl.setPosition('topright')
  map.doubleClickZoom.disable()
  map.on('dblclick', handleDoubleClick)

  pointLayer = L.layerGroup().addTo(map)
  boxLayer = L.layerGroup().addTo(map)
  renderPoints()
  if (points.value.length > 0) nextTick(fitBox)
})

onBeforeUnmount(() => {
  if (!map) return
  map.off('dblclick', handleDoubleClick)
  map.remove()
  map = null
})
</script>

<template>
  <header class="app-header">
    <a class="brand" href="/" aria-label="Cardinally home">
      <img src="/cardinally-mark.svg" alt="" width="44" height="44" />
      <h1>Cardinally<span class="brand-period">.</span></h1>
    </a>
    <span class="brand-tagline">Expand your range.</span>
    <div class="header-caption"><span class="header-rule"></span>Your personal travel atlas</div>
  </header>
  <div ref="mapElement" class="map-canvas" aria-label="Map of visited places"></div>

  <aside ref="controlsPanel" class="controls-panel" aria-label="Cardinally controls">
    <header class="panel-header">
      <h2>The places you go.<br /><em>The world you make.</em></h2>
      <p>A little further, a little wider. See the world you’ve explored, one place at a time.</p>
    </header>

    <form class="coordinate-form" novalidate @submit.prevent="handleFormSubmit">
      <h2>Add a place</h2>
      <p class="section-note">Enter coordinates or double-click the map.</p>
      <div class="coordinate-fields">
        <label>
          Latitude
          <input
            v-model="latitudeInput"
            name="latitude"
            type="number"
            min="-90"
            max="90"
            step="any"
            placeholder="e.g. 48.2082"
            autocomplete="off"
            required
          />
        </label>
        <label>
          Longitude
          <input
            v-model="longitudeInput"
            name="longitude"
            type="number"
            min="-180"
            max="180"
            step="any"
            placeholder="e.g. 16.3738"
            autocomplete="off"
            required
          />
        </label>
      </div>
      <button class="primary-button" type="submit"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-6.1 7-12a7 7 0 0 0-14 0c0 5.9 7 12 7 12Z"/><circle cx="12" cy="9" r="2.5"/></svg>Add place</button>
      <p v-if="formError" class="error-message" role="alert">{{ formError }}</p>
    </form>

    <section class="metrics-section" aria-labelledby="box-heading">
      <div class="section-heading-row">
        <h2 id="box-heading">Your range</h2>
        <button class="text-button" type="button" :disabled="!travelBox" @click="fitBox">Fit box</button>
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
      <button class="text-button clear-visits" type="button" :disabled="points.length === 0" @click="clearVisits">
        Clear all
      </button>
    </section>

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
  </aside>
  <div class="map-compass" aria-hidden="true"><span>N</span><img src="/cardinally-mark.svg" alt="" width="56" height="56" /></div>
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
.map-canvas { position: absolute; inset: 80px 0 0; background: #e6e9dc; }
.controls-panel {
  position: absolute; z-index: 1100; top: 104px; bottom: 24px; left: 24px;
  display: flex; width: 352px; height: fit-content; max-height: calc(100dvh - 128px);
  flex-direction: column; overflow-y: auto; padding: 28px;
  border-radius: 12px; background: var(--paper); color: var(--ink);
  box-shadow: 0 8px 32px rgb(39 43 28 / 14%); overscroll-behavior: contain;
}
.panel-header { padding-bottom: 26px; border-bottom: 1px solid var(--line); }
.panel-header h2 { font-family: Georgia, 'Times New Roman', serif; font-size: 28px; font-weight: 400; line-height: 1.22; letter-spacing: -.7px; }
.panel-header em { color: var(--green); font-weight: 400; }
.panel-header p { margin-top: 12px; color: var(--muted); font-size: 14px; line-height: 1.65; }
.coordinate-form, .metrics-section { display: grid; gap: 12px; padding-top: 22px; }
.metrics-section { margin-top: 24px; border-top: 1px solid var(--line); }
.coordinate-form h2, .section-heading-row h2 { font-size: 16px; font-weight: 650; }
.section-note { color: var(--muted); font-size: 12px; margin-top: -7px; }
.coordinate-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.coordinate-fields label { display: grid; gap: 6px; color: var(--muted); font-size: 13px; font-weight: 500; }
.coordinate-fields input {
  width: 100%; min-width: 0; min-height: 44px; padding: 10px;
  border: 1px solid #c9c7b9; border-radius: 5px; background: #fffdf7; color: var(--ink); font: inherit; font-size: 14px;
}
.coordinate-fields input::placeholder { color: #77766b; }
button { min-height: 36px; padding: 6px 10px; border: 1px solid var(--line); border-radius: 5px; background: transparent; color: var(--green); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; transition: background-color 150ms ease; }
button:hover:not(:disabled) { background: #eaeadd; }
button:disabled { cursor: not-allowed; opacity: .45; }
button:focus-visible, input:focus-visible, a:focus-visible { outline: 2px solid var(--green); outline-offset: 3px; }
.primary-button { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; border: 0; background: var(--red); color: #fffaf0; font-size: 14px; }
.primary-button svg { width: 17px; height: 17px; fill: none; stroke: currentColor; stroke-width: 1.6; }
.primary-button:hover:not(:disabled) { background: #951b16; }
.primary-button:active:not(:disabled) { background: #7b1713; }
.section-heading-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.text-button { min-height: 30px; padding: 3px 0 3px 8px; border: 0; font-size: 12px; text-decoration: underline; text-underline-offset: 3px; }
.metrics-list { display: grid; gap: 10px; margin: 2px 0 0; }
.metrics-list > div { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.metrics-list dt { color: var(--muted); font-size: 13px; }
.metrics-list dd { margin: 0; color: var(--green); font-size: 14px; font-weight: 650; font-variant-numeric: tabular-nums; text-align: right; }
.clear-visits { justify-self: end; }
.map-canvas :deep(.visit-popup .leaflet-popup-content-wrapper),
.map-canvas :deep(.visit-popup .leaflet-popup-tip) { background: var(--paper); color: var(--ink); }
.map-canvas :deep(.visit-popup .leaflet-popup-content) { margin: 20px 28px 20px 20px; font: 14px/1.5 'Avenir Next', Avenir, 'Segoe UI', sans-serif; }
.map-canvas :deep(.visit-popup-card) { display: flex; align-items: center; gap: 16px; }
.map-canvas :deep(.visit-popup-card h2) { font-size: 16px; font-weight: 650; }
.map-canvas :deep(.visit-popup-card p) { margin: 4px 0 0; color: var(--muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
.map-canvas :deep(.remove-visit-button) { display: grid; place-items: center; width: 44px; height: 44px; flex-shrink: 0; padding: 10px; border: 1px solid var(--line); border-radius: 5px; background: transparent; color: var(--red); cursor: pointer; }
.map-canvas :deep(.remove-visit-button:hover) { background: #f5e4d9; }
.map-canvas :deep(.remove-visit-button:active) { background: #ecd1c1; }
.map-canvas :deep(.remove-visit-button svg) { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.map-canvas :deep(.leaflet-interactive:focus-visible),
.map-canvas :deep(.visit-popup button:focus-visible) { outline: 2px solid var(--green); outline-offset: 3px; }
.storage-status, .storage-warning { margin-top: 22px; font-size: 12px; }
.storage-status { padding-top: 16px; border-top: 1px solid var(--line); color: var(--muted); text-align: center; }
.storage-warning { display: grid; gap: 8px; padding: 10px; border: 1px solid var(--red); border-radius: 5px; background: #fff0e7; color: #80231b; }
.storage-warning button { justify-self: start; }
.error-message { color: #a02119; font-size: 13px; }
.map-compass { position: absolute; z-index: 500; right: 28px; bottom: 55px; display: grid; justify-items: center; gap: 3px; pointer-events: none; }
.map-compass span { color: var(--green); font-size: 12px; font-weight: 700; }
.map-note { position: absolute; z-index: 500; bottom: 24px; left: calc(50% + 176px); transform: translateX(-50%); display: flex; align-items: center; gap: 8px; white-space: nowrap; padding: 10px 16px; border-radius: 5px; background: var(--paper); color: var(--green); box-shadow: 0 3px 12px rgb(39 43 28 / 10%); font-size: 12px; pointer-events: none; }
.map-note svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.5; }
@media (max-width: 800px) { .header-caption { display: none; } .map-note { display: none; } }
@media (max-width: 640px) {
  .app-header { height: 72px; padding: 0 16px; gap: 12px; }
  .brand { gap: 6px; } .brand img { width: 36px; height: 36px; } .brand h1 { font-size: 25px; }
  .brand-tagline { margin-left: auto; padding-left: 0; border: 0; font-size: 12px; }
  .map-canvas { top: 72px; }
  .controls-panel { top: auto; right: 12px; bottom: 12px; left: 12px; width: auto; max-height: 48dvh; padding: 20px; }
  .panel-header { padding-bottom: 18px; } .panel-header h2 { font-size: 25px; }
  .panel-header p { margin-top: 8px; }
  .coordinate-form, .metrics-section { padding-top: 18px; }
  .metrics-section { margin-top: 18px; }
  .map-compass { right: 16px; bottom: calc(48dvh + 28px); }
  .map-compass img { width: 40px; height: 40px; }
}
</style>
