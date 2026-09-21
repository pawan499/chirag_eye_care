# Chirag Eye Care Backend

A focused REST backend for a single-owner eye-care and spectacle shop. It records patients, permanent visit/examination history, medicines supplied, spectacle orders, manually verified payments, and collection reports. It intentionally includes no patient portal, staff system, inventory, or payment-gateway integration.

## Stack and architecture

Node.js, Express, MongoDB/Mongoose, JWT, bcryptjs, Zod, Helmet, CORS, rate limiting, Morgan, and Swagger UI. The project uses a modular monolith: routes → controllers → services → models.

```
src/
  config/ controllers/ middleware/ models/ routes/ services/ utils/ validators/
  app.js  server.js
seed/  tests/
```

## Install and run

1. Copy `.env.example` to `.env`, set a real MongoDB URI and a randomly generated JWT secret of at least 32 characters.
2. Install dependencies: `npm install`
3. Create development owner/medicine data: `npm run seed`
4. Start development mode: `npm run dev`

The service runs on `http://localhost:4000` by default. `GET /health` reports service availability. Open `http://localhost:4000/api-docs` for Swagger UI when `ENABLE_SWAGGER=true`.

## Authentication

There is no public registration endpoint. Create the single owner via `npm run seed`; its credentials come from `OWNER_EMAIL` and `OWNER_PASSWORD`. Log in using `POST /api/v1/auth/login`, then send `Authorization: Bearer <token>` on all business requests. Login has a strict per-IP rate limit.

## Main endpoints

| Area | Endpoints |
| --- | --- |
| Patients | `POST/GET /api/v1/patients`, `GET/PATCH/DELETE /api/v1/patients/:id`, `GET /:id/details`, `/timeline`, `/payments` |
| Visits | `POST/GET /api/v1/visits`, `GET /api/v1/visits/:id` |
| Medicines | CRUD at `/api/v1/medicines` |
| Spectacles | `POST/GET /api/v1/spectacle-orders`, `PATCH /api/v1/spectacle-orders/:id` |
| Payments | `POST/GET /api/v1/payments` |
| Dashboard/reports | `/api/v1/dashboard/summary`, `/api/v1/reports/collection/{daily,weekly,monthly}`, custom collection range |
| Settings | `GET/PATCH /api/v1/settings` |

List endpoints accept `page` and `limit` (maximum 100). Patient and medicine lists accept `search`; patient search covers public ID, name, and mobile. Collection reports use India (`Asia/Kolkata`) business dates. Custom report syntax: `/api/v1/reports/collection?from=2026-09-01&to=2026-09-30`.

## Business safeguards

- Every visit gets a new `VIS-xxxxxx` ID and is never replaced.
- Patient/order/payment IDs are human-readable (`P-`, `ORD-`, `PAY-`).
- Medicine name and price are stored inside the visit, preserving historical pricing.
- Visit/order totals are calculated on the server. Payments must target a visit or spectacle order and cannot exceed its due amount.
- Payments are recordings only; `UPI` means manually verified. No gateway, QR, webhook, or automatic verification exists.
- Patient and medicine deletion is soft deactivation.

## Quality commands

`npm run lint`, `npm test`, and `npm run test:watch` are available. Tests use a MongoDB in-memory server and never contact production data.

## Deployment and backups

Set `NODE_ENV=production`, use TLS/reverse-proxy termination, restrict `CORS_ORIGIN`, use a strong unique `JWT_SECRET`, and run the process manager of your choice. MongoDB backups must be configured separately: enable provider point-in-time recovery or schedule encrypted `mongodump` backups to off-host storage, periodically test restores, and retain them according to local record-keeping requirements.
