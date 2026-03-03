import {
  createResource,
  createResourceTarget,
  listResources,
  mainDomain,
} from "./pangolin";

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

export async function handleWebhook(event: DokployEvent): Promise<Result> {
  if (event.type && event.type === "build") {
    console.log(
      `Build event received for project: ${event.projectName}`,
      event,
    );

    if (event.status === "error") {
      console.error(`Build error for project: ${event.projectName}`, event);
      return {
        success: false,
        message: `Build error for project: ${event.projectName}`,
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

    const resources = await listResources();
    const match = resources?.find((res) => event.domains === res.fullDomain);

    if (match) {
      console.log(
        `Matching resource found in Pangolin: ${match.name} (${match.fullDomain})`,
      );
    } else {
      console.warn(
        "No matching resource found in Pangolin for the provided domains.",
      );

      const domain = event.domains as string;

      const extractedSubdomain = domain.replace(`.${mainDomain}`, "").trim();
      if (!extractedSubdomain) {
        console.error(
          "No subdomain could be extracted from the event domains.",
        );
        return {
          success: false,
          message: "No subdomain extracted from event domains",
        };
      }

      const createdResource = await createResource({
        name: event.projectName || `project-${Date.now()}`,
        subdomain: extractedSubdomain,
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
  } else {
    console.log("Webhook payload received:", event);
  }

  return {
    success: true,
    message: "Webhook processed successfully",
  };
}
