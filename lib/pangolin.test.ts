import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { Domain, Resource, Site } from "./types";

// Mock the openapi-fetch client
const mockGET = mock(() =>
  Promise.resolve({ data: undefined, error: undefined }),
);
const mockPUT = mock(() =>
  Promise.resolve({ data: undefined, error: undefined }),
);

const mockClient = {
  GET: mockGET,
  PUT: mockPUT,
  use: mock(() => {}),
};

mock.module("openapi-fetch", () => ({
  default: mock(() => mockClient),
}));

// Mock config
mock.module("../config", () => ({
  config: {
    pangolin: {
      mainDomain: "example.com",
      apiBaseUrl: "https://api.example.com",
      apiKey: "test-key",
      orgId: "test-org-123",
      mainSiteName: "main-site",
    },
  },
}));

// Import after mocks are set up
const {
  createResource,
  createResourceTarget,
  fetchMainDomain,
  getMainSite,
  listDomains,
  listResources,
  listSites,
} = await import("./pangolin");

describe("Pangolin API Functions", () => {
  beforeEach(() => {
    mockGET.mockClear();
    mockPUT.mockClear();
  });

  describe("listDomains", () => {
    test("should return domains on success", async () => {
      const mockDomains: Domain[] = [
        {
          baseDomain: "example.com",
          name: "Example Domain",
          id: "domain-1",
          domainId: "domain-id-1",
        },
        {
          baseDomain: "test.com",
          name: "Test Domain",
          id: "domain-2",
          domainId: "domain-id-2",
        },
      ];

      mockGET.mockResolvedValue({
        data: {
          data: {
            domains: mockDomains,
          },
        },
        error: undefined,
      });

      const result = await listDomains();

      expect(result).toEqual(mockDomains);
      expect(mockGET).toHaveBeenCalledTimes(1);
      expect(mockGET.mock.calls[0][0]).toBe("/org/{orgId}/domains");
    });

    test("should return undefined on error", async () => {
      mockGET.mockResolvedValue({
        data: undefined,
        error: { message: "API Error" },
      });

      const result = await listDomains();

      expect(result).toBeUndefined();
    });

    test("should handle undefined data", async () => {
      mockGET.mockResolvedValue({
        data: undefined,
        error: undefined,
      });

      const result = await listDomains();

      expect(result).toBeUndefined();
    });
  });

  describe("fetchMainDomain", () => {
    test("should return main domain when found", async () => {
      const mockDomains: Domain[] = [
        {
          baseDomain: "other.com",
          name: "Other Domain",
          id: "domain-1",
          domainId: "domain-id-1",
        },
        {
          baseDomain: "example.com",
          name: "Main Domain",
          id: "domain-2",
          domainId: "domain-id-2",
        },
      ];

      mockGET.mockResolvedValue({
        data: {
          data: {
            domains: mockDomains,
          },
        },
        error: undefined,
      });

      const result = await fetchMainDomain();

      expect(result).toEqual(mockDomains[1]);
      expect(result?.baseDomain).toBe("example.com");
    });

    test("should return undefined when main domain not found", async () => {
      const mockDomains: Domain[] = [
        {
          baseDomain: "other.com",
          name: "Other Domain",
          id: "domain-1",
          domainId: "domain-id-1",
        },
      ];

      mockGET.mockResolvedValue({
        data: {
          data: {
            domains: mockDomains,
          },
        },
        error: undefined,
      });

      const result = await fetchMainDomain();

      expect(result).toBeUndefined();
    });

    test("should return undefined when listDomains fails", async () => {
      mockGET.mockResolvedValue({
        data: undefined,
        error: { message: "API Error" },
      });

      const result = await fetchMainDomain();

      expect(result).toBeUndefined();
    });
  });

  describe("listResources", () => {
    test("should return resources on success", async () => {
      const mockResources: Resource[] = [
        {
          name: "Resource 1",
          fullDomain: "res1.example.com",
          resourceId: "res-1",
        },
        {
          name: "Resource 2",
          fullDomain: "res2.example.com",
          resourceId: "res-2",
        },
      ];

      mockGET.mockResolvedValue({
        data: {
          data: {
            resources: mockResources,
          },
        },
        error: undefined,
      });

      const result = await listResources();

      expect(result).toEqual(mockResources);
      expect(mockGET).toHaveBeenCalledTimes(1);
      expect(mockGET.mock.calls[0][0]).toBe("/org/{orgId}/resources");
    });

    test("should return undefined on error", async () => {
      mockGET.mockResolvedValue({
        data: undefined,
        error: { message: "API Error" },
      });

      const result = await listResources();

      expect(result).toBeUndefined();
    });
  });

  describe("listSites", () => {
    test("should return sites on success", async () => {
      const mockSites: Site[] = [
        {
          name: "Site 1",
          siteId: "site-1",
        },
        {
          name: "Site 2",
          siteId: "site-2",
        },
      ];

      mockGET.mockResolvedValue({
        data: {
          data: {
            sites: mockSites,
          },
        },
        error: undefined,
      });

      const result = await listSites();

      expect(result).toEqual(mockSites);
      expect(mockGET).toHaveBeenCalledTimes(1);
      expect(mockGET.mock.calls[0][0]).toBe("/org/{orgId}/sites");
    });

    test("should return undefined on error", async () => {
      mockGET.mockResolvedValue({
        data: undefined,
        error: { message: "API Error" },
      });

      const result = await listSites();

      expect(result).toBeUndefined();
    });
  });

  describe("getMainSite", () => {
    test("should return main site when found", async () => {
      const mockSites: Site[] = [
        {
          name: "other-site",
          siteId: "site-1",
        },
        {
          name: "main-site",
          siteId: "site-2",
        },
      ];

      mockGET.mockResolvedValue({
        data: {
          data: {
            sites: mockSites,
          },
        },
        error: undefined,
      });

      const result = await getMainSite();

      expect(result).toEqual(mockSites[1]);
      expect(result?.name).toBe("main-site");
    });

    test("should return undefined when main site not found", async () => {
      const mockSites: Site[] = [
        {
          name: "other-site",
          siteId: "site-1",
        },
      ];

      mockGET.mockResolvedValue({
        data: {
          data: {
            sites: mockSites,
          },
        },
        error: undefined,
      });

      const result = await getMainSite();

      expect(result).toBeUndefined();
    });

    test("should return undefined when listSites fails", async () => {
      mockGET.mockResolvedValue({
        data: undefined,
        error: { message: "API Error" },
      });

      const result = await getMainSite();

      expect(result).toBeUndefined();
    });
  });

  describe("createResource", () => {
    test("should create resource successfully", async () => {
      const mockDomains: Domain[] = [
        {
          baseDomain: "example.com",
          name: "Main Domain",
          id: "domain-1",
          domainId: "domain-id-1",
        },
      ];

      const mockResource: Resource = {
        name: "test-resource",
        fullDomain: "test.example.com",
        resourceId: "res-123",
      };

      mockGET.mockResolvedValue({
        data: {
          data: {
            domains: mockDomains,
          },
        },
        error: undefined,
      });

      mockPUT.mockResolvedValue({
        data: {
          data: mockResource,
        },
        error: undefined,
      });

      const result = await createResource({
        name: "test-resource",
        subdomain: "test",
      });

      expect(result).toEqual(mockResource);
      expect(mockPUT).toHaveBeenCalledTimes(1);
      expect(mockPUT.mock.calls[0][0]).toBe("/org/{orgId}/resource");
      expect(mockPUT.mock.calls[0][1].body).toMatchObject({
        name: "test-resource",
        subdomain: "test",
        http: true,
        domainId: "domain-id-1",
        stickySession: true,
        postAuthPath: "/",
        protocol: "tcp",
      });
    });

    test("should return undefined when main domain not available", async () => {
      mockGET.mockResolvedValue({
        data: {
          data: {
            domains: [],
          },
        },
        error: undefined,
      });

      const result = await createResource({
        name: "test-resource",
        subdomain: "test",
      });

      expect(result).toBeUndefined();
      expect(mockPUT).not.toHaveBeenCalled();
    });

    test("should return undefined when domain has no domainId", async () => {
      const mockDomains = [
        {
          baseDomain: "example.com",
          name: "Main Domain",
          id: "domain-1",
          domainId: "",
        },
      ];

      mockGET.mockResolvedValue({
        data: {
          data: {
            domains: mockDomains,
          },
        },
        error: undefined,
      });

      const result = await createResource({
        name: "test-resource",
        subdomain: "test",
      });

      expect(result).toBeUndefined();
      expect(mockPUT).not.toHaveBeenCalled();
    });

    test("should return undefined on PUT error", async () => {
      const mockDomains: Domain[] = [
        {
          baseDomain: "example.com",
          name: "Main Domain",
          id: "domain-1",
          domainId: "domain-id-1",
        },
      ];

      mockGET.mockResolvedValue({
        data: {
          data: {
            domains: mockDomains,
          },
        },
        error: undefined,
      });

      mockPUT.mockResolvedValue({
        data: undefined,
        error: { message: "Creation failed" },
      });

      const result = await createResource({
        name: "test-resource",
        subdomain: "test",
      });

      expect(result).toBeUndefined();
    });
  });

  describe("createResourceTarget", () => {
    test("should create resource target successfully", async () => {
      const mockSites: Site[] = [
        {
          name: "main-site",
          siteId: "site-123",
        },
      ];

      const mockTarget = {
        targetId: "target-456",
        resourceId: "res-789",
        siteId: "site-123",
        port: 443,
        method: "https",
        enabled: true,
        ip: "localhost",
      };

      mockGET.mockResolvedValue({
        data: {
          data: {
            sites: mockSites,
          },
        },
        error: undefined,
      });

      mockPUT.mockResolvedValue({
        data: {
          data: mockTarget,
        },
        error: undefined,
      });

      const result = await createResourceTarget({
        resourceId: "res-789",
      });

      expect(result).toEqual(mockTarget);
      expect(mockPUT).toHaveBeenCalledTimes(1);
      expect(mockPUT.mock.calls[0][0]).toBe("/resource/{resourceId}/target");
      expect(mockPUT.mock.calls[0][1].body).toMatchObject({
        siteId: "site-123",
        port: 443,
        method: "https",
        enabled: true,
        ip: "localhost",
      });
    });

    test("should return undefined when main site not available", async () => {
      mockGET.mockResolvedValue({
        data: {
          data: {
            sites: [],
          },
        },
        error: undefined,
      });

      const result = await createResourceTarget({
        resourceId: "res-789",
      });

      expect(result).toBeUndefined();
      expect(mockPUT).not.toHaveBeenCalled();
    });

    test("should return undefined on PUT error", async () => {
      const mockSites: Site[] = [
        {
          name: "main-site",
          siteId: "site-123",
        },
      ];

      mockGET.mockResolvedValue({
        data: {
          data: {
            sites: mockSites,
          },
        },
        error: undefined,
      });

      mockPUT.mockResolvedValue({
        data: undefined,
        error: { message: "Target creation failed" },
      });

      const result = await createResourceTarget({
        resourceId: "res-789",
      });

      expect(result).toBeUndefined();
    });
  });
});
