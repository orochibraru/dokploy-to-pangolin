// Custom types for Pangolin API - defined manually since the OAS is broken

export interface Domain {
	domainId: string;
	baseDomain: string;
	verified: boolean;
	type: string;
	failed: boolean;
	tries: number;
	configManaged: boolean;
	certResolver: string | null;
	preferWildcardCert: boolean;
}

export interface Resource {
	name: string;
	fullDomain: string;
	resourceId: string;
}

export interface Site {
	name: string;
	siteId: string;
}

export interface ResourceTarget {
	targetId: string;
	resourceId: string;
	siteId: string;
	port: number;
	method: string;
	enabled: boolean;
	ip: string;
}

// API Response wrappers
export interface ApiResponse<T> {
	data: T;
}

export interface DomainsResponse {
	domains: Domain[];
}

export interface ResourcesResponse {
	resources: Resource[];
}

export interface SitesResponse {
	sites: Site[];
}
