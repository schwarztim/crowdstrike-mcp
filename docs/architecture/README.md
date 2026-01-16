# CrowdStrike MCP Server - Architecture Documentation

## Overview

This documentation provides comprehensive architecture views of the CrowdStrike MCP (Model Context Protocol) Server, which enables AI assistants to interact with the CrowdStrike Falcon EDR/XDR platform.

## Document Navigation

| Document | Description |
|----------|-------------|
| [Context](./context.md) | C4 Level 1 - System context diagram and narrative |
| [Containers](./containers.md) | C4 Level 2 - Container diagram and runtime components |
| [Components](./components.md) | C4 Level 3 - Internal component structure |
| [Deployment](./deployment.md) | Deployment views by environment |
| [Data Flows](./data-flows.md) | Data flow diagrams and sensitive data paths |
| [Security](./security.md) | Threat model, controls, and security architecture |
| [TOGAF Mapping](./togaf-mapping.md) | TOGAF-aligned architecture views |
| [Decisions](./decisions.md) | Architecture Decision Records (ADRs) |

## Architecture Summary

### System Purpose

The CrowdStrike MCP Server is a TypeScript-based server that implements the Model Context Protocol, providing a bridge between AI assistants (such as Claude) and the CrowdStrike Falcon platform. It enables automated security operations including:

- Host/endpoint management and containment
- Detection and incident investigation
- IOC (Indicators of Compromise) management
- Vulnerability discovery via Spotlight
- Alert triage and response

### Technology Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js (ES2022) |
| Language | TypeScript 5.3+ |
| Protocol | MCP over stdio |
| HTTP Client | Axios 1.6+ |
| MCP SDK | @modelcontextprotocol/sdk 1.0+ |

### Key Characteristics

- **Stateless Design**: Each request is independent; OAuth tokens are cached in-memory
- **Single Process**: Runs as a single Node.js process
- **Stdio Transport**: Communicates via standard input/output streams
- **No Persistence**: No local data storage; all data resides in CrowdStrike cloud

## Quick Start

```bash
# Environment variables required
export CROWDSTRIKE_CLIENT_ID="your-client-id"
export CROWDSTRIKE_CLIENT_SECRET="your-client-secret"
export CROWDSTRIKE_BASE_URL="https://api.crowdstrike.com"  # Optional

# Build and run
npm install
npm run build
npm start
```

## Architecture Principles

1. **Security First**: Credentials handled via environment variables, never logged
2. **Minimal Dependencies**: Only essential packages to reduce attack surface
3. **Fail Fast**: Immediate exit on missing credentials or fatal errors
4. **Transparent Errors**: Clear error messages propagated to MCP clients
5. **Single Responsibility**: One MCP server per integration target

## Document Conventions

- **Diagrams**: All diagrams use Mermaid syntax for version control and rendering
- **Assumptions**: Clearly labeled when behavior is inferred rather than explicit
- **C4 Model**: Following Simon Brown's C4 architecture model
- **ADR Format**: Using Michael Nygard's ADR template

---

*Last updated: 2025-01-16*
*Generated for: crowdstrike-mcp v1.0.0*
