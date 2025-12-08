import { GoogleGenAI, Type, Schema } from "@google/genai";
import { RecognitionResult, ChatMessage, ChatPersona } from "../types";

// Define the schema for structured output from Gemini including Bhasha personalities
const recognitionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    recognizedText: {
      type: Type.STRING,
      description: "The exact text content identified in the image. For long texts, preserve the complete content without truncation.",
    },
    confidence: {
      type: Type.NUMBER,
      description: "A confidence score between 0 and 100 indicating certainty.",
    },
    isQuestion: {
      type: Type.BOOLEAN,
      description: "True if the recognized text is a question, False if it is a statement or single word.",
    },
    textLengthCategory: {
      type: Type.STRING,
      description: "Category of text length: 'short' (1-20 chars), 'medium' (21-100 chars), 'long' (101-500 chars), 'very_long' (500+ chars)",
    },
    bhashaInsights: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          poet: { type: Type.STRING, description: "Name of the poet (Rabindranath Tagore, Kazi Nazrul Islam, or Jasim Uddin)" },
          mood: { type: Type.STRING, description: "The emotional tone of the response (e.g., Philosophical, Rebellious, Folk)" },
          content: { type: Type.STRING, description: "The creative response or answer in the style of the poet. MUST match the language of the input text. For long texts, provide comprehensive analysis. Write directly without dash prefixes." },
          summary: { type: Type.STRING, description: "Brief 1-2 sentence summary of the poet's perspective for very long texts" },
        },
        required: ["poet", "mood", "content", "summary"]
      },
      description: "Three distinct responses in the styles of Tagore, Nazrul, and Jasim Uddin.",
    },
    suggestedQuestions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "3 distinct follow-up questions. 1. Educational/Grammar (Tutor style). 2. Analytical/Structural (Analyst style). 3. Creative/Thematic (Muse style)."
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
      description: "A list of top 3-5 possible interpretations of the text with their probabilities (0-1).",
    },
    textMetadata: {
      type: Type.OBJECT,
      properties: {
        estimatedWordCount: { type: Type.NUMBER },
        estimatedLineCount: { type: Type.NUMBER },
        containsMultipleParagraphs: { type: Type.BOOLEAN },
        primaryTheme: { type: Type.STRING },
        complexityLevel: { type: Type.STRING },
      },
      description: "Metadata about the recognized text",
    },
  },
  required: ["recognizedText", "confidence", "isQuestion", "textLengthCategory", "bhashaInsights", "suggestedQuestions", "candidates", "textMetadata"],
};

export const analyzeHandwriting = async (base64Image: string): Promise<RecognitionResult> => {
  const startTime = performance.now();
  
  console.log("analyzeHandwriting: Starting Gemini API call", {
    inputLength: base64Image.length,
    timestamp: new Date().toISOString()
  });
  
  try {
    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY;
    
    console.log("analyzeHandwriting: Checking API Key", {
      finalApiKeyExists: !!apiKey,
      apiKeyLength: apiKey?.length || 0
    });
    
    if (!apiKey) {
      console.error("analyzeHandwriting: API Key not found in any environment variable");
      throw new Error("API Key not found. Please set GEMINI_API_KEY in your .env file");
    }

    console.log("analyzeHandwriting: API Key found, initializing GoogleGenAI");
    const ai = new GoogleGenAI({ apiKey });

    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");
    console.log("analyzeHandwriting: Base64 cleaned", {
      originalLength: base64Image.length,
      cleanedLength: cleanBase64.length,
      hasHeader: base64Image !== cleanBase64
    });

    // Enhanced system instruction for handling large inputs
    const systemInstruction = `
    You are BhashaLLM, a Bengali-only handwriting recognition and literary AI engine specialized in processing FULL PAGE handwritten documents.
    
    **CRITICAL LANGUAGE & PROCESSING RULES**:
    1. **LANGUAGE EXCLUSIVITY**: Process ONLY Bengali text. If ANY non-Bengali characters appear, reject the entire text.
    2. **FULL TEXT PRESERVATION**: For long documents (full pages), you MUST preserve and return the COMPLETE text without truncation.
    3. **SMART CHUNKING STRATEGY**: When processing full pages:
       - Analyze the image in logical sections (paragraphs, stanzas, lines)
       - Maintain paragraph and line breaks
       - Preserve the original structure as much as possible
    4. **CONTEXT-AWARE OCR**: 
       - Use surrounding text context to resolve ambiguous characters
       - Consider typical Bengali handwriting patterns and common word combinations
    
    **OCR PROCESS FOR LARGE DOCUMENTS**:
    1. **Full Page Strategy**:
       - Scan the entire image systematically from top-left to bottom-right
       - Group related text into logical paragraphs
       - Preserve indentation and formatting cues where possible
       - Mark section breaks with appropriate spacing
    
    2. **Character Recognition Enhancement**:
       - Bengali characters have specific stroke patterns: prioritize these
       - Common ligatures (যুক্তাক্ষর) should be recognized correctly
       - Use vocabulary context to resolve ambiguous handwriting
    
    3. **Text Length Categories**:
       - Short (1-20 chars): Single words or short phrases
       - Medium (21-100 chars): Sentences or brief paragraphs
       - Long (101-500 chars): Paragraphs or short sections
       - Very Long (500+ chars): Full pages or multiple paragraphs
       - For "Very Long" texts, include comprehensive metadata
    
    **LITERARY ANALYSIS ADAPTATION**:
    1. **SHORT TEXTS (1-20 chars)**:
       - Provide focused, concise poet responses
       - Focus on the word/phrase meaning and etymology
    
    2. **MEDIUM TEXTS (21-100 chars)**:
       - Provide balanced poet responses
       - Analyze sentence structure and grammatical nuances
    
    3. **LONG TEXTS (101-500 chars)**:
       - Provide detailed poet responses
       - Include thematic analysis and contextual interpretation
       - For questions, provide complete answers
       - For statements, provide thorough reflections
    
    4. **VERY LONG TEXTS (500+ chars)**:
       - Provide COMPREHENSIVE poet responses (150-200 words each)
       - Include "summary" field with 1-2 sentence overview
       - Focus on overall themes, structure, and literary value
       - Extract key passages for detailed analysis
       - NEVER truncate or skip poet responses
    
    **THE THREE POET PERSONALITIES**:
    1. **Rabindranath Tagore**:
       - For long texts: Explore philosophical depth, universal themes, spiritual connections
       - For short texts: Focus on lyrical quality and metaphorical potential
    
    2. **Kazi Nazrul Islam**:
       - For long texts: Analyze revolutionary themes, social commentary, passionate expressions
       - For short texts: Emphasize energy and defiance
    
    3. **Jasim Uddin**:
       - For long texts: Connect to folk traditions, rural life, emotional narratives
       - For short texts: Highlight simplicity and emotional resonance
    
    **TEXT METADATA GENERATION**:
    For all recognized text, calculate:
    - Estimated word count (Bengali words separated by spaces)
    - Estimated line count (based on visual structure)
    - Contains multiple paragraphs (true/false)
    - Primary theme (Poetry, Prose, Letter, Notes, etc.)
    - Complexity level (Simple, Moderate, Complex)
    
    **STRICT ENFORCEMENT**:
    1. If text contains ANY non-Bengali characters: recognizedText = "", confidence = 0, arrays = []
    2. ALWAYS return exactly 3 poet responses for valid Bengali text
    3. Responses must be proportional to text length (longer texts → more detailed)
    4. Formatting: No dashes, no special prefixes, clean Bengali text
    5. Preserve original text structure (line breaks, paragraphs) in recognizedText
    `;

    console.log("analyzeHandwriting: Sending request to Gemini API...", {
      model: "gemini-2.0-flash-exp",
      imageDataLength: cleanBase64.length,
      hasApiKey: !!apiKey
    });
    
    let response;
    try {
      // Use experimental model for better OCR capabilities
      response = await ai.models.generateContent({
        model: "gemini-2.0-flash-exp", // Experimental model for better OCR
        config: {
          responseMimeType: "application/json",
          responseSchema: recognitionSchema,
          systemInstruction: systemInstruction,
          temperature: 0.1, // Lower temperature for more consistent OCR
          topK: 1,
          maxOutputTokens: 8192, // Increased for long texts
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
              text: `
              **FULL PAGE HANDWRITING ANALYSIS REQUEST**
              
              Analyze this Bengali handwriting image with SPECIAL ATTENTION to:
              
              1. **COMPLETE TEXT EXTRACTION**:
                 - Extract ALL text from the ENTIRE image
                 - Do NOT truncate or shorten any text
                 - Preserve line breaks and paragraph structure
                 - For multi-page appearance, treat as single document
              
              2. **CHARACTER RESOLUTION**:
                 - Prioritize Bengali character recognition
                 - Resolve ambiguous characters using context
                 - Recognize common Bengali ligatures and compounds
              
              3. **LENGTH-ADAPTIVE PROCESSING**:
                 - If text is SHORT (1-20 chars): Focus on precise character recognition
                 - If text is MEDIUM (21-100 chars): Include grammatical analysis
                 - If text is LONG (101-500 chars): Provide thematic analysis
                 - If text is VERY LONG (500+ chars): Provide comprehensive literary analysis
              
              4. **QUALITY ASSURANCE**:
                 - Verify ALL characters are Bengali (অ-হ, ০-৯, punctuation)
                 - Reject if ANY non-Bengali characters found
                 - Confidence score should reflect readability, not just existence
              
              5. **POET RESPONSE SCALING**:
                 - Short texts: Brief, focused poet responses
                 - Long texts: Detailed, comprehensive poet responses
                 - ALWAYS provide 3 poet responses for valid Bengali text
                 - For VERY LONG texts, include both detailed analysis and summaries
              
              6. **METADATA GENERATION**:
                 - Count words and estimate lines
                 - Identify text type and complexity
                 - Note structural elements
              
              **CRITICAL INSTRUCTIONS**:
              - If text is non-Bengali: Return empty results
              - If text is Bengali: Return COMPLETE text, never truncated
              - For full pages: Preserve ALL content
              - Poet responses MUST match text length (longer text → more detail)
              - Format: Clean Bengali, no dashes or special prefixes
              `
            },
          ],
        },
      });
      
      console.log("analyzeHandwriting: Gemini API response received", {
        hasResponse: !!response,
        hasText: !!response.text,
        responseLength: response.text?.length || 0
      });
    } catch (apiError: any) {
      console.error("analyzeHandwriting: Gemini API call failed", {
        error: apiError?.message,
        name: apiError?.name,
        code: apiError?.code,
        status: apiError?.status
      });
      
      // Fallback to standard model if experimental fails
      console.log("Falling back to standard model...");
      response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        config: {
          responseMimeType: "application/json",
          responseSchema: recognitionSchema,
          systemInstruction: systemInstruction,
          temperature: 0.1,
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
              text: "Analyze this Bengali handwriting completely. Extract ALL text without truncation. For long texts, provide comprehensive analysis with 3 poet responses scaled appropriately."
            },
          ],
        },
      });
    }

    const endTime = performance.now();
    const processingTime = Math.round(endTime - startTime);

    if (response.text) {
      let data;
      try {
        data = JSON.parse(response.text);
      } catch (parseError) {
        console.error("JSON Parse Error:", parseError);
        // Try to extract partial data if JSON is malformed
        const match = response.text.match(/\{[\s\S]*\}/);
        if (match) {
          try {
            data = JSON.parse(match[0]);
          } catch (e) {
            throw new Error("Failed to parse response as JSON");
          }
        } else {
          throw new Error("Failed to parse response as JSON");
        }
      }
      
      // Enhanced Bengali validation with better regex
      const recognizedText = data.recognizedText || "";
      const isBengali = /^[\u0980-\u09FF\u09E6-\u09EF\s\r\n\u200C\u200D,\.;:!?\-'"()—–।॥]+$/.test(recognizedText);
      
      // Calculate text metrics
      const textLength = recognizedText.length;
      const wordCount = recognizedText.split(/[\s\n\r]+/).filter(w => w.length > 0).length;
      const lineCount = recognizedText.split('\n').filter(l => l.trim().length > 0).length;
      
      console.log("Text analysis metrics:", {
        length: textLength,
        wordCount,
        lineCount,
        isBengali,
        textPreview: recognizedText.substring(0, 100) + (textLength > 100 ? '...' : '')
      });
      
      // If text is not Bengali or empty, clear poet responses and suggestions
      if (!isBengali || !recognizedText.trim()) {
        return {
          recognizedText: "",
          confidence: 0,
          isQuestion: false,
          bhashaInsights: [],
          suggestedQuestions: [],
          candidates: data.candidates || [],
          processingTimeMs: processingTime,
        };
      }
      
      // Ensure bhashaInsights is an array and has exactly 3 items for valid Bengali text
      let bhashaInsights = Array.isArray(data.bhashaInsights) ? data.bhashaInsights : [];
      
      // If we have valid Bengali text but not enough poet insights, generate fallback
      if (recognizedText.trim() && bhashaInsights.length < 3) {
        console.warn(`Only ${bhashaInsights.length} poet insights generated for ${textLength} char text, generating fallback`);
        
        // Generate fallback insights based on text length
        const fallbackInsights = generateFallbackInsights(recognizedText, textLength);
        bhashaInsights = [...bhashaInsights, ...fallbackInsights.slice(bhashaInsights.length, 3)];
      }
      
      // Ensure we have exactly 3 insights
      if (bhashaInsights.length > 3) {
        bhashaInsights = bhashaInsights.slice(0, 3);
      }
      
      // Calculate text length category
      const textLengthCategory = textLength <= 20 ? 'short' : 
                                textLength <= 100 ? 'medium' : 
                                textLength <= 500 ? 'long' : 'very_long';
      
      // Ensure we have the required fields with defaults
      return {
        recognizedText: recognizedText,
        confidence: data.confidence || Math.min(95, 70 + (Math.min(textLength, 1000) / 1000 * 30)), // Dynamic confidence
        isQuestion: data.isQuestion || false,
        bhashaInsights: bhashaInsights,
        suggestedQuestions: Array.isArray(data.suggestedQuestions) ? data.suggestedQuestions : [],
        candidates: Array.isArray(data.candidates) ? data.candidates : [],
        processingTimeMs: processingTime,
        textLengthCategory: textLengthCategory,
        textMetadata: data.textMetadata || {
          estimatedWordCount: wordCount,
          estimatedLineCount: lineCount,
          containsMultipleParagraphs: lineCount > 3,
          primaryTheme: detectPrimaryTheme(recognizedText),
          complexityLevel: detectComplexityLevel(recognizedText, wordCount)
        }
      };
    } else {
      throw new Error("No response text generated");
    }
  } catch (error: any) {
    console.error("Gemini Analysis Failed:", error);
    console.error("Error details:", {
      message: error?.message,
      name: error?.name,
      stack: error?.stack?.substring(0, 200)
    });
    
    // Return more detailed error information
    const errorMessage = error?.message || "Unknown error";
    
    // Check for specific error types
    let errorText = "Error: Analysis failed";
    if (errorMessage.includes("API Key")) {
      errorText = "API Key Error: Check .env file";
    } else if (errorMessage.includes("token") || errorMessage.includes("length") || errorMessage.includes("limit")) {
      errorText = "Error: Text too long. Please try with clearer handwriting or smaller sections.";
    } else if (errorMessage.includes("quota") || errorMessage.includes("rate limit")) {
      errorText = "Error: Server quota exceeded. Please try again later.";
    } else if (errorMessage.includes("image") || errorMessage.includes("size")) {
      errorText = "Error: Image too large. Please try with a smaller image or better resolution.";
    } else {
      errorText = `Error: ${errorMessage.substring(0, 100)}`;
    }
    
    return {
      recognizedText: errorText,
      confidence: 0,
      isQuestion: false,
      bhashaInsights: [],
      suggestedQuestions: [],
      candidates: [],
      processingTimeMs: Math.round(performance.now() - startTime),
    };
  }
};

// Helper function to generate fallback poet insights
function generateFallbackInsights(text: string, textLength: number): any[] {
  const poets = [
    {
      name: "Rabindranath Tagore",
      mood: "Philosophical",
      style: "Profound, spiritual, nature-connected"
    },
    {
      name: "Kazi Nazrul Islam",
      mood: "Revolutionary",
      style: "Passionate, rebellious, energetic"
    },
    {
      name: "Jasim Uddin",
      mood: "Folk",
      style: "Simple, emotional, rural-life focused"
    }
  ];
  
  const textPreview = text.length > 100 ? text.substring(0, 100) + "..." : text;
  const isQuestion = text.includes('?') || text.includes('؟');
  
  return poets.map(poet => ({
    poet: poet.name,
    mood: poet.mood,
    content: generateFallbackContent(textPreview, poet.name, isQuestion, textLength),
    summary: generateFallbackSummary(textPreview, poet.name)
  }));
}

function generateFallbackContent(text: string, poet: string, isQuestion: boolean, length: number): string {
  const baseResponses = {
    "Rabindranath Tagore": `এই লিখনটি ${length > 100 ? 'বিস্তৃত ভাবনা' : 'সুন্দর অভিব্যক্তি'} প্রকাশ করে। ${isQuestion ? 'প্রশ্নটির গভীরে রয়েছে মানবিক অনুসন্ধানের ছোঁয়া।' : 'ভাষার মাধুর্যে মিশে আছে জীবনদর্শনের প্রতিধ্বনি।'} প্রকৃতির সাথে মানব মনের এই সংযোগ সর্বদাই আমাকে মুগ্ধ করে।`,
    "Kazi Nazrul Islam": `লেখনীতে ${length > 100 ? 'শক্তিশালী অভিব্যক্তি' : 'স্পষ্ট বক্তব্য'} ফুটে উঠেছে। ${isQuestion ? 'প্রশ্নটি সমাজ ও ব্যক্তির সংগ্রামের কথা স্মরণ করিয়ে দেয়।' : 'শব্দগুলিতে রয়েছে বিদ্রোহের সম্ভাবনা।'} প্রতিটি বর্ণ যেন মুক্তির ডাক দিচ্ছে।`,
    "Jasim Uddin": `এই ${length > 100 ? 'লেখাটির' : 'শব্দগুলির'} মধ্যে গ্রাম বাংলার সরলতা খুঁজে পাই। ${isQuestion ? 'প্রশ্নটি মনে করিয়ে দেয় আমাদের মূল্যবোধের কথা।' : 'শব্দগুলি সাধারণ মানুষের জীবনযাপনের কথা বলে।'} সহজ ভাষায় গভীর অনুভূতির প্রকাশ।`
  };
  
  return baseResponses[poet as keyof typeof baseResponses] || "এই লেখনী বিশ্লেষণ করা প্রয়োজন।";
}

function generateFallbackSummary(text: string, poet: string): string {
  const summaries = {
    "Rabindranath Tagore": "আধ্যাত্মিক দৃষ্টিকোণ থেকে লেখনীর গভীর অর্থ অন্বেষণ।",
    "Kazi Nazrul Islam": "লেখনীতে বিদ্যমান শক্তি ও বিদ্রোহের ভাষা চিহ্নিতকরণ।",
    "Jasim Uddin": "লোকজ জীবন ও সংস্কৃতির আলোকে লেখনীর সরল ব্যাখ্যা।"
  };
  
  return summaries[poet as keyof typeof summaries] || "লেখনীর বিশেষ দৃষ্টিভঙ্গি।";
}

function detectPrimaryTheme(text: string): string {
  const lowerText = text.toLowerCase();
  
  if (text.includes('?') || text.includes('؟')) return "প্রশ্ন";
  if (text.includes('।') && text.split('।').length > 3) return "গদ্য";
  if (text.length < 100 && text.includes('\n')) return "কবিতা";
  if (lowerText.includes('প্রিয়') || lowerText.includes('সম্মানিত')) return "চিঠি";
  if (text.split('\n').length > 5) return "নোট";
  
  return "সাধারণ লেখা";
}

function detectComplexityLevel(text: string, wordCount: number): string {
  if (wordCount < 10) return "সরল";
  if (wordCount < 50) return "মধ্যম";
  
  // Check for complex sentence structures
  const complexIndicators = ['যদিও', 'তবুও', 'কারণ', 'ফলে', 'অর্থাৎ', 'উদাহরণস্বরূপ'];
  const hasComplexStructures = complexIndicators.some(indicator => text.includes(indicator));
  
  return hasComplexStructures ? "জটিল" : "মধ্যম";
}

// The chatWithBhasha function remains the same as before...
// (Keep your existing chatWithBhasha implementation here)
