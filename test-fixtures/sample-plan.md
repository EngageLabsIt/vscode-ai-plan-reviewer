# Implementation Plan: Task Management REST API

A comprehensive plan to build a task management API with authentication, persistence, and real-time updates.

## Step 1: Project Setup and Dependencies

Initialize the Node.js project with TypeScript and install all required dependencies.

```bash
npm init -y
npm install express typescript ts-node @types/express
npm install --save-dev nodemon eslint prettier
```

Configure `tsconfig.json` with strict mode:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "outDir": "./dist"
  }
}
```

## Step 2: Database Schema Design

Design the PostgreSQL schema for users, tasks, and labels.

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  priority INTEGER NOT NULL DEFAULT 0,
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1'
);

CREATE TABLE task_labels (
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  label_id UUID REFERENCES labels(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, label_id)
);

CREATE INDEX idx_tasks_user ON tasks(user_id, status);
CREATE INDEX idx_tasks_due ON tasks(due_date) WHERE due_date IS NOT NULL;
```

## Step 3: Authentication Layer

Implement JWT-based authentication with refresh tokens.

```typescript
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

export interface TokenPayload {
  userId: string;
  email: string;
}

export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '15m' });
}

export function generateRefreshToken(userId: string): string {
  return jwt.sign({ userId }, process.env.REFRESH_SECRET!, { expiresIn: '7d' });
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

## Step 4: Express Router Structure

Organize routes by domain using Express Router.

```
src/
├── routes/
│   ├── auth.ts        # POST /auth/register, POST /auth/login, POST /auth/refresh
│   ├── tasks.ts       # CRUD /tasks, PATCH /tasks/:id/status
│   └── labels.ts      # CRUD /labels
├── middleware/
│   ├── authenticate.ts  # JWT validation middleware
│   └── validate.ts      # Request body validation with zod
├── services/
│   ├── AuthService.ts
│   ├── TaskService.ts
│   └── LabelService.ts
└── db/
    ├── pool.ts          # pg Pool singleton
    └── queries/         # SQL query functions
```

## Step 5: Task CRUD Endpoints

Implement the full task management API.

Key endpoints:
- `GET /tasks` — list tasks with filtering (status, priority, label, due_date range)
- `POST /tasks` — create task, returns 201 with Location header
- `GET /tasks/:id` — get single task with labels
- `PATCH /tasks/:id` — partial update (title, description, priority, due_date)
- `PATCH /tasks/:id/status` — dedicated status transition endpoint
- `DELETE /tasks/:id` — soft delete (set status to 'deleted')

```typescript
// PATCH /tasks/:id/status
router.patch('/:id/status', authenticate, async (req, res) => {
  const { status } = req.body as { status: string };
  const VALID = ['todo', 'in_progress', 'done'] as const;

  if (!VALID.includes(status as typeof VALID[number])) {
    return res.status(400).json({ error: 'Invalid status value' });
  }

  const task = await taskService.updateStatus(req.params.id, req.user.id, status);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  res.json(task);
});
```

## Step 6: Real-time Updates with WebSockets

Add Socket.IO for real-time task updates across connected clients.

```typescript
import { Server } from 'socket.io';

export function setupSocketIO(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: { origin: process.env.CLIENT_URL, credentials: true },
  });

  io.use(socketAuthMiddleware);

  io.on('connection', (socket) => {
    const userId = socket.data.userId as string;
    void socket.join(`user:${userId}`);

    socket.on('disconnect', () => {
      console.log(`User ${userId} disconnected`);
    });
  });

  return io;
}

// Emit from task service after update:
io.to(`user:${userId}`).emit('task:updated', { task });
```

## Step 7: Input Validation with Zod

Define schemas for all request bodies.

```typescript
import { z } from 'zod';

export const createTaskSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  priority: z.number().int().min(0).max(5).default(0),
  due_date: z.string().datetime().optional(),
  label_ids: z.array(z.string().uuid()).default([]),
});

export const updateTaskSchema = createTaskSchema.partial().omit({ label_ids: true });
```

## Step 8: Error Handling and Logging

Centralized error handling middleware and structured logging with Pino.

```typescript
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport:
    process.env.NODE_ENV === 'development'
      ? { target: 'pino-pretty' }
      : undefined,
});

// Error middleware (must have 4 params for Express to recognize as error handler)
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.error({ err, path: req.path, method: req.method }, 'Unhandled error');

  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Validation failed', details: err.errors });
    return;
  }

  res.status(500).json({ error: 'Internal server error' });
}
```

## Step 9: Testing Strategy

Unit tests for services, integration tests for routes using supertest.

```typescript
import request from 'supertest';
import { app } from '../src/app';
import { pool } from '../src/db/pool';

describe('POST /tasks', () => {
  let authToken: string;

  beforeAll(async () => {
    // Create test user and get token
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });
    authToken = res.body.accessToken as string;
  });

  afterAll(() => pool.end());

  it('creates a task and returns 201', async () => {
    const res = await request(app)
      .post('/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 'Write tests', priority: 2 });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ title: 'Write tests', priority: 2 });
    expect(res.headers.location).toMatch(/^\/tasks\//);
  });
});
```

## Step 10: Docker and Deployment

Containerize the application for production deployment.

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
USER node
CMD ["node", "dist/index.js"]
```

`docker-compose.yml` for local development:

```yaml
version: '3.9'
services:
  api:
    build: .
    ports: ['3000:3000']
    environment:
      DATABASE_URL: postgres://postgres:password@db:5432/tasks
      JWT_SECRET: dev-secret-change-in-prod
    depends_on: [db]
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: password
      POSTGRES_DB: tasks
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:
```

## Step 11: CI/CD Pipeline with GitHub Actions

Automate testing and deployment on every push to main.

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: password
          POSTGRES_DB: tasks_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run build
```

## Step 12: Performance Optimization

Implement caching and query optimization for production load.

**Caching strategy:**
- Redis cache for frequently read tasks (TTL: 5 minutes)
- Cache invalidation on write operations
- HTTP ETag headers for conditional requests

**Query optimization:**
- Use cursor-based pagination instead of OFFSET
- Partial index on `status` for active tasks
- Connection pooling with `pg-pool` (max: 20 connections)

**Rate limiting:**
```typescript
import rateLimit from 'express-rate-limit';

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
```

## Step 13: Security Hardening

Apply security best practices before going to production.

Checklist:
- **Helmet.js** — sets secure HTTP headers
- **CORS** configured for specific origins only
- **SQL injection** prevention via parameterized queries (no string interpolation)
- **Password hashing** with bcrypt (cost factor 12)
- **JWT secrets** rotated via environment variables (never hardcoded)
- **Input validation** on all endpoints with Zod
- **Rate limiting** on auth endpoints (10 req/15 min)
- **Dependency audit** via `npm audit` in CI pipeline

## Step 14: API Documentation with OpenAPI

Generate interactive documentation with Swagger UI.

```typescript
import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: { title: 'Task API', version: '1.0.0' },
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
  },
  apis: ['./src/routes/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
```

## Step 15: Monitoring and Observability

Set up metrics, tracing, and alerting for production visibility.

- **Metrics**: Prometheus + Grafana dashboard for request rate, latency p50/p95/p99, error rate
- **Tracing**: OpenTelemetry with Jaeger for distributed traces
- **Alerting**: PagerDuty integration for error rate > 1% or p95 latency > 500ms
- **Health check**: `GET /health` endpoint reporting DB connection status and uptime
