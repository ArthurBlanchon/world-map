import { useEffect, useMemo, useState } from "react"

import { Map as MapView, MapControls } from "@/components/ui/map"
import { WorldCountryLayer } from "@/components/world-country-layer"
import { legendGradient } from "@/lib/choropleth-scale"
import {
  mergeCountryCounts,
  normalizeCountryCode,
  type CountryCounts,
} from "@/lib/countries-geojson"
import {
  tableDataToRows,
  useGrist,
  useWidgetMetadata,
  type GristRowRecord,
} from "grist-widget-sdk"

export const WIDGET_METADATA = {
  title: "World map",
  description:
    "Choropleth of country counts from a table — map CountryISO (2 or 3 letters) and Count columns.",
} as const

function asNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0
  if (value == null || value === "") return 0
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function buildCounts(
  rows: readonly GristRowRecord[],
  countryColId: string,
  countColId: string,
): CountryCounts {
  const parsed = rows.flatMap((row) => {
    const code = normalizeCountryCode(row[countryColId])
    if (!code) return []
    return [{ code, count: asNumber(row[countColId]) }]
  })
  return mergeCountryCounts(parsed)
}

export function App() {
  useWidgetMetadata(WIDGET_METADATA)
  const w = useGrist()
  const { fetchSelectedTable } = w

  const countryColId = w.resolveMappedColumnId("CountryISO")
  const countColId = w.resolveMappedColumnId("Count")

  const [fallbackCounts, setFallbackCounts] = useState<CountryCounts | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [fetchingFallback, setFetchingFallback] = useState(false)

  const countsFromRecords = useMemo(() => {
    if (!w.columnMappingStatus.ok || !countryColId || !countColId) {
      return null
    }
    if (w.records == null) return null
    return buildCounts(w.records, countryColId, countColId)
  }, [
    w.columnMappingStatus.ok,
    w.records,
    countryColId,
    countColId,
  ])

  const shouldFetchFallback =
    w.isReady &&
    w.columnMappingStatus.ok &&
    Boolean(countryColId && countColId) &&
    w.records == null

  useEffect(() => {
    if (!shouldFetchFallback || !countryColId || !countColId) return

    let cancelled = false

    void (async () => {
      await Promise.resolve()
      if (cancelled) return
      setFetchingFallback(true)
      setLoadError(null)

      try {
        const columnar = await fetchSelectedTable()
        if (cancelled) return
        const rows = tableDataToRows(columnar)
        setFallbackCounts(buildCounts(rows, countryColId, countColId))
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : String(err))
          setFallbackCounts(null)
        }
      } finally {
        if (!cancelled) setFetchingFallback(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    shouldFetchFallback,
    fetchSelectedTable,
    countryColId,
    countColId,
  ])

  const activeFallbackCounts = shouldFetchFallback ? fallbackCounts : null
  const activeLoadError = shouldFetchFallback ? loadError : null
  const activeFetchingFallback = shouldFetchFallback ? fetchingFallback : false

  const counts = useMemo(
    () =>
      countsFromRecords ??
      activeFallbackCounts ??
      new Map<string, number>(),
    [countsFromRecords, activeFallbackCounts],
  )
  const loading =
    w.isReady &&
    w.columnMappingStatus.ok &&
    countsFromRecords == null &&
    activeFallbackCounts == null &&
    !activeLoadError &&
    (w.records == null || activeFetchingFallback)

  const stats = useMemo(() => {
    let total = 0
    let countries = 0
    let max = 0
    for (const value of counts.values()) {
      countries += 1
      total += value
      if (value > max) max = value
    }
    return { total, countries, max }
  }, [counts])

  if (w.status === "booting") {
    return <StatusPanel title="Connecting to Grist…" />
  }

  if (!w.columnMappingStatus.ok && !w.columnMappingStatus.pending) {
    return (
      <StatusPanel
        title="Map columns in the widget panel"
        body={`Required: CountryISO (Text, ISO 2 or 3 letters) and Count (Numeric). Missing: ${w.columnMappingStatus.missing.join(", ")}`}
      />
    )
  }

  if (activeLoadError) {
    return (
      <StatusPanel
        title="Could not load table data"
        body={activeLoadError}
      />
    )
  }

  return (
    <div className="flex h-svh min-h-80 flex-col">
      <header className="border-border flex shrink-0 items-center justify-between gap-4 border-b px-4 py-2 text-sm">
        <div>
          <h1 className="font-medium">World map</h1>
          <p className="text-muted-foreground text-xs">
            {stats.countries} countries · {stats.total.toLocaleString()} total
          </p>
        </div>
        {stats.max > 0 ? (
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            <span>0</span>
            <span
              className="border-border h-3 w-28 rounded-sm border"
              style={{ background: legendGradient() }}
              title="Low → high count"
            />
            <span>{stats.max.toLocaleString()}</span>
          </div>
        ) : null}
      </header>

      <div className="relative min-h-0 flex-1">
        <MapView
          className="absolute inset-0"
          projection={{ type: "globe" }}
          center={[10, 24]}
          zoom={1.4}
          loading={loading}
        >
          <WorldCountryLayer counts={counts} />
          <MapControls showZoom showFullscreen position="bottom-right" />
        </MapView>
      </div>
    </div>
  )
}

function StatusPanel({ title, body }: { title: string; body?: string }) {
  return (
    <div className="text-muted-foreground flex h-svh items-center justify-center p-6 text-sm">
      <div className="max-w-md space-y-2 text-center">
        <p className="text-foreground font-medium">{title}</p>
        {body ? <p className="text-xs leading-relaxed">{body}</p> : null}
      </div>
    </div>
  )
}

export default App
