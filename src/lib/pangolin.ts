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

/**
 * The API defaults to a page size of 20, so an unparameterised call silently
 * hides every resource past the first page - which made the hook re-create
 * resources it already had. Always walk the whole collection.
 */
export async function listResources(): Promise<Resource[] | undefined> {
	const pageSize = 500;
	const resources: Resource[] = [];

	for (let page = 1; ; page++) {
		// @ts-expect-error - OAS paths are broken, using custom types
		const { data, error } = (await client.GET("/org/{orgId}/resources", {
			params: {
				path: {
					orgId: config.pangolin.orgId,
				},
				query: {
					page,
					pageSize,
				},
			},
		})) as { data?: ApiResponse<ResourcesResponse>; error?: unknown };

		if (error) {
			console.error("Error fetching Pangolin resources:", error);
			return;
		}

		const batch = data?.data.resources;

		if (!batch) {
			return page === 1 ? undefined : resources;
		}

		resources.push(...batch);

		const total = data?.data.pagination?.total;
		const done =
			batch.length === 0 ||
			batch.length < pageSize ||
			(total !== undefined && resources.length >= total);

		if (done) {
			return resources;
		}
	}
}

export async function deleteResource(
	resourceId: string | number,
): Promise<boolean> {
	// @ts-expect-error - OAS paths are broken, using custom types
	const { error } = await client.DELETE("/resource/{resourceId}", {
		params: {
			path: {
				resourceId: String(resourceId),
			},
		},
	});

	if (error) {
		console.error(`Error deleting Pangolin resource ${resourceId}:`, error);
		return false;
	}

	return true;
}

export async function renameResource(
	resourceId: string | number,
	name: string,
): Promise<boolean> {
	// @ts-expect-error - OAS paths are broken, using custom types
	const { error } = await client.POST("/resource/{resourceId}", {
		params: {
			path: {
				resourceId: String(resourceId),
			},
		},
		body: { name },
	});

	if (error) {
		console.error(`Error renaming Pangolin resource ${resourceId}:`, error);
		return false;
	}

	return true;
}

export interface ICreateResourceParams {
	name: string;
	subdomain: string | null;
	domainId: string;
}

export async function createResource({
	name,
	subdomain,
	domainId,
}: ICreateResourceParams): Promise<Resource | undefined> {
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
			domainId: domainId,
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
