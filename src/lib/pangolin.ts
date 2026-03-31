import createClient, { type Middleware } from "openapi-fetch";
import { config } from "../config";
import type {
	ApiResponse,
	Domain,
	DomainsResponse,
	Resource,
	ResourcesResponse,
	ResourceTarget,
	Site,
	SitesResponse,
} from "./types";

const client = createClient({
	baseUrl: config.pangolin.apiBaseUrl,
});

const authMiddleware: Middleware = {
	async onRequest({ request }) {
		request.headers.set("Authorization", `Bearer ${config.pangolin.apiKey}`);
		return request;
	},
};

client.use(authMiddleware);

export async function listDomains(): Promise<Domain[] | undefined> {
	// @ts-expect-error - OAS paths are broken, using custom types
	const { data, error } = (await client.GET("/org/{orgId}/domains", {
		params: {
			path: {
				orgId: config.pangolin.orgId,
			},
		},
	})) as { data?: ApiResponse<DomainsResponse>; error?: unknown };

	if (error) {
		console.error("Error fetching Pangolin domains:", error);
		return;
	}
	console.log(data?.data.domains);

	return data?.data.domains;
}

export async function fetchMainDomain(): Promise<Domain | undefined> {
	const domains = await listDomains();
	const main = domains?.find(
		(d: Domain) => d.baseDomain === config.pangolin.mainDomain,
	);

	if (!main) {
		console.error(
			`Main domain ${config.pangolin.mainDomain} not found in Pangolin.`,
		);
		return;
	}

	console.log(`Main domain found: ${main.name} (${main.id})`);
	return main;
}

export async function listResources(): Promise<Resource[] | undefined> {
	// @ts-expect-error - OAS paths are broken, using custom types
	const { data, error } = (await client.GET("/org/{orgId}/resources", {
		params: {
			path: {
				orgId: config.pangolin.orgId,
			},
		},
	})) as { data?: ApiResponse<ResourcesResponse>; error?: unknown };

	if (error) {
		console.error("Error fetching Pangolin resources:", error);
		return;
	}

	return data?.data.resources;
}

export interface ICreateResourceParams {
	name: string;
	subdomain: string;
}

export async function createResource({
	name,
	subdomain,
}: ICreateResourceParams): Promise<Resource | undefined> {
	const domain = await fetchMainDomain();

	if (!domain?.domainId) {
		console.error("Cannot create resource without main domain.");
		return;
	}

	// @ts-expect-error - OAS paths are broken, using custom types
	const { data, error } = (await client.PUT("/org/{orgId}/resource", {
		params: {
			path: {
				orgId: config.pangolin.orgId,
			},
		},
		body: {
			name: name,
			subdomain: subdomain,
			http: true,
			domainId: domain.domainId,
			stickySession: true,
			postAuthPath: "/",
			protocol: "tcp",
		},
	})) as { data?: ApiResponse<Resource>; error?: unknown };

	if (error) {
		console.error("Error creating Pangolin resource:", error);
		return;
	}

	console.log(`Resource created `, data?.data);
	return data?.data;
}

export interface ICreateTargetParams {
	resourceId: string;
}

export async function createResourceTarget(
	params: ICreateTargetParams,
): Promise<ResourceTarget | undefined> {
	const mainSite = await getMainSite();

	if (!mainSite) {
		console.error("Cannot create resource target without main site.");
		return;
	}

	const { data, error } = (await client.PUT(
		// @ts-expect-error - OAS paths are broken, using custom types
		"/resource/{resourceId}/target",
		{
			params: {
				path: {
					resourceId: params.resourceId,
				},
			},
			body: {
				siteId: mainSite.siteId,
				port: 443,
				method: "https",
				enabled: true,
				ip: "localhost",
			},
		},
	)) as { data?: ApiResponse<ResourceTarget>; error?: unknown };

	if (error) {
		console.error("Error creating Pangolin resource target:", error);
		return;
	}

	console.log(`Resource target created `, data?.data);

	return data?.data;
}

export async function listSites(): Promise<Site[] | undefined> {
	// @ts-expect-error - OAS paths are broken, using custom types
	const { data, error } = (await client.GET("/org/{orgId}/sites", {
		params: {
			path: {
				orgId: config.pangolin.orgId,
			},
		},
	})) as { data?: ApiResponse<SitesResponse>; error?: unknown };

	if (error) {
		console.error("Error fetching Pangolin sites:", error);
		return;
	}

	console.log(data?.data.sites);

	return data?.data.sites;
}

export async function getMainSite(): Promise<Site | undefined> {
	const sites = await listSites();
	const mainSite = sites?.find(
		(s: Site) => s.name === config.pangolin.mainSiteName,
	);

	if (!mainSite) {
		console.error(
			`Main site ${config.pangolin.mainSiteName} not found in Pangolin.`,
		);
		return;
	}

	console.log(`Main site found: ${mainSite.name} (${mainSite.siteId})`);
	return mainSite;
}
