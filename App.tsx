
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import useSpeechRecognition from './hooks/useSpeechRecognition';
import useDiarization from './hooks/useDiarization';
import { generateSummary, generateTopics, generateActionItems, generateSnippets, translateText, analyzeTranscriptChunk } from './services/geminiService';
import Visualizer from './components/Visualizer';
import Tooltip from './components/Tooltip';
import Toast, { type ToastMessage, type ToastType } from './components/Toast';
import ImmersiveMode from './components/ImmersiveMode';
import TranscriptChat from './components/TranscriptChat';
import BackgroundPenLogo from './components/BackgroundPenLogo';
import {
  type TranscriptEntry,
  type SummaryStyle,
  type Emotion,
  type SpeechAnalytics,
  type DiarizationSettings,
  type SpeakerId,
  type DiarizationSegment,
  type SpeakerProfile,
  type ActionItem,
  type Snippet,
  type TimelineEvent,
} from './types';
import { AVATAR_EMOTIONS, FILLER_WORDS, THEME_PRESETS, DIARIZATION_PALETTE } from './constants';

// --- Custom Hook for Previous State ---
const usePrevious = <T,>(value: T): T | undefined => {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
};


// --- Custom Hook for Resizable Panels ---
const useResizablePanels = (
  defaultLeftWidth: number,
  defaultRightWidth: number,
  minWidth: number,
  maxWidth: number
) => {
  const getInitialWidth = (key: string, defaultValue: number): number => {
    const saved = localStorage.getItem(key);
    if (!saved) return defaultValue;
    const num = parseInt(saved, 10);
    return isNaN(num) ? defaultValue : Math.max(minWidth, Math.min(maxWidth, num));
  };

  const [leftPanelWidth, setLeftPanelWidth] = useState(() => getInitialWidth('defscribe-leftPanelWidth', defaultLeftWidth));
  const [rightPanelWidth, setRightPanelWidth] = useState(() => getInitialWidth('defscribe-rightPanelWidth', defaultRightWidth));

  const activeResizer = useRef<"left" | "right" | null>(null);

  const handleMouseDown = useCallback((resizer: 'left' | 'right') => {
    activeResizer.current = resizer;
    document.body.classList.add('resizing');
    const handleMouseMove = (e: MouseEvent) => {
        if (!activeResizer.current) return;
        if (activeResizer.current === 'left') {
          const newWidth = e.clientX;
          const constrainedWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
          setLeftPanelWidth(constrainedWidth);
        } else if (activeResizer.current === 'right') {
          const newWidth = window.innerWidth - e.clientX;
          const constrainedWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
          setRightPanelWidth(constrainedWidth);
        }
    };
    const handleMouseUp = () => {
        activeResizer.current = null;
        document.body.classList.remove('resizing');
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [minWidth, maxWidth]);
  
  useEffect(() => {
    localStorage.setItem('defscribe-leftPanelWidth', String(leftPanelWidth));
  }, [leftPanelWidth]);
  useEffect(() => {
    localStorage.setItem('defscribe-rightPanelWidth', String(rightPanelWidth));
  }, [rightPanelWidth]);
  
  const resetLayout = () => {
      setLeftPanelWidth(defaultLeftWidth);
      setRightPanelWidth(defaultRightWidth);
      localStorage.removeItem('defscribe-leftPanelWidth');
      localStorage.removeItem('defscribe-rightPanelWidth');
  }

  return { leftPanelWidth, rightPanelWidth, handleMouseDown, resetLayout };
};

// --- Reusable UI Components ---
const SectionHeader: React.FC<{icon: string, title: string, className?: string}> = ({icon, title, className=""}) => (
  <h3 className={`font-bold text-[var(--color-primary)] flex items-center gap-2 ${className}`}>
    <i className={`fas ${icon} w-4 text-center`}></i>
    <span>{title}</span>
  </h3>
);

const MetricCard: React.FC<{ icon: string; value: string | number; label: string; }> = ({ icon, value, label }) => (
    <div className="p-3 bg-slate-900/50 rounded-xl text-center flex flex-col items-center justify-center h-24 transition-colors duration-300 hover:bg-slate-900/80">
        <i className={`fas ${icon} text-xl text-[var(--color-primary)] mb-1`}></i>
        <div className="font-bold text-2xl text-white">{value}</div>
        <div className="text-xs text-slate-400 uppercase tracking-wider">{label}</div>
    </div>
);

const AccuracyCircle: React.FC<{ percentage: number }> = ({ percentage }) => {
    const radius = 50;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
        <div className="p-3 bg-slate-900/50 rounded-xl text-center flex flex-col items-center justify-center h-full">
             <div className="relative w-24 h-24">
                <svg className="w-full h-full" viewBox="0 0 120 120">
                    <circle className="text-slate-700" strokeWidth="8" stroke="currentColor" fill="transparent" r={radius} cx="60" cy="60" />
                    <circle
                        className="text-[var(--color-primary)]"
                        strokeWidth="8"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="transparent"
                        r={radius}
                        cx="60"
                        cy="60"
                        style={{ transition: 'stroke-dashoffset 0.5s ease-out', transform: 'rotate(-90deg)', transformOrigin: 'center' }}
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold text-white">{`${percentage}`}<span className="text-xl">%</span></span>
                </div>
            </div>
            <div className="text-sm text-slate-400 uppercase tracking-wider mt-2">Accuracy</div>
        </div>
    );
};

const SpeakerChip: React.FC<{ profile: SpeakerProfile; onUpdate: (id: SpeakerId, newLabel: string) => void; }> = ({ profile, onUpdate }) => {
    const [text, setText] = useState(profile.label);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleBlur = () => {
        if (text.trim()) {
            onUpdate(profile.id, text);
        } else {
            setText(profile.label); // Revert if empty
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            inputRef.current?.blur();
        }
    };
    
    useEffect(() => { setText(profile.label) }, [profile.label]);

    return (
        <div className="flex items-center gap-2 flex-shrink-0 group w-full p-1 rounded-md hover:bg-slate-700/50">
            <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: profile.color }}></span>
            <input
                ref={inputRef}
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                className="bg-transparent text-sm font-semibold w-full p-0 focus:outline-none focus:ring-0 focus:bg-slate-700 rounded px-1"
                style={{ color: profile.color }}
                aria-label={`Edit label for ${profile.label}`}
            />
        </div>
    );
};

const DiarizationPanel: React.FC<{ 
  settings: DiarizationSettings; 
  setSettings: React.Dispatch<React.SetStateAction<DiarizationSettings>>;
  profiles: Record<SpeakerId, SpeakerProfile>;
  onUpdateProfile: (id: SpeakerId, newLabel: string) => void;
}> = ({ settings, setSettings, profiles, onUpdateProfile }) => {
    const handleToggle = () => setSettings(s => ({ ...s, enabled: !s.enabled }));
    const handleSpeakersChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        const numSpeakers = value === 'auto' ? 25 : Number(value); 
        setSettings(s => ({ ...s, expectedSpeakers: numSpeakers }));
    };

    const displayValue = settings.expectedSpeakers === 25 ? 'auto' : settings.expectedSpeakers;

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <SectionHeader icon="fa-users" title="Diarization" />
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={settings.enabled} onChange={handleToggle} className="sr-only peer" aria-label="Toggle Diarization"/>
                  <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[var(--color-primary)] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-primary)]"></div>
                </label>
            </div>
            <div className={`space-y-3 transition-opacity duration-300 ${settings.enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                 <div className="relative">
                    <label htmlFor="speakers" className="block text-sm font-medium text-slate-300 mb-1">Speaker Count</label>
                     <Tooltip text="Auto-detects speakers. Experimental for many speakers.">
                        <select id="speakers" value={displayValue} onChange={handleSpeakersChange} className="bg-slate-700/70 border border-slate-600 text-white text-sm rounded-lg focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] block w-full p-2">
                            <option value="auto">Auto (Max 25)</option>
                            {[...Array(7).keys()].map(i => <option key={i+2} value={i + 2}>{i + 2}</option>)}
                        </select>
                    </Tooltip>
                </div>
                 <div className="space-y-2 pt-2 border-t border-slate-700/50">
                    <h4 className="font-semibold text-sm text-slate-300">Detected Speakers:</h4>
                    {Object.values(profiles).length > 0 ? (
                        <div className="space-y-1 max-h-32 overflow-y-auto pr-2">
                            {Object.values(profiles).sort((a,b) => a.id.localeCompare(b.id)).map(profile => (
                                <SpeakerChip key={profile.id} profile={profile} onUpdate={onUpdateProfile} />
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-slate-400 italic px-1">Start listening to detect speakers.</p>
                    )}
                </div>
            </div>
        </div>
    );
};


const DiarizationTimeline: React.FC<{ segments: DiarizationSegment[], profiles: Record<SpeakerId, SpeakerProfile>, duration: number, timelineEvents: TimelineEvent[] }> = ({ segments, profiles, duration, timelineEvents }) => {
    if (duration === 0) return null;

    const sentimentGradient = useMemo(() => {
        if (timelineEvents.length === 0) return 'transparent';
        const sentimentEvents = timelineEvents.filter(e => e.type === 'sentiment');
        if (sentimentEvents.length === 0) return 'transparent';

        const colorStops = sentimentEvents.map(event => {
            const color = event.value === 'positive' ? 'rgba(74, 222, 128, 0.3)' : event.value === 'negative' ? 'rgba(248, 113, 113, 0.3)' : 'rgba(107, 114, 128, 0.2)';
            const position = (event.startMs / duration) * 100;
            return `${color} ${position}%`;
        });

        return `linear-gradient(to right, ${colorStops.join(', ')})`;
    }, [timelineEvents, duration]);

    return (
        <div className="w-full h-8 bg-slate-900/50 rounded-lg relative overflow-hidden border border-slate-700/50" style={{ background: sentimentGradient }}>
            {segments.map((seg, i) => {
                const profile = profiles[seg.speakerId];
                if (!profile) return null;
                const left = (seg.startMs / duration) * 100;
                const width = ((seg.endMs - seg.startMs) / duration) * 100;
                return (
                    <Tooltip key={`seg-${i}`} text={`${profile.label}: ${formatDuration(seg.startMs/1000)} - ${formatDuration(seg.endMs/1000)}`}>
                        <div 
                            className="absolute h-full"
                            style={{
                                left: `${left}%`,
                                width: `${width}%`,
                                backgroundColor: profile.color,
                                opacity: 0.7
                            }}
                        />
                    </Tooltip>
                );
            })}
            {timelineEvents.filter(e => e.type === 'topic').map((event, i) => (
                 <Tooltip key={`topic-${i}`} text={`Topic: ${event.value}`}>
                    <div className="absolute top-1/2 -translate-y-1/2 w-1 h-full bg-[var(--color-accent)]" style={{ left: `${(event.startMs / duration) * 100}%` }}></div>
                 </Tooltip>
            ))}
        </div>
    );
};

const SpeakerTag: React.FC<{ profile: SpeakerProfile }> = ({ profile }) => {
  const speakerNum = profile.id.replace('S', '');
  return (
    <Tooltip text={profile.label} position="right">
      <div 
        className="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 text-white shadow-md border-2 border-slate-900/50"
        style={{ backgroundColor: profile.color }}
      >
        {speakerNum}
      </div>
    </Tooltip>
  );
};

const formatDuration = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const seconds = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
};

const hexToRgb = (hex: string): [number, number, number] | null => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [ parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16) ] : null;
};


const App: React.FC = () => {
  const { isListening, transcript, finalTranscript, error, startListening, stopListening, clearTranscript, confidence } = useSpeechRecognition();
  
  const [transcriptEntries, setTranscriptEntries] = useState<TranscriptEntry[]>([]);
  const [summary, setSummary] = useState<string>('Your transcript summary will appear here.');
  const [summaryStyle, setSummaryStyle] = useState<SummaryStyle | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isDetectingTopics, setIsDetectingTopics] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAnalyzingSnippets, setIsAnalyzingSnippets] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isImmersive, setIsImmersive] = useState(false);
  const [isImmersiveButtonGlowing, setIsImmersiveButtonGlowing] = useState(true);
  
  const [showTimestamps, setShowTimestamps] =useState(() => localStorage.getItem('defscribe-showTimestamps') === 'true');
  const [autoScroll, setAutoScroll] = useState(() => localStorage.getItem('defscribe-autoScroll') !== 'false');
  const [activeThemeKey, setActiveThemeKey] = useState<number>(() => Number(localStorage.getItem('defscribe-theme') || 1));
  const [themeColors, setThemeColors] = useState(THEME_PRESETS[Number(localStorage.getItem('defscribe-theme') || 1)]);
  const [searchQuery, setSearchQuery] = useState('');
  const [avatarEmotion, setAvatarEmotion] = useState<Emotion>('normal');
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [translationLanguage, setTranslationLanguage] = useState<string>('');
  
  // --- Diarization State ---
  const [diarizationSettings, setDiarizationSettings] = useState<DiarizationSettings>({ enabled: true, mode: 'local', expectedSpeakers: 25 });
  const [speakerProfiles, setSpeakerProfiles] = useState<Record<SpeakerId, SpeakerProfile>>({});
  const [diarizationSegments, setDiarizationSegments] = useState<DiarizationSegment[]>([]);
  
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<number | null>(null);
  const translationQueueRef = useRef<{ id: string, text: string }[]>([]);
  const firstSpeakerIdentified = useRef(false);

  const { activeSpeaker } = useDiarization(stream, diarizationSettings, startTimeRef.current, setDiarizationSegments);
  
  // --- Live Transcript Animation State ---
  const prevTranscript = usePrevious(transcript);
  const [liveText, setLiveText] = useState('');
  const [liveTextState, setLiveTextState] = useState<'visible' | 'fading-out' | 'hidden'>('hidden');
  const fadeOutTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (fadeOutTimerRef.current) {
        clearTimeout(fadeOutTimerRef.current);
        fadeOutTimerRef.current = null;
    }

    if (transcript) {
        setLiveText(transcript);
        setLiveTextState('visible');
    } else if (prevTranscript && !transcript) {
        setLiveText(prevTranscript);
        setLiveTextState('fading-out');
        fadeOutTimerRef.current = window.setTimeout(() => {
            setLiveTextState('hidden');
            fadeOutTimerRef.current = null;
        }, 500);
    } else {
        if (!isListening) {
            setLiveTextState('hidden');
        }
    }
  }, [transcript, prevTranscript, isListening]);
  
  useEffect(() => {
    return () => {
        if (fadeOutTimerRef.current) {
            clearTimeout(fadeOutTimerRef.current);
        }
    };
  }, []);

  const initialAnalytics: SpeechAnalytics = {
      wpm: 0, accuracy: 0, fillers: 0, duration: 0, words: 0, sentences: 0, pauses: 0,
      clarity: 0, speakingRateLabel: 'Medium', emotionalTone: 'normal', emotionHistory: [], topics: [],
      talkTime: {}, interruptions: 0, timelineEvents: [],
  };
  const [analytics, setAnalytics] = useState<SpeechAnalytics>(initialAnalytics);
  const [activeAnalyticsTab, setActiveAnalyticsTab] = useState<'speech' | 'conversation' | 'actions' | 'snippets' | 'summary'>('speech');

  const { leftPanelWidth, rightPanelWidth, handleMouseDown, resetLayout } = useResizablePanels(300, 384, 280, 500);

  const addToast = useCallback((title: string, message: string, type: ToastType) => {
    setToasts((prevToasts) => [...prevToasts, { id: Date.now(), title, message, type }]);
  }, []);

  useEffect(() => { localStorage.setItem('defscribe-showTimestamps', String(showTimestamps)); }, [showTimestamps]);
  useEffect(() => { localStorage.setItem('defscribe-autoScroll', String(autoScroll)); }, [autoScroll]);
  useEffect(() => { localStorage.setItem('defscribe-theme', String(activeThemeKey)); }, [activeThemeKey]);

  useEffect(() => {
    const theme = THEME_PRESETS[activeThemeKey];
    if (theme) {
        setThemeColors(theme);
        const root = document.documentElement;
        const primaryRgb = hexToRgb(theme.primary);
        const secondaryRgb = hexToRgb(theme.secondary);
        
        if (primaryRgb && secondaryRgb) {
            root.style.setProperty('--color-primary', theme.primary);
            root.style.setProperty('--color-secondary', theme.secondary);
            root.style.setProperty('--color-accent', theme.accent);
            root.style.setProperty('--color-primary-rgb', primaryRgb.join(', '));
            root.style.setProperty('--color-secondary-rgb', secondaryRgb.join(', '));
            
            const panelR = Math.round(30 * 0.7 + primaryRgb[0] * 0.3);
            const panelG = Math.round(41 * 0.7 + primaryRgb[1] * 0.3);
            const panelB = Math.round(59 * 0.7 + primaryRgb[2] * 0.3);
            root.style.setProperty('--panel-bg-color', `rgba(${panelR}, ${panelG}, ${panelB}, 0.5)`);
        }
    }
  }, [activeThemeKey]);

  useEffect(() => {
    // Initial glow for 6 seconds
    const initialGlowTimeout = setTimeout(() => {
        setIsImmersiveButtonGlowing(false);
    }, 6000);

    let intermittentGlowTimeout: number;

    const scheduleIntermittentGlow = () => {
        // Schedule the next glow in 1.5 to 2.5 minutes
        const randomInterval = 90000 + Math.random() * 60000;
        intermittentGlowTimeout = window.setTimeout(() => {
            setIsImmersiveButtonGlowing(true);
            // Turn off the glow after 6 seconds
            const glowDurationTimeout = setTimeout(() => {
                setIsImmersiveButtonGlowing(false);
                scheduleIntermittentGlow();
            }, 6000);
        }, randomInterval);
    };

    scheduleIntermittentGlow();

    return () => {
        clearTimeout(initialGlowTimeout);
        clearTimeout(intermittentGlowTimeout);
    };
  }, []);
    
    // Debounced translation handler
    const processTranslationQueue = useCallback(async () => {
        if (translationQueueRef.current.length === 0 || !translationLanguage) return;

        const itemsToTranslate = [...translationQueueRef.current];
        translationQueueRef.current = [];
        const combinedText = itemsToTranslate.map(item => item.text).join('\n---\n');
        
        try {
            const translatedCombined = await translateText(combinedText, translationLanguage);
            const translatedParts = translatedCombined.split('\n---\n');

            setTranscriptEntries(prev => prev.map(entry => {
                const itemIndex = itemsToTranslate.findIndex(item => item.id === entry.id);
                if (itemIndex > -1) {
                    return { ...entry, translatedText: translatedParts[itemIndex] || "..." };
                }
                return entry;
            }));
        } catch (e) {
            addToast('Translation Error', 'Could not translate text.', 'error');
        }
    }, [translationLanguage, addToast]);

    useEffect(() => {
        const handler = setTimeout(() => {
            processTranslationQueue();
        }, 2000);
        return () => clearTimeout(handler);
    }, [finalTranscript, processTranslationQueue]);


    useEffect(() => {
        if (finalTranscript) {
            const existingText = transcriptEntries.map(e => e.text).join(' ');
            const newText = finalTranscript.slice(existingText.length).trim();

            if (newText) {
                const now = Date.now();
                const newEntryId = `entry-${now}`;
                const entryStartMs = now - (startTimeRef.current || now);
                
                const matchingSegment = [...diarizationSegments].reverse().find(
                    seg => entryStartMs >= seg.startMs && entryStartMs <= seg.endMs
                );
                // Use activeSpeaker if available. If the back-fill logic hasn't run yet,
                // this might be null, which is fine. The back-fill will fix it.
                const speakerIdArray = matchingSegment ? [matchingSegment.speakerId] : (activeSpeaker ? [activeSpeaker] : []);
                
                if(translationLanguage) {
                    translationQueueRef.current.push({ id: newEntryId, text: newText });
                }

                setTranscriptEntries(prev => {
                    if (prev.length > 0 && prev[prev.length-1].endTimestamp === undefined) {
                        prev[prev.length - 1].endTimestamp = now;
                    }
                    const newEntry: TranscriptEntry = {
                        id: newEntryId,
                        timestamp: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        rawTimestamp: now,
                        text: newText,
                        isFinal: true,
                        speakerIds: speakerIdArray,
                    };
                    return [...prev, newEntry];
                });
            }
        }
    }, [finalTranscript, translationLanguage, activeSpeaker, diarizationSegments, transcriptEntries]);

  // FIX: Back-fill speaker IDs for initial entries that were created before the first speaker was identified.
  useEffect(() => {
    if (activeSpeaker && !firstSpeakerIdentified.current && transcriptEntries.length > 0) {
        firstSpeakerIdentified.current = true; // Set flag to ensure this only runs once per session.
        setTranscriptEntries(prev => {
            let changed = false;
            const updatedEntries = prev.map(entry => {
                if (!entry.speakerIds || entry.speakerIds.length === 0) {
                    changed = true;
                    return { ...entry, speakerIds: [activeSpeaker] };
                }
                return entry;
            });
            return changed ? updatedEntries : prev;
        });
    }
  }, [activeSpeaker, transcriptEntries]);
  
  useEffect(() => {
    const allSpeakers = new Set(transcriptEntries.flatMap(e => e.speakerIds || []).filter(Boolean) as SpeakerId[]);
    if (activeSpeaker) allSpeakers.add(activeSpeaker);
    
    let needsUpdate = false;
    const newProfiles: Record<SpeakerId, SpeakerProfile> = { ...speakerProfiles };
    
    allSpeakers.forEach(id => {
        if (!newProfiles[id]) {
            const speakerNum = parseInt(id.replace('S', ''), 10);
            newProfiles[id] = {
                id,
                label: `Speaker ${speakerNum}`,
                color: DIARIZATION_PALETTE[(speakerNum - 1) % DIARIZATION_PALETTE.length],
            };
            needsUpdate = true;
        }
    });

    if (needsUpdate) {
        setSpeakerProfiles(newProfiles);
    }
  }, [transcriptEntries, activeSpeaker, speakerProfiles]);


  useEffect(() => {
    if (autoScroll) {
      transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcriptEntries, transcript, autoScroll]);
  
  useEffect(() => {
    if (isListening) {
      setAvatarEmotion(transcript.trim().length > 0 ? 'talking' : 'listening');
    }
  }, [transcript, isListening]);

  const handleStart = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStream(mediaStream);
      
      clearTranscript();
      setTranscriptEntries([]);
      setSummary('Your transcript summary will appear here.');
      setSummaryStyle(null);
      setAnalytics(initialAnalytics);
      setSearchQuery('');
      setSpeakerProfiles({});
      setActionItems([]);
      setSnippets([]);
      setDiarizationSegments([]);
      firstSpeakerIdentified.current = false;

      startTimeRef.current = Date.now();

      startListening();
      setAvatarEmotion('listening');
      addToast('Listening Started', 'DefScribe is now recording your speech.', 'info');
    } catch (err) {
      addToast('Microphone Error', 'Could not access the microphone. Please check permissions.', 'error');
    }
  };
  
    const analyzeFullTranscript = async () => {
        const fullTranscript = transcriptEntries.map(e => {
            const speakerLabel = e.speakerIds?.[0] ? `${speakerProfiles[e.speakerIds[0]]?.label || e.speakerIds[0]}: ` : '';
            return `${speakerLabel}${e.text}`;
        }).join('\n');
        
        if (fullTranscript.trim().length < 50) return;

        setIsAnalyzing(true);
        addToast('Analyzing...', 'Generating topics and timeline.', 'info');
        
        // Analyze topics
        setIsDetectingTopics(true);
        const detectedTopics = await generateTopics(fullTranscript);
        setAnalytics(prev => ({ ...prev, topics: detectedTopics }));
        setIsDetectingTopics(false);

        // Analyze for timeline events
        const CHUNK_DURATION_MS = 30000; // 30 seconds
        const events: TimelineEvent[] = [];
        let lastTopic = '';

        for (let i = 0; i < transcriptEntries.length; i++) {
            const chunkStartTime = transcriptEntries[i].rawTimestamp;
            const chunkEndTime = chunkStartTime + CHUNK_DURATION_MS;
            const entriesInChunk = transcriptEntries.filter(e => e.rawTimestamp >= chunkStartTime && e.rawTimestamp < chunkEndTime);
            if (entriesInChunk.length === 0) continue;
            
            const chunkText = entriesInChunk.map(e => e.text).join(' ');
            const { topic, sentiment } = await analyzeTranscriptChunk(chunkText);
            
            events.push({ startMs: chunkStartTime - startTimeRef.current!, endMs: chunkEndTime - startTimeRef.current!, type: 'sentiment', value: sentiment });
            if (topic !== lastTopic) {
                events.push({ startMs: chunkStartTime - startTimeRef.current!, endMs: chunkEndTime - startTimeRef.current!, type: 'topic', value: topic });
                lastTopic = topic;
            }
            i += entriesInChunk.length - 1; // Skip entries already processed
        }
        setAnalytics(prev => ({...prev, timelineEvents: events }));
        
        setIsAnalyzing(false);
    };

  const handleStop = async () => {
    stopListening();
    stream?.getTracks().forEach(track => track.stop());
    setStream(null);
    setAvatarEmotion('normal');
    addToast('Listening Stopped', 'Recording has been paused.', 'info');
    
    await analyzeFullTranscript();
  };

  const handleSummarize = async (style: SummaryStyle) => {
    const fullTranscript = transcriptEntries.map(e => e.text).join(' ');
    if (fullTranscript.trim().length < 10) {
      addToast('Not enough content', 'Please speak more before summarizing.', 'warning');
      return;
    }
    setIsSummarizing(true);
    setSummaryStyle(style);
    setAvatarEmotion('thinking');
    addToast('Summarizing...', 'Generating your summary with Gemini AI.', 'info');
    
    try {
      const { summary: result, emotion } = await generateSummary(fullTranscript, style);
      setSummary(result);
      addToast('Summary Ready', 'Your transcript summary is complete.', 'success');
      setAvatarEmotion(emotion);
      setAnalytics(prev => ({ ...prev, emotionalTone: emotion, emotionHistory: [...prev.emotionHistory, emotion].slice(-7) }));
    } catch (e) {
      const error = e as Error;
      setSummary(`Failed to generate summary: ${error.message}`);
      addToast('Summarization Failed', 'Could not generate summary.', 'error');
      setAvatarEmotion('sad');
    } finally {
      setIsSummarizing(false);
    }
  };
  
    const handleAnalyzeActionItems = async () => {
        const fullTranscript = transcriptEntries.map(e => {
            const speakerLabel = e.speakerIds?.[0] ? `${speakerProfiles[e.speakerIds[0]]?.label || e.speakerIds[0]}: ` : '';
            return `${speakerLabel}${e.text}`;
        }).join('\n');
        
        if (fullTranscript.trim().length < 20) {
            addToast('Not enough content', 'Please record more before analyzing.', 'warning');
            return;
        }
        setIsAnalyzing(true);
        addToast('Analyzing...', 'Extracting action items and decisions.', 'info');
        try {
            const items = await generateActionItems(fullTranscript);
            const speakerLabelMap: Record<string, SpeakerId> = {};
            Object.values(speakerProfiles).forEach(p => { speakerLabelMap[p.label.toLowerCase()] = p.id; });

            setActionItems(items.map((item, i) => ({
                ...item,
                id: `action-${Date.now()}-${i}`,
                speakerId: item.speakerLabel ? speakerLabelMap[item.speakerLabel.toLowerCase()] : undefined
            })));
            addToast('Analysis Complete', `${items.length} items found.`, 'success');
            setActiveAnalyticsTab('actions');
        } catch(e) {
            addToast('Analysis Failed', 'Could not extract action items.', 'error');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleAnalyzeSnippets = async () => {
        const fullTranscript = transcriptEntries.map(e => {
            const speakerLabel = e.speakerIds?.[0] ? `${speakerProfiles[e.speakerIds[0]]?.label || e.speakerIds[0]}: ` : '';
            return `${speakerLabel}${e.text}`;
        }).join('\n');
        
        if (fullTranscript.trim().length < 50) {
            addToast('Not enough content', 'Please record more before analyzing.', 'warning');
            return;
        }
        setIsAnalyzingSnippets(true);
        addToast('Analyzing...', 'Extracting smart snippets.', 'info');
        try {
            const items = await generateSnippets(fullTranscript);
            const speakerLabelMap: Record<string, SpeakerId> = {};
            Object.values(speakerProfiles).forEach(p => { speakerLabelMap[p.label.toLowerCase()] = p.id; });

            setSnippets(items.map((item, i) => ({
                ...item,
                id: `snippet-${Date.now()}-${i}`,
                speakerId: item.speakerLabel ? speakerLabelMap[item.speakerLabel.toLowerCase()] : undefined
            })));
            addToast('Analysis Complete', `${items.length} snippets found.`, 'success');
            setActiveAnalyticsTab('snippets');
        } catch(e) {
            addToast('Analysis Failed', 'Could not extract snippets.', 'error');
        } finally {
            setIsAnalyzingSnippets(false);
        }
    };

  const handleClear = () => {
    if (window.confirm("Are you sure you want to clear the entire transcript? This action cannot be undone.")) {
      clearTranscript();
      setTranscriptEntries([]);
      setSummary('Your transcript summary will appear here.');
      setSummaryStyle(null);
      setAnalytics(initialAnalytics);
      setSearchQuery('');
      setSpeakerProfiles({});
      setActionItems([]);
      setSnippets([]);
      setDiarizationSegments([]);
      startTimeRef.current = null;
      firstSpeakerIdentified.current = false;
      addToast('Cleared', 'Transcript has been cleared.', 'info');
    }
  }

  const handleCopy = (textToCopy: string, type: string) => {
    navigator.clipboard.writeText(textToCopy)
      .then(() => addToast('Copied!', `${type} has been copied to clipboard.`, 'success'))
      .catch(() => addToast('Copy Failed', 'Could not copy to clipboard.', 'error'));
  }
  
  const createAndDownloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSave = () => {
    const fullTranscript = transcriptEntries.map(e => {
        const speakerLabel = e.speakerIds?.[0] ? `${speakerProfiles[e.speakerIds[0]]?.label || e.speakerIds[0]}: ` : '';
        return `[${e.timestamp}] ${speakerLabel}${e.text}`
    }).join('\n');
    const fileContent = `DefScribe Transcript\nGenerated: ${new Date().toLocaleString()}\n\n--- SUMMARY ---\n${summary}\n\n--- FULL TRANSCRIPT ---\n${fullTranscript}`;
    createAndDownloadFile(fileContent, `defscribe-transcript-${Date.now()}.txt`, 'text/plain;charset=utf-8');
    addToast('Saved', 'Transcript has been saved as a .txt file.', 'success');
  };
  
  const handleSaveJson = () => {
    const output = {
        generated: new Date().toISOString(),
        summary,
        speakerProfiles,
        transcript: transcriptEntries,
        analytics,
        actionItems,
        snippets,
    };
    createAndDownloadFile(JSON.stringify(output, null, 2), `defscribe-transcript-${Date.now()}.json`, 'application/json');
    addToast('Saved', 'Transcript has been saved as a .json file.', 'success');
  }

    const formatSrtTime = (ms: number) => {
        const date = new Date(ms);
        const hours = date.getUTCHours().toString().padStart(2, '0');
        const minutes = date.getUTCMinutes().toString().padStart(2, '0');
        const seconds = date.getUTCSeconds().toString().padStart(2, '0');
        const milliseconds = date.getUTCMilliseconds().toString().padStart(3, '0');
        return `${hours}:${minutes}:${seconds},${milliseconds}`;
    };

    const handleSaveSrt = () => {
        if (!startTimeRef.current) return;
        let srtContent = '';
        let counter = 1;
        transcriptEntries.forEach(entry => {
            const startTime = formatSrtTime(entry.rawTimestamp - startTimeRef.current!);
            const endTime = formatSrtTime((entry.endTimestamp || entry.rawTimestamp + 2000) - startTimeRef.current!);
            const speakerLabel = entry.speakerIds?.[0] ? `${speakerProfiles[entry.speakerIds[0]]?.label || entry.speakerIds[0]}: ` : '';
            srtContent += `${counter++}\n${startTime} --> ${endTime}\n${speakerLabel}${entry.text}\n\n`;
        });
        createAndDownloadFile(srtContent, `defscribe-transcript-${Date.now()}.srt`, 'application/x-subrip');
        addToast('Saved', 'Transcript has been saved as a .srt file.', 'success');
    };

  const dismissToast = (id: number) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
  };
  
  useEffect(() => {
    if (error) { addToast('Recognition Error', error, 'error'); }
  }, [error, addToast]);
  
  useEffect(() => {
    if (confidence >= 0) {
      const accuracy = Math.round(confidence * 100);
      setAnalytics(prev => ({ ...prev, accuracy, clarity: accuracy }));
    }
  }, [confidence]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isListening) {
      interval = setInterval(() => {
        if (startTimeRef.current) {
          const elapsedSeconds = (Date.now() - startTimeRef.current) / 1000;
          const wordCount = analytics.words;
          const wpm = elapsedSeconds > 0 ? Math.round((wordCount / elapsedSeconds) * 60) : 0;
          let speakingRateLabel: SpeechAnalytics['speakingRateLabel'] = 'Medium';
          if (wpm > 0 && wpm < 140) speakingRateLabel = 'Slow';
          else if (wpm > 160) speakingRateLabel = 'Fast';

          setAnalytics(prev => ({ ...prev, duration: elapsedSeconds, wpm, speakingRateLabel }));
        }
      }, 1000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isListening, analytics.words]);

  useEffect(() => {
    const fullTranscript = transcriptEntries.map(entry => entry.text).join(' ');
    const words = fullTranscript.split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const fillerCount = words.reduce((acc, word) => FILLER_WORDS.has(word.toLowerCase().replace(/[.,?!]/g, '')) ? acc + 1 : acc, 0);
    const sentenceCount = (fullTranscript.match(/[.?!…]+/g) || []).length || (wordCount > 0 ? 1 : 0);
    let pauseCount = 0;
    if (transcriptEntries.length > 1) {
      for (let i = 1; i < transcriptEntries.length; i++) {
        if (transcriptEntries[i].rawTimestamp - transcriptEntries[i - 1].rawTimestamp > 2000) { pauseCount++; }
      }
    }
    setAnalytics(prev => ({ ...prev, words: wordCount, fillers: fillerCount, sentences: sentenceCount, pauses: pauseCount, }));
  }, [transcriptEntries]);
  
    // Calculate Conversation Dynamics
    useEffect(() => {
        if (diarizationSegments.length === 0 || analytics.duration === 0) return;
        const talkTime: Record<SpeakerId, { seconds: number, percentage: number }> = {};
        
        diarizationSegments.forEach(seg => {
            const duration = (seg.endMs - seg.startMs) / 1000;
            if (!talkTime[seg.speakerId]) talkTime[seg.speakerId] = { seconds: 0, percentage: 0 };
            talkTime[seg.speakerId].seconds += duration;
        });

        Object.keys(talkTime).forEach(id => {
            talkTime[id].percentage = Math.round((talkTime[id].seconds / analytics.duration) * 100);
        });

        // Simple interruption detection: a new speaker starts within 1s of another ending
        let interruptions = 0;
        for (let i = 1; i < diarizationSegments.length; i++) {
            const prev = diarizationSegments[i-1];
            const curr = diarizationSegments[i];
            if (curr.speakerId !== prev.speakerId && curr.startMs < prev.endMs + 1000) {
                interruptions++;
            }
        }

        setAnalytics(prev => ({ ...prev, talkTime, interruptions }));

    }, [diarizationSegments, analytics.duration]);

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return <>{text}</>;
    try {
      const regex = new RegExp(`(${query})`, 'gi');
      const parts = text.split(regex);
      return (
        <>
          {parts.map((part, i) =>
            regex.test(part) ? <mark key={i}>{part}</mark> : <span key={i}>{part}</span>
          )}
        </>
      );
    } catch (error) {
      return <>{text}</>;
    }
  };
  
  const updateSpeakerLabel = (id: SpeakerId, newLabel: string) => {
    setSpeakerProfiles(prev => ({ ...prev, [id]: { ...prev[id], label: newLabel } }));
  };

  const snippetIconMap: Record<Snippet['type'], string> = {
    quote: 'fas fa-quote-left',
    question: 'fas fa-question-circle',
    insight: 'fas fa-lightbulb',
  };
  
  const snippetColorMap: Record<Snippet['type'], string> = {
      quote: 'var(--color-accent)',
      question: 'var(--color-secondary)',
      insight: 'var(--color-primary)',
  };

  const isAnalyzingSomething = useMemo(() => isSummarizing || isAnalyzing || isAnalyzingSnippets, [isSummarizing, isAnalyzing, isAnalyzingSnippets]);

  if (isImmersive) {
    return (
      <ImmersiveMode
        isListening={isListening}
        transcriptEntries={transcriptEntries}
        stream={stream}
        themeColors={themeColors}
        onExit={() => setIsImmersive(false)}
        onToggleListen={isListening ? handleStop : handleStart}
        onClear={handleClear}
        avatarEmotion={avatarEmotion}
        avatarMap={AVATAR_EMOTIONS}
      />
    );
  }

  return (
    <>
      <div className="fixed top-4 right-4 z-[100] w-full max-w-sm space-y-2">
        {toasts.map((toast) => ( <Toast key={toast.id} toast={toast} onDismiss={dismissToast} /> ))}
      </div>
      
      <div 
        className="fixed inset-0 -z-10"
        style={{
            background: `radial-gradient(circle at 20% 30%, rgba(var(--color-primary-rgb), 0.15) 0%, transparent 40%),
                         radial-gradient(circle at 80% 70%, rgba(var(--color-secondary-rgb), 0.1) 0%, transparent 50%)`
        }}
      />
      
      <BackgroundPenLogo isListening={isListening} isSummarizing={isAnalyzingSomething} wpm={analytics.wpm} />

       {isChatOpen && (
        <TranscriptChat
          transcript={transcriptEntries.map(e => `${speakerProfiles[e.speakerIds?.[0]!]?.label || 'Unknown'}: ${e.text}`).join('\n')}
          onClose={() => setIsChatOpen(false)}
        />
      )}
    
      <div 
        className="h-screen text-slate-200 grid p-4 gap-0 relative z-20"
        style={{ gridTemplateColumns: `minmax(0, ${leftPanelWidth}px) 5px minmax(0, 1fr) 5px minmax(0, ${rightPanelWidth}px)` }}
      >
        
        {/* Left Control Sidebar */}
        <aside className="backdrop-blur-lg border border-slate-700/50 rounded-2xl shadow-2xl p-4 flex flex-col gap-4 overflow-y-auto">
          <button onClick={isListening ? handleStop : handleStart} disabled={isAnalyzingSomething} className={`w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl font-bold text-lg transition-all duration-300 text-white shadow-lg disabled:opacity-50 ${isListening ? 'bg-red-500 hover:bg-red-600 recording-shadow' : 'bg-green-500 hover:bg-green-600'}`}>
            {isListening ? (<><i className="fas fa-stop mic-pulse-animation"></i> Stop Listening</>) : (<><i className="fas fa-microphone"></i> Start Listening</>)}
            {isAnalyzingSomething && <div className="w-5 h-5 border-2 border-t-transparent border-white rounded-full spinner-animation"></div>}
          </button>
          
          <div className="my-2 border-b border-slate-700/50"></div>

          <div className="space-y-4">
            <SectionHeader icon="fa-sliders-h" title="Management" />
            <div className="grid grid-cols-5 gap-2">
                <Tooltip text="Clear"><button onClick={handleClear} className="w-full py-2 bg-slate-700/70 hover:bg-red-500/50 rounded-lg transition-colors"><i className="fas fa-trash-alt"></i></button></Tooltip>
                <Tooltip text="Copy TXT"><button onClick={() => handleCopy(transcriptEntries.map(e => e.text).join(' '), 'Transcript')} className="w-full py-2 bg-slate-700/70 hover:bg-[var(--color-primary)]/30 rounded-lg transition-colors"><i className="fas fa-copy"></i></button></Tooltip>
                <Tooltip text="Save TXT"><button onClick={handleSave} className="w-full py-2 bg-slate-700/70 hover:bg-[var(--color-primary)]/30 rounded-lg transition-colors"><i className="fas fa-save"></i></button></Tooltip>
                <Tooltip text="Save JSON"><button onClick={handleSaveJson} className="w-full py-2 bg-slate-700/70 hover:bg-[var(--color-primary)]/30 rounded-lg transition-colors"><i className="fab fa-js-square"></i></button></Tooltip>
                <Tooltip text="Save SRT"><button onClick={handleSaveSrt} className="w-full py-2 bg-slate-700/70 hover:bg-[var(--color-primary)]/30 rounded-lg transition-colors"><i className="fas fa-closed-captioning"></i></button></Tooltip>
            </div>
            <div>
                <label htmlFor="translation" className="block text-sm font-medium text-slate-300 mb-1">Live Translation</label>
                <select id="translation" value={translationLanguage} onChange={(e) => setTranslationLanguage(e.target.value)} className="bg-slate-700/70 border border-slate-600 text-white text-sm rounded-lg focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] block w-full p-2">
                    <option value="">Disabled</option><option value="English">English</option><option value="Spanish">Spanish</option><option value="French">French</option><option value="German">German</option><option value="Japanese">Japanese</option><option value="Mandarin Chinese">Mandarin Chinese</option>
                </select>
            </div>
          </div>
          
           <div className="my-2 border-b border-slate-700/50"></div>
           
           <div className="space-y-4">
              <SectionHeader icon="fa-cogs" title="Settings" />
              <div className="space-y-2">
                <h4 className="font-semibold text-sm text-slate-300">Theme</h4>
                <div className="grid grid-cols-5 gap-1">
                    {Object.entries(THEME_PRESETS).map(([key, theme]) => (<Tooltip text={`Theme ${key}`} key={key}><button onClick={() => setActiveThemeKey(Number(key))} className={`h-8 w-full rounded-lg transition-all border-2 ${activeThemeKey === Number(key) ? 'border-white' : 'border-transparent'}`} style={{background: `linear-gradient(45deg, ${theme.primary}, ${theme.secondary})`}}/></Tooltip>))}
                </div>
              </div>
              <DiarizationPanel settings={diarizationSettings} setSettings={setDiarizationSettings} profiles={speakerProfiles} onUpdateProfile={updateSpeakerLabel} />
           </div>

          <div className="mt-auto pt-4">
              <div className="my-2 border-b border-slate-700/50"></div>
              <Tooltip text="Enter a distraction-free, futuristic transcription environment.">
                  <button 
                      onClick={() => setIsImmersive(true)} 
                      className={`w-full py-3 bg-slate-800 hover:bg-[var(--color-primary)]/30 rounded-xl transition-all relative overflow-hidden font-bold text-lg text-white flex items-center justify-center gap-3 ${isImmersiveButtonGlowing ? 'immersive-button-glowing' : 'border border-slate-700/50'}`}
                      aria-label="Enter Immersive Mode"
                  >
                      <i className="fas fa-rocket"></i> Go Immersive
                  </button>
              </Tooltip>
          </div>
        </aside>

        <div className="resizer-handle" onMouseDown={() => handleMouseDown('left')} />
        
        {/* Main Content Area */}
        <main className="w-full flex flex-col overflow-hidden h-full">
          <Visualizer isListening={isListening} stream={stream} themeColors={themeColors} />
          {diarizationSettings.enabled && <div className="mt-4"><DiarizationTimeline segments={diarizationSegments} profiles={speakerProfiles} duration={analytics.duration * 1000} timelineEvents={analytics.timelineEvents} /></div>}

          <div className="relative p-4 flex-1 backdrop-blur-lg border border-slate-700/50 rounded-2xl shadow-lg flex flex-col min-h-0" style={{ backgroundColor: 'var(--panel-bg-color)' }}>
            <div className="absolute top-2 right-2 z-10 flex gap-2">
                <Tooltip text="Chat with Transcript"><button onClick={() => setIsChatOpen(true)} className="px-3 py-1 text-xs rounded-full transition-colors bg-slate-700/70 text-slate-400 hover:bg-[var(--color-primary)]/30 hover:text-[var(--color-primary)]"><i className="fas fa-comments mr-1"></i></button></Tooltip>
                <Tooltip text={showTimestamps ? "Hide Timestamps" : "Show Timestamps"}><button onClick={() => setShowTimestamps(!showTimestamps)} className={`px-3 py-1 text-xs rounded-full transition-colors ${showTimestamps ? 'bg-[var(--color-primary)]/30 text-[var(--color-primary)]' : 'bg-slate-700/70 text-slate-400'}`}><i className="fas fa-clock mr-1"></i></button></Tooltip>
                <Tooltip text={autoScroll ? "Disable Autoscroll" : "Enable Autoscroll"}><button onClick={() => setAutoScroll(!autoScroll)} className={`px-3 py-1 text-xs rounded-full transition-colors ${autoScroll ? 'bg-[var(--color-primary)]/30 text-[var(--color-primary)]' : 'bg-slate-700/70 text-slate-400'}`}><i className="fas fa-scroll mr-1"></i></button></Tooltip>
            </div>
             <h2 className={`text-lg font-bold flex items-center gap-2 mb-2 ${!showTimestamps ? 'pl-2' : ''}`}><i className="fas fa-history text-[var(--color-primary)]"></i> Chat History</h2>
             <div className={`relative mb-2 ${!showTimestamps ? 'pl-2' : ''}`}>
                <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"></i>
                <input
                    type="text"
                    placeholder="Search transcript..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-900/70 border border-slate-700 rounded-lg py-2 pl-9 pr-3 text-sm focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-none transition-shadow"
                />
            </div>
            <div className="overflow-y-auto flex-1 space-y-1 pr-2">
                {transcriptEntries.length > 0 ? (
                    transcriptEntries.map((entry) => (
                        <div key={entry.id} className="group relative flex items-start gap-3 p-2 rounded-lg hover:bg-slate-800/50 transition-colors fade-in-entry pb-4">
                            {showTimestamps && (
                                <div className="w-24 flex-shrink-0 pt-1">
                                    <span className="font-roboto-mono text-xs text-[var(--color-secondary)] bg-[var(--color-secondary)]/10 px-2 py-1 rounded-md">{entry.timestamp}</span>
                                </div>
                            )}
                            <div className={`flex-1 pt-1 ${!showTimestamps ? 'pl-2' : ''}`}>
                                <div className="flex items-start gap-2">
                                    {diarizationSettings.enabled && entry.speakerIds && entry.speakerIds.length > 0 && (
                                        <div className="flex items-center justify-center gap-1 pt-1">
                                            {entry.speakerIds.map(id => speakerProfiles[id] ? <SpeakerTag key={id} profile={speakerProfiles[id]} /> : null)}
                                        </div>
                                    )}
                                    <div className="flex-1">
                                        <p className="text-slate-300 leading-relaxed">{highlightText(entry.text, searchQuery)}</p>
                                        {entry.translatedText && <p className="text-sm text-slate-400 italic mt-1 pl-2 border-l-2 border-slate-600">{entry.translatedText}</p>}
                                    </div>
                                </div>
                            </div>
                            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-0 h-px bg-gradient-to-r from-transparent via-[var(--color-primary)]/50 to-transparent transition-all duration-500 group-hover:w-[95%]"></div>
                        </div>
                    ))
                ) : ( <div className="flex items-start gap-3 p-2"><p className="flex-1 text-slate-400 italic">Welcome to DefScribe. Press Start Listening to begin.</p></div>)}
                
                {isListening && liveTextState !== 'hidden' && (
                    <div className={`group relative flex items-start gap-3 p-2 rounded-lg text-slate-400 transition-opacity duration-500 ease-out ${liveTextState === 'fading-out' ? 'opacity-0' : 'opacity-100'}`}>
                        {showTimestamps && (
                            <div className="w-24 flex-shrink-0 pt-1">
                                <span className="font-roboto-mono text-xs text-slate-500 bg-slate-800/50 px-2 py-1 rounded-md">Now...</span>
                            </div>
                        )}
                        <div className={`flex-1 pt-1 ${!showTimestamps ? 'pl-2' : ''}`}>
                            <div className="flex items-start gap-2">
                                {diarizationSettings.enabled && activeSpeaker && speakerProfiles[activeSpeaker] && (
                                    <div className="flex items-center justify-center gap-1 pt-1">
                                        <SpeakerTag profile={speakerProfiles[activeSpeaker]} />
                                    </div>
                                )}
                                <div className="flex-1">
                                    <p className="italic leading-relaxed text-slate-300">
                                        {highlightText(liveText, searchQuery)}
                                        {liveTextState === 'visible' && <span className="inline-block w-0.5 h-4 bg-white/70 ml-1 animate-[cursor-blink_1s_step-end_infinite]"></span>}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={transcriptEndRef} />
            </div>
          </div>
        </main>

        <div className="resizer-handle" onMouseDown={() => handleMouseDown('right')} />
        
        {/* Right Analytics Sidebar */}
        <aside className="flex flex-col gap-4 overflow-y-auto">
             <div className="backdrop-blur-lg border border-slate-700/50 rounded-2xl shadow-lg flex-1 flex flex-col" style={{ backgroundColor: 'var(--panel-bg-color)' }}>
                <div className="grid grid-cols-5 border-b border-slate-700/50 p-2 text-sm font-bold">
                    <button onClick={() => setActiveAnalyticsTab('speech')} className={`p-2 transition-colors rounded-lg ${activeAnalyticsTab === 'speech' ? 'text-black bg-[var(--color-primary)]' : 'text-slate-300 hover:bg-slate-700/50'}`}>Speech</button>
                    <button onClick={() => setActiveAnalyticsTab('conversation')} className={`p-2 transition-colors rounded-lg ${activeAnalyticsTab === 'conversation' ? 'text-black bg-[var(--color-primary)]' : 'text-slate-300 hover:bg-slate-700/50'}`}>Talk</button>
                    <button onClick={() => setActiveAnalyticsTab('actions')} className={`p-2 transition-colors rounded-lg ${activeAnalyticsTab === 'actions' ? 'text-black bg-[var(--color-primary)]' : 'text-slate-300 hover:bg-slate-700/50'}`}>Actions</button>
                    <button onClick={() => setActiveAnalyticsTab('snippets')} className={`p-2 transition-colors rounded-lg ${activeAnalyticsTab === 'snippets' ? 'text-black bg-[var(--color-primary)]' : 'text-slate-300 hover:bg-slate-700/50'}`}>Snippets</button>
                    <button onClick={() => setActiveAnalyticsTab('summary')} className={`p-2 transition-colors rounded-lg ${activeAnalyticsTab === 'summary' ? 'text-black bg-[var(--color-primary)]' : 'text-slate-300 hover:bg-slate-700/50'}`}>Summary</button>
                </div>
                
                <div className="p-4 flex-1 overflow-y-auto">
                    {activeAnalyticsTab === 'speech' && <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2 row-span-2"><AccuracyCircle percentage={analytics.accuracy} /></div>
                      <div className="cursor-pointer transition-transform duration-200 hover:scale-105" onClick={() => setSearchQuery(`\\b(${[...FILLER_WORDS].join('|')})\\b`)}>
                        <MetricCard icon="fa-microphone-alt-slash" value={analytics.fillers} label="Fillers" />
                      </div>
                      <MetricCard icon="fa-clock" value={formatDuration(analytics.duration)} label="Duration" />
                      <MetricCard icon="fa-file-word" value={analytics.words} label="Words" />
                      <MetricCard icon="fa-paragraph" value={analytics.sentences} label="Sentences" />
                      <MetricCard icon="fa-tachometer-alt" value={analytics.wpm} label="WPM" />
                      <MetricCard icon="fa-pause-circle" value={analytics.pauses} label="Pauses" />
                    </div>}
                    
                    {activeAnalyticsTab === 'conversation' && <div className="space-y-4">
                         <h3 className="font-bold text-[var(--color-primary)] flex items-center gap-2 text-md"><i className="fas fa-users"></i>Talk Time</h3>
                         <TalkTimeDonutChart talkTime={analytics.talkTime} profiles={speakerProfiles} />
                         <MetricCard icon="fa-bolt" value={analytics.interruptions} label="Interruptions" />
                         <div className="text-xs text-slate-400 p-2 bg-slate-900/50 rounded-lg border-l-2 border-[var(--color-secondary)]"><b>Insight:</b> Use Diarization to analyze who is speaking and for how long.</div>
                    </div>}

                    {activeAnalyticsTab === 'actions' && <div className="flex-1 flex flex-col min-h-0">
                        <h3 className="font-bold text-[var(--color-primary)] mb-2 flex items-center justify-between gap-2 text-md">
                            <span><i className="fas fa-tasks"></i>Extracted Items</span>
                            <Tooltip text="Find Action Items & Decisions"><button onClick={handleAnalyzeActionItems} className="px-3 py-1 text-xs rounded-full transition-colors bg-slate-700/70 text-slate-300 hover:bg-[var(--color-primary)]/30 hover:text-[var(--color-primary)]"><i className="fas fa-sync-alt"></i> Analyze</button></Tooltip>
                        </h3>
                        <div className="overflow-y-auto space-y-2 flex-1 pr-2">
                            {isAnalyzing ? <i className="fas fa-spinner fa-spin text-xl text-[var(--color-primary)] mx-auto mt-4"></i> :
                             actionItems.length > 0 ? actionItems.map(item => (
                                <div key={item.id} className="p-2 bg-slate-900/50 rounded-lg border-l-4" style={{ borderColor: item.type === 'action' ? 'var(--color-accent)' : 'var(--color-secondary)'}}>
                                    <div className="flex items-center gap-2 mb-1">
                                        <i className={`fas ${item.type === 'action' ? 'fa-check-square' : 'fa-gavel'}`} style={{ color: item.type === 'action' ? 'var(--color-accent)' : 'var(--color-secondary)'}} />
                                        {item.speakerId && speakerProfiles[item.speakerId] ? <SpeakerTag profile={speakerProfiles[item.speakerId]} /> : <span className="text-xs font-bold text-slate-400">{item.speakerLabel || 'Unknown'}</span>}
                                    </div>
                                    <p className="text-sm text-slate-300">{item.content}</p>
                                </div>
                             )) : <span className="text-xs text-slate-400 italic text-center block mt-4">No action items detected. Click 'Analyze' to scan the transcript.</span>
                            }
                        </div>
                    </div>}
                    
                    {activeAnalyticsTab === 'snippets' && <div className="flex-1 flex flex-col min-h-0">
                        <h3 className="font-bold text-[var(--color-primary)] mb-2 flex items-center justify-between gap-2 text-md">
                            <span><i className="fas fa-highlighter"></i>Smart Snippets</span>
                            <Tooltip text="Extract Key Quotes & Questions"><button onClick={handleAnalyzeSnippets} className="px-3 py-1 text-xs rounded-full transition-colors bg-slate-700/70 text-slate-300 hover:bg-[var(--color-primary)]/30 hover:text-[var(--color-primary)]"><i className="fas fa-sync-alt"></i> Analyze</button></Tooltip>
                        </h3>
                        <div className="overflow-y-auto space-y-2 flex-1 pr-2">
                            {isAnalyzingSnippets ? <i className="fas fa-spinner fa-spin text-xl text-[var(--color-primary)] mx-auto mt-4"></i> :
                             snippets.length > 0 ? snippets.map(item => (
                                <div key={item.id} className="p-2 bg-slate-900/50 rounded-lg border-l-4" style={{ borderColor: snippetColorMap[item.type] }}>
                                    <div className="flex items-center gap-2 mb-1">
                                        <i className={snippetIconMap[item.type]} style={{ color: snippetColorMap[item.type] }} />
                                        {item.speakerId && speakerProfiles[item.speakerId] ? <SpeakerTag profile={speakerProfiles[item.speakerId]} /> : <span className="text-xs font-bold text-slate-400">{item.speakerLabel || 'Unknown'}</span>}
                                    </div>
                                    <p className="text-sm text-slate-300">{item.content}</p>
                                </div>
                             )) : <span className="text-xs text-slate-400 italic text-center block mt-4">No snippets detected. Click 'Analyze' to find key moments.</span>
                            }
                        </div>
                    </div>}

                    {activeAnalyticsTab === 'summary' && <div className="flex flex-col h-full">
                        <div className="flex justify-between items-center mb-2">
                            <h2 className="text-lg font-bold flex items-center gap-2"><i className="fas fa-comment-alt text-[var(--color-primary)]"></i> AI Summary {summaryStyle && <span className="text-xs font-semibold bg-[var(--color-secondary)]/20 text-[var(--color-secondary)] px-2 py-1 rounded-full">{summaryStyle}</span>}</h2>
                            <div className="flex gap-2">
                               <Tooltip text="Generate Summary"><button onClick={() => handleSummarize(summaryStyle || 'detailed')} className="w-8 h-8 rounded-full bg-slate-700/70 hover:bg-[var(--color-primary)]/30 transition-colors"><i className="fas fa-sync-alt"></i></button></Tooltip>
                               <Tooltip text="Copy"><button onClick={() => handleCopy(summary, 'Summary')} className="w-8 h-8 rounded-full bg-slate-700/70 hover:bg-[var(--color-primary)]/30 transition-colors"><i className="fas fa-copy"></i></button></Tooltip>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 bg-slate-900/50 rounded-lg border border-slate-700/50 text-slate-300 text-sm min-h-[100px]">
                              {isSummarizing ? (
                                  <div className="space-y-3 animate-pulse">
                                      <div className="h-4 w-3/4 skeleton-loader"></div>
                                      <div className="h-4 w-full skeleton-loader"></div>
                                      <div className="h-4 w-5/6 skeleton-loader"></div>
                                  </div>
                              ) : (
                                  summary
                              )}
                        </div>
                    </div>}
                </div>
            </div>
            
            <div className="p-4 backdrop-blur-lg border border-slate-700/50 rounded-2xl shadow-lg flex flex-col gap-4 transition-all duration-300 hover:border-[var(--color-primary)]/40 hover:-translate-y-1" style={{ backgroundColor: 'var(--panel-bg-color)' }}>
                <div>
                    <h3 className="font-bold text-[var(--color-primary)] mb-3 flex items-center gap-2 text-md"><i className="fas fa-tags"></i>Detected Topics</h3>
                    <div className="min-h-[6rem] flex flex-wrap items-center justify-center gap-2 p-2 rounded-lg bg-slate-900/50 border border-dashed border-slate-600">
                        {isDetectingTopics ? <i className="fas fa-spinner fa-spin text-xl text-[var(--color-primary)]"></i> : 
                            analytics.topics.length > 0 ? analytics.topics.map((topic, i) => <span key={i} className="bg-[var(--color-accent)]/20 text-[var(--color-accent)] text-xs font-semibold px-3 py-1 rounded-full cursor-pointer hover:bg-[var(--color-accent)]/40 transition-colors">{topic}</span>)
                            : <span className="text-xs text-slate-400 italic text-center">No topics detected yet. Stop a recording to analyze content.</span>
                        }
                    </div>
                </div>
            </div>
        </aside>
      </div>
    </>
  );
};


const TalkTimeDonutChart: React.FC<{ talkTime: SpeechAnalytics['talkTime'], profiles: Record<SpeakerId, SpeakerProfile> }> = ({ talkTime, profiles }) => {
    const radius = 60;
    const circumference = 2 * Math.PI * radius;
    const sortedSpeakers = Object.entries(talkTime).sort(([, a], [, b]) => b.percentage - a.percentage);

    let offset = 0;

    return (
        <div className="flex items-center justify-center gap-4 p-3 bg-slate-900/50 rounded-xl">
            <div className="relative w-40 h-40">
                <svg className="w-full h-full" viewBox="0 0 140 140">
                    <circle className="text-slate-700" strokeWidth="12" stroke="currentColor" fill="transparent" r={radius} cx="70" cy="70" />
                    {sortedSpeakers.map(([speakerId, data]) => {
                        const profile = profiles[speakerId];
                        if (!profile) return null;
                        const dashoffset = circumference - (data.percentage / 100) * circumference;
                        const rotation = (offset / 100) * 360;
                        offset += data.percentage;

                        return (
                            <circle
                                key={speakerId}
                                strokeWidth="12"
                                strokeDasharray={circumference}
                                strokeDashoffset={dashoffset}
                                strokeLinecap="butt"
                                stroke={profile.color}
                                fill="transparent"
                                r={radius}
                                cx="70"
                                cy="70"
                                style={{ transform: `rotate(${rotation - 90}deg)`, transformOrigin: 'center' }}
                            />
                        );
                    })}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-sm text-slate-400">Talk Time</span>
                </div>
            </div>
            <div className="flex-1 space-y-2">
                {sortedSpeakers.map(([speakerId, data]) => {
                     const profile = profiles[speakerId];
                     if (!profile) return null;
                     return (
                        <div key={speakerId} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full" style={{backgroundColor: profile.color}} />
                                <span className="font-semibold">{profile.label}</span>
                            </div>
                            <span className="font-bold text-white">{data.percentage}%</span>
                        </div>
                     )
                })}
            </div>
        </div>
    );
};


export default App;
