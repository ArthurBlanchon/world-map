# world-map

A Grist custom widget: a world map (MapLibre GL) shading each country by a
count from your table. Map a `CountryISO` column (ISO 3166-1 alpha-2 or
alpha-3, `FR` or `FRA`) and a `Count` column; rows for the same country add
up. Country shapes come from Natural Earth's 110m Admin 0 dataset (see
`public/ATTRIBUTION.md`); the basemap is CARTO's Positron (or Dark Matter, in
Grist's dark theme).

<!-- install-url:start -->
**Install URL**, to paste into a Grist custom widget's URL field: <https://arthurblanchon.github.io/world-map/latest/>
<!-- install-url:end -->

**Try it:** <https://arthurblanchon.github.io/world-map/latest/demo/>, Grist running in your browser with sample data (nothing is saved).

## In Grist

Add a custom widget, paste the install URL, and set its access level to
**Read selected table**.

Then map its columns:

| Column | Type | What it is |
| --- | --- | --- |
| `CountryISO` | Text | ISO 3166-1 alpha-2 or alpha-3 code |
| `Count` | Numeric | the value to shade by |

## Code

The widget's own code is in `src/`:

- `src/app/App.tsx` exports `GRIST_OPTIONS` and `WIDGET_METADATA` (from
  `src/grist-options.ts`) and lazy-loads `src/app/WorldMap.tsx`, so MapLibre
  loads in a chunk of its own, after Grist has connected.
- `WorldMap.tsx` reads the mapped rows with `useGrist()`, falling back to
  `fetchSelectedTable()` when Grist sends no records, sums the counts per
  country (`src/lib/countries-geojson.ts`) and draws them with
  `src/components/world-country-layer.tsx` and a color scale
  (`src/lib/choropleth-scale.ts`).
- `src/hooks/use-map-theme.ts` picks the light or dark basemap.

## Develop

Develop on the `dev` branch; every push deploys `/dev/`
(<https://arthurblanchon.github.io/world-map/dev/>), which reloads itself in an
open Grist document a few seconds later.

| | |
| --- | --- |
| Install | `pnpm install` |
| Test (emulated Grist, no browser) | `pnpm test` |
| Lint, type-check, build | `pnpm lint`, `pnpm typecheck`, `pnpm build` |
| The widget in a real local Grist (Docker) | `pnpm demo` |
| Regenerate the demo page | `pnpm demo --save` |

`src/main.tsx` is one `mountGristWidget()` call from `grist-widget-sdk/app`:
inside Grist it renders the widget behind the SDK's connection and
column-mapping screens, with its alerts, in Grist's light or dark theme.
Opened anywhere else, it shows which build this is and the URL to paste into
Grist. The widget's code reads Grist only through `grist-widget-sdk`
([docs](https://gristwidgets.com/docs)), never the `grist` global.

`src/main.tsx`, the workflows and the build config are the template's: they
come from `create-grist-widget`, and `pnpm exec create-grist-widget upgrade`
(run on `dev` after Dependabot updates it) rewrites them
([Upgrading a widget](https://gristwidgets.com/docs/cli/upgrading)).
`AGENTS.md` says which files are which.

## Release

1. On `dev`, bump `package.json`'s `version`.
2. Open a pull request from `dev` into `main`, and merge it once its checks
   are green.

Merging builds `/v<version>/` and updates `/latest/` and their demo pages.
Without a version bump, nothing is published. The deploy workflow and its
one-time repository settings are described in the
[template's README](https://github.com/ArthurBlanchon/grist-widget-template#deployment).
