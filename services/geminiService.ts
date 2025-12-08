import { GoogleGenAI, Type, Schema } from "@google/genai";
import { RecognitionResult, ChatMessage, ChatPersona } from "../types";

// Define the schema for structured output
const recognitionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    recognizedText: {
      type: Type.STRING,
      description: "The exact Bengali text content identified in the image section.",
    },
    confidence: {
      type: Type.NUMBER,
      description: "Confidence score between 0 and 100.",
    },
    isQuestion: {
      type: Type.BOOLEAN,
      description: "True if the text is a question.",
    },
    textMetadata: {
      type: Type.OBJECT,
      properties: {
        sectionNumber: { type: Type.NUMBER },
        totalSections: { type: Type.NUMBER },
        lineCount: { type: Type.NUMBER },
        wordCount: { type: Type.NUMBER },
        containsMultipleParagraphs: { type: Type.BOOLEAN },
      }
    }
  },
  required: ["recognizedText", "confidence", "isQuestion", "textMetadata"],
};

// Schema for final aggregation
const aggregationSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    fullText: {
      type: Type.STRING,
      description: "Complete concatenated text from all sections with proper formatting.",
    },
    bhashaInsights: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          poet: { type: Type.STRING },
          mood: { type: Type.STRING },
          content: { type: Type.STRING },
        }
      }
    },
    suggestedQuestions: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    confidence: { type: Type.NUMBER },
    isQuestion: { type: Type.BOOLEAN },
    textMetrics: {
      type: Type.OBJECT,
      properties: {
        totalCharacters: { type: Type.NUMBER },
        totalWords: { type: Type.NUMBER },
        totalLines: { type: Type.NUMBER },
        estimatedPages: { type: Type.NUMBER },
      }
    }
  },
  required: ["fullText", "bhashaInsights", "suggestedQuestions", "confidence", "isQuestion", "textMetrics"],
};

// Image preprocessing function to divide image into sections
async function preprocessAndChunkImage(base64Image: string, maxSections: number = 6): Promise<string[]> {
  console.log("Preprocessing image into sections...");
  
  const chunks: string[] = [];
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const img = new Image();
  
  return new Promise((resolve, reject) => {
    img.onload = () => {
      // Calculate optimal dimensions for OCR (Gemini works best with 1024px max dimension)
      const maxDimension = 1024;
      let width = img.width;
      let height = img.height;
      
      // Scale down if too large
      if (width > maxDimension || height > maxDimension) {
        const scale = maxDimension / Math.max(width, height);
        width = Math.floor(width * scale);
        height = Math.floor(height * scale);
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // Draw and enhance image
      ctx?.drawImage(img, 0, 0, width, height);
      
      // Enhance for handwritten text
      const imageData = ctx?.getImageData(0, 0, width, height);
      if (imageData && ctx) {
        // Increase contrast for better OCR
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          // Convert to grayscale and enhance contrast
          const avg = 0.299 * r + 0.587 * g + 0.114 * b;
          const enhanced = avg < 128 ? 0 : 255;
          
          data[i] = enhanced;     // R
          data[i + 1] = enhanced; // G
          data[i + 2] = enhanced; // B
        }
        ctx.putImageData(imageData, 0, 0);
      }
      
      // Get full image as base64
      const fullImage = canvas.toDataURL('image/jpeg', 0.85);
      
      // For very large images, create logical sections
      const sections = Math.min(maxSections, Math.ceil(height / 400)); // ~400px per section
      
      if (sections <= 1 || height < 800) {
        // Image is small enough for single processing
        chunks.push(fullImage);
      } else {
        // Create horizontal sections
        const sectionHeight = Math.ceil(height / sections);
        
        for (let i = 0; i < sections; i++) {
          const sectionCanvas = document.createElement('canvas');
          const sectionCtx = sectionCanvas.getContext('2d');
          
          sectionCanvas.width = width;
          sectionCanvas.height = sectionHeight + 100; // Overlap to prevent cutting words
          
          const startY = Math.max(0, i * sectionHeight - 50); // 50px overlap
          const endY = Math.min(height, startY + sectionHeight + 100);
          const actualHeight = endY - startY;
          
          sectionCanvas.height = actualHeight;
          
          // Draw the section
          sectionCtx?.drawImage(
            canvas,
            0, startY, width, actualHeight, // Source
            0, 0, width, actualHeight       // Destination
          );
          
          chunks.push(sectionCanvas.toDataURL('image/jpeg', 0.9));
        }
      }
      
      console.log(`Image divided into ${chunks.length} sections`);
      resolve(chunks);
    };
    
    img.onerror = reject;
    img.src = base64Image;
  });
}

// Process a single image section
async function processImageSection(ai: GoogleGenAI, imageChunk: string, sectionNumber: number, totalSections: number): Promise<any> {
  const cleanBase64 = imageChunk.replace(/^data:image\/jpeg;base64,/, "");
  
  const sectionPrompt = `
  **IMAGE SECTION ${sectionNumber} OF ${totalSections}**
  
  Analyze ONLY this section of a larger Bengali handwritten document.
  
  **CRITICAL INSTRUCTIONS:**
  1. Extract ALL Bengali text from this section only
  2. Preserve EXACT characters, line breaks, and spacing
  3. If text continues from previous section or continues to next, still extract completely
  4. Return ONLY the text found in this section
  5. Include confidence score based on clarity of THIS section only
  
  **BENGALI CHARACTER RECOGNITION PRIORITIES:**
  - Focus on অ-হ letters
  - Recognize যুক্তাক্ষর (compound letters)
  - Preserve punctuation (।, ,, ;, :, !, ?)
  - Maintain line breaks where visible
  
  **OUTPUT FORMAT:**
  Return pure Bengali text only from this section.
  `;
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash", // Using 1.5 for better OCR
      config: {
        responseMimeType: "application/json",
        responseSchema: recognitionSchema,
        temperature: 0.1,
        maxOutputTokens: 2048,
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
            text: sectionPrompt
          }
        ]
      }
    });
    
    if (response.text) {
      const data = JSON.parse(response.text);
      return {
        ...data,
        textMetadata: {
          ...data.textMetadata,
          sectionNumber,
          totalSections
        }
      };
    }
  } catch (error) {
    console.error(`Error processing section ${sectionNumber}:`, error);
    return {
      recognizedText: `[ত্রুটি: এই অংশ পড়া যায়নি]`,
      confidence: 0,
      isQuestion: false,
      textMetadata: {
        sectionNumber,
        totalSections,
        lineCount: 0,
        wordCount: 0,
        containsMultipleParagraphs: false
      }
    };
  }
  
  return {
    recognizedText: "",
    confidence: 0,
    isQuestion: false,
    textMetadata: {
      sectionNumber,
      totalSections,
      lineCount: 0,
      wordCount: 0,
      containsMultipleParagraphs: false
    }
  };
}

// Main enhanced handwriting analysis function
export const analyzeHandwriting = async (base64Image: string): Promise<RecognitionResult> => {
  const startTime = performance.now();
  
  console.log("analyzeHandwriting: Starting enhanced processing", {
    inputLength: base64Image.length,
    timestamp: new Date().toISOString()
  });
  
  try {
    const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY;
    
    if (!apiKey) {
      throw new Error("API Key not found. Please set GEMINI_API_KEY in your .env file");
    }
    
    const ai = new GoogleGenAI({ apiKey });
    
    // Step 1: Preprocess and chunk the image
    console.log("Step 1: Image preprocessing...");
    const imageChunks = await preprocessAndChunkImage(base64Image, 4); // Max 4 sections
    
    // Step 2: Process each section in parallel with rate limiting
    console.log(`Step 2: Processing ${imageChunks.length} sections...`);
    
    const sectionPromises = imageChunks.map((chunk, index) => 
      processImageSection(ai, chunk, index + 1, imageChunks.length)
    );
    
    // Process with delay between requests to avoid rate limiting
    const sectionResults = [];
    for (let i = 0; i < sectionPromises.length; i++) {
      console.log(`Processing section ${i + 1}/${sectionPromises.length}...`);
      const result = await sectionPromises[i];
      sectionResults.push(result);
      
      // Add delay between requests (except last one)
      if (i < sectionPromises.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    // Step 3: Aggregate results
    console.log("Step 3: Aggregating results...");
    
    const allText = sectionResults
      .map(result => result.recognizedText || "")
      .join('\n\n') // Add spacing between sections
      .replace(/\n{3,}/g, '\n\n'); // Normalize excessive newlines
    
    const avgConfidence = sectionResults.length > 0 
      ? sectionResults.reduce((sum, r) => sum + (r.confidence || 0), 0) / sectionResults.length
      : 0;
    
    const containsQuestion = sectionResults.some(r => r.isQuestion);
    
    // Step 4: Generate comprehensive analysis from full text
    console.log("Step 4: Generating comprehensive analysis...");
    
    const analysisPrompt = `
    **FULL BENGALI TEXT ANALYSIS**
    
    Complete Bengali Text (from multiple image sections):
    """
    ${allText}
    """
    
    **ANALYSIS TASK:**
    1. **TEXT VALIDATION**: 
       - Verify this is 100% Bengali text
       - If ANY non-Bengali characters exist, return empty results
       - Calculate overall confidence based on text coherence
    
    2. **COMPREHENSIVE POETIC ANALYSIS** (Generate exactly 3):
       - RABINDRANATH TAGORE: Philosophical, spiritual, nature-focused reflection
       - KAZI NAZRUL ISLAM: Revolutionary, passionate, energetic response
       - JASIM UDDIN: Folk, emotional, rural-life perspective
    
    3. **SUGGESTED QUESTIONS** (Generate exactly 3 in Bengali):
       - 1. Educational/Grammar question (Tutor style)
       - 2. Analytical/Structural question (Analyst style)
       - 3. Creative/Thematic question (Muse style)
    
    4. **TEXT METRICS**:
       - Calculate character count, word count, line count
       - Estimate if this represents a full page
    
    **RULES FOR LONG TEXTS:**
    - For texts over 500 characters: Provide detailed poet responses (100-150 words each)
    - For texts over 1000 characters: Provide comprehensive analysis
    - ALWAYS generate 3 poet responses regardless of length
    - Responses should address the ENTIRE text, not just parts
    
    **FORMATTING:**
    - No dashes (—, -, –) in poet responses
    - Clean Bengali text only
    - Direct language without prefixes
    `;
    
    const finalResponse = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      config: {
        responseMimeType: "application/json",
        responseSchema: aggregationSchema,
        temperature: 0.7,
        maxOutputTokens: 4096,
      },
      contents: [
        {
          text: analysisPrompt
        }
      ]
    });
    
    const endTime = performance.now();
    const processingTime = Math.round(endTime - startTime);
    
    if (finalResponse.text) {
      const finalData = JSON.parse(finalResponse.text);
      
      // Validate text is Bengali
      const isBengali = /^[\u0980-\u09FF\u09E6-\u09EF\s\r\n\u200C\u200D,\.;:!?\-'"()।॥]+$/.test(allText.trim());
      
      if (!isBengali || !allText.trim()) {
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
      
      // Ensure we have poet insights
      let bhashaInsights = Array.isArray(finalData.bhashaInsights) ? finalData.bhashaInsights : [];
      
      // Fallback if Gemini didn't generate insights
      if (bhashaInsights.length === 0 && allText.trim()) {
        bhashaInsights = generateFallbackPoetInsights(allText);
      }
      
      // Ensure exactly 3 insights
      if (bhashaInsights.length > 3) bhashaInsights = bhashaInsights.slice(0, 3);
      while (bhashaInsights.length < 3) {
        bhashaInsights.push(generateEmptyPoetInsight(bhashaInsights.length));
      }
      
      return {
        recognizedText: allText,
        confidence: Math.min(95, avgConfidence * 0.8 + (finalData.confidence || 0) * 0.2),
        isQuestion: containsQuestion || finalData.isQuestion,
        bhashaInsights: bhashaInsights,
        suggestedQuestions: Array.isArray(finalData.suggestedQuestions) 
          ? finalData.suggestedQuestions 
          : generateDefaultQuestions(allText),
        candidates: [],
        processingTimeMs: processingTime,
      };
    }
    
    throw new Error("No final analysis generated");
    
  } catch (error: any) {
    console.error("Enhanced analysis failed:", error);
    
    const processingTime = Math.round(performance.now() - startTime);
    
    return {
      recognizedText: `ত্রুটি: ${error.message.substring(0, 100)}`,
      confidence: 0,
      isQuestion: false,
      bhashaInsights: [],
      suggestedQuestions: [],
      candidates: [],
      processingTimeMs: processingTime,
    };
  }
};

// Helper functions
function generateFallbackPoetInsights(text: string): any[] {
  const textLength = text.length;
  const wordCount = text.split(/\s+/).length;
  
  return [
    {
      poet: "Rabindranath Tagore",
      mood: "Philosophical",
      content: `এই ${textLength > 500 ? 'বিস্তৃত রচনায়' : 'লেখনীতে'} ${wordCount} শব্দের মাধ্যমে একটি গভীর চিন্তার প্রকাশ ঘটেছে। ভাষার সৌন্দর্য ও অর্থের গভীরতা পাঠককে নিজের অন্তরের সাথে সংযোগ স্থাপনে উদ্বুদ্ধ করে।`
    },
    {
      poet: "Kazi Nazrul Islam",
      mood: "Revolutionary",
      content: `শব্দগুলির মধ্যে লক্ষ্য করা যায় স্পষ্টতা ও শক্তির প্রকাশ। ${textLength > 300 ? 'সম্পূর্ণ রচনাটি বিশ্লেষণ করলে বোঝা যায় এটি কোনও সাধারণ লেখা নয়, বরং একটি সচেতন অভিব্যক্তি।' : 'প্রতিটি বর্ণ যেন নিজের অধিকারের দাবি জানাচ্ছে।'}`
    },
    {
      poet: "Jasim Uddin",
      mood: "Folk",
      content: `লেখনীর সরলতা ও স্বচ্ছতা আমাকে গ্রাম বাংলার কথাই মনে করিয়ে দেয়। ${text.includes('?') ? 'প্রশ্নটি সাধারণ মানুষের জীবনযাপন থেকে উঠে এসেছে বলেই মনে হয়।' : 'শব্দগুলি আমাদের দৈনন্দিন জীবনের খুব কাছের।'}`
    }
  ];
}

function generateEmptyPoetInsight(index: number): any {
  const poets = [
    { name: "Rabindranath Tagore", mood: "Philosophical" },
    { name: "Kazi Nazrul Islam", mood: "Revolutionary" },
    { name: "Jasim Uddin", mood: "Folk" }
  ];
  
  return {
    poet: poets[index].name,
    mood: poets[index].mood,
    content: "এই লেখনীটি এখনও সম্পূর্ণ বিশ্লেষণের অপেক্ষায় রয়েছে।"
  };
}

function generateDefaultQuestions(text: string): string[] {
  return [
    "এই লেখার ব্যাকরণগত গঠন সম্পর্কে কী বলবেন?",
    "হাতের লেখার শৈলী ও গঠন বিশ্লেষণ করুন",
    "এই লেখার সৃজনশীল দিকগুলো কী কী?"
  ];
}

// Alternative simplified function for single-pass processing (faster but less accurate for full pages)
export const analyzeHandwritingSimple = async (base64Image: string): Promise<RecognitionResult> => {
  const startTime = performance.now();
  
  try {
    const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    
    const ai = new GoogleGenAI({ apiKey });
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");
    
    // Simple but effective prompt for full pages
    const prompt = `
    **FULL PAGE BENGALI HANDWRITING ANALYSIS**
    
    You are analyzing a FULL PAGE of Bengali handwritten text. This is CRITICAL:
    
    1. **EXTRACT EVERYTHING**: Read ALL text from top to bottom, left to right
    2. **NO TRUNCATION**: Do NOT shorten or truncate the text. Return COMPLETE text.
    3. **PRESERVE STRUCTURE**: Keep paragraphs, line breaks, and spacing as in original
    4. **ONLY BENGALI**: If text contains ANY non-Bengali, return empty string
    
    **FOR LONG TEXTS (500+ characters)**:
    - Still return COMPLETE text
    - Still generate 3 poet responses (detailed)
    - Still generate 3 suggested questions
    
    **OCR FOCUS**:
    - Prioritize accuracy over speed
    - Use context to resolve ambiguous characters
    - Recognize যুক্তাক্ষর (compound letters) correctly
    - Maintain punctuation (।, ,, ;, :, !, ?)
    
    **OUTPUT INSTRUCTIONS**:
    Return complete Bengali text exactly as written.
    For analysis, consider the ENTIRE text as one coherent piece.
    `;
    
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash", // Use 1.5 for better long-context
      config: {
        responseMimeType: "application/json",
        responseSchema: aggregationSchema,
        systemInstruction: prompt,
        temperature: 0.1,
        maxOutputTokens: 8192, // Maximum for long texts
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
            text: "Read ALL Bengali text from this full page image completely. Do not truncate. Extract everything."
          }
        ]
      }
    });
    
    const endTime = performance.now();
    
    if (response.text) {
      const data = JSON.parse(response.text);
      
      // Validate Bengali
      const isBengali = /^[\u0980-\u09FF\u09E6-\u09EF\s\r\n\u200C\u200D,\.;:!?\-'"()।॥]+$/.test(data.fullText || "");
      
      if (!isBengali || !data.fullText?.trim()) {
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
      
      return {
        recognizedText: data.fullText,
        confidence: data.confidence || 85,
        isQuestion: data.isQuestion || false,
        bhashaInsights: Array.isArray(data.bhashaInsights) ? data.bhashaInsights : generateFallbackPoetInsights(data.fullText),
        suggestedQuestions: Array.isArray(data.suggestedQuestions) ? data.suggestedQuestions : generateDefaultQuestions(data.fullText),
        candidates: [],
        processingTimeMs: Math.round(endTime - startTime),
      };
    }
    
    throw new Error("No response from API");
    
  } catch (error: any) {
    console.error("Simple analysis failed:", error);
    
    return {
      recognizedText: "ত্রুটি: বিশ্লেষণ ব্যর্থ। ছবিটি খুব বড় হতে পারে বা বাংলা লেখা স্পষ্ট নয়।",
      confidence: 0,
      isQuestion: false,
      bhashaInsights: [],
      suggestedQuestions: [],
      candidates: [],
      processingTimeMs: Math.round(performance.now() - startTime),
    };
  }
};

// Keep your existing chatWithBhasha function
export const chatWithBhasha = async (history: ChatMessage[], contextText: string, persona: ChatPersona = 'tutor'): Promise<string> => {
  // Your existing implementation
  // ... (keep as is)
};
