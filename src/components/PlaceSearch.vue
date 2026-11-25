<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { searchPhotonPlaces } from '../lib/photon.js'

defineProps({ error: { type: String, default: '' } })
const emit = defineEmits(['select', 'clear-error'])

const placeInput = ref('')
const suggestions = ref([])
const activeSuggestionIndex = ref(-1)
const searchState = ref('idle')
const searchMessage = ref('')
const suggestionsOpen = computed(() => searchState.value === 'ready' && suggestions.value.length > 0)
let searchDebounce = null
let searchController = null
let searchGeneration = 0
let suggestionsDismissed = false

function cancelPlaceSearch() {
  searchGeneration += 1
  if (searchDebounce !== null) window.clearTimeout(searchDebounce)
  searchDebounce = null
  searchController?.abort()
  searchController = null
}

function chooseSuggestion(suggestion) {
  if (!suggestion) return
  cancelPlaceSearch()
  emit('select', suggestion)
}

function reset() {
  placeInput.value = ''
  suggestions.value = []
  activeSuggestionIndex.value = -1
  searchState.value = 'idle'
  searchMessage.value = ''
}

function handleSearchKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault()
    suggestionsDismissed = true
    cancelPlaceSearch()
    suggestions.value = []
    activeSuggestionIndex.value = -1
    searchState.value = 'idle'
    searchMessage.value = ''
    return
  }

  if (!suggestionsOpen.value) return
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    activeSuggestionIndex.value = (activeSuggestionIndex.value + 1) % suggestions.value.length
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    activeSuggestionIndex.value = activeSuggestionIndex.value <= 0
      ? suggestions.value.length - 1
      : activeSuggestionIndex.value - 1
  } else if (event.key === 'Enter') {
    event.preventDefault()
    if (activeSuggestionIndex.value >= 0) {
      chooseSuggestion(suggestions.value[activeSuggestionIndex.value])
    }
  }
}

watch(
  placeInput,
  (input) => {
    cancelPlaceSearch()
    suggestionsDismissed = false
    suggestions.value = []
    activeSuggestionIndex.value = -1
    emit('clear-error')
    searchState.value = 'idle'
    searchMessage.value = ''
    const query = input.trim()
    if (query.length < 3) return

    const generation = searchGeneration
    searchDebounce = window.setTimeout(async () => {
      searchDebounce = null
      const controller = new AbortController()
      searchController = controller
      searchState.value = 'loading'
      searchMessage.value = 'Searching places…'
      try {
        const results = await searchPhotonPlaces(query, controller.signal)
        if (generation !== searchGeneration) return
        suggestions.value = results
        searchState.value = results.length > 0 ? 'ready' : 'empty'
        searchMessage.value = results.length > 0 ? '' : 'No places found. Try a nearby city or country.'
      } catch (error) {
        if (controller.signal.aborted || generation !== searchGeneration) return
        searchState.value = 'error'
        searchMessage.value = error.message || 'Could not search places. Please try again.'
      } finally {
        if (generation === searchGeneration) searchController = null
      }
    }, 500)
  }
)

onBeforeUnmount(cancelPlaceSearch)
defineExpose({ reset })
</script>

<template>
  <section class="place-search" aria-labelledby="add-place-heading">
    <h2 id="add-place-heading">Add a place</h2>
    <p class="section-note">Search by name or double-click the map.</p>
    <label class="place-search-label" for="place-search-input">Place name</label>
    <input
      id="place-search-input"
      v-model="placeInput"
      class="place-search-input"
      type="text"
      placeholder="e.g. Vienna, Austria"
      autocomplete="off"
      role="combobox"
      aria-autocomplete="list"
      aria-controls="place-search-results"
      :aria-expanded="suggestionsOpen && !suggestionsDismissed"
      :aria-activedescendant="activeSuggestionIndex >= 0 ? `place-option-${activeSuggestionIndex}` : undefined"
      @keydown="handleSearchKeydown"
    />
    <ul
      v-if="suggestionsOpen && !suggestionsDismissed"
      id="place-search-results"
      class="place-suggestions"
      role="listbox"
      aria-label="Place search results"
    >
      <li
        v-for="(suggestion, index) in suggestions"
        :id="`place-option-${index}`"
        :key="`${suggestion.label}-${suggestion.coordinates.join(',')}`"
        class="place-suggestion"
        role="option"
        :aria-selected="activeSuggestionIndex === index"
        @mouseenter="activeSuggestionIndex = index"
        @mousedown.prevent
        @click="chooseSuggestion(suggestion)"
      >{{ suggestion.label }}</li>
    </ul>
    <p v-if="searchMessage" class="search-message" :class="{ 'search-error': searchState === 'error' }" :role="searchState === 'error' ? 'alert' : 'status'">
      {{ searchMessage }}
    </p>
    <p v-if="error" class="error-message" role="alert">{{ error }}</p>
  </section>
</template>

<style scoped>
.place-search { display: grid; gap: 12px; padding-top: 22px; }
.place-search h2 { font-size: 16px; font-weight: 650; }
.section-note { color: var(--muted); font-size: 12px; margin-top: -7px; }
.place-search-label { margin-bottom: -7px; color: var(--muted); font-size: 13px; font-weight: 500; }
.place-search-input {
  width: 100%; min-width: 0; min-height: 44px; padding: 10px;
  border: 1px solid #c9c7b9; border-radius: 5px; background: #fffdf7; color: var(--ink); font: inherit; font-size: 14px;
}
.place-search-input::placeholder { color: #77766b; }
.place-suggestions { max-height: 190px; overflow-y: auto; padding: 3px; border: 1px solid var(--line); border-radius: 5px; background: #fffdf7; box-shadow: 0 4px 14px rgb(39 43 28 / 10%); list-style: none; }
.place-suggestion { min-height: 42px; display: flex; align-items: center; padding: 8px 10px; border-radius: 3px; color: var(--ink); font-size: 13px; cursor: pointer; }
.place-suggestion:hover, .place-suggestion[aria-selected='true'] { background: #eaeadd; color: var(--green); }
.search-message { color: var(--muted); font-size: 12px; }
.search-error { color: #a02119; }
input:focus-visible { outline: 2px solid var(--green); outline-offset: 3px; }
.error-message { color: #a02119; font-size: 13px; }
@media (max-width: 640px) { .place-search { padding-top: 18px; } }
</style>
