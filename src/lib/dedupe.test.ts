import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { Resource } from "./types";

const mockListResources = mock(
    (): Promise<Resource[] | undefined> => Promise.resolve([]),
);
const mockDeleteResource = mock((_id: string | number) => Promise.resolve(true));
const mockRenameResource = mock((_id: string | number, _name: string) =>
    Promise.resolve(true),
);

mock.module("./pangolin", () => ({
    listResources: mockListResources,
    deleteResource: mockDeleteResource,
    renameResource: mockRenameResource,
}));

const {
    collapseResourceName,
    findDuplicateGroups,
    normalizeDomain,
    reconcileDuplicates,
} = await import("./dedupe");

const res = (resourceId: number, fullDomain: string | null, name = "r"): Resource => ({
    resourceId,
    fullDomain,
    name,
});

describe("normalizeDomain", () => {
    test("lowercases, trims and drops the root dot", () => {
        expect(normalizeDomain("  Drive.Example.COM. ")).toBe("drive.example.com");
    });
});

describe("findDuplicateGroups", () => {
    test("returns nothing when every host name is unique", () => {
        expect(
            findDuplicateGroups([res(1, "a.example.com"), res(2, "b.example.com")]),
        ).toEqual([]);
    });

    test("keeps the oldest resource and reports the rest as duplicates", () => {
        const groups = findDuplicateGroups([
            res(9, "a.example.com", "third"),
            res(2, "a.example.com", "first"),
            res(5, "a.example.com", "second"),
        ]);

        expect(groups).toHaveLength(1);
        expect(groups[0]?.fullDomain).toBe("a.example.com");
        expect(groups[0]?.keep.resourceId).toBe(2);
        expect(groups[0]?.duplicates.map((d) => d.resourceId)).toEqual([5, 9]);
    });

    test("groups host names case-insensitively", () => {
        const groups = findDuplicateGroups([
            res(1, "A.Example.com"),
            res(2, "a.example.COM."),
        ]);

        expect(groups).toHaveLength(1);
        expect(groups[0]?.keep.resourceId).toBe(1);
    });

    test("ignores non-http resources that have no host name", () => {
        expect(findDuplicateGroups([res(1, null), res(2, null)])).toEqual([]);
    });

    test("orders groups by duplicate count, worst first", () => {
        const groups = findDuplicateGroups([
            res(1, "few.example.com"),
            res(2, "few.example.com"),
            res(3, "many.example.com"),
            res(4, "many.example.com"),
            res(5, "many.example.com"),
        ]);

        expect(groups.map((g) => g.fullDomain)).toEqual([
            "many.example.com",
            "few.example.com",
        ]);
    });
});

describe("reconcileDuplicates", () => {
    beforeEach(() => {
        mockListResources.mockReset();
        mockDeleteResource.mockReset();
        mockRenameResource.mockReset();
        mockDeleteResource.mockResolvedValue(true);
        mockRenameResource.mockResolvedValue(true);
    });

    test("returns undefined when resources cannot be listed", async () => {
        mockListResources.mockResolvedValue(undefined);

        expect(await reconcileDuplicates()).toBeUndefined();
        expect(mockDeleteResource).not.toHaveBeenCalled();
    });

    test("deletes nothing on a dry run", async () => {
        mockListResources.mockResolvedValue([
            res(1, "a.example.com"),
            res(2, "a.example.com"),
        ]);

        const result = await reconcileDuplicates();

        expect(result?.scanned).toBe(2);
        expect(result?.applied).toBe(false);
        expect(result?.groups).toHaveLength(1);
        expect(result?.deleted).toEqual([]);
        expect(mockDeleteResource).not.toHaveBeenCalled();
    });

    test("deletes every duplicate but the oldest when applied", async () => {
        mockListResources.mockResolvedValue([
            res(1, "a.example.com"),
            res(2, "a.example.com"),
            res(3, "a.example.com"),
            res(4, "b.example.com"),
        ]);

        const result = await reconcileDuplicates({ apply: true });

        expect(result?.applied).toBe(true);
        expect(result?.deleted.map((d) => d.resourceId)).toEqual([2, 3]);
        expect(result?.failed).toEqual([]);
        expect(mockDeleteResource).toHaveBeenCalledTimes(2);
        expect(mockDeleteResource).toHaveBeenCalledWith(2);
        expect(mockDeleteResource).toHaveBeenCalledWith(3);
    });

    test("reports duplicates it failed to delete", async () => {
        mockListResources.mockResolvedValue([
            res(1, "a.example.com"),
            res(2, "a.example.com"),
        ]);
        mockDeleteResource.mockResolvedValue(false);

        const result = await reconcileDuplicates({ apply: true });

        expect(result?.deleted).toEqual([]);
        expect(result?.failed.map((d) => d.resourceId)).toEqual([2]);
    });
});

describe("collapseResourceName", () => {
    test("collapses repeated segments", () => {
        expect(collapseResourceName("sergios-sergios-sergios")).toBe("sergios");
        expect(collapseResourceName("penombre-penombre-drive")).toBe(
            "penombre-drive",
        );
        expect(collapseResourceName("stremio-flaresolverr-flaresolverr")).toBe(
            "stremio-flaresolverr",
        );
    });

    test("leaves names without repeats alone", () => {
        expect(collapseResourceName("homelab-kopia-backups")).toBe(
            "homelab-kopia-backups",
        );
        expect(collapseResourceName("Dashlit")).toBe("Dashlit");
        expect(collapseResourceName("Dokploy to Pangolin")).toBe(
            "Dokploy to Pangolin",
        );
    });

    test("matches segments case-insensitively and keeps the first spelling", () => {
        expect(collapseResourceName("Nuvio-nuvio-app")).toBe("Nuvio-app");
    });

    test("works word by word, so a shared word is collapsed as well", () => {
        // Known limitation: an existing name carries no record of where
        // project, application and subdomain ended.
        expect(collapseResourceName("new-project-new-app")).toBe(
            "new-project-app",
        );
    });
});

describe("reconcileDuplicates renaming", () => {
    beforeEach(() => {
        mockListResources.mockReset();
        mockDeleteResource.mockReset();
        mockRenameResource.mockReset();
        mockDeleteResource.mockResolvedValue(true);
        mockRenameResource.mockResolvedValue(true);
    });

    test("renames survivors and skips the duplicates it deleted", async () => {
        mockListResources.mockResolvedValue([
            res(1, "a.example.com", "sergios-sergios-sergios"),
            res(2, "a.example.com", "sergios-sergios-sergios"),
            res(3, "b.example.com", "homelab-kopia-backups"),
        ]);

        const result = await reconcileDuplicates({ apply: true });

        expect(result?.deleted.map((d) => d.resourceId)).toEqual([2]);
        expect(mockRenameResource).toHaveBeenCalledTimes(1);
        expect(mockRenameResource).toHaveBeenCalledWith(1, "sergios");
        expect(result?.renamed).toEqual([
            { resource: expect.objectContaining({ resourceId: 1 }), name: "sergios" },
        ]);
    });

    test("renames nothing on a dry run", async () => {
        mockListResources.mockResolvedValue([
            res(1, "a.example.com", "nuvio-nuvio-app"),
        ]);

        const result = await reconcileDuplicates();

        expect(mockRenameResource).not.toHaveBeenCalled();
        expect(result?.renamed).toHaveLength(1);
    });

    test("honours rename: false", async () => {
        mockListResources.mockResolvedValue([
            res(1, "a.example.com", "nuvio-nuvio-app"),
        ]);

        const result = await reconcileDuplicates({ apply: true, rename: false });

        expect(mockRenameResource).not.toHaveBeenCalled();
        expect(result?.renamed).toEqual([]);
    });

    test("reports a rename it could not apply", async () => {
        mockListResources.mockResolvedValue([
            res(1, "a.example.com", "nuvio-nuvio-app"),
        ]);
        mockRenameResource.mockResolvedValue(false);

        const result = await reconcileDuplicates({ apply: true });

        expect(result?.renamed).toEqual([]);
        expect(result?.failed.map((f) => f.resourceId)).toEqual([1]);
    });
});
