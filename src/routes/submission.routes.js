import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { auth } from '../middleware/auth.js';
import { createSubmission, listSubmissions } from '../controllers/submission.controller.js';

const dir = process.env.UPLOAD_DIR || 'uploads';
fs.mkdirSync(dir, { recursive: true });
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, dir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith('image/')) });

const router = Router();
router.post('/', auth, upload.single('image'), createSubmission);
router.get('/', auth, listSubmissions);
export default router;
