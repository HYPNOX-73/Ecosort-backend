import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";

import { auth } from "../middleware/auth.js";
import { verifySeparation } from "../services/separationVerification.service.js";

const router = Router();

const dir = process.env.UPLOAD_DIR || "uploads";

fs.mkdirSync(dir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, dir);
  },

  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname);

    const filename =
      `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;

    cb(null, filename);
  }
});

const upload = multer({
  storage,

  limits: {
    fileSize: 5 * 1024 * 1024
  },

  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed."));
    }
  }
});


router.post(
  "/",
  auth,
  upload.fields([
    {
      name: "beforeImage",
      maxCount: 1
    },
    {
      name: "afterImage",
      maxCount: 1
    }
  ]),

  async (req, res) => {
    try {

      const beforeFile =
        req.files?.beforeImage?.[0];

      const afterFile =
        req.files?.afterImage?.[0];


      if (!beforeFile) {
        return res.status(400).json({
          message: "Before-separation photo is required."
        });
      }


      if (!afterFile) {
        return res.status(400).json({
          message: "After-separation photo is required."
        });
      }


      console.log(
        "Starting EcoSort before/after verification..."
      );


      const result =
        await verifySeparation({
          beforeFilePath: beforeFile.path,
          afterFilePath: afterFile.path
        });


      return res.status(200).json({
        success: true,

        result: {
          beforeWasteDetected:
            result.beforeWasteDetected,

          afterWasteDetected:
            result.afterWasteDetected,

          beforeItems:
            result.beforeItems,

          afterItems:
            result.afterItems,

          matchingItems:
            result.matchingItems,

          missingItems:
            result.missingItems,

          sameWasteLikely:
            result.sameWasteLikely,

          separationDetected:
            result.separationDetected,

          suspicious:
            result.suspicious,

          confidence:
            result.confidence,

          verified:
            result.verified,

          resultType:
            result.resultType,

          resultTitle:
            result.resultTitle,

          resultMessage:
            result.resultMessage,

          actionMessage:
            result.actionMessage,

          reason:
            result.reason
        }
      });

    } catch (error) {

      console.error(
        "Separation verification error:",
        error
      );


      return res.status(500).json({
        success: false,
        message:
          "Failed to verify the before and after photos."
      });
    }
  }
);


export default router;