import { type SummaryStyle, type Emotion, type ActionItem, type Snippet } from '../types';

const handleApiError = (endpoint: string, error: any) => {
    console.error(`Error calling ${endpoint}:`, error);
    // You could implement more sophisticated logging here
};

const createRequest = async <T>(endpoint: string, body: object, fallback: T): Promise<T> => {
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            throw new Error(`Backend error: ${response.status} ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        handleApiError(endpoint, error);
        return fallback;
    }
};

export const generateSummary = async (transcript: string, style: SummaryStyle): Promise<{ summary: string; emotion: Emotion }> => {
    if (transcript.trim().length < 10) {
        return { summary: "Not enough content to summarize.", emotion: 'confused' };
    }
    return createRequest<{ summary: string; emotion: Emotion }>(
        '/api/summarize',
        { transcript, style },
        {
            summary: "Error: Could not connect to the backend to generate summary. Please ensure the server is running.",
            emotion: 'sad'
        }
    );
};

export const generateTopics = async (transcript: string): Promise<string[]> => {
    if (transcript.trim().length < 50) return [];
    const result = await createRequest<{ topics: string[] }>('/api/topics', { transcript }, { topics: [] });
    return result.topics || [];
};

export const generateActionItems = async (transcript: string): Promise<Omit<ActionItem, 'id'>[]> => {
    if (transcript.trim().length < 20) return [];
    return createRequest<Omit<ActionItem, 'id'>[]>('/api/action-items', { transcript }, []);
};

export const generateSnippets = async (transcript: string): Promise<Omit<Snippet, 'id'>[]> => {
    if (transcript.trim().length < 50) return [];
    return createRequest<Omit<Snippet, 'id'>[]>('/api/snippets', { transcript }, []);
};

export const translateText = async (text: string, language: string): Promise<string> => {
    if (!text.trim()) return "";
    const result = await createRequest<{ translatedText: string }>('/api/translate', { text, language }, { translatedText: "Translation failed." });
    return result.translatedText;
};

export const analyzeTranscriptChunk = async (chunk: string): Promise<{ topic: string; sentiment: 'positive' | 'neutral' | 'negative' }> => {
    const fallback = { topic: 'General', sentiment: 'neutral' as const };
    if (!chunk.trim()) return fallback;
    return createRequest<{ topic: string; sentiment: 'positive' | 'neutral' | 'negative' }>('/api/analyze-chunk', { chunk }, fallback);
};
