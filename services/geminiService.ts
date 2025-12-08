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
          content: { type: Type.STRING, description: "The creative response or answer in the style of the poet. MUST match the language of the input text." },
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
  
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error("API Key not found");
    }

    const ai = new GoogleGenAI({ apiKey });

    // Clean base64 string if it contains metadata header
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");

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
    `;

    const response = await ai.models.generateContent({
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
4. Ensure all poet responses are comprehensive and address the full meaning of the text, especially for longer passages.`,
          },
        ],
      },
    });

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
  } catch (error) {
    console.error("Gemini Analysis Failed:", error);
    // Fallback/Error result
    return {
      recognizedText: "Error",
      confidence: 0,
      isQuestion: false,
      bhashaInsights: [],
      suggestedQuestions: [],
      candidates: [],
      processingTimeMs: 0,
    };
  }
};

export const chatWithBhasha = async (history: ChatMessage[], contextText: string, persona: ChatPersona = 'tutor'): Promise<string> => {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API Key not found");

    // Get the last user message
    const lastUserMessage = history.filter(msg => msg.role === 'user').pop()?.content || "";
    const isLastMessageBengali = lastUserMessage && /^[\u0980-\u09FF\u09E6-\u09EF\s\u200C\u200D,\.;:!?\-'"()]+$/.test(lastUserMessage.trim());
    
    // Validate contextText if it exists (it may be empty for general questions)
    const isContextBengali = !contextText || /^[\u0980-\u09FF\u09E6-\u09EF\s\u200C\u200D,\.;:!?\-'"()]+$/.test(contextText.trim());
    
    // If user message is not Bengali (and not empty), reject the request
    // Allow responses even if contextText is empty or not Bengali, as long as the user message is Bengali
    if (lastUserMessage.trim() && !isLastMessageBengali) {
      return "দুঃখিত, এই সিস্টেম শুধুমাত্র বাংলা পাঠ্য গ্রহণ করে। অনুগ্রহ করে বাংলায় আপনার প্রশ্ন বা মন্তব্য লিখুন। (Sorry, this system only accepts Bengali text. Please write your question or comment in Bengali.)";
    }
    
    // If contextText exists but is not Bengali, warn but still allow if user message is Bengali
    if (contextText && !isContextBengali && isLastMessageBengali) {
      console.warn("Context text is not Bengali, but proceeding with Bengali user message");
    }

    const ai = new GoogleGenAI({ apiKey });

    // Check if we have context text
    const hasContextText = contextText && contextText.trim();

    // Format history for the prompt
    const conversationHistory = history.map(msg => 
      `${msg.role === 'user' ? 'User' : 'Bhasha'}: ${msg.content}`
    ).join('\n');

    // Persona Configuration
    const personaConfig = {
      tutor: {
        role: "Bengali Language Teacher",
        tone: "Educational, objective, and friendly. Act as a modern AI tutor.",
        instruction: `Explain the text clearly, grammatically, and conceptually. ${hasContextText ? `You MUST provide a comprehensive literary review of the recognized text, including: meaning analysis, grammatical structure, themes, and educational insights. This is MANDATORY when recognized text is provided.` : ''} If asked about poets, explain objectively. ONLY respond to Bengali text.`
      },
      analyst: {
        role: "Formal Document Analyst",
        tone: "Professional, precise, concise, and data-driven. No fluff.",
        instruction: "Focus on the structural accuracy, linguistics, and literal meaning of the text. Analyze the handwriting style formally. ONLY respond to Bengali text."
      },
      muse: {
        role: "Creative Literary Muse",
        tone: "Imaginative, inspiring, and slightly metaphorical but easy to understand.",
        instruction: "Engage with the artistic soul of the text. Encourage the user to see the deeper beauty and emotion. You can be slightly poetic but remain helpful. ONLY respond to Bengali text."
      }
   };

   const currentPersona = personaConfig[persona];

    // Build context part of prompt
    const contextPart = hasContextText
      ? `**RECOGNIZED TEXT FROM IMAGE**: "${contextText}"

This is the Bengali text that was recognized from the user's uploaded image. You MUST analyze this text and provide insights about it.`
      : "Context: The user is asking a general question. There is no specific recognized text from an image at this moment.";
    
    const prompt = `
    ${contextPart}
    
    Conversation History:
    ${conversationHistory}
    
    You are BhashaLLM, a ${currentPersona.role}.
    
    **CRITICAL RESTRICTION**: This system ONLY processes Bengali text. If the user writes in any language other than Bengali (English, Hindi, etc.), you MUST respond with: "দুঃখিত, এই সিস্টেম শুধুমাত্র বাংলা পাঠ্য গ্রহণ করে। অনুগ্রহ করে বাংলায় আপনার প্রশ্ন বা মন্তব্য লিখুন।"
    
    **Your Role:**
    1. ${currentPersona.instruction}
    2. **Tone**: ${currentPersona.tone}
    3. DO NOT use the "3 Poets" format in this chat. That is for the analysis panel only. Be conversational.
    4. **ALWAYS respond in Bengali**. If the user's message is in Bengali, provide a helpful response. If not Bengali, use the rejection message above.
    5. **CRITICAL - LITERARY REVIEW**: ${hasContextText ? `You MUST provide a literary review and analysis of the recognized text: "${contextText}". Analyze its meaning, themes, grammar, and provide educational insights. This is MANDATORY when recognized text is present.` : 'If there\'s no context text, you can still help with general Bengali language questions or explanations.'}
    6. **IMPORTANT**: You MUST always provide a response. Never leave the user without an answer.
    
    **Language Rules (STRICT):**
    - You MUST respond ONLY in Bengali.
    - If the user writes in any language other than Bengali, reject it with the message above.
    - All your responses must be in Bengali, regardless of what the user writes.
    - **MANDATORY**: Always provide a meaningful response when the user writes in Bengali, even if there's no context text.
    ${hasContextText ? `- **MANDATORY**: You MUST analyze and provide insights about the recognized text: "${contextText}"` : ''}
    
    Keep the response ${hasContextText ? 'comprehensive (150-200 words)' : 'concise (under 100 words)'} and in Bengali. Be helpful and engaging.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { text: prompt },
    });

    const responseText = response.text?.trim();
    
    // Ensure we always return a response
    if (!responseText || responseText.length === 0) {
      console.warn("Empty response from Gemini, returning fallback message");
      return "দুঃখিত, আমি এখনই আপনার প্রশ্নের উত্তর দিতে পারছি না। অনুগ্রহ করে আবার চেষ্টা করুন। (Sorry, I am unable to process your request at the moment. Please try again.)";
    }
    
    return responseText;

  } catch (error) {
    console.error("Chat Error:", error);
    return "I am having trouble connecting. Please try again.";
  }
};
