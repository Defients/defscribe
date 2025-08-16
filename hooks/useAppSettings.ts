import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { THEME_PRESETS } from '../constants';
import { type DiarizationSettings } from '../types';

const useResizablePanels = (defaultLeftWidth: number, defaultRightWidth: number, minWidth: number, maxWidth: number) => {
  const getInitialWidth = (key: string, defaultValue: number): number => {
    try {
      const saved = localStorage.getItem(key);
      if (!saved) return defaultValue;
      const num = parseInt(saved, 10);
      return isNaN(num) ? defaultValue : Math.max(minWidth, Math.min(maxWidth, num));
    } catch {
      return defaultValue;
    }
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
  
  useEffect(() => { try { localStorage.setItem('defscribe-leftPanelWidth', String(leftPanelWidth)); } catch {} }, [leftPanelWidth]);
  useEffect(() => { try { localStorage.setItem('defscribe-rightPanelWidth', String(rightPanelWidth)); } catch {} }, [rightPanelWidth]);
  
  const resetLayout = () => {
    setLeftPanelWidth(defaultLeftWidth);
    setRightPanelWidth(defaultRightWidth);
    try {
      localStorage.removeItem('defscribe-leftPanelWidth');
      localStorage.removeItem('defscribe-rightPanelWidth');
    } catch {}
  }

  return { leftPanelWidth, rightPanelWidth, handleMouseDown, resetLayout };
};

const useAppSettings = () => {
    const [themeId, setThemeId] = useState(1);
    const themeColors = useMemo(() => THEME_PRESETS[themeId], [themeId]);

    const [diarizationSettings, setDiarizationSettings] = useState<DiarizationSettings>({
        enabled: false,
        mode: "local",
        expectedSpeakers: 2,
    });
    const [showTimestamps, setShowTimestamps] = useState(true);
    const [translationLanguage, setTranslationLanguage] = useState('Spanish');
    const [transcriptTextSize, setTranscriptTextSize] = useState<'sm' | 'base' | 'lg'>('base');

    const { leftPanelWidth, rightPanelWidth, handleMouseDown, resetLayout } = useResizablePanels(320, 400, 280, 500);

    useEffect(() => {
        const hexToRgb = (hex: string) => {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : null;
        };
        const root = document.documentElement;
        root.style.setProperty('--color-primary', themeColors.primary);
        root.style.setProperty('--color-secondary', themeColors.secondary);
        root.style.setProperty('--color-accent', themeColors.accent);
        const primaryRgb = hexToRgb(themeColors.primary);
        const secondaryRgb = hexToRgb(themeColors.secondary);
        const accentRgb = hexToRgb(themeColors.accent);
        if (primaryRgb) root.style.setProperty('--color-primary-rgb', primaryRgb);
        if (secondaryRgb) root.style.setProperty('--color-secondary-rgb', secondaryRgb);
        if (accentRgb) root.style.setProperty('--color-accent-rgb', accentRgb);
    }, [themeColors]);

    return {
        themeId,
        themeColors,
        setThemeId,
        diarizationSettings,
        setDiarizationSettings,
        showTimestamps,
        setShowTimestamps,
        translationLanguage,
        setTranslationLanguage,
        leftPanelWidth,
        rightPanelWidth,
        handleMouseDown,
        resetLayout,
        transcriptTextSize, 
        setTranscriptTextSize,
    };
};

export default useAppSettings;