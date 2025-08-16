
import { useState, useRef, useEffect, useCallback } from 'react';

// Type definitions for the Web Speech API to make it available to TypeScript
interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
  length: number;
}
interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResult[];
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}
interface SpeechRecognitionStatic {
  new (): SpeechRecognition;
}
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionStatic;
    webkitSpeechRecognition?: SpeechRecognitionStatic;
  }
}

interface SpeechRecognitionHook {
  isListening: boolean;
  transcript: string;
  finalTranscript: string;
  error: string | null;
  confidence: number;
  startListening: () => void;
  stopListening: () => void;
  clearTranscript: () => void;
}

const useSpeechRecognition = (): SpeechRecognitionHook => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [averageConfidence, setAverageConfidence] = useState(0);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const confidenceScoresRef = useRef<number[]>([]);
  // This ref tracks the user's *intent* to be listening, which helps manage auto-restarts.
  const listeningIntentRef = useRef(false);

  const startListening = useCallback(() => {
    // The check for `isListening` from state is removed. It's unreliable in the `onend`
    // callback due to stale closures. The `try/catch` for 'InvalidStateError'
    // gracefully handles attempts to start an already-running recognition instance.
    if (!recognitionRef.current) {
      return;
    }
    try {
      setTranscript('');
      setError(null);
      listeningIntentRef.current = true;
      recognitionRef.current.start();
      setIsListening(true);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'InvalidStateError') {
        console.warn("SpeechRecognition.start() called while already started. Ignoring.");
      } else {
        console.error("Could not start recognition", e);
        listeningIntentRef.current = false;
        setIsListening(false);
      }
    }
  }, []); // No dependencies, this function is stable.


  useEffect(() => {
    if (typeof window === 'undefined') {
      setError("Speech recognition is not available in this environment.");
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Speech recognition is not supported in this browser.");
      return;
    }

    recognitionRef.current = new SpeechRecognition();
    const recognition = recognitionRef.current;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      let finalChunk = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalChunk += event.results[i][0].transcript;
          const confidence = event.results[i][0].confidence;
          if (typeof confidence === 'number' && isFinite(confidence)) {
            confidenceScoresRef.current.push(confidence);
          }
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      setTranscript(interimTranscript);
      if (finalChunk) {
        if (confidenceScoresRef.current.length > 0) {
          const avg = confidenceScoresRef.current.reduce((a, b) => a + b, 0) / confidenceScoresRef.current.length;
          setAverageConfidence(avg);
        }
        setFinalTranscript(prev => prev + finalChunk + ' ');
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      // If our intent is to still be listening, it means recognition stopped unexpectedly.
      if (listeningIntentRef.current) {
        // We call startListening again, which contains the necessary guards.
        startListening();
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        // These errors are common (e.g., silence) and don't need to be displayed.
        // The `onend` event will fire after these, and our logic there will handle restarting.
        if (event.error === 'no-speech' || event.error === 'audio-capture') {
            return;
        }
        setError(event.error);
        listeningIntentRef.current = false; // A real error occurred, so change intent to stop.
        setIsListening(false);
    };

    return () => {
      listeningIntentRef.current = false;
      if (recognitionRef.current) {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.abort();
      }
    };
  }, [startListening]);

  const stopListening = () => {
    if (!listeningIntentRef.current || !recognitionRef.current) return;
    listeningIntentRef.current = false;
    recognitionRef.current.stop();
    // The `onend` handler will manage setting isListening to false.
  };
  
  const clearTranscript = () => {
      setTranscript('');
      setFinalTranscript('');
      confidenceScoresRef.current = [];
      setAverageConfidence(0);
  }

  return { isListening, transcript, finalTranscript, error, startListening, stopListening, clearTranscript, confidence: averageConfidence };
};

export default useSpeechRecognition;
