#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import axios, { AxiosInstance, AxiosError } from "axios";

// =============================================================================
// CrowdStrike API Client
// =============================================================================

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface CrowdStrikeConfig {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
}

class CrowdStrikeClient {
  private config: CrowdStrikeConfig;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private httpClient: AxiosInstance;

  constructor(config: CrowdStrikeConfig) {
    this.config = config;
    this.httpClient = axios.create({
      baseURL: config.baseUrl,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  private async authenticate(): Promise<void> {
    // Check if token is still valid (with 60 second buffer)
    if (this.accessToken && Date.now() < this.tokenExpiry - 60000) {
      return;
    }

    try {
      const response = await axios.post<TokenResponse>(
        `${this.config.baseUrl}/oauth2/token`,
        new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + response.data.expires_in * 1000;
    } catch (error) {
      if (error instanceof AxiosError) {
        throw new Error(
          `Authentication failed: ${error.response?.data?.errors?.[0]?.message || error.message}`
        );
      }
      throw error;
    }
  }

  async request<T>(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    endpoint: string,
    data?: Record<string, unknown>,
    params?: Record<string, string | number | boolean | string[]>
  ): Promise<T> {
    await this.authenticate();

    try {
      const response = await this.httpClient.request<T>({
        method,
        url: endpoint,
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
        data,
        params,
      });

      return response.data;
    } catch (error) {
      if (error instanceof AxiosError) {
        const errorMessage =
          error.response?.data?.errors?.[0]?.message ||
          error.response?.data?.message ||
          error.message;
        throw new Error(`API request failed: ${errorMessage}`);
      }
      throw error;
    }
  }

  // =========================================================================
  // Hosts API
  // =========================================================================

  async searchHosts(
    filter?: string,
    limit: number = 100,
    offset?: number,
    sort?: string
  ): Promise<unknown> {
    const params: Record<string, string | number> = { limit };
    if (filter) params.filter = filter;
    if (offset !== undefined) params.offset = offset;
    if (sort) params.sort = sort;

    const idsResponse = await this.request<{ resources: string[] }>(
      "GET",
      "/devices/queries/devices/v1",
      undefined,
      params
    );

    if (!idsResponse.resources || idsResponse.resources.length === 0) {
      return { resources: [] };
    }

    return this.request<unknown>(
      "POST",
      "/devices/entities/devices/v2",
      { ids: idsResponse.resources }
    );
  }

  async getHostDetails(hostIds: string[]): Promise<unknown> {
    return this.request<unknown>(
      "POST",
      "/devices/entities/devices/v2",
      { ids: hostIds }
    );
  }

  async containHost(hostIds: string[]): Promise<unknown> {
    return this.request<unknown>(
      "POST",
      "/devices/entities/devices-actions/v2",
      { ids: hostIds },
      { action_name: "contain" }
    );
  }

  async liftContainment(hostIds: string[]): Promise<unknown> {
    return this.request<unknown>(
      "POST",
      "/devices/entities/devices-actions/v2",
      { ids: hostIds },
      { action_name: "lift_containment" }
    );
  }

  async hideHost(hostIds: string[]): Promise<unknown> {
    return this.request<unknown>(
      "POST",
      "/devices/entities/devices-actions/v2",
      { ids: hostIds },
      { action_name: "hide_host" }
    );
  }

  async unhideHost(hostIds: string[]): Promise<unknown> {
    return this.request<unknown>(
      "POST",
      "/devices/entities/devices-actions/v2",
      { ids: hostIds },
      { action_name: "unhide_host" }
    );
  }

  // =========================================================================
  // Detections API
  // =========================================================================

  async searchDetections(
    filter?: string,
    limit: number = 100,
    offset?: number,
    sort?: string
  ): Promise<unknown> {
    const params: Record<string, string | number> = { limit };
    if (filter) params.filter = filter;
    if (offset !== undefined) params.offset = offset;
    if (sort) params.sort = sort;

    const idsResponse = await this.request<{ resources: string[] }>(
      "GET",
      "/detects/queries/detects/v1",
      undefined,
      params
    );

    if (!idsResponse.resources || idsResponse.resources.length === 0) {
      return { resources: [] };
    }

    return this.request<unknown>(
      "POST",
      "/detects/entities/summaries/GET/v1",
      { ids: idsResponse.resources }
    );
  }

  async getDetectionDetails(detectionIds: string[]): Promise<unknown> {
    return this.request<unknown>(
      "POST",
      "/detects/entities/summaries/GET/v1",
      { ids: detectionIds }
    );
  }

  async updateDetectionStatus(
    detectionIds: string[],
    status: string,
    assignedToUuid?: string,
    comment?: string
  ): Promise<unknown> {
    const body: Record<string, unknown> = {
      ids: detectionIds,
      status,
    };
    if (assignedToUuid) body.assigned_to_uuid = assignedToUuid;
    if (comment) body.comment = comment;

    return this.request<unknown>(
      "PATCH",
      "/detects/entities/detects/v2",
      body
    );
  }

  // =========================================================================
  // Incidents API
  // =========================================================================

  async searchIncidents(
    filter?: string,
    limit: number = 100,
    offset?: number,
    sort?: string
  ): Promise<unknown> {
    const params: Record<string, string | number> = { limit };
    if (filter) params.filter = filter;
    if (offset !== undefined) params.offset = offset;
    if (sort) params.sort = sort;

    const idsResponse = await this.request<{ resources: string[] }>(
      "GET",
      "/incidents/queries/incidents/v1",
      undefined,
      params
    );

    if (!idsResponse.resources || idsResponse.resources.length === 0) {
      return { resources: [] };
    }

    return this.request<unknown>(
      "POST",
      "/incidents/entities/incidents/GET/v1",
      { ids: idsResponse.resources }
    );
  }

  async getIncidentDetails(incidentIds: string[]): Promise<unknown> {
    return this.request<unknown>(
      "POST",
      "/incidents/entities/incidents/GET/v1",
      { ids: incidentIds }
    );
  }

  async updateIncident(
    incidentIds: string[],
    status?: number,
    assignedToUuid?: string,
    tags?: string[]
  ): Promise<unknown> {
    const actionParams: Record<string, unknown>[] = [];

    if (status !== undefined) {
      actionParams.push({ name: "update_status", value: status.toString() });
    }
    if (assignedToUuid) {
      actionParams.push({ name: "update_assigned_to_v2", value: assignedToUuid });
    }
    if (tags) {
      tags.forEach((tag) => {
        actionParams.push({ name: "add_tag", value: tag });
      });
    }

    return this.request<unknown>(
      "POST",
      "/incidents/entities/incident-actions/v1",
      {
        ids: incidentIds,
        action_parameters: actionParams,
      }
    );
  }

  async getBehaviors(behaviorIds: string[]): Promise<unknown> {
    return this.request<unknown>(
      "POST",
      "/incidents/entities/behaviors/GET/v1",
      { ids: behaviorIds }
    );
  }

  async getCrowdScore(): Promise<unknown> {
    return this.request<unknown>(
      "GET",
      "/incidents/combined/crowdscores/v1"
    );
  }

  // =========================================================================
  // IOC API
  // =========================================================================

  async searchIOCs(
    filter?: string,
    limit: number = 100,
    offset?: number,
    sort?: string
  ): Promise<unknown> {
    const params: Record<string, string | number> = { limit };
    if (filter) params.filter = filter;
    if (offset !== undefined) params.offset = offset;
    if (sort) params.sort = sort;

    const idsResponse = await this.request<{ resources: string[] }>(
      "GET",
      "/iocs/queries/indicators/v1",
      undefined,
      params
    );

    if (!idsResponse.resources || idsResponse.resources.length === 0) {
      return { resources: [] };
    }

    return this.request<unknown>(
      "GET",
      "/iocs/entities/indicators/v1",
      undefined,
      { ids: idsResponse.resources }
    );
  }

  async getIOCDetails(iocIds: string[]): Promise<unknown> {
    return this.request<unknown>(
      "GET",
      "/iocs/entities/indicators/v1",
      undefined,
      { ids: iocIds }
    );
  }

  async createIOC(
    type: string,
    value: string,
    action: string,
    platforms: string[],
    description?: string,
    severity?: string,
    expiration?: string,
    tags?: string[]
  ): Promise<unknown> {
    const indicator: Record<string, unknown> = {
      type,
      value,
      action,
      platforms,
      applied_globally: true,
    };
    if (description) indicator.description = description;
    if (severity) indicator.severity = severity;
    if (expiration) indicator.expiration = expiration;
    if (tags) indicator.tags = tags;

    return this.request<unknown>(
      "POST",
      "/iocs/entities/indicators/v1",
      { indicators: [indicator] }
    );
  }

  async deleteIOC(iocIds: string[]): Promise<unknown> {
    return this.request<unknown>(
      "DELETE",
      "/iocs/entities/indicators/v1",
      undefined,
      { ids: iocIds }
    );
  }

  // =========================================================================
  // Spotlight Vulnerabilities API
  // =========================================================================

  async searchVulnerabilities(
    filter?: string,
    limit: number = 100,
    facet?: string[]
  ): Promise<unknown> {
    const params: Record<string, string | number | string[]> = { limit };
    if (filter) params.filter = filter;
    if (facet) params.facet = facet;

    return this.request<unknown>(
      "GET",
      "/spotlight/combined/vulnerabilities/v1",
      undefined,
      params as Record<string, string | number>
    );
  }

  // =========================================================================
  // Host Groups API
  // =========================================================================

  async searchHostGroups(
    filter?: string,
    limit: number = 100,
    offset?: number
  ): Promise<unknown> {
    const params: Record<string, string | number> = { limit };
    if (filter) params.filter = filter;
    if (offset !== undefined) params.offset = offset;

    const idsResponse = await this.request<{ resources: string[] }>(
      "GET",
      "/devices/queries/host-groups/v1",
      undefined,
      params
    );

    if (!idsResponse.resources || idsResponse.resources.length === 0) {
      return { resources: [] };
    }

    return this.request<unknown>(
      "GET",
      "/devices/entities/host-groups/v1",
      undefined,
      { ids: idsResponse.resources }
    );
  }

  // =========================================================================
  // Sensor Info API
  // =========================================================================

  async getSensorInstallerDetails(
    filter?: string,
    limit: number = 100
  ): Promise<unknown> {
    const params: Record<string, string | number> = { limit };
    if (filter) params.filter = filter;

    return this.request<unknown>(
      "GET",
      "/sensors/combined/installers/v2",
      undefined,
      params
    );
  }

  // =========================================================================
  // Alerts API
  // =========================================================================

  async searchAlerts(
    filter?: string,
    limit: number = 100,
    offset?: number,
    sort?: string
  ): Promise<unknown> {
    const params: Record<string, string | number> = { limit };
    if (filter) params.filter = filter;
    if (offset !== undefined) params.offset = offset;
    if (sort) params.sort = sort;

    return this.request<unknown>(
      "GET",
      "/alerts/queries/alerts/v2",
      undefined,
      params
    );
  }

  async getAlertDetails(alertIds: string[]): Promise<unknown> {
    return this.request<unknown>(
      "POST",
      "/alerts/entities/alerts/v2",
      { composite_ids: alertIds }
    );
  }

  async updateAlerts(
    alertIds: string[],
    action: string,
    value?: string
  ): Promise<unknown> {
    const body: Record<string, unknown> = {
      composite_ids: alertIds,
      action_parameters: [{ name: action, value: value || "" }],
    };

    return this.request<unknown>(
      "PATCH",
      "/alerts/entities/alerts/v3",
      body
    );
  }
}

// =============================================================================
// MCP Server Definition
// =============================================================================

const TOOLS: Tool[] = [
  // Host Tools
  {
    name: "crowdstrike_search_hosts",
    description:
      "Search for hosts/devices in CrowdStrike Falcon. Use FQL (Falcon Query Language) filters to narrow results. Returns host details including hostname, OS, last seen, sensor version, and containment status.",
    inputSchema: {
      type: "object" as const,
      properties: {
        filter: {
          type: "string",
          description:
            "FQL filter for hosts. Examples: 'hostname:*web*', 'platform_name:Windows', 'last_seen:>='2024-01-01'",
        },
        limit: {
          type: "number",
          description: "Maximum number of hosts to return (default: 100, max: 500)",
          default: 100,
        },
        offset: {
          type: "number",
          description: "Offset for pagination",
        },
        sort: {
          type: "string",
          description: "Sort field and direction. Example: 'last_seen|desc'",
        },
      },
    },
  },
  {
    name: "crowdstrike_get_host_details",
    description:
      "Get detailed information about specific hosts by their device IDs.",
    inputSchema: {
      type: "object" as const,
      properties: {
        host_ids: {
          type: "array",
          items: { type: "string" },
          description: "Array of host/device IDs to retrieve",
        },
      },
      required: ["host_ids"],
    },
  },
  {
    name: "crowdstrike_contain_host",
    description:
      "Network contain one or more hosts. This isolates the host from the network while maintaining connection to CrowdStrike cloud.",
    inputSchema: {
      type: "object" as const,
      properties: {
        host_ids: {
          type: "array",
          items: { type: "string" },
          description: "Array of host/device IDs to contain",
        },
      },
      required: ["host_ids"],
    },
  },
  {
    name: "crowdstrike_lift_containment",
    description:
      "Lift network containment from one or more hosts, restoring normal network access.",
    inputSchema: {
      type: "object" as const,
      properties: {
        host_ids: {
          type: "array",
          items: { type: "string" },
          description: "Array of host/device IDs to uncontain",
        },
      },
      required: ["host_ids"],
    },
  },
  {
    name: "crowdstrike_hide_host",
    description:
      "Hide hosts from the Falcon console. Useful for decommissioned systems.",
    inputSchema: {
      type: "object" as const,
      properties: {
        host_ids: {
          type: "array",
          items: { type: "string" },
          description: "Array of host/device IDs to hide",
        },
      },
      required: ["host_ids"],
    },
  },
  {
    name: "crowdstrike_unhide_host",
    description: "Unhide previously hidden hosts in the Falcon console.",
    inputSchema: {
      type: "object" as const,
      properties: {
        host_ids: {
          type: "array",
          items: { type: "string" },
          description: "Array of host/device IDs to unhide",
        },
      },
      required: ["host_ids"],
    },
  },

  // Detection Tools
  {
    name: "crowdstrike_search_detections",
    description:
      "Search for detections in CrowdStrike Falcon. Use FQL filters to find specific detections by severity, status, technique, or other criteria.",
    inputSchema: {
      type: "object" as const,
      properties: {
        filter: {
          type: "string",
          description:
            "FQL filter for detections. Examples: 'status:new', 'max_severity_displayname:Critical', 'behaviors.technique:T1059'",
        },
        limit: {
          type: "number",
          description: "Maximum number of detections to return (default: 100)",
          default: 100,
        },
        offset: {
          type: "number",
          description: "Offset for pagination",
        },
        sort: {
          type: "string",
          description:
            "Sort field and direction. Example: 'last_behavior|desc'",
        },
      },
    },
  },
  {
    name: "crowdstrike_get_detection_details",
    description:
      "Get detailed information about specific detections by their IDs.",
    inputSchema: {
      type: "object" as const,
      properties: {
        detection_ids: {
          type: "array",
          items: { type: "string" },
          description: "Array of detection IDs to retrieve",
        },
      },
      required: ["detection_ids"],
    },
  },
  {
    name: "crowdstrike_update_detection",
    description:
      "Update detection status, assignment, or add comments. Valid statuses: new, in_progress, true_positive, false_positive, closed, reopened.",
    inputSchema: {
      type: "object" as const,
      properties: {
        detection_ids: {
          type: "array",
          items: { type: "string" },
          description: "Array of detection IDs to update",
        },
        status: {
          type: "string",
          enum: [
            "new",
            "in_progress",
            "true_positive",
            "false_positive",
            "closed",
            "reopened",
          ],
          description: "New status for the detection",
        },
        assigned_to_uuid: {
          type: "string",
          description: "UUID of user to assign the detection to",
        },
        comment: {
          type: "string",
          description: "Comment to add to the detection",
        },
      },
      required: ["detection_ids", "status"],
    },
  },

  // Incident Tools
  {
    name: "crowdstrike_search_incidents",
    description:
      "Search for incidents in CrowdStrike Falcon. Incidents group related detections and behaviors.",
    inputSchema: {
      type: "object" as const,
      properties: {
        filter: {
          type: "string",
          description:
            "FQL filter for incidents. Examples: 'status:20' (in_progress), 'fine_score:>=75'",
        },
        limit: {
          type: "number",
          description: "Maximum number of incidents to return (default: 100)",
          default: 100,
        },
        offset: {
          type: "number",
          description: "Offset for pagination",
        },
        sort: {
          type: "string",
          description: "Sort field and direction. Example: 'start|desc'",
        },
      },
    },
  },
  {
    name: "crowdstrike_get_incident_details",
    description:
      "Get detailed information about specific incidents by their IDs.",
    inputSchema: {
      type: "object" as const,
      properties: {
        incident_ids: {
          type: "array",
          items: { type: "string" },
          description: "Array of incident IDs to retrieve",
        },
      },
      required: ["incident_ids"],
    },
  },
  {
    name: "crowdstrike_update_incident",
    description:
      "Update incident status, assignment, or add tags. Status values: 20=New, 25=Reopened, 30=In Progress, 40=Closed.",
    inputSchema: {
      type: "object" as const,
      properties: {
        incident_ids: {
          type: "array",
          items: { type: "string" },
          description: "Array of incident IDs to update",
        },
        status: {
          type: "number",
          enum: [20, 25, 30, 40],
          description:
            "New status: 20=New, 25=Reopened, 30=In Progress, 40=Closed",
        },
        assigned_to_uuid: {
          type: "string",
          description: "UUID of user to assign the incident to",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Tags to add to the incident",
        },
      },
      required: ["incident_ids"],
    },
  },
  {
    name: "crowdstrike_get_behaviors",
    description:
      "Get detailed behavior information by behavior IDs. Behaviors represent individual malicious activities.",
    inputSchema: {
      type: "object" as const,
      properties: {
        behavior_ids: {
          type: "array",
          items: { type: "string" },
          description: "Array of behavior IDs to retrieve",
        },
      },
      required: ["behavior_ids"],
    },
  },
  {
    name: "crowdstrike_get_crowdscore",
    description:
      "Get the CrowdScore - an overall security posture score for your environment based on active incidents and their severity.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },

  // IOC Tools
  {
    name: "crowdstrike_search_iocs",
    description:
      "Search for custom IOCs (Indicators of Compromise) configured in CrowdStrike. These are user-defined indicators for detection.",
    inputSchema: {
      type: "object" as const,
      properties: {
        filter: {
          type: "string",
          description:
            "FQL filter for IOCs. Examples: 'type:sha256', 'action:detect'",
        },
        limit: {
          type: "number",
          description: "Maximum number of IOCs to return (default: 100)",
          default: 100,
        },
        offset: {
          type: "number",
          description: "Offset for pagination",
        },
        sort: {
          type: "string",
          description: "Sort field and direction",
        },
      },
    },
  },
  {
    name: "crowdstrike_get_ioc_details",
    description: "Get detailed information about specific IOCs by their IDs.",
    inputSchema: {
      type: "object" as const,
      properties: {
        ioc_ids: {
          type: "array",
          items: { type: "string" },
          description: "Array of IOC IDs to retrieve",
        },
      },
      required: ["ioc_ids"],
    },
  },
  {
    name: "crowdstrike_create_ioc",
    description:
      "Create a new custom IOC for detection or prevention. Supported types: sha256, md5, domain, ipv4, ipv6.",
    inputSchema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          enum: ["sha256", "md5", "domain", "ipv4", "ipv6"],
          description: "Type of indicator",
        },
        value: {
          type: "string",
          description: "The indicator value (hash, domain, or IP)",
        },
        action: {
          type: "string",
          enum: ["detect", "prevent", "no_action"],
          description:
            "Action to take when IOC is matched: detect (alert), prevent (block), or no_action",
        },
        platforms: {
          type: "array",
          items: { type: "string", enum: ["windows", "mac", "linux"] },
          description: "Platforms where this IOC applies",
        },
        description: {
          type: "string",
          description: "Description of the IOC",
        },
        severity: {
          type: "string",
          enum: ["informational", "low", "medium", "high", "critical"],
          description: "Severity level of the IOC",
        },
        expiration: {
          type: "string",
          description:
            "Expiration date in ISO 8601 format (e.g., 2024-12-31T23:59:59Z)",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Tags to associate with the IOC",
        },
      },
      required: ["type", "value", "action", "platforms"],
    },
  },
  {
    name: "crowdstrike_delete_ioc",
    description: "Delete custom IOCs by their IDs.",
    inputSchema: {
      type: "object" as const,
      properties: {
        ioc_ids: {
          type: "array",
          items: { type: "string" },
          description: "Array of IOC IDs to delete",
        },
      },
      required: ["ioc_ids"],
    },
  },

  // Vulnerability Tools
  {
    name: "crowdstrike_search_vulnerabilities",
    description:
      "Search for vulnerabilities discovered by CrowdStrike Spotlight. Returns vulnerability information including CVE, severity, and affected hosts.",
    inputSchema: {
      type: "object" as const,
      properties: {
        filter: {
          type: "string",
          description:
            "FQL filter for vulnerabilities. Examples: 'cve.severity:CRITICAL', 'status:open'",
        },
        limit: {
          type: "number",
          description: "Maximum number of vulnerabilities to return (default: 100)",
          default: 100,
        },
        facet: {
          type: "array",
          items: { type: "string" },
          description: "Facets to include in response for aggregations",
        },
      },
    },
  },

  // Host Groups Tools
  {
    name: "crowdstrike_search_host_groups",
    description:
      "Search for host groups in CrowdStrike. Host groups are used to organize and manage collections of hosts.",
    inputSchema: {
      type: "object" as const,
      properties: {
        filter: {
          type: "string",
          description: "FQL filter for host groups. Example: 'name:*Production*'",
        },
        limit: {
          type: "number",
          description: "Maximum number of host groups to return (default: 100)",
          default: 100,
        },
        offset: {
          type: "number",
          description: "Offset for pagination",
        },
      },
    },
  },

  // Sensor Tools
  {
    name: "crowdstrike_get_sensor_installers",
    description:
      "Get information about available Falcon sensor installers for deployment. Includes version info and download details.",
    inputSchema: {
      type: "object" as const,
      properties: {
        filter: {
          type: "string",
          description:
            "FQL filter for installers. Example: 'platform:windows'",
        },
        limit: {
          type: "number",
          description: "Maximum number of installers to return (default: 100)",
          default: 100,
        },
      },
    },
  },

  // Alert Tools
  {
    name: "crowdstrike_search_alerts",
    description:
      "Search for alerts (v2 API) in CrowdStrike Falcon. Alerts provide a unified view of security events.",
    inputSchema: {
      type: "object" as const,
      properties: {
        filter: {
          type: "string",
          description:
            "FQL filter for alerts. Examples: 'severity:>=3', 'status:open'",
        },
        limit: {
          type: "number",
          description: "Maximum number of alerts to return (default: 100)",
          default: 100,
        },
        offset: {
          type: "number",
          description: "Offset for pagination",
        },
        sort: {
          type: "string",
          description: "Sort field and direction. Example: 'created_timestamp|desc'",
        },
      },
    },
  },
  {
    name: "crowdstrike_get_alert_details",
    description: "Get detailed information about specific alerts by their composite IDs.",
    inputSchema: {
      type: "object" as const,
      properties: {
        alert_ids: {
          type: "array",
          items: { type: "string" },
          description: "Array of alert composite IDs to retrieve",
        },
      },
      required: ["alert_ids"],
    },
  },
  {
    name: "crowdstrike_update_alerts",
    description:
      "Update alert status. Actions include: update_status, assign_to_uuid, add_tag, remove_tag, show_in_ui, unassign.",
    inputSchema: {
      type: "object" as const,
      properties: {
        alert_ids: {
          type: "array",
          items: { type: "string" },
          description: "Array of alert composite IDs to update",
        },
        action: {
          type: "string",
          enum: [
            "update_status",
            "assign_to_uuid",
            "add_tag",
            "remove_tag",
            "show_in_ui",
            "unassign",
          ],
          description: "Action to perform on the alerts",
        },
        value: {
          type: "string",
          description: "Value for the action (e.g., status value, UUID, tag name)",
        },
      },
      required: ["alert_ids", "action"],
    },
  },
];

// =============================================================================
// Main Server Logic
// =============================================================================

async function main() {
  // Validate environment variables
  const clientId = process.env.CROWDSTRIKE_CLIENT_ID;
  const clientSecret = process.env.CROWDSTRIKE_CLIENT_SECRET;
  const baseUrl =
    process.env.CROWDSTRIKE_BASE_URL || "https://api.crowdstrike.com";

  if (!clientId || !clientSecret) {
    console.error(
      "Error: CROWDSTRIKE_CLIENT_ID and CROWDSTRIKE_CLIENT_SECRET environment variables are required"
    );
    process.exit(1);
  }

  const client = new CrowdStrikeClient({
    clientId,
    clientSecret,
    baseUrl,
  });

  const server = new Server(
    {
      name: "crowdstrike-mcp",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOLS };
  });

  // Handle tool execution
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      let result: unknown;

      switch (name) {
        // Host operations
        case "crowdstrike_search_hosts":
          result = await client.searchHosts(
            args?.filter as string | undefined,
            (args?.limit as number) || 100,
            args?.offset as number | undefined,
            args?.sort as string | undefined
          );
          break;

        case "crowdstrike_get_host_details":
          result = await client.getHostDetails(args?.host_ids as string[]);
          break;

        case "crowdstrike_contain_host":
          result = await client.containHost(args?.host_ids as string[]);
          break;

        case "crowdstrike_lift_containment":
          result = await client.liftContainment(args?.host_ids as string[]);
          break;

        case "crowdstrike_hide_host":
          result = await client.hideHost(args?.host_ids as string[]);
          break;

        case "crowdstrike_unhide_host":
          result = await client.unhideHost(args?.host_ids as string[]);
          break;

        // Detection operations
        case "crowdstrike_search_detections":
          result = await client.searchDetections(
            args?.filter as string | undefined,
            (args?.limit as number) || 100,
            args?.offset as number | undefined,
            args?.sort as string | undefined
          );
          break;

        case "crowdstrike_get_detection_details":
          result = await client.getDetectionDetails(
            args?.detection_ids as string[]
          );
          break;

        case "crowdstrike_update_detection":
          result = await client.updateDetectionStatus(
            args?.detection_ids as string[],
            args?.status as string,
            args?.assigned_to_uuid as string | undefined,
            args?.comment as string | undefined
          );
          break;

        // Incident operations
        case "crowdstrike_search_incidents":
          result = await client.searchIncidents(
            args?.filter as string | undefined,
            (args?.limit as number) || 100,
            args?.offset as number | undefined,
            args?.sort as string | undefined
          );
          break;

        case "crowdstrike_get_incident_details":
          result = await client.getIncidentDetails(
            args?.incident_ids as string[]
          );
          break;

        case "crowdstrike_update_incident":
          result = await client.updateIncident(
            args?.incident_ids as string[],
            args?.status as number | undefined,
            args?.assigned_to_uuid as string | undefined,
            args?.tags as string[] | undefined
          );
          break;

        case "crowdstrike_get_behaviors":
          result = await client.getBehaviors(args?.behavior_ids as string[]);
          break;

        case "crowdstrike_get_crowdscore":
          result = await client.getCrowdScore();
          break;

        // IOC operations
        case "crowdstrike_search_iocs":
          result = await client.searchIOCs(
            args?.filter as string | undefined,
            (args?.limit as number) || 100,
            args?.offset as number | undefined,
            args?.sort as string | undefined
          );
          break;

        case "crowdstrike_get_ioc_details":
          result = await client.getIOCDetails(args?.ioc_ids as string[]);
          break;

        case "crowdstrike_create_ioc":
          result = await client.createIOC(
            args?.type as string,
            args?.value as string,
            args?.action as string,
            args?.platforms as string[],
            args?.description as string | undefined,
            args?.severity as string | undefined,
            args?.expiration as string | undefined,
            args?.tags as string[] | undefined
          );
          break;

        case "crowdstrike_delete_ioc":
          result = await client.deleteIOC(args?.ioc_ids as string[]);
          break;

        // Vulnerability operations
        case "crowdstrike_search_vulnerabilities":
          result = await client.searchVulnerabilities(
            args?.filter as string | undefined,
            (args?.limit as number) || 100,
            args?.facet as string[] | undefined
          );
          break;

        // Host group operations
        case "crowdstrike_search_host_groups":
          result = await client.searchHostGroups(
            args?.filter as string | undefined,
            (args?.limit as number) || 100,
            args?.offset as number | undefined
          );
          break;

        // Sensor operations
        case "crowdstrike_get_sensor_installers":
          result = await client.getSensorInstallerDetails(
            args?.filter as string | undefined,
            (args?.limit as number) || 100
          );
          break;

        // Alert operations
        case "crowdstrike_search_alerts":
          result = await client.searchAlerts(
            args?.filter as string | undefined,
            (args?.limit as number) || 100,
            args?.offset as number | undefined,
            args?.sort as string | undefined
          );
          break;

        case "crowdstrike_get_alert_details":
          result = await client.getAlertDetails(args?.alert_ids as string[]);
          break;

        case "crowdstrike_update_alerts":
          result = await client.updateAlerts(
            args?.alert_ids as string[],
            args?.action as string,
            args?.value as string | undefined
          );
          break;

        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: `Error: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Start the server
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("CrowdStrike MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
