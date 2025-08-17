
import { useState, useEffect, useRef, useCallback } from 'react';
import { type DiarizationSettings, type DiarizationSegment, type SpeakerId } from '../types';
import { AudioContextManager } from '../utils/AudioContextManager';
import { AUDIO_CONSTANTS } from '../constants/audio';

interface AudioFeatures {
  energy: number;
  pitch: number;
  spectralCentroid: number;
  timestamp: number;
}

interface SpeakerModel {
  id: SpeakerId;
  features: AudioFeatures[];
  avgEnergy: number;
  avgPitch: number;
  avgSpectralCentroid: number;
  lastSeen: number;
}

const useDiarization = (
  stream: MediaStream | null,
  settings: DiarizationSettings,
  startTime: number | null
) => {
  const [activeSpeaker, setActiveSpeaker] = useState<SpeakerId | null>(null);
  const [segments, setSegments] = useState<DiarizationSegment[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  const speakerModelsRef = useRef<Map<SpeakerId, SpeakerModel>>(new Map());
  const currentSegmentRef = useRef<DiarizationSegment | null>(null);
  const silenceCountRef = useRef(0);
  const featureBufferRef = useRef<AudioFeatures[]>([]);
  
  const {
    SILENCE_THRESHOLD,
    SILENCE_DURATION_MS,
    FEATURE_WINDOW_SIZE,
    SPEAKER_CHANGE_THRESHOLD,
    MIN_SEGMENT_DURATION_MS
  } = AUDIO_CONSTANTS;

  const calculateFeatures = useCallback((dataArray: Uint8Array, sampleRate: number): AudioFeatures => {
    const samples = new Float32Array(dataArray.length);
    for (let i = 0; i < dataArray.length; i++) {
      samples[i] = (dataArray[i] - 128) / 128;
    }

    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
      sum += samples[i] * samples[i];
    }
    const energy = Math.sqrt(sum / samples.length);

    let zeroCrossings = 0;
    for (let i = 1; i < samples.length; i++) {
      if ((samples[i] >= 0) !== (samples[i - 1] >= 0)) {
        zeroCrossings++;
      }
    }
    const pitch = (zeroCrossings * sampleRate) / (2 * samples.length);

    const fftSize = AUDIO_CONSTANTS.FFT_SIZE;
    const fft = new Float32Array(fftSize);
    for (let i = 0; i < Math.min(samples.length, fftSize); i++) {
      fft[i] = samples[i];
    }
    
    let weightedSum = 0;
    let magnitudeSum = 0;
    for (let i = 0; i < fftSize / 2; i++) {
      const magnitude = Math.abs(fft[i]);
      weightedSum += magnitude * i;
      magnitudeSum += magnitude;
    }
    const spectralCentroid = magnitudeSum > 0 ? (weightedSum / magnitudeSum) * (sampleRate / fftSize) : 0;

    return {
      energy,
      pitch,
      spectralCentroid,
      timestamp: Date.now()
    };
  }, []);

  const calculateSimilarity = useCallback((features1: AudioFeatures[], features2: AudioFeatures[]): number => {
    if (features1.length === 0 || features2.length === 0) return 0;

    const avg1 = {
      energy: features1.reduce((sum, f) => sum + f.energy, 0) / features1.length,
      pitch: features1.reduce((sum, f) => sum + f.pitch, 0) / features1.length,
      spectralCentroid: features1.reduce((sum, f) => sum + f.spectralCentroid, 0) / features1.length
    };

    const avg2 = {
      energy: features2.reduce((sum, f) => sum + f.energy, 0) / features2.length,
      pitch: features2.reduce((sum, f) => sum + f.pitch, 0) / features2.length,
      spectralCentroid: features2.reduce((sum, f) => sum + f.spectralCentroid, 0) / features2.length
    };

    const energyDiff = Math.abs(avg1.energy - avg2.energy) / (Math.max(avg1.energy, avg2.energy) || 1);
    const pitchDiff = Math.abs(avg1.pitch - avg2.pitch) / (Math.max(avg1.pitch, avg2.pitch) || 1);
    const spectralDiff = Math.abs(avg1.spectralCentroid - avg2.spectralCentroid) / (Math.max(avg1.spectralCentroid, avg2.spectralCentroid) || 1);

    const distance = (energyDiff * 0.2) + (pitchDiff * 0.4) + (spectralDiff * 0.4);
    
    return Math.max(0, 1 - distance);
  }, []);

  const detectSpeaker = useCallback((currentFeatures: AudioFeatures[]): SpeakerId => {
    const models = speakerModelsRef.current;
    
    if (models.size === 0 || models.size < settings.expectedSpeakers) {
      const newSpeakerId = `S${models.size + 1}` as SpeakerId;
      const newModel: SpeakerModel = {
        id: newSpeakerId,
        features: [...currentFeatures],
        avgEnergy: currentFeatures.reduce((sum, f) => sum + f.energy, 0) / currentFeatures.length,
        avgPitch: currentFeatures.reduce((sum, f) => sum + f.pitch, 0) / currentFeatures.length,
        avgSpectralCentroid: currentFeatures.reduce((sum, f) => sum + f.spectralCentroid, 0) / currentFeatures.length,
        lastSeen: Date.now()
      };
      models.set(newSpeakerId, newModel);
      return newSpeakerId;
    }

    let bestMatch: SpeakerId | null = null;
    let bestSimilarity = 0;

    models.forEach((model) => {
      const similarity = calculateSimilarity(currentFeatures, model.features.slice(-FEATURE_WINDOW_SIZE));
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = model.id;
      }
    });

    if (bestSimilarity < (1 - SPEAKER_CHANGE_THRESHOLD) && models.size < settings.expectedSpeakers) {
      const newSpeakerId = `S${models.size + 1}` as SpeakerId;
      const newModel: SpeakerModel = {
        id: newSpeakerId,
        features: [...currentFeatures],
        avgEnergy: currentFeatures.reduce((sum, f) => sum + f.energy, 0) / currentFeatures.length,
        avgPitch: currentFeatures.reduce((sum, f) => sum + f.pitch, 0) / currentFeatures.length,
        avgSpectralCentroid: currentFeatures.reduce((sum, f) => sum + f.spectralCentroid, 0) / currentFeatures.length,
        lastSeen: Date.now()
      };
      models.set(newSpeakerId, newModel);
      return newSpeakerId;
    }

    if (bestMatch) {
      const model = models.get(bestMatch)!;
      model.features = [...model.features.slice(-FEATURE_WINDOW_SIZE), ...currentFeatures];
      model.lastSeen = Date.now();
      
      const allFeatures = model.features;
      model.avgEnergy = allFeatures.reduce((sum, f) => sum + f.energy, 0) / allFeatures.length;
      model.avgPitch = allFeatures.reduce((sum, f) => sum + f.pitch, 0) / allFeatures.length;
      model.avgSpectralCentroid = allFeatures.reduce((sum, f) => sum + f.spectralCentroid, 0) / allFeatures.length;
    }

    return bestMatch || 'S1' as SpeakerId;
  }, [calculateSimilarity, settings.expectedSpeakers]);

  const endCurrentSegment = useCallback((endTime: number) => {
    if (currentSegmentRef.current) {
      const segment = currentSegmentRef.current;
      segment.endMs = endTime;
      
      if (segment.endMs - segment.startMs >= MIN_SEGMENT_DURATION_MS) {
        setSegments(prev => [...prev, segment]);
      }
      
      currentSegmentRef.current = null;
      setActiveSpeaker(null);
    }
  }, []);

  const processAudioData = useCallback((dataArray: Uint8Array, sampleRate: number) => {
    if (!startTime) return;

    const currentTime = Date.now() - startTime;
    const features = calculateFeatures(dataArray, sampleRate);

    if (features.energy < SILENCE_THRESHOLD) {
      silenceCountRef.current++;
      const silenceDuration = (silenceCountRef.current * dataArray.length / sampleRate) * 1000;
      
      if (silenceDuration > SILENCE_DURATION_MS && currentSegmentRef.current) {
        endCurrentSegment(currentTime);
        featureBufferRef.current = [];
      }
      return;
    }

    silenceCountRef.current = 0;

    featureBufferRef.current.push(features);
    if (featureBufferRef.current.length > FEATURE_WINDOW_SIZE) {
      featureBufferRef.current = featureBufferRef.current.slice(-FEATURE_WINDOW_SIZE);
    }

    if (featureBufferRef.current.length < 3) return;

    const detectedSpeaker = detectSpeaker(featureBufferRef.current);

    if (!currentSegmentRef.current || currentSegmentRef.current.speakerId !== detectedSpeaker) {
      if (currentSegmentRef.current) {
        endCurrentSegment(currentTime);
      }

      currentSegmentRef.current = {
        speakerId: detectedSpeaker,
        startMs: currentTime,
        endMs: currentTime + 100
      };

      setActiveSpeaker(detectedSpeaker);
    } else {
      currentSegmentRef.current.endMs = currentTime;
    }
  }, [startTime, calculateFeatures, detectSpeaker, endCurrentSegment]);

  const initializeAudioProcessing = useCallback(async () => {
    if (!stream || !settings.enabled || !startTime) return;

    try {
      setIsProcessing(true);
      setError(null);

      const context = AudioContextManager.acquire('diarization');
      
      if (context.state === 'suspended') {
        await context.resume();
      }

      await context.audioWorklet.addModule('/diarization-processor.js');
      
      const workletNode = new AudioWorkletNode(context, 'diarization-processor');
      workletNodeRef.current = workletNode;

      const source = context.createMediaStreamSource(stream);
      sourceNodeRef.current = source;
      
      source.connect(workletNode);
      const gainNode = context.createGain();
      gainNode.gain.setValueAtTime(0, context.currentTime);
      workletNode.connect(gainNode);
      gainNode.connect(context.destination);

      workletNode.port.onmessage = (event) => {
        processAudioData(event.data, context.sampleRate);
      };

    } catch (err) {
      console.error('Error initializing audio processing:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize audio processing with AudioWorklet');
    } finally {
        setIsProcessing(false);
    }
  }, [stream, settings.enabled, startTime, processAudioData]);

  const resetDiarization = useCallback(() => {
    setSegments([]);
    speakerModelsRef.current.clear();
    featureBufferRef.current = [];
    silenceCountRef.current = 0;
    currentSegmentRef.current = null;
    setActiveSpeaker(null);
  }, []);

  const cleanup = useCallback(() => {
    if (currentSegmentRef.current && startTime) {
      endCurrentSegment(Date.now() - startTime);
    }

    if (workletNodeRef.current) {
      workletNodeRef.current.port.onmessage = null;
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    
    AudioContextManager.release('diarization');
    setIsProcessing(false);
  }, [startTime, endCurrentSegment]);

  useEffect(() => {
    if (stream && settings.enabled && startTime) {
      resetDiarization();
      initializeAudioProcessing();
    } else {
      cleanup();
    }
    return cleanup;
  }, [stream, settings.enabled, startTime, initializeAudioProcessing, cleanup, resetDiarization]);

  return { 
    activeSpeaker, 
    isProcessing, 
    error,
    segments,
    resetDiarization
  };
};

export default useDiarization;
