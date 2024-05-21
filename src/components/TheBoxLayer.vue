<script setup>
import { defineProps } from 'vue'
import { Map, Layers, Sources, Geometries, Styles } from 'vue3-openlayers'

const props = defineProps(['coordinates'])
</script>

<template>
  <Layers.OlVectorLayer>
    <Sources.OlSourceVector>
      <Map.OlFeature>
        <Geometries.OlGeomPolygon :coordinates="[props.coordinates]"></Geometries.OlGeomPolygon>
        <Styles.OlStyle>
          <Styles.OlStyleStroke color="green" :width="2"></Styles.OlStyleStroke>
          <Styles.OlStyleFill color="rgba(0,255,0,0.2)"></Styles.OlStyleFill>
        </Styles.OlStyle>
      </Map.OlFeature>
    </Sources.OlSourceVector>
  </Layers.OlVectorLayer>
</template>
