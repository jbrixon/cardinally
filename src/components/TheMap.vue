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

const handleDoubleClick = (event) => {
  points.value.push(event.coordinate)
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
</template>
