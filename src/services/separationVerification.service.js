import fs from "fs";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

const MODEL = "gemini-3.5-flash-lite";


export async function verifySeparation({
  beforeFilePath,
  afterFilePath
}) {
  try {
    const beforeBase64 = fs
      .readFileSync(beforeFilePath)
      .toString("base64");

    const afterBase64 = fs
      .readFileSync(afterFilePath)
      .toString("base64");


    const prompt = `
You are the EcoSort Waste Separation Verification Agent.

You are given TWO photographs:

PHOTO 1 = BEFORE SEPARATION
PHOTO 2 = AFTER SEPARATION

Your job is to determine whether the AFTER photo plausibly shows
the SAME waste from the BEFORE photo after it has been separated.

IMPORTANT:

Do NOT simply compare whether the two photos look visually similar.

The photos may have:
- different camera angles
- different backgrounds
- different lighting
- different object positions
- different containers

Instead, compare the actual waste objects and materials.

Analyze:

1. What waste items are visible BEFORE separation?
2. What waste items are visible AFTER separation?
3. Do the waste items in the AFTER photo correspond to the waste
   shown BEFORE?
4. Does the AFTER photo show meaningful separation?
5. Does the pair look suspicious, unrelated, reused, or unusable?
6. How confident are you?

Examples:

BEFORE:
Plastic bottle + paper + food waste

AFTER:
Plastic bottle in dry/recyclable area
Paper in dry area
Food waste in wet area

→ This is a successful separation.

Another example:

BEFORE:
Plastic bottles + paper

AFTER:
Completely different objects such as metal cans + clothes

→ This should NOT be verified.

Another example:

BEFORE:
Plastic bottle + paper + food waste

AFTER:
Exactly the same mixed pile with no meaningful separation

→ Separation was NOT detected.

ANTI-CHEATING RULES:

- Do not assume the pair is valid only because both images contain waste.
- Check whether the same identifiable waste/materials plausibly appear in both.
- If the AFTER photo contains completely different waste, mark it suspicious.
- If the BEFORE image contains specific identifiable objects, check whether
  those objects/materials are represented AFTER separation.
- Do not require pixel-level similarity.
- Different camera angles and backgrounds are allowed.
- If either image is too blurry or unclear, lower confidence.
- If there is insufficient evidence, do not approve the submission.

Allowed result types:

- verified
- separation_not_detected
- unrelated_waste
- unclear
- suspicious

Return ONLY valid JSON.
`;


    const request = {
      model: MODEL,

      contents: [
        {
          role: "user",

          parts: [
            {
              text: prompt
            },

            {
              text: "PHOTO 1 — BEFORE SEPARATION"
            },

            {
              inlineData: {
                mimeType: getMimeType(beforeFilePath),
                data: beforeBase64
              }
            },

            {
              text: "PHOTO 2 — AFTER SEPARATION"
            },

            {
              inlineData: {
                mimeType: getMimeType(afterFilePath),
                data: afterBase64
              }
            }
          ]
        }
      ],

      config: {
        responseMimeType: "application/json",

        responseSchema: {
          type: "object",

          properties: {
            beforeWasteDetected: {
              type: "boolean"
            },

            afterWasteDetected: {
              type: "boolean"
            },

            beforeItems: {
              type: "array",
              items: {
                type: "string"
              }
            },

            afterItems: {
              type: "array",
              items: {
                type: "string"
              }
            },

            matchingItems: {
              type: "array",
              items: {
                type: "string"
              }
            },

            missingItems: {
              type: "array",
              items: {
                type: "string"
              }
            },

            sameWasteLikely: {
              type: "boolean"
            },

            separationDetected: {
              type: "boolean"
            },

            suspicious: {
              type: "boolean"
            },

            confidence: {
              type: "number"
            },

            resultType: {
              type: "string",
              enum: [
                "verified",
                "separation_not_detected",
                "unrelated_waste",
                "unclear",
                "suspicious"
              ]
            },

            reason: {
              type: "string"
            }
          },

          required: [
            "beforeWasteDetected",
            "afterWasteDetected",
            "beforeItems",
            "afterItems",
            "matchingItems",
            "missingItems",
            "sameWasteLikely",
            "separationDetected",
            "suspicious",
            "confidence",
            "resultType",
            "reason"
          ]
        }
      }
    };


    const maxRetries = 3;


    for (
      let attempt = 1;
      attempt <= maxRetries;
      attempt++
    ) {

      try {

        console.log(
          `Gemini separation check ${attempt}/${maxRetries}...`
        );


        const response =
          await ai.models.generateContent(request);


        const result =
          JSON.parse(response.text);


        const confidence = Math.max(
          0,
          Math.min(
            1,
            Number(result.confidence) || 0
          )
        );


        const beforeItems =
          Array.isArray(result.beforeItems)
            ? result.beforeItems
            : [];


        const afterItems =
          Array.isArray(result.afterItems)
            ? result.afterItems
            : [];


        const matchingItems =
          Array.isArray(result.matchingItems)
            ? result.matchingItems
            : [];


        const missingItems =
          Array.isArray(result.missingItems)
            ? result.missingItems
            : [];


        const sameWasteLikely =
          result.sameWasteLikely === true;


        const separationDetected =
          result.separationDetected === true;


        const suspicious =
          result.suspicious === true;


        /*
         * FINAL ECOSORT DECISION
         *
         * AI must satisfy ALL important conditions.
         */

        const verified =
          result.beforeWasteDetected === true &&
          result.afterWasteDetected === true &&
          sameWasteLikely === true &&
          separationDetected === true &&
          suspicious === false &&
          confidence >= 0.75;


        let resultType =
          result.resultType || "unclear";


        let resultTitle =
          "📸 Photos Not Clear";


        let resultMessage =
          "We couldn't reliably compare the two photos.";


        let actionMessage =
          "Take clear photos of the same waste before and after separation.";


        if (verified) {

          resultType = "verified";

          resultTitle =
            "✅ Separation Verified";

          resultMessage =
            "The waste shown before separation corresponds with the waste shown after separation.";

          actionMessage =
            "Great job! Your waste appears to have been properly separated.";

        }

        else if (suspicious) {

          resultType = "suspicious";

          resultTitle =
            "🚨 Verification Failed";

          resultMessage =
            "The photo pair appears suspicious or could not be reliably linked.";

          actionMessage =
            "Please photograph the actual waste before and after separation.";

        }

        else if (
          resultType === "unrelated_waste" ||
          sameWasteLikely === false
        ) {

          resultType = "unrelated_waste";

          resultTitle =
            "🚨 Waste Does Not Match";

          resultMessage =
            "The waste in the second photo does not sufficiently correspond to the waste shown in the first photo.";

          actionMessage =
            "Please photograph the same waste before and after separation.";

        }

        else if (
          resultType === "separation_not_detected" ||
          separationDetected === false
        ) {

          resultType =
            "separation_not_detected";

          resultTitle =
            "⚠️ Separation Not Detected";

          resultMessage =
            "The waste appears largely unchanged between the two photos.";

          actionMessage =
            "Separate the waste and take a new after-separation photo.";

        }

        else {

          resultType = "unclear";

          resultTitle =
            "📸 Photos Not Clear";

          resultMessage =
            "The AI couldn't reliably compare the waste in the two photos.";

          actionMessage =
            "Take clear, well-lit photos of the same waste.";
        }


        console.log(
          `Separation result: ${resultType} (${Math.round(
            confidence * 100
          )}%)`
        );


        return {

          beforeWasteDetected:
            result.beforeWasteDetected === true,

          afterWasteDetected:
            result.afterWasteDetected === true,

          beforeItems,

          afterItems,

          matchingItems,

          missingItems,

          sameWasteLikely,

          separationDetected,

          suspicious,

          confidence,

          verified,

          resultType,

          resultTitle,

          resultMessage,

          actionMessage,

          reason:
            result.reason ||
            "No additional reason provided."
        };

      } catch (error) {

        const status =
          error?.status;

        console.error(
          `Gemini separation attempt ${attempt} failed:`,
          error.message
        );


        if (
          (status === 503 || status === 429) &&
          attempt < maxRetries
        ) {

          const delay =
            3000 * Math.pow(
              2,
              attempt - 1
            );


          console.log(
            `Retrying separation check in ${
              delay / 1000
            } seconds...`
          );


          await new Promise(
            resolve =>
              setTimeout(
                resolve,
                delay
              )
          );


          continue;
        }


        console.error(
          "EcoSort separation verification error:",
          error
        );


        return failedResult(
          "AI verification failed. Please try again."
        );
      }
    }

  } catch (error) {

    console.error(
      "EcoSort separation service error:",
      error
    );


    return failedResult(
      "Unable to process the two photos."
    );
  }


  return failedResult(
    "AI service temporarily unavailable."
  );
}


/* =========================================================
   FAILED RESULT
========================================================= */

function failedResult(reason) {

  return {

    beforeWasteDetected: false,

    afterWasteDetected: false,

    beforeItems: [],

    afterItems: [],

    matchingItems: [],

    missingItems: [],

    sameWasteLikely: false,

    separationDetected: false,

    suspicious: true,

    confidence: 0,

    verified: false,

    resultType: "suspicious",

    resultTitle:
      "🚨 Verification Failed",

    resultMessage:
      "We couldn't verify this photo pair.",

    actionMessage:
      "Please take fresh photos of the actual waste before and after separation.",

    reason
  };
}


/* =========================================================
   MIME TYPE
========================================================= */

function getMimeType(filePath) {

  const extension =
    filePath
      .toLowerCase()
      .split(".")
      .pop();


  const types = {

    jpg: "image/jpeg",

    jpeg: "image/jpeg",

    png: "image/png",

    webp: "image/webp"

  };


  return (
    types[extension] ||
    "image/jpeg"
  );
}