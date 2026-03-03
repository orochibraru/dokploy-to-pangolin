export const config = {
	pangolin: {
		apiBaseUrl: process.env.PANGOLIN_API_BASE_URL as string,
		apiKey: process.env.PANGOLIN_API_KEY as string,
		orgId: process.env.PANGOLIN_ORG_ID as string,
		mainSiteName: process.env.PANGOLIN_MAIN_SITE_NAME as string,
		mainDomain: process.env.PANGOLIN_MAIN_DOMAIN as string,
	},
	webhookSecret: process.env.WEBHOOK_SECRET as string,
};

export function validateConfig() {
	const { pangolin, webhookSecret } = config;

	if (!pangolin.apiBaseUrl) {
		console.error("PANGOLIN_API_BASE_URL environment variable is not set.");
		process.exit(1);
	}

	if (!pangolin.apiKey) {
		console.error("PANGOLIN_API_KEY environment variable is not set.");
		process.exit(1);
	}

	if (!pangolin.orgId) {
		console.error("PANGOLIN_ORG_ID environment variable is not set.");
		process.exit(1);
	}

	if (!pangolin.mainSiteName) {
		console.error("PANGOLIN_MAIN_SITE_NAME environment variable is not set.");
		process.exit(1);
	}

	if (!pangolin.mainDomain) {
		console.error("PANGOLIN_MAIN_DOMAIN environment variable is not set.");
		process.exit(1);
	}

	if (!webhookSecret) {
		console.error("WEBHOOK_SECRET environment variable is not set.");
		process.exit(1);
	}
}
