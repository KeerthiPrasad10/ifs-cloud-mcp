import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { ifsGet, ifsPost, getConfig, type ODataResponse } from "../ifs-client.js"
import { IFS_PROJECTIONS } from "../mappings.js"

export function registerMeterReadingTools(server: McpServer): void {
  server.tool(
    "record_meter_reading",
    "Record a meter/measurement reading for an equipment object in IFS Cloud. Used for condition-based maintenance tracking.",
    {
      equipment: z.string().describe("Equipment code (MchCode)"),
      meter_type: z.string().describe("Test point / measurement type ID"),
      value: z.number().describe("Measured value"),
      reading_date: z.string().optional().describe("Date of reading in ISO 8601 format. Defaults to now"),
      recorded_by: z.string().optional().describe("Person ID who took the reading"),
      site: z.string().optional().describe("Site contract code. Falls back to IFS_DEFAULT_SITE"),
    },
    async ({ equipment, meter_type, value, reading_date, recorded_by, site }) => {
      const cfg = getConfig()
      const contract = site ?? cfg.defaultSite

      await ifsPost(IFS_PROJECTIONS.meterReadings, {
        Contract: contract,
        MchCode: equipment,
        TestPointId: meter_type,
        RegDate: reading_date ?? new Date().toISOString(),
        MeasuredValue: value,
        RegisteredBy: recorded_by ?? "MCP",
      })

      return {
        content: [{ type: "text", text: `Meter reading recorded: ${meter_type} = ${value} for equipment ${equipment}.` }],
      }
    },
  )

  server.tool(
    "list_meter_readings",
    "List meter/measurement readings for an equipment object.",
    {
      equipment: z.string().describe("Equipment code (MchCode)"),
      limit: z.number().default(20).describe("Maximum number of readings to return"),
    },
    async ({ equipment, limit }) => {
      const response = await ifsGet<ODataResponse>(
        `${IFS_PROJECTIONS.meterReadings}/AssetMeasurementEntity`,
        {
          $filter: `MchCode eq '${equipment}'`,
          $top: limit,
        },
      )

      const readings = (response.value ?? []).map((r) => ({
        equipment: r.MchCode,
        meter_type: r.TestPointId,
        value: r.MeasuredValue,
        date: r.RegDate,
        recorded_by: r.RegisteredBy,
      }))

      return {
        content: [{
          type: "text",
          text: `Found ${readings.length} readings for ${equipment}.\n\n${JSON.stringify(readings, null, 2)}`,
        }],
      }
    },
  )
}
