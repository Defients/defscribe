import React, { useState, useEffect } from 'react';
import { type TranscriptEntry, type SpeakerProfile, type SpeakerId } from '../types';
import Tooltip from './Tooltip';

const SpeakerTag: React.FC<{ profile: SpeakerProfile; onClick: (speakerId: SpeakerId) => void }> = ({ profile, onClick }) => {
  const speakerNum = profile.id.replace('S', '');
  return (
    <Tooltip text={`Edit ${profile.label}`} position="right">
      <button 
        onClick={() => onClick(profile.id)}
        className="w-8 h-8 text-xs font-bold flex items-center justify-center flex-shrink-0 text-white shadow-md transition-all duration-300 hover:scale-110 hover:animate-[pulse-glow_1.5s_ease-in-out_infinite] hex-clip"
        style={{ '--color': profile.color, backgroundColor: profile.color } as React.CSSProperties}
        aria-label={`Speaker ${speakerNum}, ${profile.label}. Click to edit.`}
      >
        {speakerNum}
      </button>
    </Tooltip>
  );
};

interface ActionsMenuProps {
    entry: TranscriptEntry;
    speakerProfiles: Record<SpeakerId, SpeakerProfile>;
    onTranslate: (entryId: string) => void;
    onReassign: (entryId: string, newSpeakerId: SpeakerId) => void;
    onClose: () => void;
}

const ActionsMenu: React.FC<ActionsMenuProps> = ({ entry, speakerProfiles, onTranslate, onReassign, onClose }) => {
    const [showSpeakers, setShowSpeakers] = useState(false);
    
    const handleReassign = (newSpeakerId: SpeakerId) => {
        onReassign(entry.id, newSpeakerId);
        onClose();
    };

    return (
        <div className="absolute right-2 top-8 z-40 bg-slate-800 border border-slate-600 rounded-lg shadow-xl animate-[fadeIn_0.1s_ease-out]">
            <ul className="text-sm text-slate-200">
                <li><button onClick={() => onTranslate(entry.id)} className="w-full text-left px-3 py-2 hover:bg-slate-700/50 flex items-center gap-2 rounded-t-lg"><i className="fas fa-language w-4"></i> Translate</button></li>
                <li className="relative">
                    <button onClick={() => setShowSpeakers(p => !p)} className="w-full text-left px-3 py-2 hover:bg-slate-700/50 flex items-center gap-2 rounded-b-lg"><i className="fas fa-user-edit w-4"></i> Reassign</button>
                    {showSpeakers && (
                        <div className="absolute right-full top-0 mr-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl p-1 animate-[fadeIn_0.1s_ease-out]">
                            {Object.values(speakerProfiles).map(p => (
                                <button key={p.id} onClick={() => handleReassign(p.id)} className="w-full text-left px-3 py-1 hover:bg-slate-700/50 rounded-md flex items-center gap-2 whitespace-nowrap">
                                    <div className="w-4 h-4 rounded-full" style={{backgroundColor: p.color}} />
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    )}
                </li>
            </ul>
        </div>
    );
};


interface TranscriptDisplayProps {
  entries: TranscriptEntry[];
  isListening: boolean;
  liveText: string;
  liveTextState: 'visible' | 'fading-out' | 'hidden';
  activeSpeaker: SpeakerId | null;
  speakerProfiles: Record<SpeakerId, SpeakerProfile>;
  showTimestamps: boolean;
  diarizationEnabled: boolean;
  onSpeakerTagClick: (speakerId: SpeakerId) => void;
  highlightText: (text: string, query: string) => React.ReactNode;
  searchQuery: string;
  containerRef: React.RefObject<HTMLDivElement>;
  endRef: React.RefObject<HTMLDivElement>;
  onTranslateEntry: (entryId: string) => void;
  onReassignSpeaker: (entryId: string, newSpeakerId: SpeakerId) => void;
  transcriptTextSize: 'sm' | 'base' | 'lg';
}

const TranscriptDisplay: React.FC<TranscriptDisplayProps> = ({
  entries, isListening, liveText, liveTextState, activeSpeaker, speakerProfiles,
  showTimestamps, diarizationEnabled, onSpeakerTagClick, highlightText, searchQuery,
  containerRef, endRef, onTranslateEntry, onReassignSpeaker, transcriptTextSize
}) => {

  const [activeMenuEntryId, setActiveMenuEntryId] = useState<string | null>(null);
  const textSizeClasses = { sm: 'text-sm', base: 'text-base', lg: 'text-lg' };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Find if the click was inside a menu trigger button
      const target = event.target as HTMLElement;
      if (!target.closest('.actions-menu-trigger')) {
        setActiveMenuEntryId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


  return (
    <div ref={containerRef} className="overflow-y-auto flex-1 pr-2 min-h-0">
      {entries.map((entry) => (
        <div key={entry.id} className="relative flex items-start gap-3 p-2 rounded-lg hover:bg-slate-800/50 transition-colors fade-in-entry pb-4 group">
            {showTimestamps && (
                <div className="w-24 flex-shrink-0 pt-1">
                    <span className="font-roboto-mono text-xs text-[var(--color-secondary)] bg-[var(--color-secondary)]/10 px-2 py-1 rounded-md">{entry.timestamp}</span>
                </div>
            )}
            <div className={`flex-1 pt-1 ${!showTimestamps ? 'pl-2' : ''}`}>
                <div className="flex items-start gap-2">
                    {diarizationEnabled && entry.speakerIds && entry.speakerIds.length > 0 && (
                        <div className="flex items-center justify-center gap-1 pt-0">
                            {entry.speakerIds.map(id => speakerProfiles[id] ? <SpeakerTag key={id} profile={speakerProfiles[id]} onClick={onSpeakerTagClick} /> : null)}
                        </div>
                    )}
                    <div className="flex-1">
                        <p className={`text-slate-300 leading-relaxed ${textSizeClasses[transcriptTextSize]}`}>{highlightText(entry.text, searchQuery)}</p>
                        {entry.translatedText && <p className="text-sm text-slate-400 italic mt-1 pl-2 border-l-2 border-slate-600">{entry.translatedText}</p>}
                    </div>
                </div>
            </div>
            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-30">
                <Tooltip text="Actions" position="left">
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setActiveMenuEntryId(prev => prev === entry.id ? null : entry.id); 
                      }} 
                      className="w-6 h-6 rounded-md hover:bg-slate-700/80 flex items-center justify-center actions-menu-trigger"
                    >
                        <i className="fas fa-ellipsis-v text-xs"></i>
                    </button>
                </Tooltip>
            </div>

            {activeMenuEntryId === entry.id && (
                <ActionsMenu
                    entry={entry}
                    speakerProfiles={speakerProfiles}
                    onTranslate={onTranslateEntry}
                    onReassign={onReassignSpeaker}
                    onClose={() => setActiveMenuEntryId(null)}
                />
            )}
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-0 h-px bg-gradient-to-r from-transparent via-[var(--color-primary)]/80 to-transparent transition-all duration-500 group-hover:w-[95%] shadow-[0_0_8px_var(--color-primary)]"></div>
        </div>
      ))}
      
      {entries.length === 0 && !isListening && (
        <div className="flex items-start gap-3 p-2">
          <p className="flex-1 text-slate-400 italic">Welcome to DefScribe. Press Start Listening to begin.</p>
        </div>
      )}
      
      {isListening && liveTextState !== 'hidden' && (
          <div className={`group relative flex items-start gap-3 p-2 rounded-lg text-slate-400 transition-all duration-500 ease-out 
            ${liveTextState === 'fading-out' ? 'opacity-0' : 'opacity-100'}
            ${activeSpeaker ? 'border-l-4' : ''}`}
            style={{ borderLeftColor: activeSpeaker && speakerProfiles[activeSpeaker] ? speakerProfiles[activeSpeaker].color : 'transparent' }}
          >
              {showTimestamps && (
                  <div className="w-24 flex-shrink-0 pt-1">
                      <span className="font-roboto-mono text-xs text-slate-500 bg-slate-800/50 px-2 py-1 rounded-md">Now...</span>
                  </div>
              )}
              <div className={`flex-1 pt-1 ${!showTimestamps ? 'pl-2' : ''}`}>
                  <div className="flex items-start gap-2">
                      {diarizationEnabled && activeSpeaker && speakerProfiles[activeSpeaker] && (
                          <div className="flex items-center justify-center gap-1 pt-0">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white hex-clip" style={{ backgroundColor: speakerProfiles[activeSpeaker].color, opacity: 0.9 }}>
                                {activeSpeaker.replace('S','')}
                              </div>
                          </div>
                      )}
                      <div className="flex-1">
                          <p className={`italic leading-relaxed text-slate-300 ${textSizeClasses[transcriptTextSize]}`}>
                              {highlightText(liveText, searchQuery)}
                              {liveTextState === 'visible' && <span className="inline-block w-0.5 h-4 bg-white/70 ml-1 animate-[cursor-blink_1s_step-end_infinite]"></span>}
                          </p>
                      </div>
                  </div>
              </div>
          </div>
      )}
      <div ref={endRef} />
    </div>
  );
};

export default TranscriptDisplay;