import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { ifsGet, type ODataResponse } from "../ifs-client.js"
import { IFS_PROJECTIONS } from "../mappings.js"

export function registerPersonTools(server: McpServer): void {
  server.tool(
    "list_persons",
    "List persons/technicians from IFS Cloud. Useful for finding employee IDs to assign work orders or log time.",
    {
      search: z.string().optional().describe("Search by name or person ID"),
      limit: z.number().default(50).describe("Maximum number of results"),
    },
    async ({ search, limit }) => {
      const params: Record<string, string | number | undefined> = {
        $select: "PersonId,Name,FirstName,LastName,UserId",
        $top: limit,
      }
      if (search) {
        params.$filter = `(contains(Name,'${search}') or contains(PersonId,'${search}'))`
      }

      const response = await ifsGet<ODataResponse>(IFS_PROJECTIONS.persons, params)
      const persons = (response.value ?? []).map((r) => ({
        person_id: r.PersonId,
        name: r.Name,
        first_name: r.FirstName,
        last_name: r.LastName,
        user_id: r.UserId,
      }))

      return {
        content: [{
          type: "text",
          text: `Found ${persons.length} persons.\n\n${JSON.stringify(persons, null, 2)}`,
        }],
      }
    },
  )
}
