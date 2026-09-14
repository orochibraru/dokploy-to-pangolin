import { deleteResource, listResources, renameResource } from "./pangolin";
import type { Resource } from "./types";

/**
 * Pangolin routes by host name, which is case-insensitive and may carry a
 * trailing root dot. Compare and group on this form so "Drive.Example.com"
 * and "drive.example.com." are recognised as the same resource.
 */
export function normalizeDomain(domain: string): string {
	return domain.trim().toLowerCase().replace(/\.$/, "");
}

export interface DuplicateGroup {
	fullDomain: string;
	/** The resource to keep: the oldest one, which holds the original config. */
	keep: Resource;
	/** Later resources pointing at the same host name. */
	duplicates: Resource[];
}

/**
 * Two resources sharing a host name are a routing conflict - Pangolin serves
 * whichever one it happens to pick, so the extras have to go. The oldest is
 * kept because it is the one that was configured deliberately (SSO, rules,
 * auth) before the hook started cloning it.
 */
export function findDuplicateGroups(resources: Resource[]): DuplicateGroup[] {
	const byDomain = new Map<string, Resource[]>();

	for (const resource of resources) {
		// Non-http resources have no host name and cannot collide this way.
		if (!resource.fullDomain) {
			continue;
		}

		const key = normalizeDomain(resource.fullDomain);
		const group = byDomain.get(key);

		if (group) {
			group.push(resource);
		} else {
			byDomain.set(key, [resource]);
		}
	}

	const groups: DuplicateGroup[] = [];

	for (const [fullDomain, group] of byDomain) {
		if (group.length < 2) {
			continue;
		}

		const [keep, ...duplicates] = group.sort(
			(a, b) => Number(a.resourceId) - Number(b.resourceId),
		);

		if (keep) {
			groups.push({ fullDomain, keep, duplicates });
		}
	}

	return groups.sort((a, b) => b.duplicates.length - a.duplicates.length);
}

/**
 * The old naming scheme pasted project, application and subdomain together
 * even when they were the same word, leaving names like
 * "sergios-sergios-sergios" behind. Collapse repeats in an existing name;
 * a name with nothing repeated comes back unchanged.
 *
 * An existing name is all there is to go on, so this works word by word and
 * would shorten a deliberate "new-project-new-app" too. Review the dry run
 * before applying it.
 */
export function collapseResourceName(name: string): string {
	const seen = new Set<string>();
	const segments: string[] = [];

	for (const segment of name.split("-")) {
		const key = segment.trim().toLowerCase();

		if (!seen.has(key)) {
			seen.add(key);
			segments.push(segment);
		}
	}

	return segments.join("-");
}

export interface ReconcileResult {
	scanned: number;
	groups: DuplicateGroup[];
	deleted: Resource[];
	failed: Resource[];
	renamed: { resource: Resource; name: string }[];
	applied: boolean;
}

/**
 * Report - and with `apply`, fix - resources that duplicate a host name:
 * delete every copy but the oldest, then tidy up repeated segments in the
 * names that survive. Pass `rename: false` to only deal with the duplicates.
 */
export async function reconcileDuplicates({
	apply = false,
	rename = true,
}: {
	apply?: boolean;
	rename?: boolean;
} = {}): Promise<ReconcileResult | undefined> {
	const resources = await listResources();

	if (!resources) {
		console.error("Could not list Pangolin resources, skipping reconcile.");
		return;
	}

	const groups = findDuplicateGroups(resources);
	const deleted: Resource[] = [];
	const failed: Resource[] = [];
	const renamed: { resource: Resource; name: string }[] = [];
	const removedIds = new Set(
		groups.flatMap((group) =>
			group.duplicates.map((duplicate) => String(duplicate.resourceId)),
		),
	);

	for (const group of groups) {
		console.log(
			`${group.fullDomain}: keeping ${group.keep.name} (${group.keep.resourceId}), ${group.duplicates.length} duplicate(s)`,
		);

		for (const duplicate of group.duplicates) {
			if (!apply) {
				console.log(
					`  would delete ${duplicate.name} (${duplicate.resourceId})`,
				);
				continue;
			}

			if (await deleteResource(duplicate.resourceId)) {
				console.log(`  deleted ${duplicate.name} (${duplicate.resourceId})`);
				deleted.push(duplicate);
			} else {
				failed.push(duplicate);
			}
		}
	}

	if (rename) {
		for (const resource of resources) {
			if (removedIds.has(String(resource.resourceId))) {
				continue;
			}

			const collapsed = collapseResourceName(resource.name);

			if (collapsed === resource.name) {
				continue;
			}

			if (!apply) {
				console.log(
					`would rename ${resource.name} (${resource.resourceId}) to ${collapsed}`,
				);
				renamed.push({ resource, name: collapsed });
				continue;
			}

			if (await renameResource(resource.resourceId, collapsed)) {
				console.log(
					`renamed ${resource.name} (${resource.resourceId}) to ${collapsed}`,
				);
				renamed.push({ resource, name: collapsed });
			} else {
				failed.push(resource);
			}
		}
	}

	return {
		scanned: resources.length,
		groups,
		deleted,
		failed,
		renamed,
		applied: apply,
	};
}
