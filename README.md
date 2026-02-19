# IFS Cloud MCP Server

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server that provides AI assistants with direct access to IFS Cloud work order management via OData REST API.

Enables LLMs to create, manage, and query work orders, fault reports, equipment, and more in IFS Cloud — without users needing to know IFS OData internals.

## Tools (22)

### Discovery
| Tool | Description |
|------|-------------|
| `list_sites` | List all sites/contracts |
| `list_equipment` | Search equipment/assets with filtering |
| `get_equipment` | Get details for a specific asset |
| `list_persons` | Search technicians/employees |
| `list_customers` | List customers |
| `list_inventory_parts` | Search inventory parts |

### Work Orders
| Tool | Description |
|------|-------------|
| `create_work_order` | Create a new work order with human-friendly inputs |
| `release_work_order` | Release a WO for execution (handles etag flow) |
| `list_work_orders` | List WOs with filtering by site, status, priority |
| `get_work_order` | Get full WO details including tasks and steps |
| `add_task_steps` | Add task steps to a work order |
| `list_task_steps` | List all steps for a work order |

### Reporting
| Tool | Description |
|------|-------------|
| `create_fault_report` | Create a fault report |
| `list_fault_reports` | List fault reports |
| `log_time` | Log time against a work order |
| `list_time_entries` | List time entries for a WO |
| `report_hse_incident` | Report a health/safety/environment incident |

### Materials & Assets
| Tool | Description |
|------|-------------|
| `requisition_material` | Create a material requisition |
| `list_materials` | List material requisitions for a WO |
| `record_meter_reading` | Record an equipment meter reading |
| `list_meter_readings` | List meter readings for equipment |

### Other
| Tool | Description |
|------|-------------|
| `list_service_contracts` | List service contracts |
| `attach_document` | Attach a document reference to an entity |

## Setup

### Prerequisites

- Node.js 18+
- IFS Cloud instance with OData API access
- OAuth2 client credentials (client ID + secret) with appropriate IFS permissions

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `IFS_BASE_URL` | Yes | IFS Cloud base URL (e.g. `https://your-instance.ifs.cloud`) |
| `IFS_TOKEN_URL` | Yes | OAuth2 token endpoint |
| `IFS_CLIENT_ID` | Yes | OAuth2 client ID |
| `IFS_CLIENT_SECRET` | Yes | OAuth2 client secret |
| `IFS_DEFAULT_COMPANY` | No | Default company ID for new records |
| `IFS_DEFAULT_SITE` | No | Default site/contract code |
| `IFS_SCOPE` | No | OAuth2 scope |
| `IFS_TIMEOUT` | No | Request timeout in ms (default: 30000) |
| `MCP_TRANSPORT` | No | `stdio` (default) or `sse` |
| `MCP_PORT` | No | HTTP port for SSE transport (default: 3100) |

## Usage

### With Cursor

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "ifs-cloud": {
      "command": "node",
      "args": ["/path/to/ifs-cloud-mcp/dist/index.js"],
      "env": {
        "IFS_BASE_URL": "https://your-instance.ifs.cloud",
        "IFS_TOKEN_URL": "https://your-instance.ifs.cloud/auth/realms/ifs/protocol/openid-connect/token",
        "IFS_CLIENT_ID": "your-client-id",
        "IFS_CLIENT_SECRET": "your-client-secret",
        "IFS_DEFAULT_COMPANY": "25",
        "IFS_DEFAULT_SITE": "2501"
      }
    }
  }
}
```

### With Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ifs-cloud": {
      "command": "node",
      "args": ["/path/to/ifs-cloud-mcp/dist/index.js"],
      "env": {
        "IFS_BASE_URL": "https://your-instance.ifs.cloud",
        "IFS_TOKEN_URL": "https://your-instance.ifs.cloud/auth/realms/ifs/protocol/openid-connect/token",
        "IFS_CLIENT_ID": "your-client-id",
        "IFS_CLIENT_SECRET": "your-client-secret"
      }
    }
  }
}
```

### Via npx (once published)

```json
{
  "mcpServers": {
    "ifs-cloud": {
      "command": "npx",
      "args": ["-y", "@resolve/ifs-cloud-mcp"],
      "env": {
        "IFS_BASE_URL": "...",
        "IFS_TOKEN_URL": "...",
        "IFS_CLIENT_ID": "...",
        "IFS_CLIENT_SECRET": "..."
      }
    }
  }
}
```

### As a shared SSE server

Run the server with SSE transport for multi-user access:

```bash
IFS_BASE_URL=https://... \
IFS_TOKEN_URL=https://... \
IFS_CLIENT_ID=... \
IFS_CLIENT_SECRET=... \
MCP_TRANSPORT=sse \
MCP_PORT=3100 \
node dist/index.js
```

Connect from any MCP client using the SSE endpoint:
- SSE: `GET http://localhost:3100/sse`
- Messages: `POST http://localhost:3100/messages?sessionId=...`
- Health: `GET http://localhost:3100/health`

## Build from Source

```bash
git clone https://github.com/YOUR_ORG/ifs-cloud-mcp.git
cd ifs-cloud-mcp
npm install
npm run build
```

## Example Prompts

Once configured, ask your AI assistant things like:

- *"List all sites in IFS"*
- *"Show me equipment at the Amsterdam site"*
- *"Create a corrective work order for chiller NLVTZ2001 at site 2501, high priority"*
- *"Add inspection steps to WO 750: check compressor, test refrigerant levels, verify temperatures"*
- *"Release work order 750"*
- *"What are the open work orders at the London site?"*
- *"Log 3 hours for employee JSMITH on WO 750"*
- *"Create a fault report for the HVAC unit at Austin — it's overheating"*
- *"Record a temperature reading of 72.5 for meter TEMP-01 on equipment NLVTZ2001"*
- *"Report a near-miss HSE incident at the Austin warehouse"*
- *"Who are the technicians available? Search for Smith"*

## IFS Cloud API Coverage

| Projection | Operations |
|-----------|------------|
| `ActiveWorkOrdersHandling` | Read work orders |
| `PrepareWorkOrderHandling` | Create, release work orders |
| `WorkTaskHandling` | Tasks, time entries, materials |
| `WorkTaskStepsHandling` | Task steps |
| `FaultReportHandling` | Fault reports |
| `EquipmentAllObjectsHandling` | Equipment/assets |
| `CompanySiteHandling` | Sites |
| `PersonHandling` | Persons/technicians |
| `CustomerHandling` | Customers |
| `InventoryPartHandling` | Inventory parts |
| `ServiceContractHandling` | Service contracts |
| `ObjectMeasurementService` | Meter readings |
| `HSETransferService` | HSE incidents |
| `CreateAndImportDocument` | Document attachments |

## License

MIT
