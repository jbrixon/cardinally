# Cardinally

Cardinally maps the places you have visited and draws the smallest geographic box containing them. Search for a place by name or double-click the map to add a visit. Visits are saved in the current browser.

The box shows approximate area, north–south span, and east–west span. Longitude bounds can cross the date line. Measurements use a spherical Earth model and are intended for comparing travel boxes, not navigation.

## Run locally

Use Node.js 24 LTS (also used by CI).

```sh
npm ci
npm run dev
```

## Verify

```sh
npm run build
npm run test:unit -- --run
npx playwright install chromium  # once, before the browser tests
npm run test:e2e -- --project=chromium
npm run lint
npm audit
```

Browser tests block OpenStreetMap tile requests and mock Photon searches, so they do not depend on either service being online. The live map uses OpenStreetMap tiles and displays its required attribution.

## Privacy and storage

Visits are stored in the browser's local storage. The app has no backend, accounts, or analytics, and does not upload your saved visit list. Clearing browser data removes those visits; this storage is not a backup. Other scripts on the same origin can access local storage, so use a dedicated origin if you host other untrusted apps.

The browser requests map tiles directly from OpenStreetMap and place-name searches directly from [Photon](https://photon.komoot.io/). Those services receive your IP address and referrer; Photon also receives the text you search for. Search results are cached only in memory for the current page session, and your saved visit list is not sent. Photon asks users to keep requests reasonable and may throttle or block extensive use; it provides no availability guarantee. Each open tab spaces searches by at least one second, caches recent queries, and pauses after a rate-limit response; traffic across tabs and users is not shared-throttled. See the [OpenStreetMap privacy policy](https://osmfoundation.org/wiki/Privacy_Policy), [tile usage policy](https://operations.osmfoundation.org/policies/tiles/), and [Photon demo-server terms](https://github.com/komoot/photon#demo-server). The community tile service has no availability guarantee; use a suitable provider if traffic grows.

## License

Cardinally is licensed under the GNU Affero General Public License, version 3 only (`AGPL-3.0-only`). See [LICENSE](LICENSE) for the full terms. Third-party packages retain their own licenses.

The app links to its [source code on GitHub](https://github.com/jbrixon/cardinally). Keep the linked repository public and ensure it contains the corresponding source and build instructions for the deployed version. For modified deployments, update the app's source and license links to point to that version's source.

## Deploy

Pushes to `main` deploy to [https://jbrixon.github.io/cardinally/](https://jbrixon.github.io/cardinally/) after lint, unit tests, the production build, and Chromium browser tests pass. Pull requests run the checks without deploying.
