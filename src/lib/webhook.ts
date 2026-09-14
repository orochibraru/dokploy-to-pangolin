import { normalizeDomain } from "./dedupe";
import {
	createResource,
	createResourceTarget,
	listDomains,
	listResources,
} from "./pangolin";
import type { Resource } from "./types";

export type DokployEvent = {
	title: string;
	message: string;
	timestamp: string;
	projectName?: string;
	applicationName?: string;
	applicationType?: string;
	buildLink?: string;
	date?: string;
	domains?: string;
	status?: string;
	type?: "build" | "dokploy-restart";
};

type Result = {
	success: boolean;
	message: string;
};

/**
 * Dokploy often repeats itself - project "sergios" holding application
 * "sergios" served from subdomain "sergios" used to become the resource
 * "sergios-sergios-sergios". Keep each distinct segment once.
 */
export function buildResourceName(
	projectName: string,
	applicationName: string,
	subdomain: string | null,
): string {
	// Deliberately compared whole, not word by word: "new-project" and
	// "new-app" are different names that merely share a word.
	const parts = [projectName, applicationName, subdomain]
		.map((part) => part?.trim().toLowerCase())
		.filter((part): part is string => Boolean(part));

	return [...new Set(parts)].join("-");
}

interface HandleResourceCreationParams {
	domain: string;
	resources: Resource[];
	event: DokployEvent;
}

async function handleResourcecreation({
	domain,
	resources,
	event,
}: HandleResourceCreationParams) {
	const normalizedDomain = normalizeDomain(domain);
	const match = resources.find(
		(res) =>
			res.fullDomain && normalizeDomain(res.fullDomain) === normalizedDomain,
	);

	if (match) {
		console.log(
			`Matching resource found in Pangolin: ${match.name} (${match.fullDomain})`,
		);
	} else {
		console.warn(
			"No matching resource found in Pangolin for the provided domain.",
		);

		const domains = await listDomains();
		const matchingDomain = domains?.find(
			(d) =>
				normalizedDomain === normalizeDomain(d.baseDomain) ||
				normalizedDomain.endsWith(`.${normalizeDomain(d.baseDomain)}`),
		);

		if (!matchingDomain) {
			console.error(
				"No matching Pangolin domain found for the provided domain.",
			);
			return {
				success: false,
				message: "No matching Pangolin domain found for the provided domain",
			};
		}

		const baseDomain = normalizeDomain(matchingDomain.baseDomain);
		const isRootDomain = normalizedDomain === baseDomain;
		const extractedSubdomain = isRootDomain
			? null
			: normalizedDomain.slice(0, -`.${baseDomain}`.length).trim();

		if (!isRootDomain && !extractedSubdomain) {
			console.error("No subdomain could be extracted from the event domain.");
			return {
				success: false,
				message: "No subdomain extracted from event domain",
			};
		}

		if (!event.applicationName || !event.projectName) {
			console.error(
				"No application name or project name provided in the webhook event.",
			);
			return {
				success: false,
				message: "No application name or project name provided in the event",
			};
		}

		const resourceName = buildResourceName(
			event.projectName,
			event.applicationName,
			extractedSubdomain,
		);

		const createdResource = await createResource({
			name: resourceName,
			subdomain: extractedSubdomain,
			domainId: matchingDomain.domainId,
		});

		if (!createdResource) {
			return {
				success: false,
				message: "Failed to create resource in Pangolin",
			};
		}

		// Record it so a second domain in the same event resolving to this host
		// name matches instead of creating another copy.
		resources.push(createdResource);

		console.log(
			`Resource created successfully in Pangolin: ${createdResource.name} (${createdResource.fullDomain})`,
		);

		const resourceTarget = await createResourceTarget({
			resourceId: String(createdResource.resourceId),
		});

		if (!resourceTarget) {
			return {
				success: false,
				message: "Failed to create resource target in Pangolin",
			};
		}

		console.log(
			`Resource target created successfully in Pangolin for resource: ${createdResource.name} with domain ${createdResource.fullDomain}`,
		);
	}
}

let pending: Promise<unknown> = Promise.resolve();

/**
 * Dokploy fires a webhook per deploy, so two overlapping deploys would both
 * read the resource list before either had created anything and each would
 * then create its own copy. Handling one event at a time removes that race.
 */
function serialize<T>(work: () => Promise<T>): Promise<T> {
	const result = pending.then(work, work);
	pending = result.catch(() => {});
	return result;
}

async function processWebhook(event: DokployEvent): Promise<Result> {
	if (event.type && event.type === "build") {
		console.log(
			`Build event received for project: ${event.projectName} (${event.applicationName})`,
			event,
		);

		if (event.status === "error") {
			console.error(
				`Build error for project: ${event.projectName} (${event.applicationName})`,
				event,
			);
			return {
				success: false,
				message: `Build error for project: ${event.projectName} (${event.applicationName})`,
			};
		}

		const domain = event.domains;

		if (!domain) {
			console.warn("No domains provided in the webhook event.");
			return {
				success: false,
				message: "No domains provided in the event",
			};
		}

		const domainList = event.domains?.split(",").map((d) => d.trim());

		if (!domainList || domainList.length === 0) {
			console.warn("No valid domains extracted from the webhook event.");
			return {
				success: false,
				message: "No valid domains extracted from the event",
			};
		}

		console.log(`Extracted domains from event: ${domainList.join(", ")}`);

		const resources = await listResources();

		// Creating resources against an unknown state is what produced the
		// duplicates in the first place - bail out instead of guessing.
		if (!resources) {
			console.error(
				"Could not list existing Pangolin resources, skipping to avoid creating duplicates.",
			);
			return {
				success: false,
				message: "Could not list existing Pangolin resources",
			};
		}

		for (const domain of domainList) {
			await handleResourcecreation({ domain, resources, event });
		}
	} else {
		console.log("Webhook payload received:", event);
	}

	return {
		success: true,
		message: "Webhook processed successfully",
	};
}

export function handleWebhook(event: DokployEvent): Promise<Result> {
	return serialize(() => processWebhook(event));
}
