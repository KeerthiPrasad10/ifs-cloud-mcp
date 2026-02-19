#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js"
import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import { configure } from "./ifs-client.js"
import { registerWorkOrderTools } from "./tools/work-orders.js"
import { registerTaskStepTools } from "./tools/task-steps.js"
import { registerAssetTools } from "./tools/assets.js"
import { registerSiteTools } from "./tools/sites.js"
import { registerFaultReportTools } from "./tools/fault-reports.js"
import { registerTimeEntryTools } from "./tools/time-entries.js"
import { registerMaterialTools } from "./tools/materials.js"
import { registerServiceContractTools } from "./tools/service-contracts.js"
import { registerMeterReadingTools } from "./tools/meter-readings.js"
import { registerHSETools } from "./tools/hse.js"
import { registerDocumentTools } from "./tools/documents.js"
import { registerPersonTools } from "./tools/persons.js"

function loadConfig(): void {
  const baseUrl = process.env.IFS_BASE_URL
  const tokenUrl = process.env.IFS_TOKEN_URL
  const clientId = process.env.IFS_CLIENT_ID
  const clientSecret = process.env.IFS_CLIENT_SECRET

  if (!baseUrl || !tokenUrl || !clientId || !clientSecret) {
    console.error(
      "Missing required environment variables:\n" +
      "  IFS_BASE_URL      - IFS Cloud base URL (e.g. https://your-instance.ifs.cloud)\n" +
      "  IFS_TOKEN_URL     - OAuth2 token endpoint\n" +
      "  IFS_CLIENT_ID     - OAuth2 client ID\n" +
      "  IFS_CLIENT_SECRET - OAuth2 client secret\n" +
      "\nOptional:\n" +
      "  IFS_DEFAULT_COMPANY - Default company ID\n" +
      "  IFS_DEFAULT_SITE    - Default site/contract code\n" +
      "  IFS_SCOPE           - OAuth2 scope\n" +
      "  IFS_TIMEOUT         - Request timeout in ms (default: 30000)",
    )
    process.exit(1)
  }

  configure({
    baseUrl: baseUrl.replace(/\/$/, ""),
    tokenUrl,
    clientId,
    clientSecret,
    scope: process.env.IFS_SCOPE,
    defaultCompany: process.env.IFS_DEFAULT_COMPANY,
    defaultSite: process.env.IFS_DEFAULT_SITE,
    timeout: process.env.IFS_TIMEOUT ? parseInt(process.env.IFS_TIMEOUT, 10) : undefined,
  })
}

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "ifs-cloud",
    version: "1.0.0",
  })

  registerSiteTools(server)
  registerPersonTools(server)
  registerAssetTools(server)
  registerWorkOrderTools(server)
  registerTaskStepTools(server)
  registerFaultReportTools(server)
  registerTimeEntryTools(server)
  registerMaterialTools(server)
  registerServiceContractTools(server)
  registerMeterReadingTools(server)
  registerHSETools(server)
  registerDocumentTools(server)

  return server
}

async function startStdio(): Promise<void> {
  const server = createMcpServer()
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

async function startSSE(port: number): Promise<void> {
  const sessions = new Map<string, SSEServerTransport>()

  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`)

    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    res.setHeader("Access-Control-Allow-Headers", "Content-Type")

    if (req.method === "OPTIONS") {
      res.writeHead(204)
      res.end()
      return
    }

    if (url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ status: "ok", transport: "sse", tools: 22 }))
      return
    }

    if (url.pathname === "/sse" && req.method === "GET") {
      const transport = new SSEServerTransport("/messages", res)
      const sessionId = transport.sessionId
      sessions.set(sessionId, transport)

      const server = createMcpServer()
      await server.connect(transport)

      req.on("close", () => {
        sessions.delete(sessionId)
      })
      return
    }

    if (url.pathname === "/messages" && req.method === "POST") {
      const sessionId = url.searchParams.get("sessionId")
      if (!sessionId || !sessions.has(sessionId)) {
        res.writeHead(400, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ error: "Invalid or missing sessionId" }))
        return
      }

      const transport = sessions.get(sessionId)!
      await transport.handlePostMessage(req, res)
      return
    }

    res.writeHead(404, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Not found" }))
  })

  httpServer.listen(port, () => {
    console.error(`IFS Cloud MCP server (SSE) listening on http://localhost:${port}`)
    console.error(`  SSE endpoint:     GET  http://localhost:${port}/sse`)
    console.error(`  Message endpoint: POST http://localhost:${port}/messages`)
    console.error(`  Health check:     GET  http://localhost:${port}/health`)
  })
}

async function main(): Promise<void> {
  loadConfig()

  const transport = process.env.MCP_TRANSPORT?.toLowerCase()
  const port = parseInt(process.env.MCP_PORT ?? "3100", 10)

  if (transport === "sse") {
    await startSSE(port)
  } else {
    await startStdio()
  }
}

main().catch((err) => {
  console.error("Fatal:", err)
  process.exit(1)
})
