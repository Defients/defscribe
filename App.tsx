import React, { useState, useEffect, useCallback } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import useSpeechRecognition from './hooks/useSpeechRecognition';
import useAppSettings from './hooks/useAppSettings';
import useTranscript from './hooks/useTranscript';
import useAnalytics from './hooks/useAnalytics';
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation';

import ControlPanel from './components/panels/ControlPanel';
import MainContentPanel from './components/panels/MainContentPanel';
import AnalyticsPanel from './components/panels/AnalyticsPanel';

import Toast, { type ToastMessage, type ToastType } from './components/Toast';
import ImmersiveMode from './components/ImmersiveMode';
import TranscriptChat from './components/TranscriptChat';
import ExportModal from './components/ExportModal';
import { AVATAR_EMOTIONS } from './constants';
import CosmicBackground from './components/CosmicBackground';

const MAX_TOASTS = 5;

const App: React.FC = () => {
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const addToast = useCallback((title: string, message: string, type: ToastType) => {
    setToasts((prev) => {
      const newToast = { id: Date.now(), title, message, type };
      const updated = [...prev, newToast];
      return updated.slice(-MAX_TOASTS);
    });
  }, []);
  
  const dismissToast = (id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const { isListening, transcript, finalTranscript, error, startListening, stopListening, clearTranscript, confidence } = useSpeechRecognition();
  
  useEffect(() => { if (error) { addToast('Recognition Error', error, 'error'); } }, [error, addToast]);

  const {
    themeId, themeColors, setThemeId,
    diarizationSettings, setDiarizationSettings,
    showTimestamps, setShowTimestamps,
    translationLanguage, setTranslationLanguage,
    leftPanelWidth, rightPanelWidth, handleMouseDown, resetLayout,
    transcriptTextSize, setTranscriptTextSize,
  } = useAppSettings();

  const {
    stream, setStream,
    transcriptEntries,
    activeSpeaker,
    speakerProfiles,
    clearTranscriptEntries,
    startTimeRef,
    segments,
    handleUpdateSpeakerLabel,
    handleReassignSpeakerForEntry,
    handleTranslateEntry,
  } = useTranscript({ finalTranscript, diarizationSettings, addToast });

  const {
    summary, summaryStyle,
    actionItems, snippets, topics,
    isAnalyzing, isSummarizing,
    avatarEmotion,
    speechAnalytics,
    generateAllAnalytics,
    handleSummarize,
    clearAnalytics,
  } = useAnalytics({ 
      addToast,
      transcriptEntries,
      startTime: startTimeRef.current,
      confidence,
      segments,
  });

  const [isImmersive, setIsImmersive] = useState(false);
  const [isImmersiveButtonGlowing, setIsImmersiveButtonGlowing] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const fullTranscriptText = transcriptEntries.map(e => e.text).join(' ');

  useEffect(() => {
    const initialGlowTimeout = setTimeout(() => setIsImmersiveButtonGlowing(false), 6000);
    return () => clearTimeout(initialGlowTimeout);
  }, []);

  const handleStart = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStream(mediaStream);
      startListening();
      addToast('Listening Started', 'DefScribe is now recording your speech.', 'info');
    } catch (err) {
      addToast('Microphone Error', 'Could not access the microphone. Please check permissions.', 'error');
    }
  };

  const handleStop = async () => {
    stopListening();
    stream?.getTracks().forEach(track => track.stop());
    setStream(null);
    addToast('Listening Stopped', 'Recording has been paused.', 'info');
    if (fullTranscriptText.trim().length > 10) {
      generateAllAnalytics(fullTranscriptText, speakerProfiles);
    }
  };
  
  const handleClear = () => {
    if (window.confirm("Are you sure you want to clear the entire session?")) {
      clearTranscript();
      clearTranscriptEntries();
      clearAnalytics();
      addToast('Cleared', 'The session has been cleared.', 'info');
    }
  };

  // Keyboard shortcuts
  useKeyboardNavigation([
    { key: ' ', handler: () => isListening ? handleStop() : handleStart(), description: 'Toggle recording' },
    { key: 'i', ctrl: true, handler: () => setIsImmersive(!isImmersive), description: 'Toggle immersive mode' },
    { key: 'c', ctrl: true, shift: true, handler: handleClear, description: 'Clear session' },
    { key: '/', ctrl: true, handler: () => setIsChatOpen(!isChatOpen), description: 'Toggle chat' },
  ], !isImmersive);

  if (isImmersive) {
    return (
      <ErrorBoundary>
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
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <CosmicBackground />
      <div className="fixed top-4 right-4 z-[100] w-full max-w-sm space-y-2">
        {toasts.map((toast) => <Toast key={toast.id} toast={toast} onDismiss={dismissToast} />)}
      </div>
      
      {isChatOpen && <TranscriptChat transcript={fullTranscriptText} onClose={() => setIsChatOpen(false)} translationLanguage={translationLanguage} />}
      <ExportModal 
        isOpen={isExportModalOpen} 
        onClose={() => setIsExportModalOpen(false)}
        transcriptEntries={transcriptEntries}
        speakerProfiles={speakerProfiles}
      />
      
      <div className="h-screen text-slate-200 grid p-4 gap-4 relative z-20" style={{ gridTemplateColumns: `minmax(0, ${leftPanelWidth}px) 5px minmax(0, 1fr) 5px minmax(0, ${rightPanelWidth}px)` }}>
        <ControlPanel 
          isListening={isListening}
          isAnalyzing={isAnalyzing}
          isSummarizing={isSummarizing}
          wpm={speechAnalytics.wpm || 0}
          onStart={handleStart}
          onStop={handleStop}
          onClear={handleClear}
          addToast={addToast}
          onGoImmersive={() => setIsImmersive(true)}
          isImmersiveButtonGlowing={isImmersiveButtonGlowing}
          themeId={themeId}
          setThemeId={setThemeId}
          diarizationSettings={diarizationSettings}
          setDiarizationSettings={setDiarizationSettings}
          showTimestamps={showTimestamps}
          setShowTimestamps={setShowTimestamps}
          translationLanguage={translationLanguage}
          setTranslationLanguage={setTranslationLanguage}
          onResetLayout={resetLayout}
          onExport={() => setIsExportModalOpen(true)}
        />

        <div className="resizer-handle" onMouseDown={() => handleMouseDown('left')} />
        
        <MainContentPanel
          isListening={isListening}
          stream={stream}
          themeColors={themeColors}
          transcriptEntries={transcriptEntries}
          liveText={transcript}
          liveTextState={isListening && transcript ? 'visible' : 'hidden'}
          activeSpeaker={activeSpeaker}
          speakerProfiles={speakerProfiles}
          handleUpdateSpeakerLabel={handleUpdateSpeakerLabel}
          showTimestamps={showTimestamps}
          diarizationEnabled={diarizationSettings.enabled}
          onOpenChat={() => setIsChatOpen(true)}
          onTranslateEntry={(entryId) => handleTranslateEntry(entryId, translationLanguage)}
          onReassignSpeaker={handleReassignSpeakerForEntry}
          transcriptTextSize={transcriptTextSize}
          setTranscriptTextSize={setTranscriptTextSize}
        />

        <div className="resizer-handle" onMouseDown={() => handleMouseDown('right')} />
        
        <AnalyticsPanel
          isSummarizing={isSummarizing}
          summary={summary}
          summaryStyle={summaryStyle}
          onSummarize={(style) => handleSummarize(fullTranscriptText, style)}
          actionItems={actionItems}
          snippets={snippets}
          topics={topics}
          isAnalyzing={isAnalyzing}
          speechAnalytics={speechAnalytics}
          speakerProfiles={speakerProfiles}
        />
      </div>
    </ErrorBoundary>
  );
};

export default App;
