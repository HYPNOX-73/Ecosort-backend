import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { auth } from '../middleware/auth.js';
import { listSpotChecks, submitSpotCheck, createBeforeCollection } from '../controllers/spotCheck.controller.js';

const dir = process.env.UPLOAD_DIR || 'uploads';
fs.mkdirSync(dir, { recursive: true });
const storage = multer.diskStorage({ destination: (_req, _file, cb) => cb(null, dir), filename: (_req, file, cb) => cb(null, `spot-${Date.now()}${path.extname(file.originalname)}`) });
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });
const router = Router();
router.get('/', auth, listSpotChecks);
router.post('/:id/submit', auth, upload.single('image'), submitSpotCheck);
router.post('/before-collection', auth, createBeforeCollection);
export default router;
