import React, { useRef, useEffect, useCallback } from 'react';

// Augment the global Window interface to include webkitAudioContext for Safari compatibility
declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

interface VisualizerProps {
  isListening: boolean;
  stream: MediaStream | null;
  themeColors: { primary: string; secondary: string; accent: string; };
}

const Visualizer: React.FC<VisualizerProps> = ({ isListening, stream, themeColors }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const dataArray = useRef<Uint8Array | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const idleTime = useRef(0);

  const drawIdle = useCallback(() => {
    idleTime.current += 0.01;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerY = height / 2;

    ctx.clearRect(0, 0, width, height);

    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, "rgba(0, 217, 255, 0.1)");
    gradient.addColorStop(0.5, "rgba(0, 217, 255, 0.7)");
    gradient.addColorStop(1, "rgba(0, 217, 255, 0.1)");

    ctx.lineWidth = 3;
    ctx.strokeStyle = gradient;
    ctx.shadowColor = 'rgba(0, 217, 255, 0.5)';
    ctx.shadowBlur = 10;
    
    ctx.beginPath();
    for (let x = 0; x < width; x++) {
      const y = centerY + Math.sin(x * 0.03 + idleTime.current) * 10 * Math.sin(idleTime.current * 0.5);
      ctx.lineTo(x, y);
    }
    ctx.stroke();

    animationFrameId.current = requestAnimationFrame(drawIdle);
  }, []);

  const drawActive = useCallback(() => {
    if (!analyser.current || !dataArray.current || !canvasRef.current) return;
    
    analyser.current.getByteTimeDomainData(dataArray.current);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    
    ctx.clearRect(0, 0, width, height);
    
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, themeColors.secondary);
    gradient.addColorStop(0.5, themeColors.primary);
    gradient.addColorStop(1, themeColors.accent);

    const bufferLength = analyser.current.frequencyBinCount;
    const sliceWidth = width * 1.0 / bufferLength;
    const data = dataArray.current;

    // --- Draw Glow Path ---
    ctx.lineWidth = 8;
    ctx.strokeStyle = themeColors.primary + '33'; // Add alpha for transparency
    ctx.shadowBlur = 0;

    ctx.beginPath();
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
        const v = data[i] / 128.0;
        const y = v * height / 2;
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
        x += sliceWidth;
    }
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    // --- Draw Main Path ---
    ctx.lineWidth = 3;
    ctx.strokeStyle = gradient;
    ctx.shadowColor = themeColors.primary;
    ctx.shadowBlur = 15;
    
    ctx.beginPath();
    x = 0;
    for (let i = 0; i < bufferLength; i++) {
        const v = data[i] / 128.0;
        const y = v * height / 2;
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
        x += sliceWidth;
    }
    ctx.lineTo(width, height / 2);
    ctx.stroke();
    
    animationFrameId.current = requestAnimationFrame(drawActive);
  }, [themeColors]);

  useEffect(() => {
    if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
    }
    
    if (isListening && stream) {
        if (!audioContext.current || audioContext.current.state === 'closed') {
            audioContext.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        analyser.current = audioContext.current.createAnalyser();
        const source = audioContext.current.createMediaStreamSource(stream);
        source.connect(analyser.current);
        analyser.current.fftSize = 2048;
        analyser.current.smoothingTimeConstant = 0.85;
        dataArray.current = new Uint8Array(analyser.current.frequencyBinCount);
        
        drawActive();
    } else {
        drawIdle();
    }
    
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      analyser.current?.disconnect();
      if (stream) { // Only close context if we created it for a stream
        audioContext.current?.close().catch(console.error);
        audioContext.current = null;
      }
    };
  }, [isListening, stream, drawActive, drawIdle]);

  return (
    <div className="relative w-full h-36 bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl overflow-hidden shadow-lg">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
};

export default Visualizer;