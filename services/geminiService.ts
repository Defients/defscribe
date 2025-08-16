import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { type SummaryStyle, type Emotion, type ActionItem, type Snippet } from '../types';
import { AVATAR_EMOTIONS } from '../constants';

const API_KEY = typeof process !== 'undefined' && process.env?.API_KEY;
let ai: GoogleGenAI | null = null;

if (API_KEY) {
    try {
        ai = new GoogleGenAI({ apiKey: API_KEY });
    } catch (e) {
        console.error("Failed to initialize GoogleGenAI", e);
    }
} else {
  console.warn("Gemini API key not found. Summarization will be disabled. Make sure to set the API_KEY environment variable.");
}

const getPromptForStyle = (style: SummaryStyle, text: string): string => {
  const emotionInstruction = `First, analyze the overall emotional tone of the speaker. On the very first line, respond with the single dominant emotion from this list: normal, happy, sad, surprised, confused. The format must be 'EMOTION: [emotion]'. Then, on a new line, provide the summary as requested below.`;

  switch (style) {
    case 'basic':
      return `${emotionInstruction}\n\nCreate a concise, one-paragraph summary of the following transcript. Identify the main topic and the key takeaway. Transcript: "${text}"`;
    case 'detailed':
      return `${emotionInstruction}\n\nGenerate a detailed summary of the following transcript. Use bullet points to list the main topics discussed and key conclusions. Transcript: "${text}"`;
    case 'full':
      return `${emotionInstruction}\n\nProvide a comprehensive, multi-paragraph summary of the following transcript. Analyze the key arguments, identify any action items, and describe the overall sentiment. Transcript: "${text}"`;
    default:
      return `${emotionInstruction}\n\nSummarize this transcript: "${text}"`;
  }
};

export const generateSummary = async (transcript: string, style: SummaryStyle): Promise<{ summary: string; emotion: Emotion }> => {
  if (!ai) {
    return Promise.resolve({
      summary: "Summarization is disabled. Please configure your Gemini API key.",
      emotion: 'confused'
    });
  }

  const prompt = getPromptForStyle(style, transcript);

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
    });
    
    const rawText = response.text;
    const lines = rawText.split('\n');
    let emotion: Emotion = 'happy'; // Default to happy on success
    let summaryText = rawText;

    if (lines.length > 0 && lines[0].toUpperCase().startsWith('EMOTION:')) {
        const parsedEmotion = lines[0].replace(/EMOTION:/i, '').trim().toLowerCase() as Emotion;
        if (Object.keys(AVATAR_EMOTIONS).includes(parsedEmotion)) {
            emotion = parsedEmotion;
        }
        summaryText = lines.slice(1).join('\n').trim();
    }
    
    return { summary: summaryText, emotion };
  } catch (error) {
    console.error("Error generating summary with Gemini:", error);
    return {
      summary: "Error: Could not generate summary. Please check the API key and network connection.",
      emotion: 'sad'
    };
  }
};


export const generateTopics = async (transcript: string): Promise<string[]> => {
    if (!ai || transcript.trim().length < 50) {
        return Promise.resolve([]);
    }

    const prompt = `Analyze the following transcript and identify the top 3-5 main topics or keywords. Respond with only a JSON object. Transcript: "${transcript}"`;
    
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        topics: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.STRING,
                            },
                        },
                    },
                },
            },
        });

        const jsonStr = response.text.trim();
        const result = JSON.parse(jsonStr);
        return result.topics || [];

    } catch (error) {
        console.error("Error generating topics with Gemini:", error);
        return []; // Return empty array on error
    }
};

export const generateActionItems = async (transcript: string): Promise<Omit<ActionItem, 'id'>[]> => {
    if (!ai || transcript.trim().length < 20) {
        return Promise.resolve([]);
    }
    
    const prompt = `Analyze the following transcript and extract all action items and key decisions made. Identify the speaker if possible (e.g., "Speaker 1"). Format your response as a JSON array of objects. Transcript: "${transcript}"`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            type: { type: Type.STRING, description: "Must be 'action' or 'decision'." },
                            content: { type: Type.STRING, description: "The full text of the action item or decision." },
                            speakerLabel: { type: Type.STRING, description: "The label of the speaker, e.g., 'Speaker 1'." }
                        }
                    }
                }
            }
        });
        const jsonStr = response.text.trim();
        return JSON.parse(jsonStr);
    } catch (error) {
        console.error("Error generating action items:", error);
        return [];
    }
};

export const generateSnippets = async (transcript: string): Promise<Omit<Snippet, 'id'>[]> => {
    if (!ai || transcript.trim().length < 50) {
        return Promise.resolve([]);
    }
    
    const prompt = `Analyze the following transcript. Extract key quotes, important questions asked, and actionable insights. For each item, identify the speaker if possible (e.g., "Speaker 1"). Format your response as a JSON array of objects. Transcript: "${transcript}"`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            type: { type: Type.STRING, description: "Must be 'quote', 'question', or 'insight'." },
                            content: { type: Type.STRING, description: "The full text of the item." },
                            speakerLabel: { type: Type.STRING, description: "The label of the speaker, e.g., 'Speaker 1'." }
                        }
                    }
                }
            }
        });
        const jsonStr = response.text.trim();
        return JSON.parse(jsonStr);
    } catch (error) {
        console.error("Error generating snippets:", error);
        return [];
    }
};

export const translateText = async (text: string, language: string): Promise<string> => {
    if (!ai || !text.trim()) {
        return "";
    }
    const prompt = `Translate the following text to ${language}: "${text}"`;
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });
        return response.text;
    } catch (error) {
        console.error(`Error translating text to ${language}:`, error);
        return "Translation failed.";
    }
};

export const analyzeTranscriptChunk = async (chunk: string): Promise<{ topic: string; sentiment: 'positive' | 'neutral' | 'negative' }> => {
    const fallback = { topic: 'General', sentiment: 'neutral' as const };
    if (!ai || !chunk.trim()) {
        return fallback;
    }
    const prompt = `Analyze the following transcript chunk for its main topic and overall sentiment (positive, neutral, or negative). Respond with a JSON object. Chunk: "${chunk}"`;
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        topic: { type: Type.STRING },
                        sentiment: { type: Type.STRING }
                    }
                }
            }
        });
        const jsonStr = response.text.trim();
        const result = JSON.parse(jsonStr);
        // Basic validation
        if (['positive', 'neutral', 'negative'].includes(result.sentiment)) {
            return result;
        }
        return { topic: result.topic || 'Unknown', sentiment: 'neutral' };
    } catch (error) {
        console.error("Error analyzing transcript chunk:", error);
        return fallback;
    }
};