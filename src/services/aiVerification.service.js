import fs from "fs";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

const MODEL = "gemini-3.5-flash-lite";

export async function verifyWasteImage({ filePath }) {
  const imageBase64 = fs.readFileSync(filePath).toString("base64");

  const prompt = `
You are the EcoSort Waste Verification Agent.

Analyze the uploaded image.

Determine:
1. Is actual waste visible?
2. What type of waste is visible?
3. Is it properly segregated?
4. Is the image clear enough to verify?
5. How confident are you?
6. Does the image look suspicious or unusable?

Allowed categories:
- wet
- dry
- recyclable
- mixed
- unknown

Examples:
- Food scraps -> wet
- Paper/cardboard -> dry
- Plastic bottles/cans -> recyclable
- Different incompatible waste types together -> mixed

Rules:
- If actual waste is not clearly visible, use isWaste=false.
- If the image is blurry or unclear, reduce confidence.
- If different waste categories are mixed together, use mixed.
- Return ONLY JSON.
`;

  const request = {
    model: MODEL,

    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: getMimeType(filePath),
              data: imageBase64
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
          isWaste: {
            type: "boolean"
          },

          category: {
            type: "string",
            enum: [
              "wet",
              "dry",
              "recyclable",
              "mixed",
              "unknown"
            ]
          },

          items: {
            type: "array",
            items: {
              type: "string"
            }
          },

          segregated: {
            type: "boolean"
          },

          imageQuality: {
            type: "string",
            enum: [
              "good",
              "acceptable",
              "poor"
            ]
          },

          confidence: {
            type: "number"
          },

          suspicious: {
            type: "boolean"
          },

          reason: {
            type: "string"
          }
        },

        required: [
          "isWaste",
          "category",
          "items",
          "segregated",
          "imageQuality",
          "confidence",
          "suspicious",
          "reason"
        ]
      }
    }
  };

  // Retry Gemini if the service temporarily returns 503/429
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(
        `Gemini AI attempt ${attempt}/${maxRetries}...`
      );

      const response = await ai.models.generateContent(request);

      const result = JSON.parse(response.text);

      const confidence = Math.max(
        0,
        Math.min(1, Number(result.confidence) || 0)
      );

      const validCategories = [
        "wet",
        "dry",
        "recyclable",
        "mixed",
        "unknown"
      ];

      const category = validCategories.includes(result.category)
        ? result.category
        : "unknown";

      const verified =
        result.isWaste === true &&
        result.imageQuality !== "poor" &&
        confidence >= 0.75 &&
        category !== "mixed" &&
        category !== "unknown" &&
        result.suspicious !== true;

      console.log(
        `Gemini result: ${category} (${Math.round(confidence * 100)}%)`
      );

      return {
        category,
        confidence,
        verified,

        isWaste: result.isWaste === true,

        items: Array.isArray(result.items)
          ? result.items
          : [],

        segregated: result.segregated === true,

        imageQuality:
          result.imageQuality || "unknown",

        suspicious:
          result.suspicious === true,

        reason:
          result.reason ||
          "Gemini did not provide a reason."
      };

    } catch (error) {

      const status = error?.status;

      console.error(
        `Gemini attempt ${attempt} failed:`,
        error.message
      );

      // Retry only temporary errors
      if (
        (status === 503 || status === 429) &&
        attempt < maxRetries
      ) {
        const delay = 3000 * Math.pow(2, attempt - 1);

        console.log(
          `Gemini temporarily unavailable. Retrying in ${delay / 1000}s...`
        );

        await new Promise(resolve =>
          setTimeout(resolve, delay)
        );

        continue;
      }

      // Permanent error or final failed attempt
      console.error(
        "EcoSort Gemini AI ERROR:",
        error
      );

      return {
  category: "unknown",
  confidence: 0,
  verified: false,
  isWaste: false,
  items: [],
  segregated: false,
  imageQuality: "unknown",
  suspicious: true,
  reason: "AI verification failed. Manual review required.",

  resultType: "verification_failed",
  resultTitle: "🚨 Verification Failed",
  resultMessage: "We couldn't safely verify this image.",
  actionMessage: "Please upload a fresh photo."
};
    }
  }

 const items = Array.isArray(result.items) ? result.items : [];
const isWaste = result.isWaste === true;
const segregated = result.segregated === true;
const imageQuality = result.imageQuality || "unknown";
const suspicious = result.suspicious === true;

let resultType = "unclear";
let resultTitle = "📸 Photo Not Clear";
let resultMessage = "We couldn't confidently identify the waste.";
let actionMessage = "Take a closer, brighter photo and try again.";

if (suspicious) {
  resultType = "verification_failed";
  resultTitle = "🚨 Verification Failed";
  resultMessage = "We couldn't safely verify this image.";
  actionMessage = "Please upload a fresh photo.";
}
else if (!isWaste) {
  resultType = "no_waste";
  resultTitle = "❌ No Waste Detected";
  resultMessage = "We couldn't clearly find waste in this image.";
  actionMessage = "Upload a photo where the waste is clearly visible.";
}
else if (category === "mixed") {
  resultType = "mixed";
  resultTitle = "⚠️ Mixed Waste — Please Separate";
  resultMessage = "We detected different types of waste together.";
  actionMessage = "Separate the waste and upload a fresh photo.";
}
else if (imageQuality === "poor" || confidence < 0.75) {
  resultType = "unclear";
  resultTitle = "📸 Photo Not Clear";
  resultMessage = "We couldn't clearly identify the waste.";
  actionMessage = "Take a brighter, closer photo and try again.";
}
else if (category === "wet") {
  resultType = "wet";
  resultTitle = "💧 Wet Waste";
  resultMessage = "Wet/organic waste detected.";
  actionMessage = segregated
    ? "✅ Waste appears properly segregated."
    : "Keep wet waste separated from other waste.";
}
else if (category === "dry") {
  resultType = "dry";
  resultTitle = "📄 Dry Waste";
  resultMessage = "Dry waste detected.";
  actionMessage = segregated
    ? "✅ Waste appears properly segregated."
    : "Keep dry waste separated from other waste.";
}
else if (category === "recyclable") {
  resultType = "recyclable";
  resultTitle = "♻️ Recyclable Waste";
  resultMessage = "Recyclable materials detected.";
  actionMessage = segregated
    ? "✅ Waste appears properly segregated."
    : "Keep recyclable materials separated.";
}
else {
  resultType = "unclear";
  resultTitle = "📸 Photo Not Clear";
  resultMessage = "We couldn't clearly identify the waste.";
  actionMessage = "Take a brighter, closer photo and try again.";
}

return {
  category,
  confidence,
  verified,
  isWaste,
  items,
  segregated,
  imageQuality,
  suspicious,
  reason: result.reason || "Gemini did not provide a reason.",

  // Human-readable result
  resultType,
  resultTitle,
  resultMessage,
  actionMessage
};
}

function getMimeType(filePath) {
  const extension = filePath
    .toLowerCase()
    .split(".")
    .pop();

  const types = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp"
  };

  return types[extension] || "image/jpeg";
}