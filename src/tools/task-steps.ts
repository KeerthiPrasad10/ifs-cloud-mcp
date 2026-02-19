import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { ifsGet, ifsPost, type ODataResponse } from "../ifs-client.js"
import { IFS_PROJECTIONS } from "../mappings.js"

export function registerTaskStepTools(server: McpServer): void {
  server.tool(
    "add_task_steps",
    "Add task steps to a work order. Automatically finds the TaskSeq for the WO and adds numbered steps.",
    {
      wo_no: z.number().describe("The work order number"),
      steps: z.array(z.string()).min(1).describe("List of step descriptions in order"),
    },
    async ({ wo_no, steps }) => {
      const taskResp = await ifsGet<ODataResponse>(IFS_PROJECTIONS.workTasks, {
        $filter: `WoNo eq ${wo_no}`,
        $select: "TaskSeq",
        $top: 1,
      })

      const tasks = taskResp.value ?? []
      if (tasks.length === 0) {
        return {
          content: [{ type: "text", text: `No task found for WO#${wo_no}. The work order may need to be released first to auto-create a default task.` }],
          isError: true,
        }
      }

      const taskSeq = tasks[0].TaskSeq
      let added = 0
      const errors: string[] = []

      for (const desc of steps) {
        try {
          await ifsPost(IFS_PROJECTIONS.workTaskSteps, {
            TaskSeq: taskSeq,
            Description: desc,
          })
          added++
        } catch (err: any) {
          errors.push(`"${desc.slice(0, 40)}...": ${err.message?.slice(0, 80)}`)
        }
      }

      let text = `Added ${added}/${steps.length} steps to WO#${wo_no} (TaskSeq ${taskSeq}).`
      if (errors.length) text += `\n\nErrors:\n${errors.join("\n")}`

      return { content: [{ type: "text", text }] }
    },
  )

  server.tool(
    "list_task_steps",
    "List all task steps for a work order.",
    {
      wo_no: z.number().describe("The work order number"),
    },
    async ({ wo_no }) => {
      const response = await ifsGet<ODataResponse>(IFS_PROJECTIONS.workTaskSteps, {
        $filter: `WoNo eq ${wo_no}`,
        $select: "WoNo,TaskSeq,TaskStepSeq,Description,Objstate,CreatedDate",
        $orderby: "TaskStepSeq asc",
      })

      const steps = (response.value ?? []).map((s, i) => ({
        step_number: i + 1,
        step_seq: s.TaskStepSeq,
        task_seq: s.TaskSeq,
        description: s.Description,
        status: s.Objstate === "DONE" ? "completed" : s.Objstate === "NOTAPPLICABLE" ? "skipped" : "pending",
        created: s.CreatedDate,
      }))

      return {
        content: [{
          type: "text",
          text: `WO#${wo_no} has ${steps.length} task steps.\n\n${JSON.stringify(steps, null, 2)}`,
        }],
      }
    },
  )
}
