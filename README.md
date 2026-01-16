# CrowdStrike Falcon MCP Server

Model Context Protocol (MCP) server for CrowdStrike Falcon EDR/XDR platform.

## Features

- 25 CrowdStrike API operations across 8 categories
- OAuth2 authentication with automatic token refresh
- HTTP connection pooling for optimal performance
- Comprehensive input validation
- Full FQL (Falcon Query Language) support

## Supported Operations

### Host Management
- Search hosts with FQL filters
- Get host details (v1 and v2 APIs)
- Network containment (contain/lift)
- Host visibility (hide/unhide)

### Detection & Incident Response
- Search and manage detections
- Search and manage incidents
- Get behavior details
- Retrieve CrowdScore

### Threat Intelligence
- Search and manage custom IOCs
- Create/delete indicators
- Support for multiple IOC types (hash, domain, IP)

### Vulnerability Management
- Search vulnerabilities via Spotlight
- Filter by CVE, severity, status

### Additional Capabilities
- Host groups management
- Sensor installer information
- Alert management (v2 API)

## Configuration

Required environment variables:

```bash
CROWDSTRIKE_CLIENT_ID=your_client_id
CROWDSTRIKE_CLIENT_SECRET=your_client_secret
CROWDSTRIKE_BASE_URL=https://api.crowdstrike.com  # Optional, defaults to US-1
```

### Regional Base URLs

- US-1: `https://api.crowdstrike.com` (default)
- US-2: `https://api.us-2.crowdstrike.com`
- EU-1: `https://api.eu-1.crowdstrike.com`
- US-GOV-1: `https://api.laggar.gcw.crowdstrike.com`

## Installation

```bash
npm install
npm run build
```

## Usage

```bash
npm start
```

Or with tsx for development:

```bash
npm run dev
```

## Performance Optimizations

Version 1.1.0 includes significant performance improvements:

- **HTTP Connection Pooling**: Enabled keepAlive with connection reuse
  - 20-50% reduction in request latency
  - Max 50 concurrent sockets, 10 free sockets in pool
  - 30-second keepAlive timeout

- **Optimized Authentication**: Auth requests use connection pool
  - Reduced overhead for token refresh
  - Shared connections across all API calls

- **Input Validation**: Prevents invalid batch operations
  - Host details: max 5,000 IDs
  - Host actions: max 100 IDs per request

## API Evolution

This server implements the latest CrowdStrike API standards as of January 2026:

- Uses Alerts-based APIs (Detections API deprecated Sept 2025)
- Supports both v1 (POST) and v2 (GET) device details endpoints
- Ready for mitre_attack array support (legacy fields deprecated Jan 2026)

## Security

- Zero npm vulnerabilities (verified via npm audit)
- No hardcoded credentials
- Input validation on all array-based operations
- 30-second request timeout prevents hanging connections

## License

MIT

## Resources

- [CrowdStrike Developer Center](https://developer.crowdstrike.com/)
- [Falcon API Documentation](https://developer.crowdstrike.com/docs/openapi/)
- [FQL Filter Reference](https://falcon.crowdstrike.com/documentation/45/falcon-query-language-feature-guide)
