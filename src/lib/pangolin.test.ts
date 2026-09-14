import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { Domain, Resource, Site } from "./types";

// Mock the openapi-fetch client
const mockGET = mock(
  (_path: string, _opts?: unknown): Promise<{ data: unknown; error: unknown }> =>
    Promise.resolve({ data: undefined, error: undefined }),
);
const mockPUT = mock(
  (_path: string, _opts?: unknown): Promise<{ data: unknown; error: unknown }> =>
    Promise.resolve({ data: undefined, error: undefined }),
);

const mockDELETE = mock(
  (_path: string, _opts?: unknown): Promise<{ data: unknown; error: unknown }> =>
    Promise.resolve({ data: undefined, error: undefined }),
);

const mockPOST = mock(
  (_path: string, _opts?: unknown): Promise<{ data: unknown; error: unknown }> =>
    Promise.resolve({ data: undefined, error: undefined }),
);

const mockClient = {
  GET: mockGET,
  PUT: mockPUT,
  POST: mockPOST,
  DELETE: mockDELETE,
  use: mock(() => {}),
};

mock.module("openapi-fetch", () => ({
  default: mock(() => mockClient),
}));

// Mock config
mock.module("../config", () => ({
  config: {
    pangolin: {
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
  deleteResource,
  getMainSite,
  renameResource,
  listDomains,
  listResources,
  listSites,
} = await import("./pangolin");

describe("Pangolin API Functions", () => {
  beforeEach(() => {
    mockGET.mockClear();
    mockPUT.mockClear();
    mockDELETE.mockClear();
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
      expect(mockGET).toHaveBeenCalledWith("/org/{orgId}/domains", expect.anything());
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
      expect(mockGET).toHaveBeenCalledWith("/org/{orgId}/resources", expect.anything());
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
      expect(mockGET).toHaveBeenCalledWith("/org/{orgId}/sites", expect.anything());
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
      const mockResource: Resource = {
        name: "test-resource",
        fullDomain: "test.example.com",
        resourceId: "res-123",
      };

      mockPUT.mockResolvedValue({
        data: {
          data: mockResource,
        },
        error: undefined,
      });

      const result = await createResource({
        name: "test-resource",
        subdomain: "test",
        domainId: "domain-id-1",
      });

      expect(result).toEqual(mockResource);
      expect(mockGET).not.toHaveBeenCalled();
      expect(mockPUT).toHaveBeenCalledTimes(1);
      expect(mockPUT).toHaveBeenCalledWith("/org/{orgId}/resource", expect.objectContaining({
        body: expect.objectContaining({
          name: "test-resource",
          subdomain: "test",
          http: true,
          domainId: "domain-id-1",
          stickySession: true,
          postAuthPath: "/",
          protocol: "tcp",
        }),
      }));
    });

    test("should return undefined on PUT error", async () => {
      mockPUT.mockResolvedValue({
        data: undefined,
        error: { message: "Creation failed" },
      });

      const result = await createResource({
        name: "test-resource",
        subdomain: "test",
        domainId: "domain-id-1",
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
      expect(mockPUT).toHaveBeenCalledWith("/resource/{resourceId}/target", expect.objectContaining({
        body: expect.objectContaining({
          siteId: "site-123",
          port: 443,
          method: "https",
          enabled: true,
          ip: "localhost",
        }),
      }));
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

describe("listResources pagination", () => {
  beforeEach(() => {
    mockGET.mockClear();
  });

  const page = (from: number, count: number, total: number) => ({
    data: {
      data: {
        resources: Array.from({ length: count }, (_, i) => ({
          name: `r${from + i}`,
          fullDomain: `r${from + i}.example.com`,
          resourceId: from + i,
        })),
        pagination: { total, pageSize: 500, page: 1 },
      },
    },
    error: undefined,
  });

  test("always asks for a page size, so page 2 is not silently dropped", async () => {
    mockGET.mockResolvedValue(page(1, 3, 3));

    await listResources();

    const opts = mockGET.mock.calls[0]?.[1] as {
      params: { query: { page: number; pageSize: number } };
    };
    expect(opts.params.query.pageSize).toBeGreaterThan(20);
    expect(opts.params.query.page).toBe(1);
  });

  test("walks every page and returns the whole collection", async () => {
    mockGET
      .mockResolvedValueOnce(page(1, 500, 620))
      .mockResolvedValueOnce(page(501, 120, 620));

    const result = await listResources();

    expect(result).toHaveLength(620);
    expect(mockGET).toHaveBeenCalledTimes(2);
    expect(result?.at(-1)?.resourceId).toBe(620);
  });

  test("stops at a short page even without a total", async () => {
    mockGET.mockResolvedValue({
      data: { data: { resources: [{ name: "r", fullDomain: "r.example.com", resourceId: 1 }] } },
      error: undefined,
    });

    expect(await listResources()).toHaveLength(1);
    expect(mockGET).toHaveBeenCalledTimes(1);
  });

  test("returns undefined when a later page errors", async () => {
    mockGET
      .mockResolvedValueOnce(page(1, 500, 620))
      .mockResolvedValueOnce({ data: undefined, error: { message: "boom" } });

    expect(await listResources()).toBeUndefined();
  });
});

describe("deleteResource", () => {
  beforeEach(() => {
    mockDELETE.mockClear();
  });

  test("returns true and targets the resource path", async () => {
    mockDELETE.mockResolvedValue({ data: {}, error: undefined });

    expect(await deleteResource(42)).toBe(true);
    expect(mockDELETE).toHaveBeenCalledWith("/resource/{resourceId}", {
      params: { path: { resourceId: "42" } },
    });
  });

  test("returns false on error", async () => {
    mockDELETE.mockResolvedValue({ data: undefined, error: { message: "nope" } });

    expect(await deleteResource("res-1")).toBe(false);
  });
});

describe("renameResource", () => {
  beforeEach(() => {
    mockPOST.mockClear();
  });

  test("posts the new name to the resource", async () => {
    mockPOST.mockResolvedValue({ data: {}, error: undefined });

    expect(await renameResource(7, "sergios")).toBe(true);
    expect(mockPOST).toHaveBeenCalledWith("/resource/{resourceId}", {
      params: { path: { resourceId: "7" } },
      body: { name: "sergios" },
    });
  });

  test("returns false on error", async () => {
    mockPOST.mockResolvedValue({ data: undefined, error: { message: "nope" } });

    expect(await renameResource(7, "sergios")).toBe(false);
  });
});
