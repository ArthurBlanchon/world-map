/**
 * Smoke test: the widget mounts inside an emulated Grist, wired as in
 * main.tsx's embedded branch, with every column GRIST_OPTIONS declares
 * mapped, and renders past GristBoundary without throwing.
 *
 * It only reads GRIST_OPTIONS, so it stays valid as the widget changes. It is
 * what .github/workflows/ci.yml runs on every pull request, Dependabot's
 * grist-widget-sdk updates included: an SDK release that breaks this widget's
 * handshake, column mapping or first render turns that PR red before merge.
 * Put widget-specific assertions in their own test files next to this one
 * (the create-grist-widget template's src/App.test.tsx shows the pattern).
 */
import "@testing-library/jest-dom/vitest"
import { afterEach, expect, it, vi } from "vitest"
import {
  GristBoundary,
  GristWidgetProvider,
  type GristReplicaDocument,
} from "grist-widget-sdk"
import {
  cleanup,
  renderWithGrist,
  screen,
  waitFor,
} from "grist-widget-sdk/emulator/testing"

import { GristSdkAlerts } from "@/components/grist-sdk-alerts"
import App from "./App"
import { GRIST_OPTIONS } from "./grist-options"

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
  const library = new Proxy(
    {},
    {
      get: (_target, key) =>
        key === "then"
          ? undefined
          : function () {
              return inert()
            },
    }
  )
  return { default: library }
})

// vitest's `globals` is off, so @testing-library/react can't register its
// own cleanup.
afterEach(() => cleanup())

// Browser APIs jsdom doesn't implement, stubbed only where missing: enough for
// components that observe their own size to mount.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.matchMedia ??= (query: string) =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  }) as MediaQueryList

const columns = (GRIST_OPTIONS.columns ?? []).map((column) =>
  typeof column === "string" ? { name: column, type: undefined } : column
)

/** The first Grist type a column accepts: "Text,Ref,Choice" -> "Text". */
function firstType(type: string | undefined): string {
  return (type ?? "Any").split(",")[0].trim()
}

function sampleValue(type: string): unknown {
  switch (type) {
    case "Numeric":
    case "Int":
      return 42
    case "Bool":
      return true
    case "Date":
    case "DateTime":
      return 1767225600 // 2026-01-01, as Grist stores it: epoch seconds
    default:
      return "Sample"
  }
}

// One table with a column per declared column, and one row to select.
const gristDocument: GristReplicaDocument = {
  generatedAt: "1970-01-01T00:00:00.000Z",
  docName: "Smoke test",
  mode: "schema+data",
  tables: {
    Table1: {
      columns: Object.fromEntries(
        columns.map((c) => [c.name, { type: firstType(c.type) }])
      ),
      rows: [
        {
          id: 1,
          ...Object.fromEntries(
            columns.map((c) => [c.name, sampleValue(firstType(c.type))])
          ),
        },
      ],
    },
  },
}

function EmbeddedWidget() {
  return (
    <GristWidgetProvider options={GRIST_OPTIONS}>
      <GristBoundary gate={columns.length ? "canRender" : "ready"}>
        <div data-testid="widget">
          <GristSdkAlerts>
            <App />
          </GristSdkAlerts>
        </div>
      </GristBoundary>
    </GristWidgetProvider>
  )
}

it(
  "mounts inside Grist past the boundary, with every declared column mapped",
  { timeout: 15_000 },
  async () => {
    const { emulator } = renderWithGrist(<EmbeddedWidget />, {
      emulator: { document: gristDocument },
    })
    if (columns.length) {
      emulator.setColumnMappings(
        Object.fromEntries(columns.map((c) => [c.name, c.name]))
      )
    }
    const widget = await screen.findByTestId("widget", undefined, {
      timeout: 10_000,
    })
    await waitFor(() => expect(widget).not.toBeEmptyDOMElement())
  }
)
