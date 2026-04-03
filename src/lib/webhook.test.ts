import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { DokployEvent } from "./webhook";
import { handleWebhook } from "./webhook";

// Mock the pangolin module
const mockListResources = mock(() => Promise.resolve(undefined));
const mockListDomains = mock(() => Promise.resolve(undefined));
const mockCreateResource = mock(() => Promise.resolve(undefined));
const mockCreateResourceTarget = mock(() => Promise.resolve(undefined));

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
        mockListResources.mockClear();
        mockListDomains.mockClear();
        mockCreateResource.mockClear();
        mockCreateResourceTarget.mockClear();
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
            {
                baseDomain: "example.com",
                name: "Example Domain",
                id: "domain-1",
                domainId: "domain-id-1",
            },
        ]);

        mockCreateResource.mockResolvedValue({
            name: "new-project-new-app",
            fullDomain: "new.example.com",
            resourceId: "res-789",
        });

        mockCreateResourceTarget.mockResolvedValue({
            targetId: "target-123",
            resourceId: "res-789",
            siteId: "site-123",
            port: 443,
            method: "https",
            enabled: true,
            ip: "localhost",
        });

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
            {
                baseDomain: "example.com",
                name: "Example Domain",
                id: "domain-1",
                domainId: "domain-id-1",
            },
        ]);
        mockCreateResource.mockResolvedValue({
            name: "api-project-api-app",
            fullDomain: "api.example.com",
            resourceId: "res-999",
        });
        mockCreateResourceTarget.mockResolvedValue({
            targetId: "target-999",
            resourceId: "res-999",
            siteId: "site-123",
            port: 443,
            method: "https",
            enabled: true,
            ip: "localhost",
        });

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
            {
                baseDomain: "example.com",
                name: "Example Domain",
                id: "domain-1",
                domainId: "domain-id-1",
            },
        ]);
        mockCreateResource.mockResolvedValue({
            name: "root-project-root-app",
            fullDomain: "example.com",
            resourceId: "res-root",
        });
        mockCreateResourceTarget.mockResolvedValue({
            targetId: "target-root",
            resourceId: "res-root",
            siteId: "site-123",
            port: 443,
            method: "https",
            enabled: true,
            ip: "localhost",
        });

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
            {
                baseDomain: "example.com",
                name: "Example Domain",
                id: "domain-1",
                domainId: "domain-id-1",
            },
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
            {
                baseDomain: "example.com",
                name: "Example Domain",
                id: "domain-1",
                domainId: "domain-id-1",
            },
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
            {
                baseDomain: "example.com",
                name: "Example Domain",
                id: "domain-1",
                domainId: "domain-id-1",
            },
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
            {
                baseDomain: "example.com",
                name: "Example Domain",
                id: "domain-1",
                domainId: "domain-id-1",
            },
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
            {
                baseDomain: "example.com",
                name: "Example Domain",
                id: "domain-1",
                domainId: "domain-id-1",
            },
        ]);
        mockCreateResource.mockResolvedValue({
            name: "multi-project-multi-app",
            fullDomain: "second.example.com",
            resourceId: "res-002",
        });
        mockCreateResourceTarget.mockResolvedValue({
            targetId: "target-002",
            resourceId: "res-002",
            siteId: "site-123",
            port: 443,
            method: "https",
            enabled: true,
            ip: "localhost",
        });

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
