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
const { fetchMainDomain, getMainSite, listDomains, listResources, listSites } =
  await import("./pangolin");

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
});
