import { useEffect, useState } from "react"

import type { MapTheme } from "@/lib/choropleth-scale"

function readMapTheme(): MapTheme {
  if (typeof document === "undefined") return "light"
  return document.documentElement.classList.contains("dark") ? "dark" : "light"
}

/** Tracks app / mapcn theme (document `dark` class). */
export function useMapTheme(): MapTheme {
  const [theme, setTheme] = useState<MapTheme>(readMapTheme)

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(readMapTheme())
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    })
    return () => observer.disconnect()
  }, [])

  return theme
}
