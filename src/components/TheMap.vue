<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import L from 'leaflet'

const mapElement = ref()
const map = ref()
const pointLayer = ref()
const boxLayer = ref()
const points = ref([])

const pointExtremes = computed(() => {
  if (points.value.length === 0) return null

  return {
    maxLon: Math.max(...points.value.map((point) => point[0])),
    minLon: Math.min(...points.value.map((point) => point[0])),
    maxLat: Math.max(...points.value.map((point) => point[1])),
    minLat: Math.min(...points.value.map((point) => point[1]))
  }
})

const bounds = computed(() => {
  if (!pointExtremes.value) return []

  const { maxLon, minLon, maxLat, minLat } = pointExtremes.value
  const bounds = [
    [minLon, minLat],
    [maxLon, minLat],
    [maxLon, maxLat],
    [minLon, maxLat]
  ]
  return bounds
})

const largestSpanDistance = computed(() => {
  if (points.value.length < 2) return 0

  const { maxLon, minLon, maxLat, minLat } = pointExtremes.value

  const lonDelta = maxLon - minLon
  const shortestLonDelta = Math.min(lonDelta, 360 - lonDelta)
  const lonDistance = getDistanceFromLatLonInKm(0, 0, 0, shortestLonDelta)
  const latDistance = getDistanceFromLatLonInKm(maxLat, 0, minLat, 0)

  return Math.max(lonDistance, latDistance)
})

const handleDoubleClick = (event) => {
  points.value.push([event.latlng.lng, event.latlng.lat])
}

const renderPoints = () => {
  if (!pointLayer.value || !boxLayer.value) return

  pointLayer.value.clearLayers()
  boxLayer.value.clearLayers()

  points.value.forEach((point) => {
    const isExtremePoint =
      pointExtremes.value &&
      (point[0] === pointExtremes.value.maxLon ||
        point[0] === pointExtremes.value.minLon ||
        point[1] === pointExtremes.value.maxLat ||
        point[1] === pointExtremes.value.minLat)

    L.circleMarker([point[1], point[0]], {
      radius: 8,
      color: 'red',
      fillColor: 'red',
      opacity: isExtremePoint ? 1 : 0.35,
      fillOpacity: isExtremePoint ? 1 : 0.35
    }).addTo(pointLayer.value)
  })

  if (bounds.value.length === 4) {
    const polygonCoordinates = bounds.value.map((point) => [point[1], point[0]])

    L.polygon(polygonCoordinates, {
      color: 'green',
      weight: 2,
      fillColor: '#00ff00',
      fillOpacity: 0.2
    }).addTo(boxLayer.value)
  }
}

onMounted(() => {
  map.value = L.map(mapElement.value, {
    center: [0, 0],
    zoom: 1
  })

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map.value)

  map.value.doubleClickZoom.disable()
  map.value.on('dblclick', handleDoubleClick)

  pointLayer.value = L.layerGroup().addTo(map.value)
  boxLayer.value = L.layerGroup().addTo(map.value)
  renderPoints()
})

watch(points, renderPoints, { deep: true })

onBeforeUnmount(() => {
  if (!map.value) return

  map.value.off('dblclick', handleDoubleClick)
  map.value.remove()
})

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = deg2rad(lat2 - lat1)
  const dLon = deg2rad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const d = R * c
  return d
}

function deg2rad(deg) {
  return deg * (Math.PI / 180)
}
</script>

<template>
  <div ref="mapElement" class="map"></div>

  <div id="area">{{ (largestSpanDistance || 0).toLocaleString() + ' km' }}</div>
</template>

<style scoped>
.map {
  height: 100%;
}

#area {
  position: fixed;
  top: 8px;
  left: 60px;
}
</style>
