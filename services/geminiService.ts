import { GoogleGenAI, Type, Schema } from "@google/genai";
import { RecognitionResult, ChatMessage, ChatPersona } from "../types";

// Define the schema for structured output from Gemini including Bhasha personalities
const recognitionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    recognizedText: {
      type: Type.STRING,
      description: "The exact text content identified in the image.",
    },
    confidence: {
      type: Type.NUMBER,
      description: "A confidence score between 0 and 100 indicating certainty.",
    },
    isQuestion: {
      type: Type.BOOLEAN,
      description: "True if the recognized text is a question, False if it is a statement or single word.",
    },
    bhashaInsights: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          poet: { type: Type.STRING, description: "Name of the poet (Rabindranath Tagore, Kazi Nazrul Islam, or Jasim Uddin)" },
          mood: { type: Type.STRING, description: "The emotional tone of the response (e.g., Philosophical, Rebellious, Folk)" },
          content: { type: Type.STRING, description: "The creative response or answer in the style of the poet. MUST match the language of the input text. Do NOT use em dashes (—) or any dashes at the beginning or within the content. Write directly without dash prefixes." },
        },
        required: ["poet", "mood", "content"]
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
  },
  required: ["recognizedText", "confidence", "isQuestion", "bhashaInsights", "suggestedQuestions", "candidates"],
};

export const analyzeHandwriting = async (base64Image: string): Promise<RecognitionResult> => {
  const startTime = performance.now();
  
  console.log("analyzeHandwriting: Starting Gemini API call", {
    inputLength: base64Image.length,
    inputPreview: base64Image.substring(0, 50),
    timestamp: new Date().toISOString()
  });
  
  try {
    // Try multiple possible environment variable names
    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY;
    
    console.log("analyzeHandwriting: Checking API Key", {
      hasAPI_KEY: !!process.env.API_KEY,
      hasGEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
      hasViteAPI_KEY: !!(import.meta as any).env?.VITE_API_KEY,
      hasViteGeminiAPI_KEY: !!(import.meta as any).env?.VITE_GEMINI_API_KEY,
      finalApiKeyExists: !!apiKey,
      apiKeyLength: apiKey?.length || 0
    });
    
    if (!apiKey) {
      console.error("analyzeHandwriting: API Key not found in any environment variable");
      console.error("Please set GEMINI_API_KEY in your .env file");
      throw new Error("API Key not found. Please set GEMINI_API_KEY in your .env file");
    }

    console.log("analyzeHandwriting: API Key found, initializing GoogleGenAI", {
      apiKeyPreview: apiKey.substring(0, 10) + "..."
    });
    const ai = new GoogleGenAI({ apiKey });

    // Clean base64 string if it contains metadata header
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");
    console.log("analyzeHandwriting: Base64 cleaned", {
      originalLength: base64Image.length,
      cleanedLength: cleanBase64.length,
      hasHeader: base64Image !== cleanBase64
    });

    const systemInstruction = `
    You are BhashaLLM, a Bengali-only handwriting recognition and literary AI engine.
    
    **CRITICAL LANGUAGE RESTRICTION**: This system ONLY recognizes and processes BENGALI text. Any other language (English, Hindi, Arabic, etc.) must be REJECTED.
    
    1. **OCR Task**: Accurately recognize the handwritten text in the image. 
       - **ONLY recognize Bengali characters** (বাংলা অক্ষর: অ-হ, ০-৯)
       - If the text contains ANY non-Bengali characters (English letters, numbers, symbols, etc.), set recognizedText to an empty string "" and confidence to 0.
       - If you cannot clearly identify Bengali text, return empty recognizedText.
       - **IMPORTANT**: Recognize the FULL text, even if it is long. Do not truncate or shorten the recognized text.
    
    2. **Language Validation (MANDATORY)**:
       - Check if the recognized text contains ONLY Bengali characters (Bengali script: অ-হ, ০-৯, and Bengali punctuation).
       - If ANY English letters (A-Z, a-z), Arabic numerals (0-9), or other non-Bengali characters are detected, the text is INVALID.
       - Only proceed with analysis if the text is 100% Bengali.
    
    3. **Literary Analysis (BENGALI ONLY - CRITICAL FOR LONG TEXTS)**:
       - **ONLY** if the recognized text is valid Bengali:
         - **MANDATORY**: You MUST ALWAYS generate exactly 3 poet responses in bhashaInsights array, regardless of text length.
         - For **longer texts**: Provide comprehensive poetic reflections that address the full meaning and themes of the text.
         - If the text is a **Question**, answer it completely in the styles of three legendary Bengali poets.
         - If the text is a **Word or Statement**, provide a detailed poetic reflection or meaning in the styles of these poets.
         - **DO NOT skip poet responses for long texts**. Long texts require MORE detailed analysis, not less.
       - **IF TEXT IS NOT BENGALI**: Return an EMPTY array [] for bhashaInsights. Do NOT provide any poet responses.
    
    4. **Prediction (Follow-up Questions - BENGALI ONLY)**:
       - **ONLY** if the recognized text is valid Bengali, suggest 3 diverse questions in Bengali:
         - **Tutor Question**: Focus on grammar, origin, definition, or correct usage (in Bengali).
         - **Analyst Question**: Focus on the visual structure, stroke quality, or historical context (in Bengali).
         - **Muse Question**: Focus on the deeper meaning, metaphorical interpretation, or artistic value (in Bengali).
       - **IF TEXT IS NOT BENGALI**: Return an EMPTY array [] for suggestedQuestions.
    
    **The Personas (for bhashaInsights only - BENGALI TEXT REQUIRED):**
    - **Rabindranath Tagore**: Philosophical, spiritual, nature-focused, profound, universalism. For longer texts, provide deeper philosophical reflections.
    - **Kazi Nazrul Islam**: Revolutionary, passionate, rebellious, energetic, breaking barriers. For longer texts, explore the revolutionary themes more thoroughly.
    - **Jasim Uddin**: Folk, rural, simple, emotional, connected to the soil and village life. For longer texts, connect to the emotional and cultural depth.
    
    **STRICT ENFORCEMENT**:
    - If recognizedText is empty or contains non-Bengali characters: bhashaInsights = [], suggestedQuestions = [], confidence = 0.
    - All poet responses MUST be in Bengali. If input is not Bengali, return empty arrays.
    - Ensure the "content" for each poet is distinct and captures their unique voice (only for Bengali inputs).
    - **CRITICAL**: For long texts, generate FULL and COMPREHENSIVE poet responses. Do not truncate or shorten responses.
    - **REQUIRED**: The bhashaInsights array MUST contain exactly 3 items for valid Bengali text, regardless of length.
    - **FORMATTING RULE**: Do NOT use em dashes (—) or any dashes at the beginning or within the poetic content. Write the content directly without any dash prefixes or separators.
    `;

    console.log("analyzeHandwriting: Sending request to Gemini API...", {
      model: "gemini-2.5-flash",
      imageDataLength: cleanBase64.length,
      hasApiKey: !!apiKey
    });
    
    let response;
    try {
      response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        config: {
          responseMimeType: "application/json",
          responseSchema: recognitionSchema,
          systemInstruction: systemInstruction,
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
              text: `Analyze this handwriting. IMPORTANT: 
1. Only recognize Bengali text. If the text contains any non-Bengali characters (English, numbers, symbols), return empty recognizedText and empty arrays for bhashaInsights and suggestedQuestions. 
2. Only provide poet responses if the text is 100% Bengali.
3. **CRITICAL FOR LONG TEXTS**: If the recognized text is long, you MUST still generate complete poet responses. Long texts require MORE detailed analysis, not less. Always return exactly 3 poet insights in bhashaInsights array for valid Bengali text, regardless of text length.
4. Ensure all poet responses are comprehensive and address the full meaning of the text, especially for longer passages.
5. **FORMATTING**: Do NOT use em dashes (—) or any dashes (—, -, –) in the poetic content. Write the content directly without any dash prefixes, separators, or quotation marks.`,
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
      throw apiError;
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
        throw new Error("Failed to parse response as JSON");
      }
      
      // Additional validation: Check if recognized text contains non-Bengali characters
      const recognizedText = data.recognizedText || "";
      const isBengali = /^[\u0980-\u09FF\u09E6-\u09EF\s\u200C\u200D,\.;:!?\-'"()]+$/.test(recognizedText.trim());
      
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
      
      // Ensure bhashaInsights is an array and has at least 3 items for valid Bengali text
      const bhashaInsights = Array.isArray(data.bhashaInsights) ? data.bhashaInsights : [];
      
      // If we have valid Bengali text but no poet insights, log a warning
      if (recognizedText.trim() && bhashaInsights.length === 0) {
        console.warn("Valid Bengali text recognized but no poet insights generated. Text length:", recognizedText.length);
      }
      
      // Ensure we have the required fields with defaults
      return {
        recognizedText: recognizedText,
        confidence: data.confidence || 0,
        isQuestion: data.isQuestion || false,
        bhashaInsights: bhashaInsights,
        suggestedQuestions: Array.isArray(data.suggestedQuestions) ? data.suggestedQuestions : [],
        candidates: Array.isArray(data.candidates) ? data.candidates : [],
        processingTimeMs: processingTime,
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
      errorText = "Error: Text too long or exceeded limits. Please try with a shorter text.";
    } else if (errorMessage.includes("quota") || errorMessage.includes("rate limit")) {
      errorText = "Error: Server quota exceeded. Please try again later.";
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

export const chatWithBhasha = async (history: ChatMessage[], contextText: string, persona: ChatPersona = 'tutor'): Promise<string> => {
  try {
    // Try multiple possible environment variable names
    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY;
    
    if (!apiKey) {
      console.error("chatWithBhasha: API Key not found");
      throw new Error("API Key not found. Please set GEMINI_API_KEY in your .env file");
    }

    // Chatbot accepts any language - no language restrictions
    // Note: contextText (recognized text) will always be Bengali since it comes from Bengali-only handwriting analysis

    const ai = new GoogleGenAI({ apiKey });

    // Check if we have context text
    const hasContextText = contextText && contextText.trim();

    // Format history for the prompt - limit to last 10 messages to avoid token limits
    // Also truncate very long messages in history to prevent token overflow
    const recentHistory = history.slice(-10);
    const conversationHistory = recentHistory.map(msg => {
      const content = msg.content.length > 500 
        ? msg.content.substring(0, 500) + '...' 
        : msg.content;
      return `${msg.role === 'user' ? 'User' : 'Bhasha'}: ${content}`;
    }).join('\n');

    // Persona Configuration
    const personaConfig = {
      tutor: {
        role: "Bengali Language Teacher",
        tone: "Educational, objective, and friendly. Act as a modern AI tutor.",
        instruction: `Explain the text clearly, grammatically, and conceptually. ${hasContextText ? `You MUST provide a comprehensive literary review of the recognized Bengali text, including: meaning analysis, grammatical structure, themes, and educational insights. This is MANDATORY when recognized text is provided.` : ''} If asked about poets, explain objectively. Respond in the same language the user uses.`
      },
      analyst: {
        role: "Formal Document Analyst",
        tone: "Professional, precise, concise, and data-driven. No fluff.",
        instruction: "Focus on the structural accuracy, linguistics, and literal meaning of the text. Analyze the handwriting style formally. Respond in the same language the user uses."
      },
      muse: {
        role: "Creative Literary Muse",
        tone: "Imaginative, inspiring, and slightly metaphorical but easy to understand.",
        instruction: "Engage with the artistic soul of the text. Encourage the user to see the deeper beauty and emotion. You can be slightly poetic but remain helpful. Respond in the same language the user uses."
      }
   };

   const currentPersona = personaConfig[persona];

    // Build context part of prompt - include full text but reference it once
    // Note: contextText is always Bengali (from handwriting analysis), but user can ask about it in any language
    const contextPart = hasContextText
      ? `**RECOGNIZED TEXT FROM IMAGE (Bengali)**: "${contextText}"

This is the Bengali text that was recognized from the user's uploaded image. The user may ask questions about this text in any language. You MUST analyze this text and provide insights about it.`
      : "Context: The user is asking a general question. There is no specific recognized text from an image at this moment.";
    
    const prompt = `
    ${contextPart}
    
    Conversation History:
    ${conversationHistory}
    
    You are BhashaLLM, a ${currentPersona.role}.
    
    **Your Role:**
    1. ${currentPersona.instruction}
    2. **Tone**: ${currentPersona.tone}
    3. DO NOT use the "3 Poets" format in this chat. That is for the analysis panel only. Be conversational.
    4. **RESPOND IN THE USER'S LANGUAGE**: Always respond in the same language the user uses. If they write in English, respond in English. If they write in Bengali, respond in Bengali. If they write in Hindi, respond in Hindi, etc.
    5. **CRITICAL - LITERARY REVIEW**: ${hasContextText ? `You MUST provide a literary review and analysis of the recognized Bengali text shown above. Analyze its meaning, themes, grammar, and provide educational insights. This is MANDATORY when recognized text is present. Respond in the user's language.` : 'You can help with general questions about Bengali language, literature, or any other topic. Respond in the user\'s language.'}
    6. **IMPORTANT**: You MUST always provide a response. Never leave the user without an answer.
    
    **Language Rules:**
    - Always respond in the same language the user uses.
    - If the user writes in English, respond in English.
    - If the user writes in Bengali, respond in Bengali.
    - If the user writes in any other language, respond in that language.
    - **MANDATORY**: Always provide a meaningful response, regardless of the language used.
    ${hasContextText ? `- **MANDATORY**: You MUST analyze and provide insights about the recognized Bengali text shown in the context above. Respond in the user's language.` : ''}
    
    Keep the response ${hasContextText ? 'comprehensive (150-200 words)' : 'concise (under 100 words)'} and in the user's language. Be helpful and engaging.
    `;

    // Check prompt length and warn if very long
    if (prompt.length > 30000) {
      console.warn("Prompt is very long, may exceed token limits:", prompt.length);
    }

    console.log("chatWithBhasha: Sending request to Gemini API...", {
      model: "gemini-2.5-flash",
      promptLength: prompt.length,
      hasApiKey: !!apiKey,
      historyLength: history.length
    });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        maxOutputTokens: 2048,
      },
      contents: {
        parts: [
          {
            text: prompt,
          },
        ],
      },
    });

    console.log("chatWithBhasha: Gemini API response received", {
      hasResponse: !!response,
      hasText: !!response.text,
      responseLength: response.text?.length || 0
    });

    const responseText = response.text?.trim();
    
    // Ensure we always return a response
    if (!responseText || responseText.length === 0) {
      console.warn("Empty response from Gemini, returning fallback message");
      return "দুঃখিত, আমি এখনই আপনার প্রশ্নের উত্তর দিতে পারছি না। অনুগ্রহ করে আবার চেষ্টা করুন। (Sorry, I am unable to process your request at the moment. Please try again.)";
    }
    
    return responseText;

  } catch (error: any) {
    console.error("Chat Error:", error);
    console.error("Chat Error details:", {
      message: error?.message,
      name: error?.name,
      code: error?.code,
      status: error?.status,
      stack: error?.stack?.substring(0, 200)
    });
    
    // Check for specific error types
    if (error?.message?.includes('token') || error?.message?.includes('length') || error?.message?.includes('limit')) {
      return "দুঃখিত, পাঠ্যটি খুব দীর্ঘ। অনুগ্রহ করে ছোট করে আবার চেষ্টা করুন। (Sorry, the text is too long. Please try with a shorter text.)";
    }
    
    if (error?.message?.includes('quota') || error?.message?.includes('rate limit')) {
      return "দুঃখিত, সার্ভার ব্যস্ত। অনুগ্রহ করে কিছুক্ষণ পরে আবার চেষ্টা করুন। (Sorry, server is busy. Please try again later.)";
    }
    
    if (error?.message?.includes('API Key') || error?.message?.includes('api key')) {
      return "API Key Error: Check .env file and ensure GEMINI_API_KEY is set correctly.";
    }
    
    return "দুঃখিত, একটি ত্রুটি হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন। (Sorry, an error occurred. Please try again.)";
  }
};
