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
	// null for non-http resources (raw TCP/UDP), which are keyed by proxyPort
	fullDomain: string | null;
	resourceId: string | number;
	niceId?: string;
	enabled?: boolean;
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

export interface Pagination {
	total: number;
	pageSize: number;
	page: number;
}

export interface DomainsResponse {
	domains: Domain[];
}

export interface ResourcesResponse {
	resources: Resource[];
	pagination?: Pagination;
}

export interface SitesResponse {
	sites: Site[];
}
