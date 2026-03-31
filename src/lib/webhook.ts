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

interface HandleResourceCreationParams {
	domain: string;
	resources?: Resource[];
	event: DokployEvent;
}

async function handleResourcecreation({
	domain,
	resources,
	event,
}: HandleResourceCreationParams) {
	const match = resources?.find((res) => domain === res.fullDomain);

	if (match) {
		console.log(
			`Matching resource found in Pangolin: ${match.name} (${match.fullDomain})`,
		);
	} else {
		console.warn(
			"No matching resource found in Pangolin for the provided domain.",
		);

		const domains = await listDomains();
		const matchingDomain = domains?.find((d) =>
			domain.endsWith(`.${d.baseDomain}`),
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

		const extractedSubdomain = domain
			.slice(0, -`.${matchingDomain.baseDomain}`.length)
			.trim();
		if (!extractedSubdomain) {
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

		const resourceName = `${event.projectName.toLowerCase()}-${event.applicationName.toLowerCase()}`;

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

		console.log(
			`Resource created successfully in Pangolin: ${createdResource.name} (${createdResource.fullDomain})`,
		);

		const resourceTarget = await createResourceTarget({
			resourceId: createdResource.resourceId,
		});

		if (!resourceTarget) {
			return {
				success: false,
				message: "Failed to create resource target in Pangolin",
			};
		}

		console.log(
			`Resource target created successfully in Pangolin for resource: ${createdResource.name}`,
		);
	}
}

export async function handleWebhook(event: DokployEvent): Promise<Result> {
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
