import MapLibreGL, { type MapLayerMouseEvent } from "maplibre-gl"
import { useCallback, useEffect, useRef } from "react"

import { useMap } from "@/components/ui/map"
import { useMapTheme } from "@/hooks/use-map-theme"
import {
  buildFillColorExpression,
  buildFillOpacityExpression,
  buildOutlineColorExpression,
  buildOutlineWidthExpression,
} from "@/lib/choropleth-scale"
import {
  COUNTRIES_GEOJSON_URL,
  enrichCountriesGeoJson,
  maxCountInCollection,
  type CountryCounts,
} from "@/lib/countries-geojson"

type WorldCountryLayerProps = {
  counts: CountryCounts
}

const SOURCE_ID = "word-map-countries"
const FILL_LAYER_ID = "word-map-countries-fill"
const LINE_LAYER_ID = "word-map-countries-outline"
const LABEL_LAYER_ID = "word-map-countries-labels"

function pickLabelFonts(map: MapLibreGL.Map): string[] {
  const layers = map.getStyle()?.layers ?? []
  for (const layer of layers) {
    if (layer.type !== "symbol") continue
    const font = layer.layout?.["text-font"]
    if (Array.isArray(font) && font.every((f) => typeof f === "string")) {
      return font as string[]
    }
  }
  return ["Open Sans Regular", "Arial Unicode MS Regular"]
}

export function WorldCountryLayer({ counts }: WorldCountryLayerProps) {
  const { map, isLoaded } = useMap()
  const theme = useMapTheme()
  const baseGeoJsonRef = useRef<GeoJSON.FeatureCollection | null>(null)
  const countsRef = useRef(counts)
  const themeRef = useRef(theme)

  useEffect(() => {
    countsRef.current = counts
    themeRef.current = theme
  }, [counts, theme])

  const applyPaint = useCallback((target: MapLibreGL.Map, maxCount: number) => {
    if (!target.getLayer(FILL_LAYER_ID)) return
    const t = themeRef.current
    target.setPaintProperty(
      FILL_LAYER_ID,
      "fill-color",
      buildFillColorExpression(maxCount, t),
    )
    target.setPaintProperty(
      FILL_LAYER_ID,
      "fill-opacity",
      buildFillOpacityExpression(),
    )
    if (target.getLayer(LINE_LAYER_ID)) {
      target.setPaintProperty(
        LINE_LAYER_ID,
        "line-color",
        buildOutlineColorExpression(t),
      )
      target.setPaintProperty(
        LINE_LAYER_ID,
        "line-width",
        buildOutlineWidthExpression(),
      )
    }
  }, [])

  const syncCountryData = useCallback((target: MapLibreGL.Map) => {
    const base = baseGeoJsonRef.current
    if (!base) return
    const enriched = enrichCountriesGeoJson(base, countsRef.current)
    const maxCount = maxCountInCollection(enriched)
    const source = target.getSource(SOURCE_ID) as MapLibreGL.GeoJSONSource | undefined
    source?.setData(enriched)
    applyPaint(target, maxCount)
  }, [applyPaint])

  useEffect(() => {
    if (!isLoaded || !map) return

    let cancelled = false

    void (async () => {
      if (!baseGeoJsonRef.current) {
        const res = await fetch(COUNTRIES_GEOJSON_URL)
        if (!res.ok) throw new Error(`Countries GeoJSON: ${res.status}`)
        baseGeoJsonRef.current = (await res.json()) as GeoJSON.FeatureCollection
      }
      if (cancelled) return

      if (!map.getSource(SOURCE_ID)) {
        const enriched = enrichCountriesGeoJson(
          baseGeoJsonRef.current,
          countsRef.current,
        )
        const maxCount = maxCountInCollection(enriched)

        map.addSource(SOURCE_ID, { type: "geojson", data: enriched })
        map.addLayer({
          id: FILL_LAYER_ID,
          type: "fill",
          source: SOURCE_ID,
          paint: {
            "fill-color": buildFillColorExpression(maxCount, themeRef.current),
            "fill-opacity": buildFillOpacityExpression(),
          },
        })
        map.addLayer({
          id: LINE_LAYER_ID,
          type: "line",
          source: SOURCE_ID,
          paint: {
            "line-color": buildOutlineColorExpression(themeRef.current),
            "line-width": buildOutlineWidthExpression(),
          },
        })
        map.addLayer({
          id: LABEL_LAYER_ID,
          type: "symbol",
          source: SOURCE_ID,
          filter: ["==", ["coalesce", ["get", "hasCount"], 0], 1],
          layout: {
            "text-field": ["get", "countLabel"],
            "text-font": pickLabelFonts(map),
            "text-size": [
              "interpolate",
              ["linear"],
              ["zoom"],
              1,
              9,
              3,
              11,
              5,
              13,
            ],
            "text-allow-overlap": false,
            "text-optional": true,
            "text-padding": 2,
          },
          paint: {
            "text-color": ["get", "labelColor"],
            "text-halo-color": ["get", "labelHaloColor"],
            "text-halo-width": 2.25,
          },
        })
      } else {
        syncCountryData(map)
      }
    })().catch((err) => {
      console.error("[word-map] failed to load countries", err)
    })

    return () => {
      cancelled = true
    }
  }, [isLoaded, map, syncCountryData])

  useEffect(() => {
    if (!isLoaded || !map || !baseGeoJsonRef.current) return
    syncCountryData(map)
  }, [isLoaded, map, counts, syncCountryData])

  useEffect(() => {
    if (!isLoaded || !map || !baseGeoJsonRef.current) return
    const maxCount = maxCountInCollection(
      enrichCountriesGeoJson(baseGeoJsonRef.current, countsRef.current),
    )
    applyPaint(map, maxCount)
  }, [isLoaded, map, theme, applyPaint])

  useEffect(() => {
    if (!isLoaded || !map || !map.getLayer(FILL_LAYER_ID)) return

    const popup = new MapLibreGL.Popup({
      closeButton: false,
      closeOnClick: false,
    })

    const onMove = (e: MapLayerMouseEvent) => {
      const feature = e.features?.[0]
      if (!feature) return
      const name = String(
        feature.properties?.NAME ?? feature.properties?.ADMIN ?? "Country",
      )
      const count = Number(feature.properties?.count ?? 0)
      const iso2 = String(feature.properties?.ISO_A2 ?? "")
      map.getCanvas().style.cursor = "pointer"
      popup
        .setLngLat(e.lngLat)
        .setHTML(
          `<div class="text-xs"><strong>${escapeHtml(name)}</strong>${iso2 && iso2 !== "-99" ? ` (${escapeHtml(iso2)})` : ""}<br/>Count: ${count.toLocaleString()}</div>`,
        )
        .addTo(map)
    }

    const onLeave = () => {
      map.getCanvas().style.cursor = ""
      popup.remove()
    }

    map.on("mousemove", FILL_LAYER_ID, onMove)
    map.on("mouseleave", FILL_LAYER_ID, onLeave)

    return () => {
      map.off("mousemove", FILL_LAYER_ID, onMove)
      map.off("mouseleave", FILL_LAYER_ID, onLeave)
      popup.remove()
    }
  }, [isLoaded, map])

  useEffect(() => {
    return () => {
      if (!map) return
      try {
        if (map.getLayer(LABEL_LAYER_ID)) map.removeLayer(LABEL_LAYER_ID)
        if (map.getLayer(LINE_LAYER_ID)) map.removeLayer(LINE_LAYER_ID)
        if (map.getLayer(FILL_LAYER_ID)) map.removeLayer(FILL_LAYER_ID)
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
      } catch {
        // ignore teardown races
      }
    }
  }, [map])

  return null
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}
