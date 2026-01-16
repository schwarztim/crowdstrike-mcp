# CrowdStrike MCP Server - Publish History

## Version 1.1.0 - Performance & Feature Update (2026-01-16)

### Summary
Comprehensive performance optimization and feature enhancement update based on CrowdStrike API evolution analysis.

### Performance Improvements Applied

#### 1. HTTP Connection Pooling (CRITICAL)
**Before**: Each HTTP request created a new TCP connection, with authentication using a separate axios instance.

**After**:
- Configured keepAlive connection pooling with optimized settings
- All requests (including auth) share the same connection pool
- Configuration:
  - keepAlive: enabled with 30s timeout
  - maxSockets: 50 (concurrent connections)
  - maxFreeSockets: 10 (pool size)
  - Request timeout: 30s

**Expected Impact**:
- 20-50% reduction in request latency for sequential operations
- Eliminated connection overhead for authentication calls
- Better performance under high-volume batch operations

#### 2. Authentication Optimization
**Before**: Authentication used global axios instance, separate from main client

**After**: Authentication uses configured httpClient with connection pooling

**Impact**: Reduced auth overhead, shared connection pool benefits

#### 3. Input Validation Added
**Before**: No validation on array inputs (potential for API errors or abuse)

**After**: Comprehensive validation with operation-specific limits
- Host details: max 5,000 IDs
- Host actions (contain/lift/hide/unhide): max 100 IDs
- Clear error messages for empty arrays

**Impact**: Better error messages, prevents API failures from invalid input

### Security Improvements

1. **npm audit**: 0 vulnerabilities (verified clean)
2. **No hardcoded secrets**: Verified via regex scan
3. **Input validation**: Prevents potential abuse of batch operations
4. **Request timeouts**: 30-second timeout prevents hanging connections

### Feature Additions

#### New API Tool: crowdstrike_get_host_details_v2
- Implements newer GET-based device details endpoint
- Replaces deprecated POST-based GetDeviceDetails
- Aligns with CrowdStrike's 2025 API evolution
- Backward compatibility maintained (legacy tool still available)

### API Evolution Research Findings

Based on web research of CrowdStrike API updates for 2025-2026:

**Deprecated APIs Identified**:
1. Detections-based APIs → Replaced by Alerts-based actions (Sept 30, 2025)
2. Legacy Falcon Shield API → Deprecation scheduled Jan 11, 2026
3. Alert API fields (tactics/techniques) → Replaced by mitre_attack array (Jan 20, 2026)

**New Platform Features** (not yet implemented):
- Host Migration service collection (10 new operations)
- US-GOV-2 region support
- Falcon AI Detection and Response (AIDR) - GA Dec 2025
- Enhanced Data Protection features
- IoT/OT enhancements for ICS hosts

**Potential Future Enhancements**:
- Implement Host Migration API operations
- Add region selection for US-GOV-2
- Enhanced alert handling with mitre_attack array support

### Build & Test Results

**Build**: ✓ Success (TypeScript compilation clean)

**Test Environment**: Not configured (no test suite present)

**Verification**:
- Code compiles without errors
- All imports resolve correctly
- HTTP agents properly configured
- Input validation methods integrated

### Code Quality Improvements

1. **Better error context**: Operation-specific error messages
2. **Code comments**: Added inline documentation for new features
3. **Type safety**: Maintained strict TypeScript typing throughout
4. **Backward compatibility**: Legacy API methods preserved

### Files Modified

- `src/index.ts`: Main implementation file
  - Added HTTP/HTTPS agent imports
  - Configured connection pooling in constructor
  - Updated authentication to use httpClient
  - Added validateIds() helper method
  - Integrated input validation into key methods
  - Added getHostDetailsV2() method
  - Added new tool definition for V2 API
  - Added handler for crowdstrike_get_host_details_v2

### Unresolved Issues

None identified. All planned improvements successfully implemented.

### Recommendations for Future Development

1. **Testing**: Add unit and integration tests
2. **Documentation**: Add API usage examples
3. **Host Migration API**: Implement the new 10 operations when needed
4. **Region Support**: Add US-GOV-2 region configuration
5. **Performance Monitoring**: Consider adding request/response metrics
6. **Batch Operations**: Implement auto-batching for large ID arrays
7. **Rate Limiting**: Add rate limit awareness and backoff logic

### Performance Metrics

**Theoretical Improvements** (based on connection pooling research):
- Connection setup time saved: ~100-300ms per request (TCP + TLS handshake)
- Authentication efficiency: Shared pool reduces overhead
- Under load: Connection reuse significantly reduces resource consumption

**Real-world validation**: Would require production workload testing with metrics

### References

Research conducted on 2026-01-16:

**API Updates**:
- [July 2025 CrowdStrike Update Information - Macnica](https://www.macnica.co.jp/en/business/security/manufacturers/crowdstrike/202507_update.html)
- [CrowdStrike Fall 2025 Release](https://www.crowdstrike.com/en-us/blog/crowdstrike-fall-2025-release-defines-agentic-soc-secures-ai-era/)
- [Migrate from CrowdStrike Detects API to Alerts API](https://docs.cloud.google.com/chronicle/docs/detection/migrate-detects-api-to-alerts-api)

**Platform Updates**:
- [CrowdStrike Fal.Con 2025: Agentic AI Age - Forrester](https://www.forrester.com/blogs/crowdstrike-fal-con-2025-flexing-into-the-agentic-ai-age/)
- [CrowdStrike Developer Center](https://developer.crowdstrike.com/)
- [FalconPy SDK Changelog](https://github.com/CrowdStrike/falconpy/blob/main/CHANGELOG.md)

---

## Version 1.0.0 - Initial Release (2026-01-16)

Initial implementation of CrowdStrike Falcon MCP server with 24 API operations across 8 categories.
