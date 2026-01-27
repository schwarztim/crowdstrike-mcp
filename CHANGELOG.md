# Changelog

All notable changes to the CrowdStrike MCP server will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-01-27

### Added

- **CRITICAL FIX**: New `crowdstrike_get_host_statistics` tool - Get accurate host inventory totals from dashboard API
  - Returns: total hosts, workstation count, server count, platform breakdown
  - **Solves**: Previous pagination limit caused 58% of hosts to be missed (only retrieved 9,226 of 22,508 hosts)
- **CRITICAL FIX**: New `crowdstrike_search_all_hosts` tool - Bypass 10k pagination limit to retrieve ALL hosts
  - Uses intelligent platform-based chunking (Windows/Linux/Mac) to work around API limitations
  - Automatically handles large inventories (20k+ hosts) with batched detail fetching
  - **Impact**: Now retrieves 100% of host inventory vs. previous 42% coverage

### Changed

- Enhanced `searchAllHosts()` method with platform-based pagination strategy
- Added comprehensive host inventory capability for environments exceeding 10k hosts

### Fixed

- **MAJOR BUG**: CrowdStrike API pagination limit (offset + limit < 10,500) prevented complete host retrieval
  - Previous behavior: Only ~10k hosts retrieved from 22.5k total (13k hosts missing)
  - New behavior: All hosts retrieved using filter-based chunking strategy
- Coverage gap analysis accuracy improved from 36.4% to actual enterprise coverage

### Performance

- Large inventory queries now retrieve all hosts in 2-3 minutes (vs. hitting pagination wall)
- Batch processing optimized for 500-host chunks during detail retrieval

### Security

- No vulnerabilities introduced (npm audit clean)
- No changes to authentication or credential handling

### Notes

- This release directly addresses production issue where 13,282 hosts were invisible to coverage analysis
- Recommended for all users performing enterprise-wide host inventory or compliance reporting

## [1.1.0] - 2026-01-16

### Added

- **New API Tool**: `crowdstrike_get_host_details_v2` - Newer GET-based endpoint for retrieving host details (replaces deprecated POST-based method)
- **Input Validation**: Added validation for array-based operations to prevent empty arrays and enforce batch size limits
  - Host details: max 5,000 IDs
  - Host actions (contain/lift/hide/unhide): max 100 IDs per request
- **Request Timeout**: Added 30-second timeout for all HTTP requests to prevent hanging

### Performance Improvements

- **HTTP Connection Pooling**: Enabled keepAlive connections with connection pooling to reduce latency and improve throughput
  - keepAlive enabled with 30-second timeout
  - Max 50 concurrent sockets per host
  - Max 10 free sockets maintained in pool
- **Authentication Optimization**: Auth requests now use the configured HTTP client with connection pooling (previously used a separate axios instance)
- **Expected Performance Gains**:
  - 20-50% reduction in request latency for sequential API calls (connection reuse)
  - Better performance under high-volume operations (connection pooling)
  - Reduced authentication overhead (shared connection pool)

### Changed

- Updated `crowdstrike_get_host_details` tool description to indicate it uses the legacy API and recommend V2
- Improved error messages to be more descriptive with operation-specific context

### Security

- npm audit: 0 vulnerabilities (verified clean)
- No hardcoded credentials detected
- Input validation prevents potential abuse of batch operations

### Notes

- CrowdStrike deprecated Detections-based APIs as of September 30, 2025 (replaced by Alerts-based actions)
- Legacy Falcon Shield API endpoints scheduled for deprecation on January 11, 2026
- New mitre_attack array introduced to Alert API for multiple MITRE ATT&CK tactics/techniques

## [1.0.0] - 2026-01-16

### Added

- Initial release of CrowdStrike Falcon MCP server
- Support for 24 CrowdStrike API operations across multiple categories:
  - **Hosts**: Search, get details, contain, lift containment, hide/unhide
  - **Detections**: Search, get details, update status
  - **Incidents**: Search, get details, update, get behaviors, get CrowdScore
  - **IOCs**: Search, get details, create, delete
  - **Vulnerabilities**: Search via Spotlight
  - **Host Groups**: Search and retrieve
  - **Sensors**: Get installer information
  - **Alerts**: Search, get details, update
- OAuth2 authentication with automatic token refresh (60-second buffer)
- Comprehensive FQL (Falcon Query Language) filter support
- Graceful error handling with informative messages
