<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import L from 'leaflet'
import { isBoundaryVisit, normalizeLongitude, unwrapLongitude } from '../lib/travelbox.js'

const props = defineProps({
  points: { type: Array, required: true },
  travelBox: { type: Object, default: null },
  controlsPanel: { type: Object, default: null }
})
const emit = defineEmits(['add', 'remove'])
const mapElement = ref(null)
let map = null
let pointLayer = null
let boxLayer = null

const formatCoordinate = (value) => Number(value.toFixed(4)).toString()

function renderPoints() {
  if (!pointLayer || !boxLayer) return

  pointLayer.clearLayers()
  boxLayer.clearLayers()

  const box = props.travelBox
  if (!box) return

  L.polygon(
    [
      [box.south, box.west],
      [box.south, box.east],
      [box.north, box.east],
      [box.north, box.west]
    ],
    {
      color: '#b82019',
      weight: 2,
      fillColor: '#bc211b',
      fillOpacity: 0.07,
      dashArray: '6 5',
      interactive: false
    }
  ).addTo(boxLayer)

  props.points.forEach((point, index) => {
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
      remove.addEventListener('click', () => emit('remove', index))
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
}

function handleDoubleClick(event) {
  emit('add', event.latlng.lat, normalizeLongitude(event.latlng.lng))
}

function popupPadding() {
  const mapRect = map.getContainer().getBoundingClientRect()
  const panelRect = props.controlsPanel.getBoundingClientRect()
  const mobile = window.matchMedia('(max-width: 640px)').matches
  return {
    autoPanPaddingTopLeft: [mobile ? 16 : panelRect.right - mapRect.left + 16, 16],
    autoPanPaddingBottomRight: [16, mobile ? mapRect.bottom - panelRect.top + 16 : 16]
  }
}

function fitBox() {
  if (!map || !props.travelBox) return
  const box = props.travelBox

  if (box.north === box.south && box.east === box.west) {
    map.setView([box.north, box.west], 4, { animate: false })
    return
  }

  const mapRect = map.getContainer().getBoundingClientRect()
  const panelRect = props.controlsPanel.getBoundingClientRect()
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

watch(() => props.points, renderPoints, { deep: true })

onMounted(() => {
  map = L.map(mapElement.value, {
    center: [18, 0],
    zoom: 2,
    zoomControl: false
  })
  L.control.zoom({ position: 'topright' }).addTo(map)
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: 'Search by <a href="https://photon.komoot.io/">Photon</a> · &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    crossOrigin: true
  }).addTo(map)
  map.attributionControl.setPosition('topright')
  map.doubleClickZoom.disable()
  map.on('dblclick', handleDoubleClick)

  pointLayer = L.layerGroup().addTo(map)
  boxLayer = L.layerGroup().addTo(map)
  renderPoints()
})

onBeforeUnmount(() => {
  if (!map) return
  map.off('dblclick', handleDoubleClick)
  map.remove()
  map = null
})

defineExpose({ fitBox })
</script>

<template>
  <div ref="mapElement" class="map-canvas" aria-label="Map of visited places"></div>
</template>

<style scoped>
.map-canvas { position: absolute; inset: 80px 0 0; background: #e6e9dc; }
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
@media (max-width: 640px) { .map-canvas { top: 72px; } }
</style>
