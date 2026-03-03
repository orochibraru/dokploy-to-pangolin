# Dokploy Hook Pangolin

A webhook service that automatically registers new Dokploy applications with Pangolin VPN, creating resources and targets for seamless integration.

## Overview

This service acts as a bridge between [Dokploy](https://dokploy.com/) (deployment platform) and [Pangolin VPN](https://pangolin.net/) (VPN/tunneling service). When Dokploy deploys a new application, it sends a webhook to this service, which automatically:

1. Receives build notifications from Dokploy
2. Checks if the domain already exists in Pangolin
3. Creates a new Pangolin resource if needed
4. Configures a resource target pointing to your main site
5. Enables automatic routing through Pangolin VPN

## Architecture

```
┌──────────┐         ┌─────────────────┐         ┌──────────┐
│ Dokploy  │────────▶│  This Service   │────────▶│ Pangolin │
│          │ Webhook │                 │   API   │   VPN    │
└──────────┘         └─────────────────┘         └──────────┘
                            │
                            │ Validates
                            ▼
                     ┌──────────────┐
                     │   Config     │
                     │ Environment  │
                     └──────────────┘
```

## Features

- Automatic resource creation in Pangolin when new domains are deployed
- Intelligent domain matching to avoid duplicates
- Webhook authentication with secret token
- Comprehensive error handling and logging
- Graceful shutdown handling (SIGINT/SIGTERM)
- Full TypeScript support with custom types
- 90%+ test coverage
- Docker & Docker Compose support
- Built with Bun & Hono for performance

## Prerequisites

- A Pangolin account or self-hosted instance with API access
- A Dokploy instance
- Docker

## Deployment

**IMPORTANT:** This service must be accessible by Dokploy to receive webhooks. You can deploy it through Dokploy & Pangolin with no issues, but if you want to run it separately, ensure it's reachable at the configured URL.

### With Docker Run

```bash
docker run -p 3000:3000 \
  -e WEBHOOK_SECRET=your-secret \
  -e PANGOLIN_API_KEY=your-key \
  -e PANGOLIN_ORG_ID=your-org \
  -e PANGOLIN_MAIN_SITE_NAME=your-site \
  -e PANGOLIN_MAIN_DOMAIN=example.com \
  -e PANGOLIN_API_BASE_URL=https://api.pangolin.com \
  orochibraru/dokploy-hook-pangolin
```

### With Docker Compose

1. Create a `compose.yml` file:

```yaml
services:
    hook:
        image: orochibraru/dokploy-hook-pangolin:latest
        ports:
            - "3000:3000"
        environment:
            - PORT=3000
            - WEBHOOK_SECRET=${WEBHOOK_SECRET}
            - PANGOLIN_API_KEY=${PANGOLIN_API_KEY}
            - PANGOLIN_ORG_ID=${PANGOLIN_ORG_ID}
            - PANGOLIN_MAIN_SITE_NAME=${PANGOLIN_MAIN_SITE_NAME}
            - PANGOLIN_MAIN_DOMAIN=${PANGOLIN_MAIN_DOMAIN}
            - PANGOLIN_API_BASE_URL=${PANGOLIN_API_BASE_URL}
```

## Configuration

Configure the following environment variables in your `.env` file:

| Variable                  | Description                             | Example                    |
| ------------------------- | --------------------------------------- | -------------------------- |
| `PANGOLIN_API_KEY`        | Your Pangolin API key                   | `pk_live_abc123...`        |
| `PANGOLIN_ORG_ID`         | Your Pangolin organization ID           | `org_xyz789`               |
| `PANGOLIN_MAIN_SITE_NAME` | Name of your main Pangolin site         | `production-site`          |
| `PANGOLIN_MAIN_DOMAIN`    | Your base domain                        | `example.com`              |
| `PANGOLIN_API_BASE_URL`   | Pangolin API base URL                   | `https://api.pangolin.com` |
| `WEBHOOK_SECRET`          | Secret token for webhook authentication | `your-secure-secret-here`  |
| `PORT`                    | Server port (optional, default: 3000)   | `3000`                     |

### Getting Pangolin Credentials

1. If self-hosting, ensure the [API integration](https://docs.pangolin.net/self-host/advanced/integration-api) is setup correctly
2. Log in to your Pangolin dashboard
3. Navigate to API settings
4. Generate a new API key
5. Note your organization ID from the URL or settings

## API Endpoints

### `GET /`

Health check endpoint

**Response:**

```
OK
```

### `POST /webhook`

Webhook endpoint for Dokploy events

**Headers:**

- `x-webhook-secret`: Must match `WEBHOOK_SECRET` environment variable

**Request Body:**

```json
{
    "title": "Build Success",
    "message": "Application deployed successfully",
    "timestamp": "2026-03-03T12:00:00Z",
    "type": "build",
    "status": "success",
    "projectName": "my-app",
    "domains": "my-app.example.com"
}
```

**Response:**

- `200 OK`: Webhook processed successfully
- `401 Unauthorized`: Invalid webhook secret
- `500 Internal Server Error`: Processing error

## How It Works

### Workflow

1. **Dokploy Deploy Event**
    - User deploys an application in Dokploy
    - Dokploy sends a webhook to `/webhook` endpoint

2. **Webhook Validation**
    - Service validates the webhook secret
    - Checks if the event type is `build`
    - Verifies build status is not `error`

3. **Domain Check**
    - Fetches existing Pangolin resources
    - Checks if domain already exists

4. **Resource Creation** (if needed)
    - Extracts subdomain from full domain
    - Creates a new Pangolin resource
    - Configures HTTP routing and sticky sessions

5. **Target Setup**
    - Creates a resource target pointing to main site
    - Configures HTTPS on port 443
    - Enables the target

### Example Flow

```
1. Deploy "api-service" with domain "api.example.com"
   ↓
2. Webhook received with domains: "api.example.com"
   ↓
3. Check Pangolin resources
   ↓
4. No match found → Create new resource
   - Name: "api-service"
   - Subdomain: "api"
   - Domain: "example.com"
   ↓
5. Create resource target
   - Site: main-site
   - Port: 443
   - Method: HTTPS
   ↓
6. ✅ "api.example.com" now routes through Pangolin
```

## Troubleshooting

### Common Issues

**"Unauthorized webhook attempt detected"**

- Ensure `WEBHOOK_SECRET` matches in both Dokploy and this service
- Check the `x-webhook-secret` header is being sent

**"Cannot create resource without main domain"**

- Verify `PANGOLIN_MAIN_DOMAIN` is correctly set
- Ensure the domain exists in your Pangolin account

**"No subdomain extracted from event domains"**

- Domain format should be: `subdomain.maindomain.com`
- Ensure domains match the configured `PANGOLIN_MAIN_DOMAIN`

**Type errors about "never" types**

- This is expected - the Pangolin OpenAPI spec is poorly defined
- We use custom types in `src/lib/types.ts` with `@ts-expect-error` comments

## Configuring Dokploy

1. In your Dokploy project settings, navigate to Webhooks
2. Add a new webhook:
    - **URL**: `http://your-service-url:3000/webhook`
    - **Secret**: Your configured `WEBHOOK_SECRET`
    - **Events**: Select "Build" events
3. Save and deploy your application
4. Check the logs to verify webhook processing

## Security Considerations

- Store sensitive credentials in environment variables, never commit them
- Use a strong, random `WEBHOOK_SECRET` (`openssl rand -hex 32` for example)
- Consider using HTTPS in production (reverse proxy recommended)
- Rotate API keys periodically
- Limit network access to webhook endpoint if possible

## Development

### Getting started

1. Clone the repository:

```bash
git clone https://github.com/orochibraru/dokploy-to-pangolin.git
cd dokploy-hook-pangolin
```

2. Install dependencies:

```bash
bun install
```

3. Copy the example environment file:

```bash
cp .example.env .env
```

4. Configure your environment variables (see [Configuration](#configuration))

5. Start the development server:

```bash
bun run dev
```

### Available Scripts

```bash
# Start development server with auto-reload
bun run dev

# Build production bundle
bun run build

# Start production server
bun run start

# Run tests
bun test

# Run tests in watch mode
bun run test:watch

# Lint and format code
bun run lint

# Auto-fix linting issues
bun run lint:fix

# Type check
bun run check

# Generate Pangolin API types (from OpenAPI spec)
bun run gen:api
```

## Testing

The project has comprehensive test coverage (98.93%):

```bash
# Run all tests
bun test

# Run tests with coverage
bun test --coverage
```

### Tech Stack

- **Runtime**: [Bun](https://bun.sh/) - Fast JavaScript runtime
- **Framework**: [Hono](https://hono.dev/) - Lightweight web framework
- **API Client**: [openapi-fetch](https://github.com/drwpow/openapi-typescript) - Type-safe API client
- **Linter**: [Biome](https://biomejs.dev/) - Fast linter and formatter
- **Testing**: Bun's built-in test runner
- **Container**: Docker with Alpine Linux

### A note on AI generated code

Some code in this project was generated with the help of AI tools. This only concerns tests and markdown (which is already bad enough). The core logic and implementation **were written by hand**.
Please follow this pattern when contributing to ensure code quality and consistency, to ensure we don't mutually destroy our Homelabs ❤️

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Run tests: `bun test`
5. Run linter: `bun run lint:fix`
6. Commit your changes: `git commit -m 'Add amazing feature'`
7. Push to the branch: `git push origin feature/amazing-feature`
8. Open a Pull Request

## Support

For issues or questions:

- Open an issue on GitHub
- Check the troubleshooting section
- Review Pangolin API documentation

---

Built with ❤️ using Bun and TypeScript
