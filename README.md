# REST API Showcase

A clean, production-style REST API built with **Bun + Elysia + TypeScript**, demonstrating real-world patterns without any domain-specific coupling.

## Tech Stack

| Layer | Tool |
|---|---|
| Runtime | [Bun](https://bun.sh) |
| Framework | [Elysia.js](https://elysiajs.com) |
| Database | PostgreSQL via [Prisma](https://www.prisma.io) |
| Cache | Redis (sorted-set pagination + hash cache) |
| Messaging | Apache Kafka (KafkaJS) |
| Auth | JWT HS256 (`jsonwebtoken`) |
| Docs | Scalar / Swagger (`@elysiajs/swagger`) |
| Language | TypeScript (strict mode) |

## Project Structure

```
src/
├── index.ts                  # App entry — Elysia setup, global error handler
├── libs/
│   ├── prisma.ts             # Prisma client singleton
│   └── redis.ts              # Redis client + task cache helpers
├── middlewares/
│   └── auth.ts               # JWT verify (derive) + signToken
├── modules/
│   ├── auth/
│   │   ├── handler.ts        # register / login / me
│   │   └── route.ts          # POST /auth/register, /auth/login, GET /auth/me
│   └── tasks/
│       ├── handler.ts        # CRUD handlers with Redis cache-aside pattern
│       └── route.ts          # GET/POST/PATCH/DELETE /tasks
└── utils/
    ├── response.ts           # successResponse / errorResponse / Elysia schemas
    ├── kafka_producer.ts     # KafkaProducer class — publishes task-events
    └── kafka_consumer.ts     # KafkaConsumer class — syncs cache from events
```

## Key Patterns

### Cache-Aside (Redis)
Task reads check Redis first (O(1) hash lookup). On a cache miss the handler queries PostgreSQL, then warms the cache. Writes invalidate and re-populate the cache entry. A sorted set keyed by `createdAt` timestamp enables server-side pagination without hitting the database on repeated list requests.

### Kafka Event Streaming
Every create / update / delete publishes a typed domain event (`task.created`, `task.updated`, `task.deleted`) to the `task-events` topic. The consumer subscribes to the same topic and keeps Redis in sync — this decouples cache invalidation from the request path and demonstrates an event-driven pattern.

### JWT Authentication
`verifyToken` is an Elysia `derive` plugin. It extracts `userId` and `email` from the Bearer token and injects them into the handler context. Any route group that calls `.use(verifyToken)` is automatically protected.

### Consistent API Responses
All endpoints return the same shape:
```json
{ "success": true | false, "message": "...", "data": <payload> | null }
```
Elysia response schemas in each route enforce this at the framework level and power the Swagger/Scalar docs.

## Prerequisites

- **Bun** >= 1.0 — [install](https://bun.sh/docs/installation)
- **PostgreSQL** running locally (or via Docker)
- **Redis** running locally (or via Docker)
- **Kafka** (optional — the API works without it; producers/consumers log errors gracefully)

### Quick infrastructure with Docker

```bash
docker run -d --name postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16
docker run -d --name redis -p 6379:6379 redis:7
```

For Kafka you can use the [Bitnami Kafka Docker image](https://hub.docker.com/r/bitnami/kafka) or any local broker.

## Setup

```bash
# 1. Clone and install dependencies
git clone <repo-url> rest-api-showcase
cd rest-api-showcase
bun install

# 2. Configure environment
cp .env.example .env
# Edit .env — at minimum set DATABASE_URL and JWT_SECRET

# 3. Generate Prisma client and run migrations
bun run db:generate
bun run db:migrate   # creates tables

# 4. Start the dev server (hot-reload)
bun run dev
```

The server listens on `http://localhost:3000` by default.

## API Reference

Interactive docs are served at **`http://localhost:3000/docs`** (Scalar UI).

### Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | — | Register a new user, returns JWT |
| POST | `/api/auth/login` | — | Login, returns JWT |
| GET | `/api/auth/me` | Bearer | Get current user profile |

### Tasks

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/tasks` | Bearer | List tasks (paginated, Redis-cached) |
| POST | `/api/tasks` | Bearer | Create a task |
| GET | `/api/tasks/:id` | Bearer | Get a single task |
| PATCH | `/api/tasks/:id` | Bearer | Update a task |
| DELETE | `/api/tasks/:id` | Bearer | Delete a task |

#### Query Parameters — `GET /api/tasks`

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | string | `"1"` | Page number |
| `size` | string | `"20"` | Page size (max 100) |
| `status` | `TODO \| IN_PROGRESS \| DONE` | — | Filter by status |

### Example — Register then create a task

```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@example.com","password":"password123"}'

# Copy the token from the response, then:
TOKEN="<your-jwt>"

# Create a task
curl -X POST http://localhost:3000/api/tasks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Write unit tests","status":"TODO","dueDate":"2026-05-01T00:00:00Z"}'

# List tasks
curl http://localhost:3000/api/tasks \
  -H "Authorization: Bearer $TOKEN"
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default `3000`) |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Secret for HS256 JWT signing |
| `REDIS_HOST` | No | Redis hostname (default `localhost`) |
| `KAFKA_HOST` | No | Kafka broker hostname (default `localhost`) |
