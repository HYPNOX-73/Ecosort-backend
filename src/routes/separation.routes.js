import { Router } from 'express';

import multer from 'multer';

import fs from 'fs';

import path from 'path';

import { auth } from '../middleware/auth.js';

import {
  createSeparationSubmission
} from '../controllers/submission.controller.js';


const router = Router();


/*
|--------------------------------------------------------------------------
| Upload directory
|--------------------------------------------------------------------------
*/

const dir =
  process.env.UPLOAD_DIR || 'uploads';


fs.mkdirSync(
  dir,
  {
    recursive: true
  }
);


/*
|--------------------------------------------------------------------------
| Multer storage
|--------------------------------------------------------------------------
*/

const storage =
  multer.diskStorage({

    destination: (
      _req,
      _file,
      cb
    ) => {
      cb(
        null,
        dir
      );
    },


    filename: (
      _req,
      file,
      cb
    ) => {

      const extension =
        path.extname(
          file.originalname
        );


      const filename =
        `${Date.now()}-${Math.round(
          Math.random() * 1e9
        )}${extension}`;


      cb(
        null,
        filename
      );
    }
  });


/*
|--------------------------------------------------------------------------
| Upload validation
|--------------------------------------------------------------------------
*/

const upload =
  multer({

    storage,

    limits: {
      fileSize:
        5 * 1024 * 1024
    },


    fileFilter: (
      _req,
      file,
      cb
    ) => {

      if (
        file.mimetype &&
        file.mimetype.startsWith(
          'image/'
        )
      ) {
        cb(
          null,
          true
        );

        return;
      }


      cb(
        new Error(
          'Only image files are allowed.'
        )
      );
    }
  });


/*
|--------------------------------------------------------------------------
| BEFORE + AFTER SEPARATION
|--------------------------------------------------------------------------
*/

router.post(
  '/',

  auth,

  upload.fields([
    {
      name:
        'beforeImage',

      maxCount:
        1
    },

    {
      name:
        'afterImage',

      maxCount:
        1
    }
  ]),

  createSeparationSubmission
);


export default router;