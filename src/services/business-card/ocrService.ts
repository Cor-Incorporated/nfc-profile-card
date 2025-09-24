/**
 * OCR Service for Business Card Processing
 * Handles image processing and text extraction using Google Gemini API
 */

import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { ContactInfo } from "@/types/business-card";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini AI with API key from environment
// Check if API key exists
if (!process.env.GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY is not configured in environment variables");
}
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Empty contact info template
const emptyContactInfo: ContactInfo = {
  lastName: "",
  firstName: "",
  phoneticLastName: "",
  phoneticFirstName: "",
  company: "",
  department: "",
  title: "",
  addresses: [],
  email: "",
  website: "",
  phoneNumbers: [],
};

// Optimized OCR prompt for Japanese business cards
const OCR_PROMPT = `
あなたは最先端のAI OCRシステムです。名刺画像から情報を高精度で抽出してください。

【優先順位】
1. 氏名（姓と名を正確に分割）
2. 会社名・部署名（完全な正式名称）
3. メールアドレス（typoを防ぐため慎重に）
4. 電話番号（種別を自動判定）
5. 住所情報

【特に注意すべき点】
- 日本語の縦書きレイアウトの正確な読み取り
- デザイン性の高い名刺のテキスト配置理解
- 手書き文字がある場合の認識
- ロゴマークと文字の区別
- 姓と名の区切り位置（スペースがなくても文脈で判断）

【電話番号の自動分類ルール】
- 携帯/Mobile: 070, 080, 090, 050で始まる
- FAX: FAX, Fax, ファックスの記載がある、または03等で始まり2番目の番号
- WORK: 上記以外、または03, 06, 052等の市外局番

【メールアドレスの検証】
- @マークの前後を慎重に確認
- よくあるドメイン: gmail.com, yahoo.co.jp, outlook.jp等
- 企業ドメインは会社名と照合

【出力形式】
必ず以下のキーを持つJSONオブジェクトを返してください：
{
  "lastName": "姓",
  "firstName": "名",
  "phoneticLastName": "姓のふりがなまたはローマ字",
  "phoneticFirstName": "名のふりがなまたはローマ字",
  "company": "会社名",
  "department": "部署名",
  "title": "役職",
  "addresses": [{ "label": "種類", "postalCode": "郵便番号", "address": "住所" }],
  "email": "メールアドレス",
  "website": "URL",
  "phoneNumbers": [{ "type": "WORK|MOBILE|FAX|OTHER", "number": "電話番号" }]
}

読み取れない項目は空文字列""または空配列[]にしてください。

重要:
- 出力は純粋なJSONのみ（マークダウンのコードブロックは含めない）
- 説明文、コメント、その他のテキストは一切含めない
- 必ず上記の形式のJSONオブジェクトを出力する
- JSONの前後に余分な文字列を付けないでください
- 必ず有効なJSON形式で応答してください
`;

export interface OcrResult {
  success: boolean;
  contactInfo?: ContactInfo;
  processingTime: number;
  error?: string;
}

/**
 * Process business card image using Google Gemini API
 * @param image Base64 encoded image data
 * @param mimeType MIME type of the image
 * @returns OCR processing result
 */
export async function processBusinessCardImage(
  image: string,
  mimeType: string,
): Promise<OcrResult> {
  const startTime = Date.now();

  // Log request info for debugging
  console.log("=== OCR Processing Started ===");
  console.log("Timestamp:", new Date().toISOString());
  console.log("MIME Type:", mimeType);
  console.log("Image size (base64):", image.length, "characters");

  // Check image size to prevent Request Entity errors
  const maxImageSize = 4 * 1024 * 1024; // 4MB limit for base64
  if (image.length > maxImageSize) {
    console.error("❌ Image too large:", image.length, "characters (max:", maxImageSize, ")");
    return {
      success: false,
      processingTime: Date.now() - startTime,
      error: "画像サイズが大きすぎます。4MB以下の画像をご利用ください。",
    };
  }

  // Check for supported image formats (including HEIC)
  const supportedMimeTypes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif'
  ];

  // Check if MIME type is supported
  if (!supportedMimeTypes.includes(mimeType.toLowerCase())) {
    console.log("⚠️ Unsupported MIME type:", mimeType);
    return {
      success: false,
      processingTime: Date.now() - startTime,
      error: `サポートされていない画像形式です: ${mimeType}。JPEG、PNG、WebP、GIF、HEIC形式をご利用ください。`,
    };
  }

  // Log HEIC format detection for monitoring
  if (mimeType === 'image/heic' || mimeType === 'image/heif') {
    console.log("📱 HEIC format detected from mobile device");
    console.log("Gemini 2.5 Flash should support HEIC format");
  }

  try {
    // Check API key before processing
    if (!process.env.GEMINI_API_KEY) {
      console.error("❌ GEMINI_API_KEY is missing from environment variables");
      return {
        success: false,
        processingTime: Date.now() - startTime,
        error: "OCR service is not properly configured. API key is missing.",
      };
    }
    console.log("✅ API key found");

    // Get the generative model (updated to Gemini 2.5 Flash)
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Remove data URL prefix if present
    const base64Image = image.replace(/^data:image\/\w+;base64,/, "");
    console.log("Base64 image size (cleaned):", base64Image.length, "characters");

    // Generate content with Gemini (with timeout and retry logic)
    const generateWithTimeout = async () => {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(ERROR_MESSAGES.OCR_TIMEOUT)), 15000), // Increased timeout
      );

      const ocrPromise = model.generateContent([
        {
          inlineData: {
            data: base64Image,
            mimeType: mimeType,
          },
        },
        OCR_PROMPT,
      ]);

      return Promise.race([ocrPromise, timeoutPromise]);
    };

    console.log("Calling Gemini API...");
    const result = (await generateWithTimeout()) as any;

    if (!result || !result.response) {
      console.error("❌ No response from Gemini API");
      console.error("Result object:", result);
      return {
        success: false,
        processingTime: Date.now() - startTime,
        error: "No response from Gemini API",
      };
    }

    const response = result.response;
    let text: string;
    try {
      text = response.text();
      console.log("✅ Got text from Gemini response");

      // Check for empty response
      if (!text || text.trim() === "") {
        console.error("❌ Gemini returned empty response");
        return {
          success: false,
          processingTime: Date.now() - startTime,
          error: "OCR APIから空の応答が返されました。画像が読み取れなかった可能性があります。",
        };
      }
    } catch (textError) {
      console.error("❌ Error getting text from Gemini response:", textError);
      console.error("Response object:", response);
      return {
        success: false,
        processingTime: Date.now() - startTime,
        error: "Failed to extract text from OCR response",
      };
    }

    // Calculate processing time
    const processingTime = Date.now() - startTime;
    console.log(`⏱️ OCR processing completed in ${processingTime}ms`);
    console.log("=== Gemini Raw Response ===");
    console.log("Response length:", text.length);
    console.log("First 200 chars:", text.substring(0, 200));
    console.log("Last 200 chars:", text.substring(Math.max(0, text.length - 200)));
    console.log("Full response:", text);
    console.log("=== End Gemini Response ===");

    // Try to parse the JSON response
    let contactInfo: ContactInfo;
    try {
      // First, check if the response looks like an error message
      if (text.includes("<!DOCTYPE") || text.includes("<html")) {
        console.error("❌ Gemini returned HTML instead of JSON (likely an error page)");
        console.error("First 500 chars of HTML:", text.substring(0, 500));
        return {
          success: false,
          processingTime: Date.now() - startTime,
          error: "OCR APIがエラーページを返しました。APIキーまたはサービス設定を確認してください。",
        };
      }

      if (text.toLowerCase().includes("error") && !text.includes("{")) {
        console.error("❌ Gemini returned plain text error:", text);
        return {
          success: false,
          processingTime: Date.now() - startTime,
          error: `OCR APIエラー: ${text.substring(0, 100)}`,
        };
      }

      // Check for common error patterns
      if (text.includes("Request En") || text.includes("Request Entity")) {
        console.error("❌ Request Entity error detected");
        console.error("Response:", text);
        return {
          success: false,
          processingTime: Date.now() - startTime,
          error: "リクエストエンティティエラーが発生しました。画像サイズが大きすぎる可能性があります。",
        };
      }

      // Remove any markdown code blocks if present
      const jsonText = text
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .replace(/^```.*$/gm, "") // Remove any remaining code block markers
        .trim();

      // Check if the cleaned text starts with { or [
      if (!jsonText.startsWith("{") && !jsonText.startsWith("[")) {
        console.error("❌ Response doesn't look like JSON");
        console.error("First 200 chars after cleaning:", jsonText.substring(0, 200));
        console.error("Full cleaned text length:", jsonText.length);
        console.error("Original text first 200 chars:", text.substring(0, 200));
        return {
          success: false,
          processingTime: Date.now() - startTime,
          error: "OCR APIの応答がJSON形式ではありません。サービスが一時的に利用できない可能性があります。",
        };
      }

      // Try to find JSON object in the response
      let jsonStart = jsonText.indexOf('{');
      let jsonEnd = jsonText.lastIndexOf('}');
      
      if (jsonStart === -1 || jsonEnd === -1 || jsonStart >= jsonEnd) {
        console.error("❌ No valid JSON object found in response");
        console.error("Cleaned text:", jsonText);
        return {
          success: false,
          processingTime: Date.now() - startTime,
          error: "有効なJSONオブジェクトが見つかりませんでした。",
        };
      }

      // Extract the JSON part
      const jsonPart = jsonText.substring(jsonStart, jsonEnd + 1);
      console.log("Extracted JSON part:", jsonPart);

      const parsedJson = JSON.parse(jsonPart);

      contactInfo = {
        ...emptyContactInfo,
        ...parsedJson,
        phoneNumbers: parsedJson.phoneNumbers || [],
        addresses: parsedJson.addresses || [],
      };
    } catch (parseError) {
      console.error("❌ Failed to parse Gemini response as JSON");
      console.error("Parse error:", parseError);
      console.error("=== Raw text that failed to parse ===");
      console.error(text);
      console.error("=== End of failed text ===");

      // Log the first 200 characters for quick debugging
      console.error("First 200 chars:", text.substring(0, 200));
      console.error("Text length:", text.length);

      // Return error with parsing failure details
      return {
        success: false,
        processingTime: Date.now() - startTime,
        error: "OCR応答の解析に失敗しました。しばらく時間をおいてから再試行してください。",
      };
    }

    return {
      success: true,
      contactInfo,
      processingTime,
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error("❌ Error in OCR processing");
    console.error("Error object:", error);

    // More specific error messages
    let errorMessage: string = ERROR_MESSAGES.UNKNOWN_ERROR;
    if (error instanceof Error) {
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);

      if (error.message.includes("API key") || error.message.includes("API_KEY_INVALID")) {
        errorMessage = "OCR APIキーが無効です。管理者にお問い合わせください。";
        console.error("🔑 API Key error detected");
      } else if (error.message.includes("timeout")) {
        errorMessage = ERROR_MESSAGES.OCR_TIMEOUT;
        console.error("⏱️ Timeout error detected");
      } else if (error.message.includes("quota") || error.message.includes("RESOURCE_EXHAUSTED")) {
        errorMessage = ERROR_MESSAGES.QUOTA_EXCEEDED;
        console.error("📊 Quota exceeded error detected");
      } else if (error.message.includes("The string did not match the expected pattern")) {
        // Check if this is a HEIC format issue
        if (mimeType === 'image/heic' || mimeType === 'image/heif') {
          errorMessage = "HEIC形式の画像でエラーが発生しました。JPEGまたはPNG形式で撮影し直してください。";
          console.error("📱 HEIC format processing error detected");
        } else {
          errorMessage = "OCR APIからの応答形式が不正です。再度お試しください。";
          console.error("📝 Response format error detected");
        }
      } else if (error.message.includes("Unexpected token") || error.message.includes("not valid JSON")) {
        errorMessage = "OCR APIの応答形式に問題があります。画像を再撮影してお試しください。";
        console.error("🔧 JSON parsing error detected");
      } else {
        // Include actual error message for debugging
        errorMessage = `OCR処理エラー: ${error.message}`;
        console.error("⚠️ Unknown error type");
      }
    }

    console.log("=== OCR Processing Failed ===");
    console.log(`Processing time: ${processingTime}ms`);
    console.log(`Error message returned: ${errorMessage}`);

    return {
      success: false,
      processingTime,
      error: errorMessage,
    };
  }
}
