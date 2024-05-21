<script setup>
import { ref, provide, computed } from 'vue'
import { Map, Layers, Sources } from 'vue3-openlayers'
import ThePointLayer from './ThePointLayer.vue'
import TheBoxLayer from './TheBoxLayer.vue'

const options = {}
provide('ol-options', options)

const center = ref([0, 0])
const projection = ref('EPSG:4326')
const zoom = ref(1)
const points = ref([])
const bounds = computed(() => {
  const maxLon = Math.max(...points.value.map((point) => point[0]))
  const minLon = Math.min(...points.value.map((point) => point[0]))
  const maxLat = Math.max(...points.value.map((point) => point[1]))
  const minLat = Math.min(...points.value.map((point) => point[1]))
  const bounds = [
    [minLon, minLat],
    [maxLon, minLat],
    [maxLon, maxLat],
    [minLon, maxLat]
  ]
  return bounds
})

const totalArea = computed(() => {
  const maxLon = Math.max(...points.value.map((point) => point[0]))
  const minLon = Math.min(...points.value.map((point) => point[0]))
  const maxLat = Math.max(...points.value.map((point) => point[1]))
  const minLat = Math.min(...points.value.map((point) => point[1]))

  const lonDistance = getDistanceFromLatLonInKm(maxLat, maxLon, maxLat, minLon)
  const latDistance = getDistanceFromLatLonInKm(maxLat, maxLon, minLat, maxLon)

  return lonDistance * latDistance
})

const handleDoubleClick = (event) => {
  points.value.push(event.coordinate)
}

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  var R = 6371 // Radius of the earth in km
  var dLat = deg2rad(lat2 - lat1) // deg2rad below
  var dLon = deg2rad(lon2 - lon1)
  var a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  var d = R * c // Distance in km
  return d
}

function deg2rad(deg) {
  return deg * (Math.PI / 180)
}
</script>

<template>
  <Map.OlMap
    :loadTilesWhileAnimating="true"
    :loadTilesWhileInteracting="true"
    style="height: 100%"
    @dblclick.stop="handleDoubleClick"
  >
    <Map.OlView :center="center" :zoom="zoom" :projection="projection" />

    <Layers.OlTileLayer>
      <Sources.OlSourceOsm />
    </Layers.OlTileLayer>

    <TheBoxLayer :coordinates="bounds" />

    <ThePointLayer :points="points" />
  </Map.OlMap>

  <div id="area">{{ (totalArea || 0).toLocaleString() + ' km²' }}</div>
</template>

<style scoped>
#area {
  position: fixed;
  top: 8px;
  left: 60px;
}
</style>
