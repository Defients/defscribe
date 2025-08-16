import { useState, useEffect, useRef, useCallback } from 'react';
import { type DiarizationSettings, type DiarizationSegment, type SpeakerId } from '../types';

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
  startTime: number | null,
  onNewSegments: (segments: DiarizationSegment[]) => void
) => {
  const [activeSpeaker, setActiveSpeaker] = useState<SpeakerId | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Core refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  
  // Speaker detection state
  const speakerModelsRef = useRef<Map<SpeakerId, SpeakerModel>>(new Map());
  const currentSegmentRef = useRef<DiarizationSegment | null>(null);
  const segmentsRef = useRef<DiarizationSegment[]>([]);
  const silenceCountRef = useRef(0);
  const featureBufferRef = useRef<AudioFeatures[]>([]);
  
  // Configuration
  const SILENCE_THRESHOLD = 0.01;
  const SILENCE_DURATION_MS = 500;
  const FEATURE_WINDOW_SIZE = 10;
  const SPEAKER_CHANGE_THRESHOLD = 0.35;
  const MIN_SEGMENT_DURATION_MS = 300;

  // Calculate audio features from time domain data
  const calculateFeatures = useCallback((dataArray: Uint8Array, sampleRate: number): AudioFeatures => {
    const samples = new Float32Array(dataArray.length);
    for (let i = 0; i < dataArray.length; i++) {
      samples[i] = (dataArray[i] - 128) / 128;
    }

    // Calculate energy (RMS)
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
      sum += samples[i] * samples[i];
    }
    const energy = Math.sqrt(sum / samples.length);

    // Calculate zero crossing rate (rough pitch estimate)
    let zeroCrossings = 0;
    for (let i = 1; i < samples.length; i++) {
      if ((samples[i] >= 0) !== (samples[i - 1] >= 0)) {
        zeroCrossings++;
      }
    }
    const pitch = (zeroCrossings * sampleRate) / (2 * samples.length);

    // Calculate spectral centroid (brightness)
    const fftSize = 2048;
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

  // Calculate similarity between two feature sets
  const calculateSimilarity = useCallback((features1: AudioFeatures[], features2: AudioFeatures[]): number => {
    if (features1.length === 0 || features2.length === 0) return 0;

    // Calculate averages for each feature set
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

    // Normalize and calculate weighted distance
    const energyDiff = Math.abs(avg1.energy - avg2.energy) / (Math.max(avg1.energy, avg2.energy) || 1);
    const pitchDiff = Math.abs(avg1.pitch - avg2.pitch) / (Math.max(avg1.pitch, avg2.pitch) || 1);
    const spectralDiff = Math.abs(avg1.spectralCentroid - avg2.spectralCentroid) / (Math.max(avg1.spectralCentroid, avg2.spectralCentroid) || 1);

    // Weighted combination (energy is less reliable, pitch and spectral are more distinctive)
    const distance = (energyDiff * 0.2) + (pitchDiff * 0.4) + (spectralDiff * 0.4);
    
    // Convert distance to similarity (0 to 1, where 1 is identical)
    return Math.max(0, 1 - distance);
  }, []);

  // Detect speaker from current features
  const detectSpeaker = useCallback((currentFeatures: AudioFeatures[]): SpeakerId => {
    const models = speakerModelsRef.current;
    
    if (models.size === 0 || models.size < settings.expectedSpeakers) {
      // Create new speaker if we haven't reached the expected number
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

    // Find best matching speaker
    let bestMatch: SpeakerId | null = null;
    let bestSimilarity = 0;

    models.forEach((model) => {
      const similarity = calculateSimilarity(currentFeatures, model.features.slice(-FEATURE_WINDOW_SIZE));
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = model.id;
      }
    });

    // If similarity is too low and we haven't reached max speakers, create new speaker
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

    // Update the matched model with new features
    if (bestMatch) {
      const model = models.get(bestMatch)!;
      model.features = [...model.features.slice(-FEATURE_WINDOW_SIZE), ...currentFeatures];
      model.lastSeen = Date.now();
      
      // Update running averages
      const allFeatures = model.features;
      model.avgEnergy = allFeatures.reduce((sum, f) => sum + f.energy, 0) / allFeatures.length;
      model.avgPitch = allFeatures.reduce((sum, f) => sum + f.pitch, 0) / allFeatures.length;
      model.avgSpectralCentroid = allFeatures.reduce((sum, f) => sum + f.spectralCentroid, 0) / allFeatures.length;
    }

    return bestMatch || 'S1' as SpeakerId;
  }, [calculateSimilarity, settings.expectedSpeakers]);

  // End current segment and start a new one if needed
  const endCurrentSegment = useCallback((endTime: number) => {
    if (currentSegmentRef.current) {
      const segment = currentSegmentRef.current;
      segment.endMs = endTime;
      
      // Only save segments that are long enough
      if (segment.endMs - segment.startMs >= MIN_SEGMENT_DURATION_MS) {
        segmentsRef.current = [...segmentsRef.current, segment];
        onNewSegments(segmentsRef.current);
      }
      
      currentSegmentRef.current = null;
      setActiveSpeaker(null);
    }
  }, [onNewSegments]);

  // Process audio data
  const processAudioData = useCallback((dataArray: Uint8Array, sampleRate: number) => {
    if (!startTime) return;

    const currentTime = Date.now() - startTime;
    const features = calculateFeatures(dataArray, sampleRate);

    // Check for silence
    if (features.energy < SILENCE_THRESHOLD) {
      silenceCountRef.current++;
      const silenceDuration = (silenceCountRef.current * dataArray.length / sampleRate) * 1000;
      
      if (silenceDuration > SILENCE_DURATION_MS && currentSegmentRef.current) {
        endCurrentSegment(currentTime);
        featureBufferRef.current = [];
      }
      return;
    }

    // Reset silence counter on speech
    silenceCountRef.current = 0;

    // Add features to buffer
    featureBufferRef.current.push(features);
    if (featureBufferRef.current.length > FEATURE_WINDOW_SIZE) {
      featureBufferRef.current = featureBufferRef.current.slice(-FEATURE_WINDOW_SIZE);
    }

    // Need enough features to make a decision
    if (featureBufferRef.current.length < 3) return;

    // Detect current speaker
    const detectedSpeaker = detectSpeaker(featureBufferRef.current);

    // Handle speaker change or new segment
    if (!currentSegmentRef.current || currentSegmentRef.current.speakerId !== detectedSpeaker) {
      // End previous segment if exists
      if (currentSegmentRef.current) {
        endCurrentSegment(currentTime);
      }

      // Start new segment
      currentSegmentRef.current = {
        speakerId: detectedSpeaker,
        startMs: currentTime,
        endMs: currentTime + 100 // Will be updated
      };

      setActiveSpeaker(detectedSpeaker);
    } else {
      // Update current segment end time
      currentSegmentRef.current.endMs = currentTime;
    }
  }, [startTime, calculateFeatures, detectSpeaker, endCurrentSegment]);

  // Initialize audio processing
  const initializeAudioProcessing = useCallback(async () => {
    if (!stream || !settings.enabled || !startTime) return;

    try {
      setIsProcessing(true);
      setError(null);

      // Create audio context
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const context = new AudioContext();
      audioContextRef.current = context;

      // Resume context if suspended
      if (context.state === 'suspended') {
        await context.resume();
      }

      // Create analyser node
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      // Create source from stream
      const source = context.createMediaStreamSource(stream);
      sourceRef.current = source;

      // Create script processor for real-time processing
      const bufferSize = 4096;
      const processor = context.createScriptProcessor(bufferSize, 1, 1);
      processorRef.current = processor;

      // Connect nodes
      source.connect(analyser);
      analyser.connect(processor);
      processor.connect(context.destination);

      // Process audio data
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      processor.onaudioprocess = () => {
        analyser.getByteTimeDomainData(dataArray);
        processAudioData(dataArray, context.sampleRate);
      };

      setIsProcessing(false);
    } catch (err) {
      console.error('Error initializing audio processing:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize audio processing');
      setIsProcessing(false);
    }
  }, [stream, settings.enabled, startTime, processAudioData]);

  // Cleanup function
  const cleanup = useCallback(() => {
    // End any current segment
    if (currentSegmentRef.current && startTime) {
      endCurrentSegment(Date.now() - startTime);
    }

    // Disconnect and cleanup audio nodes
    if (processorRef.current) {
      processorRef.current.onaudioprocess = null;
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(console.error);
      audioContextRef.current = null;
    }

    // Reset state
    speakerModelsRef.current.clear();
    segmentsRef.current = [];
    featureBufferRef.current = [];
    silenceCountRef.current = 0;
    currentSegmentRef.current = null;
    setActiveSpeaker(null);
    setIsProcessing(false);
  }, [startTime, endCurrentSegment]);

  // Main effect for managing audio processing lifecycle
  useEffect(() => {
    if (stream && settings.enabled && startTime) {
      initializeAudioProcessing();
    } else {
      cleanup();
    }

    return cleanup;
  }, [stream, settings.enabled, startTime, initializeAudioProcessing, cleanup]);

  // Reset segments when settings change significantly
  useEffect(() => {
    if (settings.enabled) {
      segmentsRef.current = [];
      speakerModelsRef.current.clear();
      onNewSegments([]);
    }
  }, [settings.expectedSpeakers, settings.enabled, onNewSegments]);

  return { 
    activeSpeaker, 
    isProcessing, 
    error,
    segments: segmentsRef.current 
  };
};

export default useDiarization;