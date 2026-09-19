import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { Domain, Resource, ResourceTarget } from "./types";
import type { DokployEvent } from "./webhook";
import { buildResourceName, handleWebhook } from "./webhook";

// Test data factories, so the mocks hand back values the real types accept.
const domain = (baseDomain: string, domainId: string): Domain => ({
    domainId,
    baseDomain,
    verified: true,
    type: "ns",
    failed: false,
    tries: 0,
    configManaged: false,
    certResolver: null,
    preferWildcardCert: false,
});

const target = (targetId: string, resourceId: string): ResourceTarget => ({
    targetId,
    resourceId,
    siteId: "site-123",
    port: 443,
    method: "https",
    enabled: true,
    ip: "localhost",
});

// Mock the pangolin module
const mockListResources = mock(
    (): Promise<Resource[] | undefined> => Promise.resolve(undefined),
);
const mockListDomains = mock(
    (): Promise<Domain[] | undefined> => Promise.resolve(undefined),
);
const mockCreateResource = mock(
    (): Promise<Resource | undefined> => Promise.resolve(undefined),
);
const mockCreateResourceTarget = mock(
    (): Promise<ResourceTarget | undefined> => Promise.resolve(undefined),
);

mock.module("./pangolin", () => ({
    listResources: mockListResources,
    listDomains: mockListDomains,
    createResource: mockCreateResource,
    createResourceTarget: mockCreateResourceTarget,
}));

// Mock config
mock.module("../config", () => ({
    config: {
        pangolin: {
            apiBaseUrl: "https://api.example.com",
            apiKey: "test-key",
            orgId: "test-org",
            mainSiteName: "main-site",
        },
    },
}));

describe("handleWebhook", () => {
    beforeEach(() => {
        mockListResources.mockReset();
        mockListDomains.mockReset();
        mockCreateResource.mockReset();
        mockCreateResourceTarget.mockReset();
    });

    test("should handle non-build events successfully", async () => {
        const event: DokployEvent = {
            title: "Test Event",
            message: "Test message",
            timestamp: "2026-03-03T12:00:00Z",
            type: "dokploy-restart",
        };

        const result = await handleWebhook(event);

        expect(result.success).toBe(true);
        expect(result.message).toBe("Webhook processed successfully");
        expect(mockListResources).not.toHaveBeenCalled();
    });

    test("should return error for build events with error status", async () => {
        const event: DokployEvent = {
            title: "Build Failed",
            message: "Build error",
            timestamp: "2026-03-03T12:00:00Z",
            type: "build",
            status: "error",
            projectName: "test-project",
            applicationName: "test-app",
        };

        const result = await handleWebhook(event);

        expect(result.success).toBe(false);
        expect(result.message).toBe(
            "Build error for project: test-project (test-app)",
        );
        expect(mockListResources).not.toHaveBeenCalled();
    });

    test("should return error when no domains provided", async () => {
        const event: DokployEvent = {
            title: "Build Success",
            message: "Build completed",
            timestamp: "2026-03-03T12:00:00Z",
            type: "build",
            status: "success",
            projectName: "test-project",
        };

        const result = await handleWebhook(event);

        expect(result.success).toBe(false);
        expect(result.message).toBe("No domains provided in the event");
        expect(mockListResources).not.toHaveBeenCalled();
    });

    test("should find matching resource and succeed", async () => {
        const event: DokployEvent = {
            title: "Build Success",
            message: "Build completed",
            timestamp: "2026-03-03T12:00:00Z",
            type: "build",
            status: "success",
            projectName: "test-project",
            domains: "test.example.com",
        };

        mockListResources.mockResolvedValue([
            {
                name: "test-resource",
                fullDomain: "test.example.com",
                resourceId: "res-123",
            },
        ]);

        const result = await handleWebhook(event);

        expect(result.success).toBe(true);
        expect(result.message).toBe("Webhook processed successfully");
        expect(mockListResources).toHaveBeenCalledTimes(1);
        expect(mockCreateResource).not.toHaveBeenCalled();
    });

    test("should create new resource when no match found", async () => {
        const event: DokployEvent = {
            title: "Build Success",
            message: "Build completed",
            timestamp: "2026-03-03T12:00:00Z",
            type: "build",
            status: "success",
            projectName: "new-project",
            applicationName: "new-app",
            domains: "new.example.com",
        };

        mockListResources.mockResolvedValue([
            {
                name: "other-resource",
                fullDomain: "other.example.com",
                resourceId: "res-456",
            },
        ]);

        mockListDomains.mockResolvedValue([
            domain("example.com", "domain-id-1"),
        ]);

        mockCreateResource.mockResolvedValue({
            name: "new-project-new-app",
            fullDomain: "new.example.com",
            resourceId: "res-789",
        });

        mockCreateResourceTarget.mockResolvedValue(target("target-123", "res-789"));

        const result = await handleWebhook(event);

        expect(result.success).toBe(true);
        expect(result.message).toBe("Webhook processed successfully");
        expect(mockListResources).toHaveBeenCalledTimes(1);
        expect(mockCreateResource).toHaveBeenCalledWith({
            name: "new-project-new-app-new",
            subdomain: "new",
            domainId: "domain-id-1",
        });
        expect(mockCreateResourceTarget).toHaveBeenCalledWith({
            resourceId: "res-789",
        });
    });

    test("should handle subdomain extraction correctly", async () => {
        const event: DokployEvent = {
            title: "Build Success",
            message: "Build completed",
            timestamp: "2026-03-03T12:00:00Z",
            type: "build",
            status: "success",
            projectName: "api-project",
            applicationName: "api-app",
            domains: "api.example.com",
        };

        mockListResources.mockResolvedValue([]);
        mockListDomains.mockResolvedValue([
            domain("example.com", "domain-id-1"),
        ]);
        mockCreateResource.mockResolvedValue({
            name: "api-project-api-app",
            fullDomain: "api.example.com",
            resourceId: "res-999",
        });
        mockCreateResourceTarget.mockResolvedValue(target("target-999", "res-999"));

        const result = await handleWebhook(event);

        expect(result.success).toBe(true);
        expect(mockCreateResource).toHaveBeenCalledWith({
            name: "api-project-api-app-api",
            subdomain: "api",
            domainId: "domain-id-1",
        });
    });

    test("should create resource for root-level domain", async () => {
        const event: DokployEvent = {
            title: "Build Success",
            message: "Build completed",
            timestamp: "2026-03-03T12:00:00Z",
            type: "build",
            status: "success",
            projectName: "root-project",
            applicationName: "root-app",
            domains: "example.com",
        };

        mockListResources.mockResolvedValue([]);
        mockListDomains.mockResolvedValue([
            domain("example.com", "domain-id-1"),
        ]);
        mockCreateResource.mockResolvedValue({
            name: "root-project-root-app",
            fullDomain: "example.com",
            resourceId: "res-root",
        });
        mockCreateResourceTarget.mockResolvedValue(target("target-root", "res-root"));

        const result = await handleWebhook(event);

        expect(result.success).toBe(true);
        expect(mockCreateResource).toHaveBeenCalledWith({
            name: "root-project-root-app",
            subdomain: null,
            domainId: "domain-id-1",
        });
        expect(mockCreateResourceTarget).toHaveBeenCalledWith({
            resourceId: "res-root",
        });
    });

    test("should not create resource when subdomain extraction fails", async () => {
        const event: DokployEvent = {
            title: "Build Success",
            message: "Build completed",
            timestamp: "2026-03-03T12:00:00Z",
            type: "build",
            status: "success",
            projectName: "test-project",
            domains: ".example.com", // Invalid - starts with dot, will become empty
        };

        mockListResources.mockResolvedValue([]);
        mockListDomains.mockResolvedValue([
            domain("example.com", "domain-id-1"),
        ]);

        const result = await handleWebhook(event);

        expect(result.success).toBe(true);
        expect(result.message).toBe("Webhook processed successfully");
        expect(mockCreateResource).not.toHaveBeenCalled();
    });

    test("should not create resource when projectName or applicationName is missing", async () => {
        const event: DokployEvent = {
            title: "Build Success",
            message: "Build completed",
            timestamp: "2026-03-03T12:00:00Z",
            type: "build",
            status: "success",
            projectName: "test-project",
            // applicationName intentionally omitted
            domains: "new.example.com",
        };

        mockListResources.mockResolvedValue([]);
        mockListDomains.mockResolvedValue([
            domain("example.com", "domain-id-1"),
        ]);

        const result = await handleWebhook(event);

        expect(result.success).toBe(true);
        expect(result.message).toBe("Webhook processed successfully");
        expect(mockCreateResource).not.toHaveBeenCalled();
    });

    test("should not create resource target when resource creation fails", async () => {
        const event: DokployEvent = {
            title: "Build Success",
            message: "Build completed",
            timestamp: "2026-03-03T12:00:00Z",
            type: "build",
            status: "success",
            projectName: "test-project",
            applicationName: "test-app",
            domains: "new.example.com",
        };

        mockListResources.mockResolvedValue([]);
        mockListDomains.mockResolvedValue([
            domain("example.com", "domain-id-1"),
        ]);
        mockCreateResource.mockResolvedValue(undefined);

        const result = await handleWebhook(event);

        expect(result.success).toBe(true);
        expect(result.message).toBe("Webhook processed successfully");
        expect(mockCreateResourceTarget).not.toHaveBeenCalled();
    });

    test("should succeed even when resource target creation fails", async () => {
        const event: DokployEvent = {
            title: "Build Success",
            message: "Build completed",
            timestamp: "2026-03-03T12:00:00Z",
            type: "build",
            status: "success",
            projectName: "test-project",
            applicationName: "test-app",
            domains: "new.example.com",
        };

        mockListResources.mockResolvedValue([]);
        mockListDomains.mockResolvedValue([
            domain("example.com", "domain-id-1"),
        ]);
        mockCreateResource.mockResolvedValue({
            name: "test-project",
            fullDomain: "new.example.com",
            resourceId: "res-111",
        });
        mockCreateResourceTarget.mockResolvedValue(undefined);

        const result = await handleWebhook(event);

        expect(result.success).toBe(true);
        expect(result.message).toBe("Webhook processed successfully");
    });

    test("should process multiple comma-separated domains independently", async () => {
        const event: DokployEvent = {
            title: "Build Success",
            message: "Build completed",
            timestamp: "2026-03-03T12:00:00Z",
            type: "build",
            status: "success",
            projectName: "multi-project",
            applicationName: "multi-app",
            domains: "first.example.com, second.example.com",
        };

        mockListResources.mockResolvedValue([
            {
                name: "existing",
                fullDomain: "first.example.com",
                resourceId: "res-001",
            },
        ]);
        mockListDomains.mockResolvedValue([
            domain("example.com", "domain-id-1"),
        ]);
        mockCreateResource.mockResolvedValue({
            name: "multi-project-multi-app",
            fullDomain: "second.example.com",
            resourceId: "res-002",
        });
        mockCreateResourceTarget.mockResolvedValue(target("target-002", "res-002"));

        const result = await handleWebhook(event);

        expect(result.success).toBe(true);
        expect(result.message).toBe("Webhook processed successfully");
        expect(mockListResources).toHaveBeenCalledTimes(1);
        expect(mockCreateResource).toHaveBeenCalledWith({
            name: "multi-project-multi-app-second",
            subdomain: "second",
            domainId: "domain-id-1",
        });
        expect(mockCreateResourceTarget).toHaveBeenCalledWith({
            resourceId: "res-002",
        });
    });
});

describe("buildResourceName", () => {
    test("collapses repeated segments instead of sergios-sergios-sergios", () => {
        expect(buildResourceName("sergios", "sergios", "sergios")).toBe("sergios");
        expect(buildResourceName("penombre", "penombre", "drive")).toBe(
            "penombre-drive",
        );
        expect(buildResourceName("stremio", "flaresolverr", "flaresolverr")).toBe(
            "stremio-flaresolverr",
        );
    });

    test("keeps distinct segments in order", () => {
        expect(buildResourceName("homelab", "kopia", "backups")).toBe(
            "homelab-kopia-backups",
        );
    });

    test("omits the subdomain for a root domain", () => {
        expect(buildResourceName("orochibraru", "website", null)).toBe(
            "orochibraru-website",
        );
    });

    test("normalises case and whitespace", () => {
        expect(buildResourceName("  Nuvio ", "APP", " Nuvio")).toBe("nuvio-app");
    });

    test("keeps parts that merely share a word", () => {
        expect(buildResourceName("new-project", "new-app", "new")).toBe(
            "new-project-new-app-new",
        );
    });
});

describe("duplicate prevention", () => {
    beforeEach(() => {
        mockListResources.mockReset();
        mockListDomains.mockReset();
        mockCreateResource.mockReset();
        mockCreateResourceTarget.mockReset();
    });

    test("matches an existing resource regardless of host name casing", async () => {
        mockListResources.mockResolvedValue([
            {
                name: "existing",
                fullDomain: "Drive.Example.com",
                resourceId: "res-1",
            },
        ]);

        const result = await handleWebhook({
            title: "Build Success",
            message: "Build completed",
            timestamp: "2026-03-03T12:00:00Z",
            type: "build",
            status: "success",
            projectName: "p",
            applicationName: "a",
            domains: "drive.example.com.",
        });

        expect(result.success).toBe(true);
        expect(mockCreateResource).not.toHaveBeenCalled();
    });

    test("creates one resource when an event repeats the same domain", async () => {
        mockListResources.mockResolvedValue([]);
        mockListDomains.mockResolvedValue([
            domain("example.com", "domain-id-1"),
        ]);
        mockCreateResource.mockResolvedValue({
            name: "p-a-dup",
            fullDomain: "dup.example.com",
            resourceId: "res-9",
        });
        mockCreateResourceTarget.mockResolvedValue(target("t-1", "res-1"));

        const result = await handleWebhook({
            title: "Build Success",
            message: "Build completed",
            timestamp: "2026-03-03T12:00:00Z",
            type: "build",
            status: "success",
            projectName: "p",
            applicationName: "a",
            domains: "dup.example.com, DUP.example.com",
        });

        expect(result.success).toBe(true);
        expect(mockCreateResource).toHaveBeenCalledTimes(1);
    });

    test("skips creation when the resource list is unavailable", async () => {
        mockListResources.mockResolvedValue(undefined);

        const result = await handleWebhook({
            title: "Build Success",
            message: "Build completed",
            timestamp: "2026-03-03T12:00:00Z",
            type: "build",
            status: "success",
            projectName: "p",
            applicationName: "a",
            domains: "new.example.com",
        });

        expect(result.success).toBe(false);
        expect(result.message).toBe("Could not list existing Pangolin resources");
        expect(mockCreateResource).not.toHaveBeenCalled();
    });

    test("serialises overlapping events so they cannot both create", async () => {
        const resources: Resource[] = [];
        mockListResources.mockImplementation(() => Promise.resolve([...resources]));
        mockListDomains.mockResolvedValue([
            domain("example.com", "domain-id-1"),
        ]);
        mockCreateResource.mockImplementation(() => {
            const created: Resource = {
                name: "p-a-race",
                fullDomain: "race.example.com",
                resourceId: "res-race",
            };
            resources.push(created);
            return Promise.resolve(created);
        });
        mockCreateResourceTarget.mockResolvedValue(target("t-1", "res-1"));

        const event: DokployEvent = {
            title: "Build Success",
            message: "Build completed",
            timestamp: "2026-03-03T12:00:00Z",
            type: "build",
            status: "success",
            projectName: "p",
            applicationName: "a",
            domains: "race.example.com",
        };

        await Promise.all([
            handleWebhook(event),
            handleWebhook(event),
            handleWebhook(event),
        ]);

        expect(mockCreateResource).toHaveBeenCalledTimes(1);
    });
});
