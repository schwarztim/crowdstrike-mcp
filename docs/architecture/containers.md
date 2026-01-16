# Container Diagram (C4 Level 2)

## Overview

This document describes the container-level architecture, showing the runtime components and their interactions. In this context, "container" refers to separately runnable/deployable units, not Docker containers.

## Container Diagram

```mermaid
C4Container
    title Container Diagram - CrowdStrike MCP Server

    Person(operator, "Security Operator", "Uses AI for security operations")

    Container_Boundary(client_boundary, "MCP Client Environment") {
        Container(ai_runtime, "AI Runtime", "Claude Desktop / CLI", "Runs AI model, manages conversation")
        Container(mcp_client, "MCP Client", "MCP SDK", "Manages MCP server lifecycle")
    }

    Container_Boundary(server_boundary, "MCP Server Process") {
        Container(mcp_server, "CrowdStrike MCP Server", "Node.js / TypeScript", "Single process, stdio transport<br/>Exposes security tools via MCP")
    }

    System_Ext(crowdstrike_api, "CrowdStrike Falcon API", "REST API endpoints<br/>OAuth2 authentication")

    Rel(operator, ai_runtime, "Natural language", "Chat UI / CLI")
    Rel(ai_runtime, mcp_client, "Tool calls", "Internal")
    Rel(mcp_client, mcp_server, "JSON-RPC", "stdio (stdin/stdout)")
    Rel(mcp_server, crowdstrike_api, "REST calls", "HTTPS/TLS 1.2+")
```

## Runtime View

```mermaid
flowchart TB
    subgraph Host["Host Machine"]
        subgraph AI["AI Process"]
            Claude["Claude / AI Model"]
            MCPClient["MCP Client Library"]
        end

        subgraph MCP["MCP Server Process"]
            MCPServer["CrowdStrike MCP Server"]
            AxiosClient["Axios HTTP Client"]
            TokenCache["Token Cache (memory)"]
        end

        ENV["Environment Variables"]
    end

    subgraph Cloud["CrowdStrike Cloud"]
        OAuth["OAuth2 Token Endpoint"]
        API["Falcon API Endpoints"]
    end

    Claude --> MCPClient
    MCPClient -->|"stdio"| MCPServer
    ENV -.->|"credentials"| MCPServer
    MCPServer --> AxiosClient
    AxiosClient --> OAuth
    OAuth -->|"access_token"| TokenCache
    TokenCache -->|"Bearer token"| AxiosClient
    AxiosClient --> API
```

## Container Details

### CrowdStrike MCP Server

| Property | Value |
|----------|-------|
| **Technology** | Node.js 18+ with TypeScript |
| **Entry Point** | `dist/index.js` (compiled from `src/index.ts`) |
| **Transport** | stdio (StdioServerTransport) |
| **Process Model** | Single process, single thread (event loop) |
| **Memory** | ~50-100MB typical usage |

#### Responsibilities

1. **Tool Registration**: Exposes 24 tools to MCP clients
2. **Request Handling**: Parses MCP requests, validates arguments
3. **Authentication**: Manages OAuth2 token lifecycle
4. **API Translation**: Converts tool calls to CrowdStrike API requests
5. **Response Formatting**: Returns JSON responses to MCP client

### MCP Client (External)

The MCP client is not part of this system but is shown for context:

| Property | Value |
|----------|-------|
| **Examples** | Claude Desktop, Claude CLI, custom MCP clients |
| **Responsibility** | Spawns MCP server, routes tool calls, manages lifecycle |
| **Protocol** | MCP over stdio |

### CrowdStrike Falcon API (External)

| Property | Value |
|----------|-------|
| **Type** | External REST API |
| **Authentication** | OAuth2 Client Credentials |
| **Base URLs** | api.crowdstrike.com (US-1), api.us-2.crowdstrike.com, etc. |
| **Protocol** | HTTPS with TLS 1.2+ |

## Process Lifecycle

```mermaid
sequenceDiagram
    participant Client as MCP Client
    participant Server as CrowdStrike MCP
    participant CS as CrowdStrike API

    Note over Client,Server: Startup Phase
    Client->>Server: spawn process
    Server->>Server: Read env vars
    alt Missing credentials
        Server->>Server: Exit(1)
    end
    Server->>Server: Initialize MCP Server
    Server->>Client: Ready (via stderr)

    Note over Client,Server: Operation Phase
    Client->>Server: ListTools request
    Server->>Client: Tool definitions

    Client->>Server: CallTool request
    Server->>CS: OAuth2 token (if expired)
    CS->>Server: Access token
    Server->>CS: API request
    CS->>Server: API response
    Server->>Client: Tool result

    Note over Client,Server: Shutdown Phase
    Client->>Server: Close stdio
    Server->>Server: Process exits
```

## Configuration

### Environment Variables

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `CROWDSTRIKE_CLIENT_ID` | Yes | OAuth2 client ID | - |
| `CROWDSTRIKE_CLIENT_SECRET` | Yes | OAuth2 client secret | - |
| `CROWDSTRIKE_BASE_URL` | No | API base URL | `https://api.crowdstrike.com` |

### Build Configuration

| File | Purpose |
|------|---------|
| `tsconfig.json` | TypeScript compiler options (ES2022, ESM) |
| `package.json` | Dependencies, scripts, metadata |

## Scalability Considerations

| Aspect | Current State | Notes |
|--------|---------------|-------|
| **Horizontal Scaling** | N/A | Single process per AI assistant session |
| **Vertical Scaling** | Low memory footprint | Can handle many sequential requests |
| **Concurrency** | Limited | Node.js event loop; API calls are async |
| **Connection Pooling** | Default Axios | HTTP keep-alive supported |

## Open Questions and Gaps

1. **Process Supervision**: No built-in restart on crash; relies on MCP client
2. **Resource Limits**: No memory or CPU limits enforced at process level
3. **Graceful Shutdown**: Limited; stdio close triggers exit
4. **Health Checks**: No health endpoint (stdio-only transport)
