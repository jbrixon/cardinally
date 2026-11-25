# Cardinally

Cardinally maps the places you have visited and draws the smallest geographic box containing them. Add a place by double-clicking the map or entering its latitude and longitude. Visits are saved in the current browser.

The box shows approximate area, north–south span, and east–west span. Longitude bounds can cross the date line. Measurements use a spherical Earth model and are intended for comparing travel boxes, not navigation.

## Run locally

```sh
npm install
npm run dev
```

## Verify

```sh
npm run build
npm run test:unit -- --run
npx playwright install chromium  # once, before the browser tests
npm run test:e2e -- --project=chromium
npm run lint
```

Browser tests block OpenStreetMap tile requests, so the interaction tests do not depend on the tile service being online. The live map uses OpenStreetMap tiles and displays its required attribution.
