<script setup>
import { defineProps } from 'vue'
import { Map, Layers, Sources, Geometries, Styles } from 'vue3-openlayers'

const props = defineProps(['points'])
</script>

<template>
  <Layers.OlVectorLayer>
    <Sources.OlSourceVector>
      <Map.OlFeature v-for="point in props.points" :key="JSON.stringify(point)">
        <Geometries.OlGeomPoint :coordinates="point"></Geometries.OlGeomPoint>
        <Styles.OlStyle>
          <Styles.OlStyleCircle :radius="10">
            <Styles.OlStyleFill color="red"></Styles.OlStyleFill>
          </Styles.OlStyleCircle>
        </Styles.OlStyle>
      </Map.OlFeature>
    </Sources.OlSourceVector>
  </Layers.OlVectorLayer>
</template>
