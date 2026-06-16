# TechFusion AI

Unified SaaS platform for IT technicians and cybersecurity teams.

## Monorepo Layout

```
techfusion-ai/
├── apps/
│   ├── web/              # Next.js 14+ (App Router) - Frontend
│   ├── api-gateway/      # NestJS - API Gateway
│   ├── agent/            # Rust - Telemetry Agent
│   └── worker/           # Node.js - Background Worker (BullMQ/Redis)
├── packages/
│   ├── ui/               # Shared UI components
│   ├── types/            # Shared TypeScript types
│   ├── config/           # Shared configuration
│   └── utils/            # Shared utilities
├── infra/
│   ├── docker/           # Docker Compose for local development
│   └── k8s/              # Kubernetes manifests (Phase 14+)
└── .github/workflows/    # CI pipeline
```

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm 9+
- Docker & Docker Compose
- Rust (optional, for agent development)

### Local Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run all services with Docker Compose
docker-compose -f infra/docker/docker-compose.yml up --build
```

### Services

| Service       | Port | Description                  |
|---------------|------|------------------------------|
| Web           | 3000 | Next.js frontend             |
| API Gateway   | 3001 | NestJS API gateway           |
| Postgres      | 5432 | TimescaleDB                  |
| Redis         | 6379 | Queue & caching              |

### Health Check

```bash
curl http://localhost:3001/health
# {"status":"ok"}
```
