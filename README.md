# EcoSort MVP Backend

Backend for the EcoSort hackathon MVP: waste-segregation photo submissions, AI verification, consistency/streak scoring, rewards, and spot checks.

## Stack
- Node.js + Express
- MongoDB + Mongoose
- JWT authentication
- Multer for image uploads
- AI provider kept behind `src/services/aiVerification.service.js`

## 1. Setup
```bash
npm install
copy .env.example .env
npm run dev
```

For MongoDB Atlas, replace `MONGODB_URI` in `.env` with your Atlas connection string.

## 2. Main API
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/submissions` (multipart/form-data, field: `image`)
- `GET /api/submissions`
- `GET /api/dashboard`
- `GET /api/rewards`
- `POST /api/rewards/:rewardId/redeem`
- `GET /api/spot-checks`
- `POST /api/spot-checks/:id/submit` (multipart/form-data, field: `image`)
- `GET /api/health`

## Spot-check logic in the MVP
1. Random fresh photo check: a configurable probability can create a spot check after a valid submission.
2. Before-collection check: an endpoint/service hook can create a spot check for a configured collection window.
3. AI confidence check: low confidence creates a recheck.
4. Duplicate photo detection: exact image hash reuse creates a spot check.

The MVP intentionally uses an exact SHA-256 duplicate check. A perceptual hash can be added later for resized/cropped/recompressed copies.

## AI
`MOCK_AI=true` lets the whole backend run without an AI API. Replace the mock implementation in `src/services/aiVerification.service.js` with the chosen vision API when ready.
