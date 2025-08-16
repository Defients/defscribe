import { useState, useEffect, useRef, useCallback } from 'react';
import { type TranscriptEntry, type SpeakerId, type SpeakerProfile, type DiarizationSettings } from '../types';
import { DIARIZATION_PALETTE } from '../constants';
import useDiarization from './useDiarization';
import { type ToastType } from '../components/Toast';
import { translateText } from '../services/geminiService';

const usePrevious = <T,>(value: T): T | undefined => {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => { ref.current = value; });
  return ref.current;
};

interface UseTranscriptProps {
    finalTranscript: string;
    diarizationSettings: DiarizationSettings;
    addToast: (title: string, message: string, type: ToastType) => void;
}

const useTranscript = ({ finalTranscript, diarizationSettings, addToast }: UseTranscriptProps) => {
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [transcriptEntries, setTranscriptEntries] = useState<TranscriptEntry[]>([]);
    const [speakerProfiles, setSpeakerProfiles] = useState<Record<SpeakerId, SpeakerProfile>>({});
    const startTimeRef = useRef<number | null>(null);
    const prevFinalTranscript = usePrevious(finalTranscript);

    const { activeSpeaker, segments, resetDiarization } = useDiarization(stream, diarizationSettings, startTimeRef.current);

    useEffect(() => {
        // Automatically create/update speaker profiles when new speakers are detected
        const allSpeakerIds = new Set(segments.map(s => s.speakerId));
        if (activeSpeaker) allSpeakerIds.add(activeSpeaker);

        setSpeakerProfiles(prevProfiles => {
            const newProfiles = { ...prevProfiles };
            let changed = false;
            allSpeakerIds.forEach(id => {
                if (!newProfiles[id]) {
                    const profileIndex = parseInt(id.replace('S', ''), 10) - 1;
                    newProfiles[id] = {
                        id,
                        label: `Speaker ${id.replace('S', '')}`,
                        color: DIARIZATION_PALETTE[profileIndex % DIARIZATION_PALETTE.length],
                        isEditable: true,
                    };
                    changed = true;
                }
            });
            return changed ? newProfiles : prevProfiles;
        });
    }, [segments, activeSpeaker]);

    useEffect(() => {
        if (!finalTranscript.trim()) {
            // Reset start time when transcript is cleared
            if (transcriptEntries.length > 0) startTimeRef.current = null;
            return;
        }

        if (!startTimeRef.current) {
            startTimeRef.current = Date.now() - 100; // a bit of buffer
        }

        if (finalTranscript && prevFinalTranscript !== finalTranscript) {
            const newText = finalTranscript.slice(prevFinalTranscript?.length || 0).trim();
            if (newText) {
                const entryTimestamp = Date.now();
                const entryStartMs = entryTimestamp - (startTimeRef.current || entryTimestamp);

                // Find the most recent segment that contains this entry's start time
                // This makes assignment more robust than just using the active speaker
                const overlappingSegment = [...segments].reverse().find(
                    seg => entryStartMs >= seg.startMs && entryStartMs <= seg.endMs
                );
                
                // Fallback to active speaker if no segment found (for very live text)
                const speakerId = overlappingSegment ? overlappingSegment.speakerId : activeSpeaker;

                const newEntry: TranscriptEntry = {
                    id: `entry-${entryTimestamp}`,
                    rawTimestamp: entryTimestamp,
                    timestamp: new Date(entryTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                    text: newText,
                    isFinal: true,
                    speakerIds: speakerId ? [speakerId] : [],
                };
                setTranscriptEntries(prev => [...prev, newEntry]);
            }
        }
    }, [finalTranscript, prevFinalTranscript, activeSpeaker, segments]);

    const clearTranscriptEntries = () => {
        setTranscriptEntries([]);
        setSpeakerProfiles({});
        startTimeRef.current = null;
        resetDiarization();
    };

    const handleUpdateSpeakerLabel = useCallback((speakerId: SpeakerId, newLabel: string) => {
        setSpeakerProfiles(prev => {
            if (!prev[speakerId]) return prev;
            return {
                ...prev,
                [speakerId]: { ...prev[speakerId], label: newLabel }
            };
        });
    }, []);

    const handleReassignSpeakerForEntry = useCallback((entryId: string, newSpeakerId: SpeakerId) => {
        setTranscriptEntries(prev => prev.map(entry => 
            entry.id === entryId ? { ...entry, speakerIds: [newSpeakerId] } : entry
        ));
    }, []);

    const handleTranslateEntry = useCallback(async (entryId: string, language: string) => {
        const entry = transcriptEntries.find(e => e.id === entryId);
        if (!entry) return;

        addToast('Translating...', `Translating text to ${language}.`, 'info');
        try {
            const translated = await translateText(entry.text, language);
            setTranscriptEntries(prev => prev.map(e => e.id === entryId ? { ...e, translatedText: translated } : e));
            addToast('Translation Complete', `Text successfully translated.`, 'success');
        } catch (error) {
            addToast('Translation Failed', `Could not translate text.`, 'error');
        }
    }, [transcriptEntries, addToast]);


    return {
        stream,
        setStream,
        transcriptEntries,
        activeSpeaker,
        speakerProfiles,
        clearTranscriptEntries,
        startTimeRef,
        segments,
        handleUpdateSpeakerLabel,
        handleReassignSpeakerForEntry,
        handleTranslateEntry,
    };
};

export default useTranscript;