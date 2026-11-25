# Cardinally design

Cardinally is a map-first travel atlas. The rebrand follows the supplied compass concept and the tagline “Expand your range.” Keep the map as the main workspace and preserve coordinate entry, visited places, geographic measurements, and browser-local storage.

## Palette

Shared tokens live in `src/assets/base.css`:

| Token | Value | Use |
| --- | --- | --- |
| `--paper` | `#fbf6e9` | Header, controls, map tools |
| `--ink` | `#162024` | Primary text and wordmark |
| `--red` | `#b82019` | Primary action, geographic boundary, north needle |
| `--green` | `#234c39` | Measurements, secondary controls, compass |
| `--muted` | `#636b66` | Supporting text |
| `--line` | `#dedbcd` | Section and input separation |

## Identity and typography

`public/cardinally-mark.svg` is the compass identity and favicon. Pair it with the bold Cardinally wordmark and a red period. Use the existing local sans-serif stack for controls, labels, and data; Georgia gives the introductory copy a travel-journal character. Measurements use tabular numerals.

## Layout and controls

The desktop header is 80px high. The map fills the remaining viewport, with a 352px control panel inset 24px from its left edge. Sections use fine rules and spacing rather than nested cards. Primary actions are red; secondary actions use green. Inputs have warm white surfaces, visible borders, and explicit labels. Keyboard focus uses a green outline.

At 640px and below, use a 72px header and a scrollable bottom panel capped at 48dvh. Keep the map, zoom, and attribution visible. Range fitting must account for the panel's position. Empty states use the compass mark and instructions; populated states show the visitor’s actual data.

## Map

Retain OpenStreetMap attribution. Desaturate and warm only the tile layer; keep red and green overlays distinct. Geographic boundaries use a red dashed stroke with a light red fill. Do not seed visits or change the existing `travelbox.visits.v1` storage key during a visual rebrand.
