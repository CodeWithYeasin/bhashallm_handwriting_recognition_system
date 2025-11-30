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
    You are BhashaLLM, an advanced handwriting recognition and literary AI engine.
    
    1. **OCR Task**: Accurately recognize the handwritten text in the image.
    2. **Language Detection**: Identify if the handwritten text is in **Bengali** or **English**.
    3. **Literary Analysis**: 
       - If the text is a **Question**, answer it in the styles of three legendary Bengali poets.
       - If the text is a **Word or Statement**, provide a poetic reflection or meaning in the styles of these poets.
    4. **Prediction (Follow-up Questions)**: Suggest 3 diverse questions the user might ask next, aligned with different personas:
       - **Tutor Question**: Focus on grammar, origin, definition, or correct usage.
       - **Analyst Question**: Focus on the visual structure, stroke quality, or historical context of the script.
       - **Muse Question**: Focus on the deeper meaning, metaphorical interpretation, or artistic value.
    
    **Language Rule (CRITICAL)**:
    - **IF INPUT IS BENGALI**: The 'content' of the poet responses MUST BE IN BENGALI. The suggested questions must be in Bengali.
    - **IF INPUT IS ENGLISH**: The 'content' of the poet responses MUST BE IN ENGLISH. The suggested questions must be in English.
    
    **The Personas (for bhashaInsights only):**
    - **Rabindranath Tagore**: Philosophical, spiritual, nature-focused, profound, universalism.
    - **Kazi Nazrul Islam**: Revolutionary, passionate, rebellious, energetic, breaking barriers.
    - **Jasim Uddin**: Folk, rural, simple, emotional, connected to the soil and village life.
    
    Ensure the "content" for each poet is distinct and captures their unique voice.
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
            text: "Analyze this handwriting. Return the recognized text, 3 Bhasha poet responses, and 3 diverse follow-up questions (Tutor, Analyst, Muse styles).",
          },
        ],
      },
    });

    const endTime = performance.now();
    const processingTime = Math.round(endTime - startTime);

    if (response.text) {
      const data = JSON.parse(response.text);
      return {
        ...data,
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

    const ai = new GoogleGenAI({ apiKey });

    // Format history for the prompt
    const conversationHistory = history.map(msg => 
      `${msg.role === 'user' ? 'User' : 'Bhasha'}: ${msg.content}`
    ).join('\n');

    // Persona Configuration
    const personaConfig = {
      tutor: {
        role: "Bengali Language Teacher",
        tone: "Educational, objective, and friendly. Act as a modern AI tutor.",
        instruction: "Explain the text clearly, grammatically, and conceptually. If asked about poets, explain objectively."
      },
      analyst: {
        role: "Formal Document Analyst",
        tone: "Professional, precise, concise, and data-driven. No fluff.",
        instruction: "Focus on the structural accuracy, linguistics, and literal meaning of the text. Analyze the handwriting style formally."
      },
      muse: {
        role: "Creative Literary Muse",
        tone: "Imaginative, inspiring, and slightly metaphorical but easy to understand.",
        instruction: "Engage with the artistic soul of the text. Encourage the user to see the deeper beauty and emotion. You can be slightly poetic but remain helpful."
      }
   };

   const currentPersona = personaConfig[persona];

    const prompt = `
    Context: The user previously uploaded an image containing the text: "${contextText}".
    
    Conversation History:
    ${conversationHistory}
    
    You are BhashaLLM, a ${currentPersona.role}.
    
    **Your Role:**
    1. ${currentPersona.instruction}
    2. **Tone**: ${currentPersona.tone}
    3. DO NOT use the "3 Poets" format in this chat. That is for the analysis panel only. Be conversational.
    
    **Language Rules:**
    - If the user writes in **Bengali**, respond in **Bengali**.
    - If the user writes in **English**, respond in **English**.
    
    Keep the response concise (under 100 words).
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { text: prompt },
    });

    return response.text || "I am unable to process that request at the moment.";

  } catch (error) {
    console.error("Chat Error:", error);
    return "I am having trouble connecting. Please try again.";
  }
};
