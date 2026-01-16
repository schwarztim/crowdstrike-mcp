# Data Flow Diagrams

## Overview

This document describes the data flows through the CrowdStrike MCP Server, including trust boundaries and sensitive data paths.

## High-Level Data Flow

```mermaid
flowchart TB
    subgraph User["User Context"]
        Operator[Security Operator]
    end

    subgraph Client["MCP Client (Trusted)"]
        AI[AI Assistant]
    end

    subgraph Server["MCP Server (Trusted)"]
        MCP[CrowdStrike MCP]
        TokenMgr[Token Manager]
    end

    subgraph External["External (Trusted Partner)"]
        CS[CrowdStrike Falcon]
    end

    Operator -->|"1. Natural language query"| AI
    AI -->|"2. Tool invocation (JSON-RPC)"| MCP
    MCP -->|"3. OAuth2 token request"| CS
    CS -->|"4. Access token"| TokenMgr
    TokenMgr -->|"5. Cached token"| MCP
    MCP -->|"6. API request + Bearer token"| CS
    CS -->|"7. Security data (JSON)"| MCP
    MCP -->|"8. Tool result (JSON)"| AI
    AI -->|"9. Formatted response"| Operator

    style User fill:#e8f5e9
    style Client fill:#e3f2fd
    style Server fill:#fff3e0
    style External fill:#fce4ec
```

## Trust Boundaries

```mermaid
flowchart TB
    subgraph TB1["Trust Boundary 1: User Environment"]
        User[User Input]
    end

    subgraph TB2["Trust Boundary 2: AI Sandbox"]
        AI[AI Model]
        MCPClient[MCP Client]
    end

    subgraph TB3["Trust Boundary 3: Process Boundary"]
        MCPServer[MCP Server Process]
        Creds[Credentials]
    end

    subgraph TB4["Trust Boundary 4: Network Boundary"]
        TLS[TLS 1.2+ Channel]
    end

    subgraph TB5["Trust Boundary 5: Cloud Provider"]
        CSAPI[CrowdStrike API]
        CSData[Security Telemetry]
    end

    User -.->|"TB1-TB2"| AI
    MCPClient -.->|"TB2-TB3 (stdio)"| MCPServer
    Creds -.->|"Environment injection"| MCPServer
    MCPServer -.->|"TB3-TB4"| TLS
    TLS -.->|"TB4-TB5"| CSAPI
    CSAPI --> CSData

    style TB1 fill:#ffebee
    style TB2 fill:#e3f2fd
    style TB3 fill:#fff8e1
    style TB4 fill:#e8f5e9
    style TB5 fill:#f3e5f5
```

## Sensitive Data Classification

| Data Type | Classification | Location | Protection |
|-----------|---------------|----------|------------|
| Client ID | Secret | Environment variable | Not logged, not transmitted except to OAuth |
| Client Secret | Secret | Environment variable | Not logged, not transmitted except to OAuth |
| Access Token | Secret | In-memory only | Not logged, short-lived (30 min) |
| Host Details | Confidential | Transit only | TLS encrypted, ephemeral |
| Detection Data | Confidential | Transit only | TLS encrypted, ephemeral |
| IOC Values | Confidential | Transit only | TLS encrypted, ephemeral |
| CVE Details | Internal | Transit only | TLS encrypted, ephemeral |

## Authentication Flow

```mermaid
sequenceDiagram
    participant Env as Environment
    participant MCP as MCP Server
    participant Cache as Token Cache
    participant OAuth as CrowdStrike OAuth

    Note over MCP: First API Request

    MCP->>Cache: Check token validity
    Cache->>MCP: Token expired/missing

    MCP->>Env: Read CLIENT_ID, CLIENT_SECRET
    Env->>MCP: Credentials

    MCP->>OAuth: POST /oauth2/token<br/>Content-Type: x-www-form-urlencoded<br/>client_id, client_secret
    OAuth->>MCP: {access_token, expires_in}

    MCP->>Cache: Store token, expiry - 60s buffer

    Note over MCP: Subsequent Requests (within token lifetime)

    MCP->>Cache: Check token validity
    Cache->>MCP: Token valid
    Note over MCP: Use cached token
```

## Tool Invocation Flow

```mermaid
sequenceDiagram
    participant AI as AI Assistant
    participant MCP as MCP Server
    participant Client as CrowdStrike Client
    participant API as CrowdStrike API

    AI->>MCP: CallTool: crowdstrike_search_hosts<br/>{filter: "hostname:*web*", limit: 10}

    MCP->>MCP: Validate tool exists
    MCP->>Client: searchHosts(filter, limit)

    Client->>Client: authenticate() - ensure valid token

    Client->>API: GET /devices/queries/devices/v1<br/>Authorization: Bearer {token}<br/>?filter=hostname:*web*&limit=10
    API->>Client: {resources: ["id1", "id2", ...]}

    alt Has results
        Client->>API: POST /devices/entities/devices/v2<br/>{ids: ["id1", "id2", ...]}
        API->>Client: {resources: [{host_details}...]}
    end

    Client->>MCP: Full host data
    MCP->>AI: {content: [{type: "text", text: JSON}]}
```

## Data Flow: Host Containment

```mermaid
flowchart LR
    subgraph Input
        AI[AI decides to contain]
        Args["host_ids: ['abc123']"]
    end

    subgraph Processing
        MCP[MCP Server]
        Client[CS Client]
        Auth[Token Check]
    end

    subgraph Output
        API[POST /devices/entities/devices-actions/v2<br/>?action_name=contain]
        Result[Action Result]
    end

    subgraph Effect
        Host[Target Host<br/>Network Isolated]
    end

    AI --> Args --> MCP --> Client --> Auth --> API --> Result
    API -.->|"Async effect"| Host

    style Effect fill:#ffcdd2
```

## Data Flow: IOC Creation

```mermaid
flowchart TB
    subgraph Input["Tool Input"]
        Type["type: sha256"]
        Value["value: abc123..."]
        Action["action: prevent"]
        Platforms["platforms: [windows, linux]"]
    end

    subgraph Server["MCP Server"]
        Validate[Validate Schema]
        Build[Build Request Body]
    end

    subgraph API["CrowdStrike API"]
        Create[POST /iocs/entities/indicators/v1]
        Store[IOC Database]
    end

    subgraph Effect["Effect"]
        Block[Endpoints block<br/>matching artifacts]
    end

    Input --> Validate --> Build --> Create --> Store
    Store -.->|"Policy Distribution"| Block

    style Effect fill:#c8e6c9
```

## Error Data Flow

```mermaid
flowchart TB
    subgraph Tool["Tool Execution"]
        Invoke[Tool Invoked]
        Execute[Execute Logic]
    end

    subgraph Error["Error Handling"]
        AxiosErr{Axios Error?}
        ExtractAPI[Extract API Message]
        ExtractGen[Extract Generic Message]
        Format[Format Error Response]
    end

    subgraph Response["Response"]
        Result["{content: [{text: 'Error: ...'}], isError: true}"]
    end

    Invoke --> Execute
    Execute -->|throws| AxiosErr
    AxiosErr -->|Yes| ExtractAPI --> Format
    AxiosErr -->|No| ExtractGen --> Format
    Format --> Result

    style Error fill:#ffecb3
```

## Data Retention

| Data Type | Retention in MCP | Retention in CrowdStrike |
|-----------|-----------------|--------------------------|
| OAuth Tokens | Until expiry (30 min) | N/A |
| API Responses | None (ephemeral) | Per CrowdStrike policy |
| Tool Arguments | None (ephemeral) | N/A |
| Error Messages | None (ephemeral) | N/A |

## Sensitive Data Paths

### Credentials Path (Most Sensitive)

```
Environment Variable --> Node.js Process Memory --> OAuth Request Body --> TLS --> CrowdStrike
                                                  (never logged)
```

### Token Path

```
CrowdStrike Response --> TLS --> Node.js Memory (tokenCache) --> Authorization Header --> TLS --> CrowdStrike
                                 (max 30 min)                    (never logged)
```

### Security Data Path

```
CrowdStrike Database --> API Response --> TLS --> MCP Server --> JSON-RPC Response --> AI Process
                        (sensitive)              (no storage)    (ephemeral)           (AI context window)
```

## Open Questions and Gaps

1. **PII in Responses**: API responses may contain hostnames, usernames, IPs - no sanitization
2. **Audit Logging**: No local audit log of tool invocations - relies on CrowdStrike API logs
3. **Data Minimization**: Full API responses returned; could filter to essential fields
4. **Token Exposure**: Token held in JavaScript memory; could be exposed via memory dump
5. **Request Logging**: No request/response logging for debugging - trade-off with security
