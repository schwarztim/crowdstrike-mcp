# Architecture Decision Records (ADRs)

## Overview

This document captures key architecture decisions made during the design and implementation of the CrowdStrike MCP Server, using the ADR format.

---

## ADR-001: Use stdio Transport for MCP

### Status
Accepted

### Context
MCP (Model Context Protocol) supports multiple transport mechanisms including stdio, HTTP/SSE, and WebSocket. We need to choose the appropriate transport for this integration.

### Decision
Use stdio (standard input/output) transport for MCP communication.

### Consequences
**Positive:**
- Simplest implementation with minimal dependencies
- No network exposure; inherently secure
- Direct integration with MCP clients that spawn processes
- No port management or network configuration required

**Negative:**
- Cannot be used as a shared network service
- One process per AI session
- No HTTP health endpoints for monitoring

### Rationale
The MCP server is designed to run locally alongside an AI assistant. stdio provides the simplest, most secure integration without introducing network attack surface.

---

## ADR-002: Single-File Architecture

### Status
Accepted (with noted future consideration)

### Context
The implementation consists of a single TypeScript file (`src/index.ts`) containing all components: client, tools, handlers, and main function.

### Decision
Keep all code in a single file for the initial implementation.

### Consequences
**Positive:**
- Easy to understand and review
- Simple build process
- No module resolution complexity
- Quick to prototype and iterate

**Negative:**
- File is 1347 lines; may become unwieldy
- Limited separation of concerns
- Harder to test individual components
- Code reuse across projects requires copy-paste

### Rationale
For an initial release, simplicity trumps modularity. The codebase is small enough to navigate. Future versions may modularize if the codebase grows.

---

## ADR-003: Environment Variables for Credentials

### Status
Accepted

### Context
CrowdStrike API credentials (client ID and secret) must be provided to the MCP server. Options include environment variables, config files, or interactive prompts.

### Decision
Use environment variables (`CROWDSTRIKE_CLIENT_ID`, `CROWDSTRIKE_CLIENT_SECRET`, `CROWDSTRIKE_BASE_URL`).

### Consequences
**Positive:**
- Standard practice for twelve-factor apps
- Compatible with secret managers (Vault, 1Password CLI)
- No credentials in files that could be committed
- Easy to configure in MCP client settings

**Negative:**
- Visible in process environment (e.g., /proc on Linux)
- Requires process restart to rotate credentials
- No built-in credential validation at startup

### Rationale
Environment variables are the de facto standard for secrets in containerized and cloud-native environments. They integrate well with secret management systems.

---

## ADR-004: In-Memory Token Caching

### Status
Accepted

### Context
OAuth2 access tokens have a limited lifetime (typically 30 minutes for CrowdStrike). We need a strategy for managing token refresh.

### Decision
Cache the access token in instance memory with automatic refresh 60 seconds before expiry.

### Consequences
**Positive:**
- Minimizes OAuth calls (one per ~29 minutes)
- Simple implementation with instance variables
- No external cache dependency
- Tokens never written to disk

**Negative:**
- Token lost on process restart
- No sharing of tokens across instances
- Memory exposure if process is compromised

### Rationale
Given the single-process, ephemeral nature of the MCP server, in-memory caching is sufficient. The 60-second buffer prevents edge cases where a token expires mid-request.

---

## ADR-005: Query-Then-Fetch Pattern for Search APIs

### Status
Accepted

### Context
Most CrowdStrike search APIs return only resource IDs, requiring a second call to fetch details. We could either return just IDs or automatically fetch details.

### Decision
Implement a two-step pattern: query for IDs, then fetch full details in a single tool invocation.

### Consequences
**Positive:**
- Single tool call returns complete data for AI consumption
- Hides API complexity from users
- Consistent behavior across tools

**Negative:**
- Two API calls per search (higher latency)
- Potential for large payloads if many results
- No option to get just IDs for efficiency

### Rationale
AI assistants work better with complete data in a single response. The latency of two sequential API calls is acceptable for interactive use cases.

---

## ADR-006: Return Full API Responses

### Status
Accepted (with noted consideration)

### Context
CrowdStrike API responses contain many fields. We could either return the full response or filter to essential fields.

### Decision
Return full API responses as JSON.

### Consequences
**Positive:**
- No information loss
- AI can use any field in responses
- Simpler implementation (no field mapping)
- Automatically benefits from API additions

**Negative:**
- Larger payloads consume AI context window
- May include sensitive data (hostnames, IPs, usernames)
- No schema documentation for response fields

### Rationale
AI models are capable of extracting relevant information from larger contexts. Filtering would require maintenance as APIs evolve.

---

## ADR-007: Minimal Dependencies

### Status
Accepted

### Context
Node.js projects can accumulate many dependencies, increasing attack surface and maintenance burden.

### Decision
Limit dependencies to essential packages only:
- `@modelcontextprotocol/sdk` - Required for MCP
- `axios` - HTTP client

### Consequences
**Positive:**
- Smaller attack surface
- Faster installs and builds
- Fewer security updates to track
- Easier security auditing

**Negative:**
- Manual implementation of some utilities
- No advanced features (retry, circuit breaker)

### Rationale
Security-focused applications should minimize dependencies. The two chosen packages are well-maintained and essential for the use case.

---

## ADR-008: TypeScript with Strict Mode

### Status
Accepted

### Context
The project could be written in JavaScript or TypeScript with varying levels of type strictness.

### Decision
Use TypeScript with strict mode enabled.

### Consequences
**Positive:**
- Compile-time error detection
- Better IDE support and documentation
- Safer refactoring
- Self-documenting interfaces

**Negative:**
- Build step required
- Some type gymnastics needed for dynamic API responses

### Rationale
TypeScript's type safety is especially valuable in security-critical code, catching potential errors before runtime.

---

## ADR-009: Exit on Credential Failure

### Status
Accepted

### Context
If CrowdStrike credentials are missing or invalid, the server cannot function. We need to decide behavior in this case.

### Decision
Exit immediately with error code 1 if credentials are missing at startup.

### Consequences
**Positive:**
- Fail fast with clear error message
- No partial functionality that could confuse users
- MCP client can detect and report failure

**Negative:**
- No graceful degradation
- No opportunity to request credentials interactively

### Rationale
A security tool with invalid credentials cannot provide value. Fast, clear failure is preferable to uncertain behavior.

---

## ADR-010: No Local Logging

### Status
Accepted (with noted gap)

### Context
Logging aids debugging but can expose sensitive data. We need to balance observability with security.

### Decision
Minimal logging to stderr (startup message, fatal errors only). No request/response logging.

### Consequences
**Positive:**
- No risk of credential or sensitive data leakage in logs
- Simpler implementation
- Relies on CrowdStrike API audit logs

**Negative:**
- Difficult to debug without adding logging
- No local audit trail
- No visibility into tool usage patterns

### Rationale
Security considerations outweigh debugging convenience. CrowdStrike's API provides server-side audit logging. Future versions may add structured logging with sensitive data redaction.

---

## ADR-011: FQL (Falcon Query Language) Passthrough

### Status
Accepted

### Context
CrowdStrike APIs use FQL for filtering. We could either abstract this or pass it through directly.

### Decision
Pass FQL filter strings directly to APIs without validation or transformation.

### Consequences
**Positive:**
- Full FQL power available to users
- No maintenance of filter abstraction layer
- Consistent with CrowdStrike documentation

**Negative:**
- Potential for FQL injection (mitigated by API validation)
- Users must learn FQL syntax
- Error messages may be cryptic

### Rationale
FQL is expressive and well-documented. AI models can learn FQL syntax from tool descriptions and examples.

---

## ADR-012: All Tools Available by Default

### Status
Accepted

### Context
We could provide configuration to enable/disable specific tools based on use case or security policy.

### Decision
All 24 tools are always available when the server starts.

### Consequences
**Positive:**
- Simple configuration
- Full functionality without additional setup
- AI can discover all capabilities

**Negative:**
- Cannot restrict to read-only mode
- Containment tools always available
- Relies on CrowdStrike API scopes for permission control

### Rationale
Permission control is better handled at the API level through OAuth scopes. Adding tool-level configuration would duplicate this without adding security value.

---

## Future Considerations

The following decisions are deferred for future consideration:

1. **ADR-F1: Modular Code Structure** - Split into separate files for client, tools, handlers
2. **ADR-F2: Structured Logging** - Add JSON logging with sensitive data redaction
3. **ADR-F3: Containerization** - Provide Dockerfile for consistent deployment
4. **ADR-F4: Retry Logic** - Add exponential backoff for transient failures
5. **ADR-F5: Pagination Support** - Automatic pagination for large result sets
6. **ADR-F6: Response Filtering** - Option to return only essential fields

---

## Open Questions and Gaps

1. **Approval Workflow**: Should destructive actions require human confirmation?
2. **Rate Limiting**: Should client-side rate limiting be implemented?
3. **Multi-Tenant Support**: How to support multiple CrowdStrike tenants?
4. **Credential Rotation**: How to rotate credentials without restart?
5. **Metrics Export**: What observability is needed for production use?
