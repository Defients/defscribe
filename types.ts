export interface TranscriptEntry {
  id: string;
  timestamp: string;
  rawTimestamp: number;
  text: string;
  isFinal: boolean;
  speakerIds?: SpeakerId[];
  endTimestamp?: number;
  translatedText?: string;
}

export interface ActionItem {
  id: string;
  type: 'action' | 'decision';
  content: string;
  speakerId?: SpeakerId;
  speakerLabel?: string;
}

export interface Snippet {
  id: string;
  type: 'quote' | 'question' | 'insight';
  content: string;
  speakerId?: SpeakerId;
  speakerLabel?: string;
}

export interface ChatMessage {
  id:string;
  role: 'user' | 'model';
  text: string;
  isLoading?: boolean;
  translatedText?: string;
}

export interface TimelineEvent {
  startMs: number;
  endMs: number;
  type: 'topic' | 'sentiment';
  value: string; // topic name or sentiment value
}

export type SummaryStyle = 'basic' | 'detailed' | 'full';

export type Emotion = 'normal' | 'talking' | 'thinking' | 'happy' | 'sad' | 'surprised' | 'confused' | 'listening';

export interface SpeechAnalytics {
  wpm: number;
  clarity: number; // based on speech recognition confidence
  fillers: number;
  duration: number; // in seconds
  words: number;
  sentences: number;
  pauses: number;
  speakingRateLabel: 'Slow' | 'Medium' | 'Fast';
  emotionalTone: Emotion;
  emotionHistory: Emotion[];
  topics: string[];
  talkTime: Record<SpeakerId, { percentage: number; seconds: number }>;
}

export type VisualizerStyle = 'wave' | 'bars' | 'circle';

// --- Diarization Types ---
export type SpeakerId = string; // e.g. "S1", "S2"

export interface SpeakerProfile {
  id: SpeakerId;
  label: string;
  color: string;
  isEditable?: boolean;
}

export interface DiarizationSegment {
  speakerId: SpeakerId;
  startMs: number;
  endMs: number;
}

export interface DiarizationSettings {
  enabled: boolean;
  mode: "local" | "cloud";
  expectedSpeakers: number;
}