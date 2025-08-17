
import React, { useRef, useEffect, useCallback } from 'react';
import { AudioContextManager } from '../utils/AudioContextManager';
import { AUDIO_CONSTANTS } from '../constants/audio';

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
  const frequencyArray = useRef<Uint8Array | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const idleTime = useRef(0);

  const drawIdle = useCallback(() => {
    idleTime.current += 0.01;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    const rootStyle = getComputedStyle(document.documentElement);
    const primaryRgb = rootStyle.getPropertyValue('--color-primary-rgb').trim();
    const secondaryRgb = rootStyle.getPropertyValue('--color-secondary-rgb').trim();

    const width = canvas.width;
    const height = canvas.height;
    const centerY = height / 2;

    ctx.clearRect(0, 0, width, height);

    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    if (primaryRgb && secondaryRgb) {
        gradient.addColorStop(0, `rgba(${secondaryRgb}, 0.1)`);
        gradient.addColorStop(0.5, `rgba(${primaryRgb}, 0.7)`);
        gradient.addColorStop(1, `rgba(${secondaryRgb}, 0.1)`);
        ctx.shadowColor = `rgba(${primaryRgb}, 0.5)`;
    }

    ctx.lineWidth = 2;
    ctx.strokeStyle = gradient;
    ctx.shadowBlur = 10;
    
    ctx.beginPath();
    for (let x = 0; x < width; x++) {
      const y = centerY + Math.sin(x * 0.02 + idleTime.current) * 15 * Math.cos(idleTime.current * 0.3);
      ctx.lineTo(x, y);
    }
    ctx.stroke();

    animationFrameId.current = requestAnimationFrame(drawIdle);
  }, []);

  const drawActive = useCallback(() => {
    if (!analyser.current || !dataArray.current || !frequencyArray.current || !canvasRef.current) return;
    
    analyser.current.getByteTimeDomainData(dataArray.current);
    analyser.current.getByteFrequencyData(frequencyArray.current);

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    
    ctx.clearRect(0, 0, width, height);
    
    const rootStyle = getComputedStyle(document.documentElement);
    const primaryRgb = rootStyle.getPropertyValue('--color-primary-rgb').trim() || '77, 138, 255';
    const secondaryRgb = rootStyle.getPropertyValue('--color-secondary-rgb').trim() || '167, 119, 255';
    const accentRgb = rootStyle.getPropertyValue('--color-accent-rgb').trim() || '255, 201, 77';

    const bufferLength = analyser.current.frequencyBinCount;
    const freqData = frequencyArray.current;
    const timeData = dataArray.current;

    const barCount = 32;
    const barWidth = width / barCount;
    ctx.globalAlpha = 0.4;
    for (let i = 0; i < barCount; i++) {
        const freqIndex = Math.floor(i * (bufferLength / barCount) * 0.2);
        const barHeight = (freqData[freqIndex] / 255) * height * 0.5;
        const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
        gradient.addColorStop(0, `rgba(${secondaryRgb}, 0.1)`);
        gradient.addColorStop(1, `rgba(${primaryRgb}, 0.5)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(i * barWidth, height - barHeight, barWidth, barHeight);
    }
    ctx.globalAlpha = 1;

    const sliceWidth = width * 1.0 / bufferLength;
    const drawWave = (lineWidth: number, strokeStyle: string | CanvasGradient, shadowBlur: number, shadowColor: string) => {
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = strokeStyle;
        ctx.shadowBlur = shadowBlur;
        ctx.shadowColor = shadowColor;
        ctx.beginPath();
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
            const v = timeData[i] / 128.0;
            const y = v * height / 2;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
            x += sliceWidth;
        }
        ctx.lineTo(width, height / 2);
        ctx.stroke();
    };
    const mainGradient = ctx.createLinearGradient(0, 0, width, 0);
    mainGradient.addColorStop(0, themeColors.secondary);
    mainGradient.addColorStop(0.5, themeColors.primary);
    mainGradient.addColorStop(1, themeColors.accent);
    drawWave(2, mainGradient, 15, themeColors.primary);
    
    ctx.shadowBlur = 0;
    for (let i = Math.floor(bufferLength * 0.4); i < bufferLength; i += 5) {
        const freqValue = freqData[i];
        if (freqValue > 190) {
            const x = (i / bufferLength) * width;
            const y = (1 - (freqValue / 255)) * height * 0.8 + (height * 0.1);
            const radius = (freqValue / 255) * 1.5;
            const alpha = (freqValue - 190) / 65;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${accentRgb}, ${alpha})`;
            ctx.fill();
        }
    }
    
    animationFrameId.current = requestAnimationFrame(drawActive);
  }, [themeColors]);

  useEffect(() => {
    let contextAcquired = false;
    if (isListening && stream) {
        const audioContext = AudioContextManager.acquire('visualizer');
        contextAcquired = true;

        analyser.current = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);
        sourceNodeRef.current = source;
        source.connect(analyser.current);
        
        analyser.current.fftSize = AUDIO_CONSTANTS.FFT_SIZE;
        analyser.current.smoothingTimeConstant = AUDIO_CONSTANTS.SMOOTHING_TIME_CONSTANT;
        dataArray.current = new Uint8Array(analyser.current.frequencyBinCount);
        frequencyArray.current = new Uint8Array(analyser.current.frequencyBinCount);
        
        drawActive();
    } else {
        drawIdle();
    }
    
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      if(sourceNodeRef.current){
        sourceNodeRef.current.disconnect();
        sourceNodeRef.current = null;
      }
      if(analyser.current) {
        analyser.current.disconnect();
      }
      if (contextAcquired) {
        AudioContextManager.release('visualizer');
      }
    };
  }, [isListening, stream, drawActive, drawIdle]);

  return (
    <div className="relative w-full h-36 bg-slate-900/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl overflow-hidden shadow-lg">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
};

export default Visualizer;
