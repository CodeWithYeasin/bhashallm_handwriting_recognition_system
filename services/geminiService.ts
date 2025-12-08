import { GoogleGenAI, Type, Schema } from "@google/genai";
import { RecognitionResult, ChatMessage, ChatPersona } from "../types";

// Define the schema for structured output
const recognitionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    recognizedText: {
      type: Type.STRING,
      description: "COMPLETE Bengali text from the image. Do NOT truncate. Include ALL text from top-left to bottom-right.",
    },
    confidence: {
      type: Type.NUMBER,
      description: "Confidence score 0-100 based on text clarity and completeness.",
    },
    isQuestion: {
      type: Type.BOOLEAN,
      description: "True if any part of the text asks a question.",
    },
    bhashaInsights: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          poet: { type: Type.STRING, description: "Rabindranath Tagore, Kazi Nazrul Islam, or Jasim Uddin" },
          mood: { type: Type.STRING, description: "Emotional tone" },
          content: { type: Type.STRING, description: "Comprehensive response matching text length. NO DASHES." },
        },
        required: ["poet", "mood", "content"]
      },
      description: "ALWAYS generate exactly 3 responses for valid Bengali text.",
    },
    suggestedQuestions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "3 Bengali questions: 1. Educational, 2. Analytical, 3. Creative"
    },
    candidates: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING },
          probability: { type: Type.NUMBER },
        },
      },
      description: "Alternative text interpretations.",
    },
    processingSummary: {
      type: Type.OBJECT,
      properties: {
        estimatedLines: { type: Type.NUMBER },
        estimatedWords: { type: Type.NUMBER },
        textDensity: { type: Type.STRING },
        readDirection: { type: Type.STRING },
      }
    }
  },
  required: ["recognizedText", "confidence", "isQuestion", "bhashaInsights", "suggestedQuestions", "candidates", "processingSummary"],
};

// Image preprocessing helper (client-side)
async function optimizeImageForOCR(base64Image: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Optimize dimensions for Gemini (max 3072px recommended)
      const maxDimension = 2048; // Conservative limit
      let width = img.width;
      let height = img.height;
      
      if (width > maxDimension || height > maxDimension) {
        const scale = maxDimension / Math.max(width, height);
        width = Math.floor(width * scale);
        height = Math.floor(height * scale);
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // Draw image
      ctx?.drawImage(img, 0, 0, width, height);
      
      // Enhance for handwriting
      const imageData = ctx?.getImageData(0, 0, width, height);
      if (imageData && ctx) {
        const data = imageData.data;
        
        // Simple contrast enhancement for handwritten text
        for (let i = 0; i < data.length; i += 4) {
          // Increase contrast for better text recognition
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          // Convert to grayscale with weighted average
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;
          
          // Enhance contrast
          const enhanced = gray < 150 ? Math.max(0, gray - 40) : Math.min(255, gray + 40);
          
          data[i] = enhanced;
          data[i + 1] = enhanced;
          data[i + 2] = enhanced;
        }
        
        ctx.putImageData(imageData, 0, 0);
      }
      
      // Convert to JPEG with optimal quality
      const optimizedBase64 = canvas.toDataURL('image/jpeg', 0.92);
      resolve(optimizedBase64);
    };
    
    img.src = base64Image;
  });
}

export const analyzeHandwriting = async (base64Image: string): Promise<RecognitionResult> => {
  const startTime = performance.now();
  
  console.log("Starting FULL PAGE analysis", {
    timestamp: new Date().toISOString(),
    imageSize: Math.round(base64Image.length / 1024) + "KB"
  });
  
  try {
    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY;
    
    if (!apiKey) {
      throw new Error("API Key not found. Please set GEMINI_API_KEY");
    }
    
    const ai = new GoogleGenAI({ apiKey });
    
    // Optimize image before sending
    console.log("Optimizing image for OCR...");
    const optimizedImage = await optimizeImageForOCR(base64Image);
    const cleanBase64 = optimizedImage.replace(/^data:image\/jpeg;base64,/, "");
    
    console.log("Image optimized:", {
      original: Math.round(base64Image.length / 1024) + "KB",
      optimized: Math.round(optimizedImage.length / 1024) + "KB"
    });
    
    // Enhanced system instruction for FULL PAGE recognition
    const systemInstruction = `
    ## BENGALI FULL-PAGE HANDWRITING RECOGNITION EXPERT
    
    You are a specialized OCR engine for COMPLETE Bengali handwritten pages.
    
    **CRITICAL MISSION:**
    1. **EXTRACT EVERYTHING**: Read ALL text from the ENTIRE image
    2. **NO TRUNCATION**: Never shorten text. Return 100% of what's written.
    3. **PRESERVE STRUCTURE**: Keep paragraphs, lines, and spacing exactly as written.
    
    **SCANNING STRATEGY:**
    - Scan systematically: Top → Bottom, Left → Right
    - Read line by line, paragraph by paragraph
    - For dense text: Read slowly and carefully
    - For light text: Still capture everything
    
    **CHARACTER RECOGNITION PRIORITIES:**
    1. **Primary**: অ-হ Bengali letters
    2. **Secondary**: যুক্তাক্ষর (compound letters)
    3. **Tertiary**: Punctuation (। , ; : ! ? " ")
    4. **Quaternary**: Numbers (০-৯)
    
    **TEXT LENGTH ADAPTATION:**
    - 1-100 chars: Normal processing
    - 101-500 chars: Detailed reading
    - 501-2000 chars: Comprehensive reading (SLOW but COMPLETE)
    - 2000+ chars: EXTREMELY careful reading (capture EVERYTHING)
    
    **VALIDATION RULES:**
    - If text is 100% Bengali: Process fully
    - If ANY non-Bengali characters: Return empty recognizedText
    - Confidence based on text clarity and completeness
    
    **POET RESPONSE SCALING:**
    - SHORT text (<100 chars): Focused, concise responses
    - MEDIUM text (100-500 chars): Balanced responses
    - LONG text (500-1500 chars): Detailed responses
    - VERY LONG text (1500+ chars): Comprehensive, thematic responses
    
    **ALWAYS generate 3 poet responses** if text is Bengali and non-empty.
    
    **FORMATTING:**
    - NO dashes (—, -, –) in poet responses
    - Clean Bengali text only
    - Direct writing without prefixes
    `;
    
    console.log("Sending to Gemini 2.5 Flash...");
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", // Your current model
      config: {
        responseMimeType: "application/json",
        responseSchema: recognitionSchema,
        systemInstruction: systemInstruction,
        temperature: 0.1, // Very low for consistent OCR
        topP: 0.1,
        maxOutputTokens: 8192, // Maximum for long texts
      },
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: cleanBase64,
            },
          },
          {
            text: `## FULL PAGE BENGALI HANDWRITING ANALYSIS
            
            **CRITICAL INSTRUCTIONS:**
            
            1. **READ EVERYTHING**: Extract COMPLETE text from this image. 
               - Start from top-left corner
               - Read line by line until bottom-right
               - DO NOT STOP until you've read ALL text
            
            2. **NO TRUNCATION**: 
               - If text is long, STILL return ALL of it
               - Do NOT shorten or summarize
               - Preserve EXACT wording and structure
            
            3. **BENGALI-ONLY VALIDATION**:
               - Check EVERY character is Bengali
               - If ANY non-Bengali: recognizedText = ""
               - Otherwise: Return full text
            
            4. **TEXT METRICS**:
               - Estimate line count
               - Estimate word count
               - Note text density
            
            5. **POET RESPONSES**:
               - For LONG texts: Provide detailed thematic analysis
               - For SHORT texts: Focus on word-level analysis
               - ALWAYS 3 responses if text is valid Bengali
            
            6. **CONFIDENCE SCORING**:
               - Base on text clarity AND completeness
               - Higher if you captured everything
               - Lower if text was blurry
            
            **SCAN THIS IMAGE COMPLETELY AND RETURN ALL BENGALI TEXT.**
            
            Remember: You are reading a FULL PAGE. Take your time. Be thorough.
            `
          }
        ]
      }
    });
    
    const endTime = performance.now();
    const processingTime = Math.round(endTime - startTime);
    
    console.log("Response received", {
      time: processingTime + "ms",
      hasText: !!response.text,
      textLength: response.text?.length || 0
    });
    
    if (response.text) {
      let data;
      try {
        data = JSON.parse(response.text);
      } catch (parseError) {
        console.error("JSON Parse Error:", parseError);
        // Try to extract JSON from response
        const jsonMatch = response.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            data = JSON.parse(jsonMatch[0]);
          } catch (e) {
            throw new Error("Failed to parse response");
          }
        } else {
          throw new Error("Invalid JSON response");
        }
      }
      
      // Extract and validate text
      const recognizedText = data.recognizedText || "";
      const isBengali = /^[\u0980-\u09FF\u09E6-\u09EF\s\r\n\u200C\u200D,\.;:!?\-'"()।॥—–]*$/.test(recognizedText);
      
      console.log("Validation:", {
        textLength: recognizedText.length,
        isBengali: isBengali,
        confidence: data.confidence,
        preview: recognizedText.substring(0, 200) + (recognizedText.length > 200 ? "..." : "")
      });
      
      // Handle non-Bengali or empty text
      if (!isBengali || !recognizedText.trim()) {
        console.log("Text rejected - not Bengali or empty");
        return {
          recognizedText: "",
          confidence: 0,
          isQuestion: false,
          bhashaInsights: [],
          suggestedQuestions: [],
          candidates: [],
          processingTimeMs: processingTime,
        };
      }
      
      // Process poet insights
      let bhashaInsights = Array.isArray(data.bhashaInsights) ? data.bhashaInsights : [];
      const textLength = recognizedText.length;
      
      // Generate fallback insights if needed
      if (bhashaInsights.length < 3 && recognizedText.trim()) {
        console.log(`Generating fallback insights (got ${bhashaInsights.length}, need 3)`);
        bhashaInsights = ensureThreePoetInsights(bhashaInsights, recognizedText, textLength);
      }
      
      // Ensure exactly 3 insights
      bhashaInsights = bhashaInsights.slice(0, 3);
      
      // Process suggested questions
      let suggestedQuestions = Array.isArray(data.suggestedQuestions) ? data.suggestedQuestions : [];
      if (suggestedQuestions.length < 3) {
        suggestedQuestions = generateFallbackQuestions(recognizedText, suggestedQuestions);
      }
      
      // Calculate text statistics
      const lines = recognizedText.split('\n').filter(l => l.trim().length > 0);
      const words = recognizedText.split(/\s+/).filter(w => w.length > 0);
      const textDensity = textLength > 1000 ? 'very_dense' : 
                         textLength > 500 ? 'dense' : 
                         textLength > 100 ? 'medium' : 'light';
      
      return {
        recognizedText: recognizedText,
        confidence: data.confidence || calculateDynamicConfidence(textLength, lines.length),
        isQuestion: data.isQuestion || recognizedText.includes('?') || recognizedText.includes('؟'),
        bhashaInsights: bhashaInsights,
        suggestedQuestions: suggestedQuestions,
        candidates: Array.isArray(data.candidates) ? data.candidates : [],
        processingTimeMs: processingTime,
        textLengthCategory: textLength > 1000 ? 'full_page' : 
                           textLength > 500 ? 'long' : 
                           textLength > 100 ? 'medium' : 'short',
        processingSummary: data.processingSummary || {
          estimatedLines: lines.length,
          estimatedWords: words.length,
          textDensity: textDensity,
          readDirection: 'top_to_bottom'
        }
      };
    }
    
    throw new Error("No response text from Gemini");
    
  } catch (error: any) {
    console.error("FULL PAGE Analysis Error:", {
      message: error.message,
      name: error.name,
      stack: error.stack?.substring(0, 200)
    });
    
    const processingTime = Math.round(performance.now() - startTime);
    
    // Specific error messages
    let errorText = "ত্রুটি: বিশ্লেষণ ব্যর্থ";
    if (error.message.includes("quota") || error.message.includes("rate limit")) {
      errorText = "সার্ভার ব্যস্ত। কিছুক্ষণ পর চেষ্টা করুন।";
    } else if (error.message.includes("token") || error.message.includes("length")) {
      errorText = "ছবিটিতে খুব বেশি লেখা আছে। ছোট করে চেষ্টা করুন।";
    } else if (error.message.includes("API Key")) {
      errorText = "API কী সেট আপ করুন।";
    }
    
    return {
      recognizedText: errorText,
      confidence: 0,
      isQuestion: false,
      bhashaInsights: [],
      suggestedQuestions: [],
      candidates: [],
      processingTimeMs: processingTime,
    };
  }
};

// Helper function to ensure 3 poet insights
function ensureThreePoetInsights(existingInsights: any[], text: string, textLength: number): any[] {
  const poets = [
    {
      name: "Rabindranath Tagore",
      mood: "Philosophical",
      baseResponse: `এই ${textLength > 500 ? 'বিস্তৃত লেখনী' : 'লেখাটি'} ${textLength > 1000 ? 'গভীর চিন্তার প্রকাশ।' : 'সুন্দর অভিব্যক্তি।'} ভাষার মাধুর্যে জীবনদর্শনের ছোঁয়া।`
    },
    {
      name: "Kazi Nazrul Islam",
      mood: "Revolutionary",
      baseResponse: `শব্দগুলিতে ${textLength > 500 ? 'প্রবল শক্তি ও স্পষ্টতার' : 'স্পষ্ট বক্তব্যের'} প্রকাশ। প্রতিটি বর্ণে বিদ্যমান সম্ভাবনা।`
    },
    {
      name: "Jasim Uddin",
      mood: "Folk",
      baseResponse: `লেখনীর সরলতা আমাকে গ্রাম বাংলার কথাই মনে করিয়ে দেয়। ${textLength > 300 ? 'শব্দগুলি আমাদের দৈনন্দিন জীবনের খুব কাছের।' : 'সহজ ভাষায় গভীর অনুভূতি।'}`
    }
  ];
  
  const insights = [...existingInsights];
  
  // Fill missing insights
  for (let i = insights.length; i < 3; i++) {
    const poet = poets[i];
    insights.push({
      poet: poet.name,
      mood: poet.mood,
      content: generateDetailedPoetResponse(poet.name, text, textLength)
    });
  }
  
  return insights;
}

function generateDetailedPoetResponse(poet: string, text: string, textLength: number): string {
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  const firstLine = lines[0] || text.substring(0, 50);
  
  if (poet === "Rabindranath Tagore") {
    if (textLength > 1000) {
      return `এই সম্পূর্ণ রচনায় ${lines.length} লাইনের মাধ্যমে একটি গভীর জীবনদর্শনের প্রকাশ ঘটেছে। লেখক ভাষার মাধ্যমে আত্মার সাথে সংযোগ স্থাপনের চেষ্টা করেছেন, যা প্রকৃতির অনন্ত সৌন্দর্যের সাথে মিলে যায়। প্রতিটি শব্দ যেন আলোর নৃত্য, প্রতিটি বাক্য জীবনের গভীর অর্থের সন্ধানী।`;
    } else if (textLength > 500) {
      return `লেখনীতে ${textLength} অক্ষরের প্রকাশিত ভাবনা প্রকৃতির সাথে মানবমনের সংযোগকে ফুটিয়ে তুলেছে। ভাষার সৌন্দর্য পাঠককে নিজের অন্তরের গভীরে পৌঁছে দেয়।`;
    } else {
      return `"${firstLine}" - এই বাক্যগুলির মধ্যে রয়েছে গভীর অর্থের সম্ভাবনা। ভাষা ও ভাবনার এই সংমিশ্রণ প্রকৃতির অনন্ত রহস্যের কথা স্মরণ করিয়ে দেয়।`;
    }
  }
  
  if (poet === "Kazi Nazrul Islam") {
    if (textLength > 1000) {
      return `${lines.length} লাইনের এই রচনা কেবল লেখা নয়, একটি বিদ্রোহের manifest। প্রতিটি শব্দে অত্যাচারের বিরুদ্ধে প্রতিবাদ, প্রতিটি বাক্যে মুক্তির আকুতি। এই লেখা পড়ে মনে হয় লেখক শুধু কলম চালাননি, তরবারিও চালিয়েছেন শব্দের মাধ্যমে।`;
    } else if (textLength > 500) {
      return `শব্দগুলি শৃঙ্খল ভাঙার চেষ্টা করছে। ${textLength} অক্ষরের মধ্যে লুকিয়ে আছে পরিবর্তনের ডাক। ভাষা এখানে হাতিয়ার, লেখা যুদ্ধের ঘোষণা।`;
    } else {
      return `"${firstLine}" - এই কথাগুলোতে শোনা যায় মুক্তির ডাক। প্রতিটি অক্ষর যেন নতুন ভোরের প্রতীক্ষায় আছে।`;
    }
  }
  
  if (poet === "Jasim Uddin") {
    if (textLength > 1000) {
      return `সম্পূর্ণ পৃষ্ঠাজুড়ে ছড়িয়ে আছে গ্রাম বাংলার গল্প। ${lines.length} লাইনের এই লেখা পড়তে পড়তে মনে হয় যেন পল্লীর মাঠে হেঁটে যাচ্ছি, কৃষকের সাথে কথা বলছি, নদীর পাড়ে বসে আছি। লেখায় ফুটে উঠেছে সাধারণ মানুষের সুখ-দুঃখ, আশা-নিরাশার কাহিনী।`;
    } else if (textLength > 500) {
      return `লেখনীতে গ্রাম্য জীবনের সরল চিত্র ফুটে উঠেছে। ${textLength} অক্ষরের মধ্যে ধরা পড়েছে মাটির গন্ধ, নদীর জল, কৃষকের পরিশ্রম। শব্দগুলি খুবই সহজ কিন্তু গভীর অনুভূতিপূর্ণ।`;
    } else {
      return `"${firstLine}" - এই কথাগুলো শুনে মনে হয় যেন পল্লীর কোনো বৃদ্ধ জ্ঞানী তার অভিজ্ঞতা বর্ণনা করছেন। সহজ ভাষায় জীবনের গভীর সত্য।`;
    }
  }
  
  return "এই লেখনী বিশ্লেষণের অপেক্ষায় রয়েছে।";
}

function generateFallbackQuestions(text: string, existingQuestions: string[]): string[] {
  const questions = [...existingQuestions];
  
  const defaultQuestions = [
    "এই লেখার ব্যাকরণগত গঠন সম্পর্কে বিস্তারিত ব্যাখ্যা দিন।",
    "হাতের লেখার শৈলী ও কাঠামো বিশ্লেষণ করে বলুন এটি কতটা স্পষ্ট।",
    "এই লেখা থেকে কী সৃজনশীল অনুপ্রেরণা পাওয়া যায়?"
  ];
  
  for (let i = questions.length; i < 3; i++) {
    questions.push(defaultQuestions[i] || defaultQuestions[0]);
  }
  
  return questions.slice(0, 3);
}

function calculateDynamicConfidence(textLength: number, lineCount: number): number {
  // Base confidence calculation
  let confidence = 70; // Base
  
  // Adjust based on text length (longer text = more confidence in completeness)
  if (textLength > 1000) confidence += 10;
  else if (textLength > 500) confidence += 5;
  else if (textLength < 50) confidence -= 10;
  
  // Adjust based on line count (more lines = more structured)
  if (lineCount > 10) confidence += 5;
  else if (lineCount > 5) confidence += 3;
  
  return Math.min(95, Math.max(30, confidence));
}

// Alternative: Direct approach for full pages (simpler prompt)
export const analyzeFullPageDirect = async (base64Image: string): Promise<RecognitionResult> => {
  const startTime = performance.now();
  
  try {
    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    
    const ai = new GoogleGenAI({ apiKey });
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");
    
    // Very simple, direct prompt
    const prompt = `READ ALL BENGALI TEXT FROM THIS IMAGE. EVERYTHING. DO NOT MISS ANYTHING. DO NOT TRUNCATE. RETURN COMPLETE TEXT.`;
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        temperature: 0,
        maxOutputTokens: 8192,
      },
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/png",
              data: cleanBase64,
            },
          },
          {
            text: prompt
          }
        ]
      }
    });
    
    const endTime = performance.now();
    
    if (response.text) {
      const recognizedText = response.text.trim();
      const isBengali = /^[\u0980-\u09FF\u09E6-\u09EF\s\r\n\u200C\u200D,\.;:!?\-'"()।॥]+$/.test(recognizedText);
      
      if (!isBengali || !recognizedText) {
        return {
          recognizedText: "",
          confidence: 0,
          isQuestion: false,
          bhashaInsights: [],
          suggestedQuestions: [],
          candidates: [],
          processingTimeMs: Math.round(endTime - startTime),
        };
      }
      
      // Generate insights based on the text
      const bhashaInsights = ensureThreePoetInsights([], recognizedText, recognizedText.length);
      const suggestedQuestions = generateFallbackQuestions(recognizedText, []);
      
      return {
        recognizedText: recognizedText,
        confidence: 85,
        isQuestion: recognizedText.includes('?') || recognizedText.includes('؟'),
        bhashaInsights: bhashaInsights,
        suggestedQuestions: suggestedQuestions,
        candidates: [],
        processingTimeMs: Math.round(endTime - startTime),
      };
    }
    
    throw new Error("No response");
    
  } catch (error) {
    console.error("Direct analysis error:", error);
    return {
      recognizedText: "ত্রুটি: সরাসরি বিশ্লেষণ ব্যর্থ",
      confidence: 0,
      isQuestion: false,
      bhashaInsights: [],
      suggestedQuestions: [],
      candidates: [],
      processingTimeMs: Math.round(performance.now() - startTime),
    };
  }
};

// Keep your existing chatWithBhasha function unchanged
export const chatWithBhasha = async (history: ChatMessage[], contextText: string, persona: ChatPersona = 'tutor'): Promise<string> => {
  // Your existing implementation
  // ... (keep as is)
};
