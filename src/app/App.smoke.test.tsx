/**
 * Smoke test: the widget renders inside an emulated Grist, mounted as
 * `main.tsx` mounts it, with every column `GRIST_OPTIONS` declares mapped.
 *
 * It only reads `GRIST_OPTIONS`, so it stays valid as the widget changes,
 * and it improves with each SDK release. `.github/workflows/ci.yml` runs it
 * on every pull request, Dependabot's `grist-widget-sdk` updates included:
 * an SDK release that breaks this widget turns that PR red before the merge.
 * `smokeTestWidget()` stubs the browser APIs jsdom lacks (`ResizeObserver`,
 * `matchMedia`); a widget that needs more mocks them here.
 *
 * App lazy-loads the map (./WorldMap), so this also covers that chunk loading.
 */
import { it, vi } from "vitest"
import { smokeTestWidget } from "grist-widget-sdk/emulator/testing"

import App, { GRIST_OPTIONS } from "./App"

// jsdom has no WebGL, which MapLibre needs before it draws anything. In this
// test every MapLibre object is an inert stand-in: any method is a no-op that
// returns the object itself (so chained calls work), except getCanvas, which
// returns a real <canvas> for cursor and style tweaks. The map never fires
// "load", so no layer is added: the test covers the SDK wiring and the first
// render, not the map drawing.
vi.mock("maplibre-gl", () => {
  const inert = (): object => {
    const self: object = new Proxy(
      {},
      {
        get: (_target, key) => {
          if (typeof key === "symbol" || key === "then") return undefined
          if (key === "getCanvas") return () => document.createElement("canvas")
          return () => self
        },
      }
    )
    return self
  }
  // MapLibre 6 has named exports only (`import * as MapLibreGL`): each class the
  // map uses is a constructor returning an inert stand-in.
  const stand = function () {
    return inert()
  }
  const names = ["Map", "Popup", "Marker", "NavigationControl", "GeolocateControl", "FullscreenControl", "AttributionControl", "ScaleControl", "LngLat", "LngLatBounds"]
  return Object.fromEntries(names.map((name) => [name, stand]))
})

it("renders inside Grist with every declared column mapped", () =>
  smokeTestWidget({ App, options: GRIST_OPTIONS }))
