import type { UseGristOptions } from "grist-widget-sdk"

export const GRIST_OPTIONS: UseGristOptions = {
  /** `fetchTable` needs `full`; we read the linked section with `read table`. */
  requiredAccess: "read table",
  columns: [
    {
      name: "CountryISO",
      type: "Text",
      description: "ISO 3166-1 alpha-2 (US, FR) or alpha-3 (USA, FRA)",
    },
    { name: "Count", type: "Numeric" },
  ],
  suppressAlerts: ["section-not-linked"],
}
