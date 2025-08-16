
import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { type TranscriptEntry, type Emotion } from '../types';
import { STOP_WORDS } from '../constants';
import Tooltip from './Tooltip';

interface ImmersiveModeProps {
  isListening: boolean;
  transcriptEntries: TranscriptEntry[];
  stream: MediaStream | null;
  themeColors: { primary: string; secondary: string; accent: string; };
  onExit: () => void;
  onToggleListen: () => void;
  onClear: () => void;
  avatarEmotion: Emotion;
  avatarMap: Record<Emotion, string>;
}

type WordType = 'action' | 'descriptive' | 'question' | 'important' | 'default';

type WordBubble = {
  id: string;
  text: string;
  type: WordType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number; // Represents mass
  width: number; // For collision, from DOM
  height: number; // For collision, from DOM
  element: HTMLDivElement | null;
  isExiting?: boolean;
};

type VisualizerType = 'waveform' | 'bars';
type BackgroundType = 'starfield' | 'digitalRain' | 'none';

// --- Word Classification ---
const ACTION_WORDS = new Set(['do', 'make', 'go', 'get', 'take', 'start', 'stop', 'try', 'create', 'build', 'run', 'move', 'think', 'analyze']);
const DESCRIPTIVE_WORDS = new Set(['good', 'bad', 'great', 'small', 'big', 'new', 'old', 'beautiful', 'important', 'different', 'easy', 'hard']);
const QUESTION_WORDS = new Set(['who', 'what', 'when', 'where', 'why', 'how', 'which', 'is', 'are', 'do', 'does', 'can', 'could']);
const IMPORTANT_WORDS = new Set(['gemini', 'defscribe', 'summary', 'transcript', 'idea', 'plan', 'next', 'action', 'item', 'key', 'result', 'goal']);

const classifyWord = (word: string): WordType => {
  if (QUESTION_WORDS.has(word)) return 'question';
  if (ACTION_WORDS.has(word)) return 'action';
  if (IMPORTANT_WORDS.has(word)) return 'important';
  if (DESCRIPTIVE_WORDS.has(word)) return 'descriptive';
  return 'default';
};

const wordTypeStyles: Record<WordType, { background: string; border: string; boxShadow: string }> = {
  default: { background: 'linear-gradient(to bottom right, rgba(107, 114, 128, 0.2), rgba(75, 85, 99, 0.2))', border: '1px solid rgba(107, 114, 128, 0.3)', boxShadow: '0 0 10px rgba(107, 114, 128, 0.3)' },
  action: { background: 'linear-gradient(to bottom right, rgba(14, 165, 233, 0.3), rgba(45, 212, 191, 0.3))', border: '1px solid rgba(45, 212, 191, 0.5)', boxShadow: '0 0 12px rgba(45, 212, 191, 0.5)' },
  descriptive: { background: 'linear-gradient(to bottom right, rgba(16, 185, 129, 0.3), rgba(52, 211, 153, 0.3))', border: '1px solid rgba(52, 211, 153, 0.5)', boxShadow: '0 0 12px rgba(52, 211, 153, 0.5)' },
  question: { background: 'linear-gradient(to bottom right, rgba(245, 158, 11, 0.3), rgba(251, 191, 36, 0.3))', border: '1px solid rgba(251, 191, 36, 0.5)', boxShadow: '0 0 12px rgba(251, 191, 36, 0.5)' },
  important: { background: 'linear-gradient(to bottom right, rgba(239, 68, 68, 0.3), rgba(244, 63, 94, 0.3))', border: '1px solid rgba(244, 63, 94, 0.5)', boxShadow: '0 0 15px rgba(244, 63, 94, 0.6)' },
};


// --- Shared Audio Processing Hook ---
const useAudioProcessor = (isListening: boolean, stream: MediaStream | null) => {
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

    useEffect(() => {
        if (isListening && stream) {
            if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
                const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
                audioContextRef.current = new AudioContext();
            }
            if (!analyserRef.current) {
                analyserRef.current = audioContextRef.current.createAnalyser();
            }
            if (!sourceRef.current || sourceRef.current.context.state === 'closed') {
                sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
                sourceRef.current.connect(analyserRef.current);
            }
        }

        return () => {
            sourceRef.current?.disconnect();
            sourceRef.current = null; // Allow reconnection on next stream
            if (stream === null && audioContextRef.current && audioContextRef.current.state !== 'closed') {
                audioContextRef.current.close().catch(console.error);
                analyserRef.current = null;
            }
        };
    }, [isListening, stream]);
    
    return { analyser: analyserRef.current };
};


// --- Immersive UI Components ---

const AnimatedTranscriptLine: React.FC<{ text: string }> = ({ text }) => {
    return (
        <>
            {text.split('').map((char, index) => (
                <span
                    key={index}
                    className="inline-block opacity-0 animate-[char-slide-in_0.5s_ease-out_forwards]"
                    style={{ animationDelay: `${index * 20}ms` }}
                >
                    {char === ' ' ? '\u00A0' : char}
                </span>
            ))}
        </>
    );
};

const StarfieldBackground: React.FC<{ analyser: AnalyserNode | null }> = React.memo(({ analyser }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let stars: {x: number, y: number, z: number}[] = [];
        const numStars = 500;
        
        const setup = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            stars = [];
            for (let i = 0; i < numStars; i++) {
                stars[i] = {
                    x: Math.random() * canvas.width - canvas.width / 2,
                    y: Math.random() * canvas.height - canvas.height / 2,
                    z: Math.random() * canvas.width
                };
            }
        };
        setup();

        let animationFrameId: number;
        const draw = () => {
            let warpFactor = 0;
            if (analyser) {
                const dataArray = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(dataArray);
                const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
                warpFactor = (avg / 255) * 10; // Increase speed based on volume
            }
            
            ctx.fillStyle = "rgba(10, 18, 24, 1)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            ctx.translate(canvas.width / 2, canvas.height / 2);

            for (let i = 0; i < numStars; i++) {
                let star = stars[i];
                star.z -= (1 + warpFactor); // Apply warp factor
                if (star.z <= 0) {
                    star.z = canvas.width;
                }

                let k = 128.0 / star.z;
                let px = star.x * k;
                let py = star.y * k;
                let size = (1 - star.z / canvas.width) * 2;
                
                ctx.fillStyle = `rgba(255, 255, 255, ${size * 1.2})`;
                ctx.beginPath();
                ctx.arc(px, py, size, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
            animationFrameId = requestAnimationFrame(draw);
        };
        draw();
        
        window.addEventListener('resize', setup);
        return () => {
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener('resize', setup);
        }
    }, [analyser]);

    return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-0" />;
});

const DigitalRainBackground: React.FC<{ themeColors: { accent: string } }> = React.memo(({ themeColors }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const setup = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        setup();

        const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
        const fontSize = 16;
        const columns = Math.floor(canvas.width / fontSize);
        const drops = Array(columns).fill(1).map(() => Math.random() * canvas.height);

        const draw = () => {
            ctx.fillStyle = 'rgba(10, 18, 24, 0.05)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.fillStyle = themeColors.accent;
            ctx.font = `${fontSize}px monospace`;

            for (let i = 0; i < drops.length; i++) {
                const text = characters.charAt(Math.floor(Math.random() * characters.length));
                ctx.fillText(text, i * fontSize, drops[i] * fontSize);
                if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
                    drops[i] = 0;
                }
                drops[i]++;
            }
        };

        const intervalId = setInterval(draw, 40);
        
        window.addEventListener('resize', setup);
        return () => {
            clearInterval(intervalId);
            window.removeEventListener('resize', setup);
        };
    }, [themeColors.accent]);

    return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-0" />;
});


const CosmicRippleVisualizer: React.FC<{ analyser: AnalyserNode | null }> = React.memo(({ analyser }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const setup = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        setup();
        
        let ripples: {x: number, y: number, radius: number, alpha: number, speed: number}[] = [];
        let animationFrameId: number;
        
        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            if (analyser) {
                const dataArray = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(dataArray);
                const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
                if (avg > 30 && ripples.length < 20) { // Threshold to trigger a ripple
                    ripples.push({
                        x: canvas.width / 2,
                        y: 150, // Approx avatar y position
                        radius: 50 + avg,
                        alpha: 0.8,
                        speed: 1 + (avg / 128)
                    });
                }
            }
            
            for (let i = ripples.length - 1; i >= 0; i--) {
                const r = ripples[i];
                r.radius += r.speed;
                r.alpha -= 0.01;
                if (r.alpha <= 0) {
                    ripples.splice(i, 1);
                    continue;
                }
                
                ctx.beginPath();
                ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(0, 217, 255, ${r.alpha})`;
                ctx.lineWidth = 2;
                ctx.stroke();
            }
            
            animationFrameId = requestAnimationFrame(draw);
        };
        draw();
        
        window.addEventListener('resize', setup);
        return () => {
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener('resize', setup);
        };
    }, [analyser]);

    return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-10 pointer-events-none" />;
});

const EnhancedVisualizer: React.FC<{ analyser: AnalyserNode | null; themeColors: { primary: string; secondary: string; accent: string; }; type: VisualizerType; }> = React.memo(({ analyser, themeColors, type }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
  
    useEffect(() => {
        if (analyser) {
            analyser.fftSize = 1024;
            analyser.smoothingTimeConstant = 0.8;
        }
    }, [analyser]);
  
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const setup = () => {
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
        };
        setup();

        let animationFrameId: number;
        const draw = () => {
            animationFrameId = requestAnimationFrame(draw);
            const ctx = canvas.getContext('2d');
            if (!ctx || !analyser) {
                ctx?.clearRect(0, 0, canvas.width, canvas.height);
                return;
            }
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
            gradient.addColorStop(0, themeColors.secondary);
            gradient.addColorStop(0.5, themeColors.primary);
            gradient.addColorStop(1, themeColors.accent);
            ctx.strokeStyle = gradient;
            ctx.fillStyle = gradient;
            ctx.shadowColor = themeColors.primary;
            ctx.shadowBlur = 10;
      
            if (type === 'waveform') {
                analyser.fftSize = 2048;
                const dataArray = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteTimeDomainData(dataArray);

                ctx.lineWidth = 3;
                ctx.beginPath();
                const sliceWidth = canvas.width * 1.0 / analyser.frequencyBinCount;
                let x = 0;

                for (let i = 0; i < analyser.frequencyBinCount; i++) {
                    const v = dataArray[i] / 128.0;
                    const y = v * canvas.height / 2;
                    if (i === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                    x += sliceWidth;
                }
                ctx.lineTo(canvas.width, canvas.height / 2);
                ctx.stroke();
            } else if (type === 'bars') {
                analyser.fftSize = 256;
                const bufferLength = analyser.frequencyBinCount;
                const dataArray = new Uint8Array(bufferLength);
                analyser.getByteFrequencyData(dataArray);

                const barWidth = (canvas.width / bufferLength) * 2.5;
                let x = 0;
                for (let i = 0; i < bufferLength; i++) {
                    const barHeight = (dataArray[i] / 255) * canvas.height;
                    ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
                    x += barWidth + 1;
                }
            }
        };

        draw();
        window.addEventListener('resize', setup);
        return () => {
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener('resize', setup);
        };
    }, [themeColors, analyser, type]);

    return <canvas ref={canvasRef} className="w-full h-full" />;
});


// --- Main Immersive Mode Component ---

const ImmersiveMode: React.FC<ImmersiveModeProps> = ({ isListening, transcriptEntries, stream, themeColors, onExit, onToggleListen, onClear, avatarEmotion, avatarMap }) => {
  const [bubbles, setBubbles] = useState<WordBubble[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
  
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isVisualsPanelOpen, setIsVisualsPanelOpen] = useState(false);
  const [visualizerType, setVisualizerType] = useState<VisualizerType>('waveform');
  const [backgroundType, setBackgroundType] = useState<BackgroundType>('starfield');

  const [showAvatar, setShowAvatar] = useState(true);
  const [avatarSize, setAvatarSize] = useState(1.5);

  const bubblesRef = useRef<WordBubble[]>([]);
  const animationFrameRef = useRef<any>(null);
  const lastTranscriptLength = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLImageElement>(null);

  const { analyser } = useAudioProcessor(isListening, stream);
  
  const toggleFullScreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`));
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }, []);
  
  const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);

  useEffect(() => {
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
        document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit();
      if (e.code === 'Space') { e.preventDefault(); onToggleListen(); }
      if (e.key === 'f' || e.key === 'F') toggleFullScreen();
      if (e.key === 'c' || e.key === 'C') onClear();
      if (e.key === 'm' || e.key === 'M') setIsMenuOpen(prev => !prev);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onExit, onToggleListen, toggleFullScreen, onClear]);

  useEffect(() => {
    bubblesRef.current = bubbles;
  }, [bubbles]);

  useLayoutEffect(() => {
    const newBubbles = [...bubblesRef.current];
    let changed = false;
    newBubbles.forEach(b => {
        if (b.element && (b.width === 0 || b.height === 0)) {
            b.width = b.element.offsetWidth;
            b.height = b.element.offsetHeight;
            changed = true;
        }
    });
    if (changed) setBubbles(newBubbles);
  }, [bubbles]);

  useEffect(() => {
    const allText = transcriptEntries.map(e => e.text).join(' ');
    if (allText.length > lastTranscriptLength.current) {
      const newText = allText.slice(lastTranscriptLength.current);
      const words = newText.split(/\s+/).map(w => w.toLowerCase().replace(/[.,?!]/g, '')).filter(w => w.length >= 3 && !STOP_WORDS.has(w));
      
      if (words.length > 0) {
        const newBubbles = words.map((word, i) => ({
            id: `${Date.now()}-${i}`, text: word, type: classifyWord(word), x: Math.random() * window.innerWidth, y: window.innerHeight + 50,
            vx: (Math.random() - 0.5) * 4, vy: -Math.random() * 5 - 3, size: 20 + word.length * 2,
            width: 0, height: 0, element: null,
        }));
        setBubbles(prev => [...prev.slice(-50), ...newBubbles]);
      }
    }
    lastTranscriptLength.current = allText.length;
  }, [transcriptEntries]);

  useEffect(() => {
    const animate = () => {
      const currentBubbles = bubblesRef.current;
      const avatarEl = avatarRef.current;
      const avatarRect = showAvatar && avatarEl ? avatarEl.getBoundingClientRect() : null;
      const avatar = avatarRect ? { x: avatarRect.left + avatarRect.width / 2, y: avatarRect.top + avatarRect.height / 2, radius: avatarRect.width / 2 } : null;

      const centersOfMass: Record<WordType, { x: number; y: number; count: number }> = {
          action: { x: 0, y: 0, count: 0 }, descriptive: { x: 0, y: 0, count: 0 }, question: { x: 0, y: 0, count: 0 },
          important: { x: 0, y: 0, count: 0 }, default: { x: 0, y: 0, count: 0 },
      };

      currentBubbles.forEach(b => {
          if (b.isExiting) return;
          centersOfMass[b.type].x += b.x; centersOfMass[b.type].y += b.y; centersOfMass[b.type].count++;
      });
      for (const type in centersOfMass) {
          const com = centersOfMass[type as WordType];
          if (com.count > 0) { com.x /= com.count; com.y /= com.count; }
      }

      currentBubbles.forEach((b1, i) => {
        if (b1.isExiting) return;
        
        const com = centersOfMass[b1.type];
        if (com.count > 1) {
            const dx = com.x - b1.x; const dy = com.y - b1.y; const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance > 50) {
                const gravity = 0.0001;
                b1.vx += (dx / distance) * gravity * b1.size; b1.vy += (dy / distance) * gravity * b1.size;
            }
        }

        b1.vx *= 0.99; b1.vy *= 0.99; b1.vy += 0.02;
        b1.x += b1.vx; b1.y += b1.vy;
        const radius = Math.max(b1.width, b1.height) / 2;
        if (!radius) return;

        if (b1.x < radius) { b1.x = radius; b1.vx *= -0.8; }
        if (b1.x > window.innerWidth - radius) { b1.x = window.innerWidth - radius; b1.vx *= -0.8; }
        if (b1.y < radius) { b1.y = radius; b1.vy *= -0.8; }
        if (b1.y > window.innerHeight + 100) { b1.isExiting = true; setTimeout(() => setBubbles(prev => prev.filter(b => b.id !== b1.id)), 300); }
        
        if (avatar) {
            const dx = b1.x - avatar.x; const dy = b1.y - avatar.y; const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < avatar.radius + radius) {
                const angle = Math.atan2(dy, dx); const overlap = (avatar.radius + radius) - distance;
                b1.x += Math.cos(angle) * overlap; b1.y += Math.sin(angle) * overlap;
                const normalX = dx / distance; const normalY = dy / distance; const dotProduct = (b1.vx * normalX + b1.vy * normalY);
                b1.vx -= 2 * dotProduct * normalX; b1.vy -= 2 * dotProduct * normalY;
            }
        }
        
        for (let j = i + 1; j < currentBubbles.length; j++) {
            const b2 = currentBubbles[j]; if (b2.isExiting) continue;
            const dx = b2.x - b1.x; const dy = b2.y - b1.y; const distance = Math.sqrt(dx * dx + dy * dy);
            const minDist = (Math.max(b1.width, b1.height) / 2) + (Math.max(b2.width, b2.height) / 2);
            if (distance < minDist) {
                const angle = Math.atan2(dy, dx); const overlap = (minDist - distance) * 0.5;
                b1.x -= Math.cos(angle) * overlap; b1.y -= Math.sin(angle) * overlap;
                b2.x += Math.cos(angle) * overlap; b2.y += Math.sin(angle) * overlap;
                const force = (minDist - distance) * 0.05; const ax = (dx / distance) * force; const ay = (dy / distance) * force;
                b1.vx -= ax; b1.vy -= ay; b2.vx += ax; b2.vy += ay;
            }
        }

        if (b1.element) b1.element.style.transform = `translate(${b1.x - b1.width/2}px, ${b1.y - b1.height/2}px)`;
      });
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animationFrameRef.current = requestAnimationFrame(animate);
    return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); };
  }, [showAvatar]);
  
  const handleBubbleClick = (id: string) => {
    setBubbles(prev => prev.map(b => b.id === id ? { ...b, isExiting: true } : b));
    setTimeout(() => setBubbles(prev => prev.filter(b => b.id !== id)), 300);
  };

  const liveEntries = transcriptEntries.slice(-5);
  const currentLine = liveEntries.length > 0 ? liveEntries[liveEntries.length - 1].text : "Start speaking to see your transcript here...";
  
  return (
    <div ref={containerRef} className="fixed inset-0 bg-[#0a1218] text-white flex flex-col items-center justify-center overflow-hidden animate-[immersive-fade-in_0.5s_ease-out]">
      {backgroundType === 'starfield' && <StarfieldBackground analyser={analyser} />}
      {backgroundType === 'digitalRain' && <DigitalRainBackground themeColors={themeColors} />}
      <CosmicRippleVisualizer analyser={analyser} />
      
      {/* --- Controls --- */}
      {isMenuOpen ? (
          <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] transition-all duration-500 ease-in-out`}>
            <div className="bg-black/30 backdrop-blur-md rounded-xl p-2 flex justify-center items-center gap-2 border border-slate-700/50 shadow-lg">
              <Tooltip text="Hide Menu (M)"><button onClick={() => setIsMenuOpen(false)} className="w-14 h-14 text-2xl rounded-lg bg-slate-700/50 hover:bg-slate-700/80 transition-colors"><i className="fas fa-chevron-up"></i></button></Tooltip>
              <Tooltip text={isListening ? "Stop (Space)" : "Start (Space)"}><button onClick={onToggleListen} className={`w-14 h-14 text-2xl rounded-lg flex items-center justify-center transition-colors ${isListening ? 'bg-red-500/80 hover:bg-red-500' : 'bg-green-500/80 hover:bg-green-500'}`}>{isListening ? <i className="fas fa-stop"></i> : <i className="fas fa-microphone"></i>}</button></Tooltip>
              <Tooltip text="Clear (C)"><button onClick={onClear} className="w-14 h-14 text-2xl rounded-lg bg-slate-700/50 hover:bg-slate-700/80 transition-colors"><i className="fas fa-trash"></i></button></Tooltip>
              <Tooltip text="Visuals"><button onClick={() => setIsVisualsPanelOpen(p => !p)} className={`w-14 h-14 text-2xl rounded-lg transition-colors ${isVisualsPanelOpen ? 'bg-[var(--color-primary)]/30' : 'bg-slate-700/50'} hover:bg-slate-700/80`}><i className="fas fa-paint-brush"></i></button></Tooltip>
              <Tooltip text={isFullscreen ? "Exit Fullscreen (F)" : "Enter Fullscreen (F)"}><button onClick={toggleFullScreen} className="w-14 h-14 text-2xl rounded-lg bg-slate-700/50 hover:bg-slate-700/80 transition-colors">{isFullscreen ? <i className="fas fa-compress"></i> : <i className="fas fa-expand"></i>}</button></Tooltip>
              <Tooltip text="Exit (Esc)"><button onClick={onExit} className="w-14 h-14 text-2xl rounded-lg bg-slate-700/50 hover:bg-slate-700/80 transition-colors"><i className="fas fa-times-circle"></i></button></Tooltip>
            </div>
            {isVisualsPanelOpen && (
                <div className="mt-2 bg-black/30 backdrop-blur-md rounded-xl p-3 space-y-3 border border-slate-700/50 shadow-lg animate-[fadeIn_0.3s_ease-out]">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm w-20 text-slate-300">Avatar:</span>
                        <input type="range" min="0.5" max="2.5" step="0.1" value={avatarSize} onChange={(e) => setAvatarSize(parseFloat(e.target.value))} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[var(--color-primary)]"/>
                        <Tooltip text={showAvatar ? "Hide" : "Show"}><button onClick={() => setShowAvatar(!showAvatar)} className={`w-8 h-8 text-lg rounded-lg transition-colors flex-shrink-0 ${showAvatar ? 'bg-[var(--color-primary)]/30' : 'bg-slate-700/50'} hover:bg-slate-700/80`}><i className="fas fa-user-circle"></i></button></Tooltip>
                    </div>
                    <div className="flex items-center gap-2">
                         <span className="font-semibold text-sm w-20 text-slate-300">Visualizer:</span>
                         <button onClick={() => setVisualizerType('waveform')} className={`px-3 py-1 text-sm rounded-lg transition-colors flex-1 ${visualizerType === 'waveform' ? 'bg-[var(--color-primary)] text-black' : 'bg-slate-700/50 hover:bg-slate-700/80'}`}>Wave</button>
                         <button onClick={() => setVisualizerType('bars')} className={`px-3 py-1 text-sm rounded-lg transition-colors flex-1 ${visualizerType === 'bars' ? 'bg-[var(--color-primary)] text-black' : 'bg-slate-700/50 hover:bg-slate-700/80'}`}>Bars</button>
                    </div>
                     <div className="flex items-center gap-2">
                         <span className="font-semibold text-sm w-20 text-slate-300">Background:</span>
                         <button onClick={() => setBackgroundType('starfield')} className={`px-3 py-1 text-sm rounded-lg transition-colors flex-1 ${backgroundType === 'starfield' ? 'bg-[var(--color-primary)] text-black' : 'bg-slate-700/50 hover:bg-slate-700/80'}`}>Stars</button>
                         <button onClick={() => setBackgroundType('digitalRain')} className={`px-3 py-1 text-sm rounded-lg transition-colors flex-1 ${backgroundType === 'digitalRain' ? 'bg-[var(--color-primary)] text-black' : 'bg-slate-700/50 hover:bg-slate-700/80'}`}>Rain</button>
                         <button onClick={() => setBackgroundType('none')} className={`px-3 py-1 text-sm rounded-lg transition-colors flex-1 ${backgroundType === 'none' ? 'bg-[var(--color-primary)] text-black' : 'bg-slate-700/50 hover:bg-slate-700/80'}`}>None</button>
                    </div>
                </div>
            )}
          </div>
      ) : (
          <div className="fixed top-4 left-4 z-[100]">
            <Tooltip text="Show Menu (M)" position="right">
                <button onClick={() => setIsMenuOpen(true)} className="w-14 h-14 text-2xl rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center border border-slate-700/50 shadow-lg hover:bg-slate-700/80 transition-colors animate-[glow-button_3s_infinite] glow-button">
                    <i className="fas fa-bars"></i>
                </button>
            </Tooltip>
          </div>
      )}
      
      {/* Avatar */}
      {showAvatar && (
        <img
            ref={avatarRef}
            src={avatarMap[avatarEmotion]}
            alt="Vircy Avatar"
            className="absolute top-8 left-1/2 -translate-x-1/2 z-40 rounded-full border-2 border-[var(--color-primary)] shadow-[0_0_25px_var(--color-primary)] transition-all duration-300 pointer-events-none"
            style={{ width: `${8 * avatarSize}rem`, height: `${8 * avatarSize}rem` }}
        />
      )}

      {/* Word Bubbles */}
      <div className="absolute inset-0 z-30 pointer-events-none">
        {bubbles.map(b => (
          <div
            key={b.id}
            ref={el => { b.element = el; }}
            onClick={() => handleBubbleClick(b.id)}
            className={`absolute rounded-xl flex items-center justify-center text-center p-2 transition-transform duration-200 hover:scale-110 cursor-pointer pointer-events-auto w-auto h-auto font-semibold
                ${b.isExiting ? 'animate-[bubble-pop-out_0.3s_ease-out_forwards]' : 'animate-[bubble-pop-in_0.3s_ease-out]'}`}
            style={{ 
              fontSize: '1rem', 
              padding: '0.5rem 1rem',
              background: wordTypeStyles[b.type].background,
              border: wordTypeStyles[b.type].border,
              boxShadow: wordTypeStyles[b.type].boxShadow,
            }}
          >
            {b.text}
          </div>
        ))}
      </div>

      {/* Transcript Area */}
      <div className="absolute inset-0 flex flex-col items-center justify-end pointer-events-none z-50 pb-48">
        <div className="w-full max-w-4xl text-center space-y-2 p-4">
          <div className="h-48 text-2xl text-slate-500 space-y-2 overflow-hidden flex flex-col justify-end">
            {liveEntries.slice(0, -1).map(entry => (
              <p key={entry.id} className="animate-[line-scroll-up_0.5s_ease-out_forwards]">{entry.text}</p>
            ))}
          </div>
          <div className="min-h-[4rem] text-4xl font-semibold text-slate-100 p-4 bg-black/20 backdrop-blur-sm rounded-xl border border-slate-700/50 shadow-lg">
            <AnimatedTranscriptLine text={currentLine} />
            <span className="inline-block w-1 h-10 bg-[var(--color-accent)] ml-1 animate-[cursor-blink_1s_step-end_infinite]"></span>
          </div>
        </div>
      </div>

      {/* Visualizer */}
      <div className="absolute bottom-0 left-0 right-0 h-48 z-20 pointer-events-none">
        <EnhancedVisualizer analyser={analyser} themeColors={themeColors} type={visualizerType} />
      </div>
    </div>
  );
};

export default ImmersiveMode;
