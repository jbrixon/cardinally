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

  points.value.forEach((point) => {
    const [longitude, latitude] = point
    const highlighted = isBoundaryVisit(point, box)
    L.circleMarker([latitude, unwrapLongitude(longitude, box.west)], {
      radius: highlighted ? 7 : 5,
      color: highlighted ? '#a23c25' : '#155c70',
      weight: 2,
      fillColor: highlighted ? '#d56a4f' : '#4b99a3',
      fillOpacity: 0.9
    }).addTo(pointLayer)
  })

  const polygon = [
    [box.south, box.west],
    [box.south, box.east],
    [box.north, box.east],
    [box.north, box.west]
  ]
  L.polygon(polygon, {
    color: '#a23c25',
    weight: 2,
    fillColor: '#d56a4f',
    fillOpacity: 0.16
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

  if (panelRect.bottom >= mapRect.bottom - 24) {
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
  <div ref="mapElement" class="map-canvas" aria-label="Map of visited places"></div>

  <aside ref="controlsPanel" class="controls-panel" aria-label="Travelbox controls">
    <header class="panel-header">
      <h1>Travelbox</h1>
      <p>Enter coordinates or double-click the map.</p>
    </header>

    <form class="coordinate-form" novalidate @submit.prevent="handleFormSubmit">
      <h2>Add a place</h2>
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
      <button class="primary-button" type="submit">Add place</button>
      <p v-if="formError" class="error-message" role="alert">{{ formError }}</p>
    </form>

    <section class="metrics-section" aria-labelledby="box-heading">
      <div class="section-heading-row">
        <h2 id="box-heading">Your box</h2>
        <button type="button" :disabled="!travelBox" @click="fitBox">Fit box</button>
      </div>
      <p class="section-note">Approximate geographic measurements</p>
      <dl class="metrics-list">
        <div>
          <dt>Box area</dt>
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
    </section>

    <section class="visits-section" aria-labelledby="visits-heading">
      <div class="section-heading-row">
        <h2 id="visits-heading">Places visited <span>({{ points.length }})</span></h2>
        <button type="button" :disabled="points.length === 0" @click="clearVisits">
          Clear all
        </button>
      </div>

      <p v-if="points.length === 0" class="empty-message">
        Double-click the map or enter coordinates above to add your first place.
      </p>
      <ul v-else class="visit-list">
        <li v-for="(point, index) in points" :key="point.join(',')" data-testid="visit-row">
          <span>{{ formatCoordinate(point[1]) }}°, {{ formatCoordinate(point[0]) }}°</span>
          <button
            type="button"
            :aria-label="`Remove visit at ${formatCoordinate(point[1])}°, ${formatCoordinate(point[0])}°`"
            @click="removeVisit(index)"
          >
            Remove
          </button>
        </li>
      </ul>
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
</template>

<style scoped>
.map-canvas {
  position: absolute;
  inset: 0;
  background: #edf1f2;
}

.controls-panel {
  position: absolute;
  z-index: 1100;
  top: 16px;
  bottom: 16px;
  left: 16px;
  display: flex;
  width: min(22rem, calc(100vw - 32px));
  height: fit-content;
  max-height: calc(100vh - 32px);
  flex-direction: column;
  gap: 18px;
  overflow-y: auto;
  padding: 20px;
  border: 1px solid #cbd5d9;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 8px 24px rgb(16 40 48 / 18%);
  color: #172b32;
  overscroll-behavior: contain;
}

.panel-header h1 {
  font-size: 1.45rem;
  font-weight: 650;
  line-height: 1.2;
}

.panel-header p,
.section-note,
.empty-message,
.storage-status {
  color: #50636a;
}

.panel-header p {
  margin-top: 4px;
  font-size: 0.9rem;
}

.coordinate-form,
.metrics-section,
.visits-section {
  display: grid;
  gap: 10px;
}

.coordinate-form h2,
.section-heading-row h2 {
  font-size: 1rem;
  font-weight: 650;
}

.coordinate-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.coordinate-fields label {
  display: grid;
  gap: 5px;
  font-size: 0.82rem;
  font-weight: 600;
}

.coordinate-fields input {
  width: 100%;
  min-width: 0;
  min-height: 40px;
  padding: 8px 9px;
  border: 1px solid #9cabb0;
  border-radius: 6px;
  background: #fff;
  color: #172b32;
  font: inherit;
  font-size: 0.85rem;
}

button {
  min-height: 36px;
  padding: 6px 10px;
  border: 1px solid #9cabb0;
  border-radius: 6px;
  background: #fff;
  color: #19343c;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
}

button:hover:not(:disabled) {
  background: #edf4f5;
}

button:active:not(:disabled) {
  background: #dfeaec;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

button:focus-visible,
input:focus-visible {
  outline: 3px solid #1b7190;
  outline-offset: 2px;
}

.primary-button {
  justify-self: start;
  border-color: #155c70;
  background: #155c70;
  color: #fff;
}

.primary-button:hover:not(:disabled) {
  background: #104b5c;
  color: #fff;
}

.section-heading-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.section-heading-row h2 span {
  color: #50636a;
  font-weight: 500;
}

.section-note {
  margin-top: -7px;
  font-size: 0.78rem;
}

.metrics-list {
  display: grid;
  gap: 7px;
  margin: 0;
}

.metrics-list > div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.metrics-list dt {
  color: #50636a;
  font-size: 0.88rem;
}

.metrics-list dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
  font-size: 0.92rem;
  font-weight: 650;
  text-align: right;
}

.visits-section {
  min-height: 0;
}

.empty-message {
  font-size: 0.86rem;
}

.visit-list {
  display: grid;
  max-height: 220px;
  gap: 5px;
  overflow-y: auto;
  margin: 0;
  padding: 0;
  list-style: none;
}

.visit-list li {
  display: flex;
  min-height: 38px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border-bottom: 1px solid #e2e8ea;
  font-variant-numeric: tabular-nums;
  font-size: 0.86rem;
}

.visit-list li span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.visit-list button {
  min-height: 30px;
  flex: 0 0 auto;
  padding: 4px 8px;
  font-size: 0.76rem;
}

.storage-status,
.storage-warning {
  margin-top: auto;
  font-size: 0.78rem;
}

.storage-warning {
  display: grid;
  gap: 8px;
  padding: 10px;
  border: 1px solid #a64c2d;
  border-radius: 6px;
  background: #fff8f5;
  color: #702f1c;
}

.storage-warning button {
  justify-self: start;
}

.error-message {
  color: #9c3028;
  font-size: 0.84rem;
}

@media (max-width: 640px) {
  .controls-panel {
    top: auto;
    right: 12px;
    bottom: 12px;
    left: 12px;
    width: auto;
    height: auto;
    max-height: 48vh;
    gap: 14px;
    padding: 16px;
  }

  .panel-header h1 {
    font-size: 1.25rem;
  }

  .visit-list {
    max-height: 132px;
  }
}
</style>
