import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from './config/db.js';
import authRoutes from './routes/auth.routes.js';
import submissionRoutes from './routes/submission.routes.js';
import separationRoutes from "./routes/separation.routes.js";
import spotCheckRoutes from './routes/spotCheck.routes.js';
import rewardRoutes from './routes/reward.routes.js';
import { auth } from './middleware/auth.js';
import { dashboard } from './controllers/dashboard.controller.js';

const app = express();
const PORT = process.env.PORT || 5000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174"
    ],
    credentials: true
  })
);
app.use(express.json());
app.use('/uploads', express.static(path.resolve(process.env.UPLOAD_DIR || 'uploads')));

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'EcoSort API' }));
app.use('/api/auth', authRoutes);
app.use('/api/submissions', submissionRoutes);
app.use("/api/separations", separationRoutes);
app.use('/api/spot-checks', spotCheckRoutes);
app.use('/api/rewards', rewardRoutes);
app.get('/api/dashboard', auth, dashboard);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: err.message || 'Internal server error' });
});

connectDB().then(() => {
  app.listen(PORT, () => console.log(`EcoSort API running on http://localhost:${PORT}`));
}).catch(err => {
  console.error('Startup failed:', err.message);
  process.exit(1);
});
