import React, { useState, useRef, useEffect } from 'react';
import Visualizer from '../Visualizer';
import TranscriptDisplay from '../TranscriptDisplay';
import Tooltip from '../Tooltip';
import SpeakerEditorModal from '../SpeakerEditorModal';
import { type TranscriptEntry, type SpeakerId, type SpeakerProfile } from '../../types';

interface MainContentPanelProps {
  isListening: boolean;
  stream: MediaStream | null;
  themeColors: { primary: string; secondary: string; accent: string; };
  transcriptEntries: TranscriptEntry[];
  liveText: string;
  liveTextState: 'visible' | 'fading-out' | 'hidden';
  activeSpeaker: SpeakerId | null;
  speakerProfiles: Record<SpeakerId, SpeakerProfile>;
  handleUpdateSpeakerLabel: (speakerId: SpeakerId, newLabel: string) => void;
  showTimestamps: boolean;
  diarizationEnabled: boolean;
  onOpenChat: () => void;
  onTranslateEntry: (entryId: string) => void;
  onReassignSpeaker: (entryId: string, newSpeakerId: SpeakerId) => void;
  transcriptTextSize: 'sm' | 'base' | 'lg';
  setTranscriptTextSize: (size: 'sm' | 'base' | 'lg') => void;
}

const MainContentPanel: React.FC<MainContentPanelProps> = ({
  isListening, stream, themeColors, transcriptEntries, liveText, liveTextState,
  activeSpeaker, speakerProfiles, handleUpdateSpeakerLabel, showTimestamps, diarizationEnabled, onOpenChat,
  onTranslateEntry, onReassignSpeaker, transcriptTextSize, setTranscriptTextSize
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingSpeaker, setEditingSpeaker] = useState<SpeakerProfile | null>(null);

  // --- Auto-scroll state and refs ---
  const [autoScroll, setAutoScroll] = useState(true);
  const [newContentSinceScroll, setNewContentSinceScroll] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const lastTranscriptLength = useRef(0);

  const textSizeLabels = { sm: 'Small', base: 'Medium', lg: 'Large' };
  const nextTextSizeLabel = { sm: 'Medium', base: 'Large', lg: 'Small' };

  const cycleTextSize = () => {
    setTranscriptTextSize(transcriptTextSize === 'base' ? 'lg' : transcriptTextSize === 'lg' ? 'sm' : 'base');
  };

  // Effect to scroll or flag new content
  useEffect(() => {
    const newContentCount = transcriptEntries.length + (liveText ? 1 : 0);
    const hasNewContent = newContentCount > lastTranscriptLength.current;

    if (hasNewContent) {
      if (autoScroll) {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
        setNewContentSinceScroll(false);
      } else {
        setNewContentSinceScroll(true);
      }
    }
    lastTranscriptLength.current = newContentCount;
  }, [transcriptEntries, liveText, autoScroll]);

  // Effect to detect user scrolling
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    let scrollTimeout: number;
    const handleScroll = () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = window.setTimeout(() => {
            const { scrollTop, scrollHeight, clientHeight } = container;
            const isNearBottom = scrollHeight - scrollTop <= clientHeight + 50;
            
            if (!isNearBottom && autoScroll) {
                setAutoScroll(false);
            } else if (isNearBottom && !autoScroll) {
                setAutoScroll(true);
            }
        }, 150);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
        clearTimeout(scrollTimeout);
        container.removeEventListener('scroll', handleScroll);
    };
  }, [autoScroll]);

  const handleAutoScrollClick = () => {
    setAutoScroll(true);
    // The useEffect hook will handle the scrolling logic
  };

  const highlightText = (text: string, query: string): React.ReactNode => {
    if (!query) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? <mark key={i}>{part}</mark> : part
    );
  };
  
  const handleSpeakerTagClick = (speakerId: SpeakerId) => {
    const profile = speakerProfiles[speakerId];
    if (profile && profile.isEditable) {
        setEditingSpeaker(profile);
    }
  };

  return (
    <>
      <div className="flex flex-col h-full cosmo-panel cosmo-panel-grid rounded-2xl p-4 gap-4">
        <header className="flex items-center justify-between pb-2 border-b border-[rgba(var(--color-primary-rgb),0.2)] z-10">
          <div className="relative flex-1 mr-4">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input
              type="text"
              placeholder="Search transcript..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full cosmo-input rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <Tooltip text={`Change to ${nextTextSizeLabel[transcriptTextSize]} text`} position="bottom">
                <button onClick={cycleTextSize} className="h-10 px-3 rounded-lg flex items-center justify-center gap-2 transition-colors cosmo-button">
                    <i className="fas fa-text-height"></i>
                    <span className="text-xs font-semibold w-12 text-center">{textSizeLabels[transcriptTextSize]}</span>
                </button>
            </Tooltip>
            <Tooltip text={autoScroll ? "Auto-scroll On" : "Scroll to Bottom"} position="bottom">
              <button 
                onClick={handleAutoScrollClick} 
                className={`h-10 w-10 flex-shrink-0 cosmo-button rounded-lg transition-all flex items-center justify-center ${autoScroll ? 'text-[var(--color-primary)]' : `text-slate-400 ${newContentSinceScroll ? 'animate-cosmic-glow' : ''}`}`}
              >
                <i className={`fas ${autoScroll ? 'fa-anchor' : 'fa-arrow-down'}`}></i>
              </button>
            </Tooltip>
            <Tooltip text="Chat with Transcript" position="bottom">
              <button onClick={onOpenChat} className="h-10 w-10 flex-shrink-0 cosmo-button rounded-lg transition-colors flex items-center justify-center">
                <i className="fas fa-comments text-lg"></i>
              </button>
            </Tooltip>
          </div>
        </header>

        <div className="z-10">
            <Visualizer isListening={isListening} stream={stream} themeColors={themeColors} />
        </div>

        <div className="flex-1 min-h-0 bg-slate-900/50 rounded-xl border border-[rgba(var(--color-primary-rgb),0.2)] shadow-inner z-10">
          <TranscriptDisplay
            entries={transcriptEntries}
            isListening={isListening}
            liveText={liveText}
            liveTextState={liveTextState}
            activeSpeaker={activeSpeaker}
            speakerProfiles={speakerProfiles}
            showTimestamps={showTimestamps}
            diarizationEnabled={diarizationEnabled}
            onSpeakerTagClick={handleSpeakerTagClick}
            highlightText={highlightText}
            searchQuery={searchQuery}
            containerRef={containerRef}
            endRef={endRef}
            onTranslateEntry={onTranslateEntry}
            onReassignSpeaker={onReassignSpeaker}
            transcriptTextSize={transcriptTextSize}
          />
        </div>
      </div>
      <SpeakerEditorModal
        isOpen={!!editingSpeaker}
        speakerProfile={editingSpeaker}
        onSave={handleUpdateSpeakerLabel}
        onClose={() => setEditingSpeaker(null)}
      />
    </>
  );
};

export default MainContentPanel;