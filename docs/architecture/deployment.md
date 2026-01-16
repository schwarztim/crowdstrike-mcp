# Deployment Architecture

## Overview

This document describes the deployment model for the CrowdStrike MCP Server across different environments and configurations.

## Deployment Model

The CrowdStrike MCP Server is designed as a local process that runs alongside an MCP client (AI assistant). It is not a network service and does not require hosting infrastructure.

```mermaid
flowchart TB
    subgraph Local["Local Development / User Machine"]
        subgraph Terminal["Terminal / IDE"]
            AI[AI Assistant<br/>Claude Desktop / CLI]
        end

        subgraph Process["Node.js Process"]
            MCP[CrowdStrike MCP Server]
        end

        ENV[.env / Environment]
    end

    subgraph Cloud["CrowdStrike Cloud"]
        direction TB
        US1[US-1<br/>api.crowdstrike.com]
        US2[US-2<br/>api.us-2.crowdstrike.com]
        EU1[EU-1<br/>api.eu-1.crowdstrike.com]
        GOV[US-GOV-1<br/>api.laggar.gcw.crowdstrike.com]
    end

    AI <-->|stdio| MCP
    ENV -.->|credentials| MCP
    MCP -->|HTTPS| US1
    MCP -->|HTTPS| US2
    MCP -->|HTTPS| EU1
    MCP -->|HTTPS| GOV

    style Local fill:#e1f5fe
    style Cloud fill:#fff3e0
```

## Environment Matrix

| Environment | Description | CrowdStrike Cloud | Use Case |
|-------------|-------------|-------------------|----------|
| Local Dev | Developer workstation | Sandbox/Dev tenant | Feature development, testing |
| CI | CI/CD pipeline | Test tenant | Automated testing |
| SOC Workstation | Analyst machine | Production tenant | Security operations |
| Automation Server | Headless server | Production tenant | Automated response playbooks |

## Deployment Diagram by Environment

### Local Development

```mermaid
flowchart LR
    subgraph Dev["Developer Machine"]
        IDE[VS Code / Terminal]
        Node[Node.js 18+]
        Src[Source Code<br/>src/index.ts]
        Dist[Compiled<br/>dist/index.js]
        ENV[.env file]
    end

    subgraph NPM["npm Registry"]
        Deps[Dependencies]
    end

    subgraph CS["CrowdStrike Dev/Sandbox"]
        API[Falcon API]
    end

    IDE -->|npm run dev| Src
    IDE -->|npm run build| Dist
    NPM -->|npm install| Node
    ENV -.->|source| IDE
    Node -->|tsx / node| API
```

**Setup**:
```bash
# Clone and install
git clone <repo>
cd crowdstrike-mcp
npm install

# Configure credentials (dev tenant)
export CROWDSTRIKE_CLIENT_ID="dev-client-id"
export CROWDSTRIKE_CLIENT_SECRET="dev-client-secret"
export CROWDSTRIKE_BASE_URL="https://api.crowdstrike.com"

# Development mode
npm run dev
```

### Production (SOC Workstation)

```mermaid
flowchart LR
    subgraph SOC["SOC Workstation"]
        Claude[Claude Desktop]
        Config[claude_desktop_config.json]
        Node[Node.js Runtime]
        MCP[crowdstrike-mcp]
    end

    subgraph Secrets["Secret Management"]
        Vault[Credential Store<br/>1Password / HashiCorp Vault]
    end

    subgraph CS["CrowdStrike Production"]
        API[Falcon API]
    end

    Claude -->|spawns| Node
    Config -->|mcp config| Claude
    Vault -.->|env injection| Node
    Node --> MCP
    MCP --> API
```

**Configuration (claude_desktop_config.json)**:
```json
{
  "mcpServers": {
    "crowdstrike": {
      "command": "node",
      "args": ["/path/to/crowdstrike-mcp/dist/index.js"],
      "env": {
        "CROWDSTRIKE_CLIENT_ID": "${CROWDSTRIKE_CLIENT_ID}",
        "CROWDSTRIKE_CLIENT_SECRET": "${CROWDSTRIKE_CLIENT_SECRET}",
        "CROWDSTRIKE_BASE_URL": "https://api.crowdstrike.com"
      }
    }
  }
}
```

### CI/CD Pipeline

```mermaid
flowchart LR
    subgraph CI["CI System (GitHub Actions)"]
        Checkout[Checkout Code]
        Install[npm install]
        Build[npm run build]
        Test[Integration Tests]
    end

    subgraph Secrets["GitHub Secrets"]
        CID[CROWDSTRIKE_CLIENT_ID]
        CSE[CROWDSTRIKE_CLIENT_SECRET]
    end

    subgraph CS["CrowdStrike Test Tenant"]
        API[Falcon API]
    end

    Checkout --> Install --> Build --> Test
    Secrets -.->|env| Test
    Test --> API
```

**Example GitHub Actions Workflow**:
```yaml
name: CI
on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build

  integration-test:
    needs: build
    runs-on: ubuntu-latest
    env:
      CROWDSTRIKE_CLIENT_ID: ${{ secrets.CROWDSTRIKE_CLIENT_ID }}
      CROWDSTRIKE_CLIENT_SECRET: ${{ secrets.CROWDSTRIKE_CLIENT_SECRET }}
      CROWDSTRIKE_BASE_URL: https://api.crowdstrike.com
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build
      - run: npm test
```

## Network Requirements

### Outbound Connections

| Destination | Port | Protocol | Purpose |
|-------------|------|----------|---------|
| api.crowdstrike.com | 443 | HTTPS | US-1 API |
| api.us-2.crowdstrike.com | 443 | HTTPS | US-2 API |
| api.eu-1.crowdstrike.com | 443 | HTTPS | EU-1 API |
| api.laggar.gcw.crowdstrike.com | 443 | HTTPS | US-GOV-1 API |

### Inbound Connections

None required. The MCP server is a local process communicating via stdio.

### Proxy Configuration

If operating behind a corporate proxy, configure via standard Node.js environment variables:

```bash
export HTTP_PROXY="http://proxy.corp.example.com:8080"
export HTTPS_PROXY="http://proxy.corp.example.com:8080"
export NO_PROXY="localhost,127.0.0.1"
```

## CrowdStrike Cloud Regions

| Region | Base URL | Notes |
|--------|----------|-------|
| US-1 | https://api.crowdstrike.com | Default, US East |
| US-2 | https://api.us-2.crowdstrike.com | US West |
| EU-1 | https://api.eu-1.crowdstrike.com | EU (Frankfurt) |
| US-GOV-1 | https://api.laggar.gcw.crowdstrike.com | FedRAMP High |

**Note**: Tenant region is determined at provisioning. Use the correct base URL for your tenant.

## Runtime Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| Node.js | 18.x | 20.x LTS |
| Memory | 64 MB | 128 MB |
| Disk | 50 MB (with deps) | 100 MB |
| Network | 1 Mbps | 10 Mbps |

## Artifact Structure

```
crowdstrike-mcp/
├── dist/
│   ├── index.js          # Compiled JavaScript (entry point)
│   ├── index.js.map      # Source map
│   ├── index.d.ts        # TypeScript declarations
│   └── index.d.ts.map    # Declaration map
├── src/
│   └── index.ts          # Source TypeScript
├── node_modules/         # Dependencies
├── package.json          # Project manifest
├── package-lock.json     # Dependency lock
└── tsconfig.json         # TypeScript config
```

## High Availability Considerations

The MCP server is designed for interactive use, not high availability:

| Aspect | Current State | For HA (if needed) |
|--------|---------------|-------------------|
| Redundancy | Single process | Multiple AI sessions |
| Failover | Process restart | MCP client handles |
| State | Stateless | No state to replicate |
| Load Balancing | N/A | Not applicable (stdio) |

## Open Questions and Gaps

1. **Containerization**: No Dockerfile provided; could add for consistent deployment
2. **Version Pinning**: Uses semver ranges; could pin exact versions for reproducibility
3. **Health Monitoring**: No health endpoint; relies on process monitoring
4. **Log Aggregation**: stderr only; no structured logging or log forwarding
5. **Credential Rotation**: Requires process restart to pick up new credentials
