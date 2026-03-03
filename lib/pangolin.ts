import createClient, { type Middleware } from "openapi-fetch";
import type { paths } from "./pangolin.d";

const pangolinApiBaseUrl = process.env.PANGOLIN_API_BASE_URL;
const apiKey = process.env.PANGOLIN_API_KEY;
const orgId = process.env.PANGOLIN_ORG_ID;
const mainSiteName = process.env.PANGOLIN_MAIN_SITE_NAME;
export const mainDomain = process.env.PANGOLIN_MAIN_DOMAIN;

if (!pangolinApiBaseUrl) {
	console.error("PANGOLIN_API_BASE_URL environment variable is not set.");
	process.exit(1);
}

if (!apiKey) {
	console.error("PANGOLIN_API_KEY environment variable is not set.");
	process.exit(1);
}

if (!orgId) {
	console.error("PANGOLIN_ORG_ID environment variable is not set.");
	process.exit(1);
}

if (!mainSiteName) {
	console.error("PANGOLIN_MAIN_SITE_NAME environment variable is not set.");
	process.exit(1);
}

if (!mainDomain) {
	console.error("PANGOLIN_MAIN_DOMAIN environment variable is not set.");
	process.exit(1);
}

const client = createClient<paths>({
	baseUrl: pangolinApiBaseUrl,
});

const authMiddleware: Middleware = {
	async onRequest({ request }) {
		request.headers.set("Authorization", `Bearer ${apiKey}`);
		return request;
	},
};

client.use(authMiddleware);

export async function listDomains() {
	const { data, error } = await client.GET("/org/{orgId}/domains", {
		params: {
			path: {
				orgId: orgId,
			},
		},
	});

	if (error) {
		console.error("Error fetching Pangolin domains:", error);
		return;
	}
	console.log(data.data.domains);

	return data.data.domains;
}

export async function fetchMainDomain() {
	const domains = await listDomains();
	const main = domains?.find((d) => d.baseDomain === mainDomain);

	if (!main) {
		console.error(`Main domain ${mainDomain} not found in Pangolin.`);
		return;
	}

	console.log(`Main domain found: ${main.name} (${main.id})`);
	return main;
}

export async function listResources() {
	const { data, error } = await client.GET("/org/{orgId}/resources", {
		params: {
			path: {
				orgId: orgId,
			},
		},
	});

	if (error) {
		console.error("Error fetching Pangolin resources:", error);
		return;
	}

	return data.data.resources;
}

export interface ICreateResourceParams {
	name: string;
	subdomain: string;
}

export async function createResource({
	name,
	subdomain,
}: ICreateResourceParams) {
	const domain = await fetchMainDomain();

	if (!domain || !domain.domainId) {
		console.error("Cannot create resource without main domain.");
		return;
	}

	// Format
	// {
	//   "name": "string",
	//   "subdomain": "string",
	//   "http": true,
	//   "protocol": "tcp",
	//   "domainId": "string",
	//   "stickySession": true,
	//   "postAuthPath": "string"
	// }

	const { data, error } = await client.PUT("/org/{orgId}/resource", {
		params: {
			path: {
				orgId: orgId,
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
	});

	if (error) {
		console.error("Error creating Pangolin resource:", error);
		return;
	}

	console.log(`Resource created `, data.data);
	return data.data;
}

export interface ICreateTargetParams {
	resourceId: string;
}

export async function createResourceTarget(params: ICreateTargetParams) {
	// Example target creation, adjust as needed
	// {
	//   "siteId": 1,
	//   "ip": "string",
	//   "method": "string",
	//   "port": 65535,
	//   "enabled": true,
	//   "hcEnabled": true,
	//   "hcPath": "string",
	//   "hcScheme": "string",
	//   "hcMode": "string",
	//   "hcHostname": "string",
	//   "hcPort": 1,
	//   "hcInterval": 6,
	//   "hcUnhealthyInterval": 6,
	//   "hcTimeout": 2,
	//   "hcHeaders": [
	//     {
	//       "name": "string",
	//       "value": "string"
	//     }
	//   ],
	//   "hcFollowRedirects": true,
	//   "hcMethod": "string",
	//   "hcStatus": 0,
	//   "hcTlsServerName": "string",
	//   "path": "string",
	//   "pathMatchType": "exact",
	//   "rewritePath": "string",
	//   "rewritePathType": "exact",
	//   "priority": 1000
	// }

	const mainSite = await getMainSite();

	if (!mainSite) {
		console.error("Cannot create resource target without main site.");
		return;
	}

	const { data, error } = await client.PUT("/resource/{resourceId}/target", {
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
	});

	if (error) {
		console.error("Error creating Pangolin resource target:", error);
		return;
	}

	console.log(`Resource target created `, data.data);

	return data.data;
}

export async function listSites() {
	const { data, error } = await client.GET("/org/{orgId}/sites", {
		params: {
			path: {
				orgId: orgId,
			},
		},
	});

	if (error) {
		console.error("Error fetching Pangolin sites:", error);
		return;
	}

	console.log(data.data.sites);

	return data.data.sites;
}

export async function getMainSite() {
	const sites = await listSites();
	const mainSite = sites?.find((s) => s.name === mainSiteName);

	if (!mainSite) {
		console.error(`Main site ${mainSiteName} not found in Pangolin.`);
		return;
	}

	console.log(`Main site found: ${mainSite.name} (${mainSite.siteId})`);
	return mainSite;
}
