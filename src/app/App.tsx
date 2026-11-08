import { lazy } from "react"

export { GRIST_OPTIONS, WIDGET_METADATA } from "@/grist-options"

/**
 * MapLibre and the choropleth UI load in a chunk of their own, after the
 * Grist handshake: mountGristWidget() renders App inside <Suspense>. So the
 * options and metadata live in src/grist-options.ts, which the main chunk
 * can import without pulling the map in.
 */
const App = lazy(() => import("./WorldMap"))

export default App
