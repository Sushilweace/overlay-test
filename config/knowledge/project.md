# Deep Project Knowledge: WeAce Platform (we-ace-new)

## 1. Request Lifecycle & Microservices Communication
- Only the NestJS API Gateway (port 3000) exposes public HTTP endpoints.
- All downstream backend services (Auth, User, Coaching, Training, Engagement, Notifications) are headless TCP microservices isolated from direct internet access.
- Request Flow Example (`POST /coaching/cohort`):
  1. Gateway Ingress: Client hits `CohortController`.
  2. Authentication: `JwtAuthGuard` extracts Bearer token and verifies via TCP `authClient.send('auth.verifyToken', { token })`.
  3. Authorization (RBAC/URBAC): `@Permissions('coaching.cohort:create')` decorator triggers `PermissionsGuard`, verifying permissions against `user-service` via TCP (`user.getUserPermissions`).
  4. Payload Routing: Gateway delegates to `coachingClient.send('cohort.create', payload)`.
  5. Execution & Persistence: Coaching service `@MessagePattern('cohort.create')` persists the cohort via TypeORM in MySQL (`weace_coaching`).
  6. Response: Wrapped by `TransformResponseInterceptor` to return standard JSON.

## 2. Transparent JWT Auto-Refresh Architecture
- Eliminates abrupt 401 disconnects during active user sessions.
- Client passes `Authorization: Bearer <accessToken>` and `x-refresh-token: <refreshToken>`.
- If the access token is expired, `JwtAuthGuard` intercepts the error, calls `auth.refreshToken` via TCP to fetch a fresh access token from AWS Cognito, updates request headers on the fly, and resumes the protected request seamlessly.
- Returns the refreshed token in response headers for the frontend to store.

## 3. Granular Dynamic RBAC & URBAC (User Role Based Access Control)
- Slugs formatted as `<module>.<submodule>:<action>` (e.g., `coaching.cohort:create`, `users:edit`).
- Roles: Super Admin, Corporate Super Admin (all org cohorts), Corporate Admin (assigned cohorts only via URBAC), Coach, Mentee/Coachee, Employee.
- Role-to-permission mappings stored in MongoDB (`user-service`), allowing runtime permission updates without redeploying microservices.

## 4. Bulk Data Ingestion & Async Processing
- Solved 504 Gateway Timeouts and DB pool exhaustion when importing 2,000–3,000 mentees at once.
- Architecture:
  - If payload < 50 items: processes synchronously.
  - If payload >= 50 items: triggers `POST /coaching/cohort/:id/mentees/bulk/async`, creates a job in MongoDB, and immediately returns HTTP 202 Accepted with a `jobId`.
  - Background worker chunks the batch into 50-item sets, handles validation, and updates job completion metrics.

## 5. Technology Stack Summary
- Languages: TypeScript, JavaScript (Node.js 20+), PHP (Laravel 10/11)
- Frameworks: NestJS (Microservices, ClientProxy, TCP), Laravel (REST, Eloquent, Queues)
- Databases: MySQL (TypeORM/Eloquent for relational integrity), MongoDB (Flexible schemas, jobs), Redis (Caching & Rate Limiting)
- Cloud & Services: AWS Cognito, AWS S3, Pusher (Live Chat), Razorpay (Payments), Docker & Docker Compose
