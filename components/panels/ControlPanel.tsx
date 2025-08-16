import React from 'react';
import Tooltip from '../Tooltip';
import { THEME_PRESETS } from '../../constants';
import { type DiarizationSettings } from '../../types';
import BackgroundPenLogo from '../BackgroundPenLogo';

interface ControlPanelProps {
  isListening: boolean;
  isAnalyzing: boolean;
  isSummarizing: boolean;
  wpm: number;
  onStart: () => void;
  onStop: () => void;
  onClear: () => void;
  addToast: (title: string, message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
  onGoImmersive: () => void;
  isImmersiveButtonGlowing: boolean;
  themeId: number;
  setThemeId: (id: number) => void;
  diarizationSettings: DiarizationSettings;
  setDiarizationSettings: (settings: DiarizationSettings) => void;
  showTimestamps: boolean;
  setShowTimestamps: (show: boolean) => void;
  translationLanguage: string;
  setTranslationLanguage: (lang: string) => void;
  onResetLayout: () => void;
}

const IconButton: React.FC<{ icon: string; text: string; onClick: () => void; className?: string; disabled?: boolean; }> = ({ icon, text, onClick, className = '', disabled }) => (
  <Tooltip text={text} position="bottom">
    <button
      onClick={onClick}
      disabled={disabled}
      className={`h-12 w-full flex items-center justify-center text-lg font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg ${className}`}
    >
      <div className="flex items-center justify-center w-full px-4 gap-3">
        <i className={`fas ${icon} w-6 text-center`}></i>
        <span className="flex-1 text-left">{text}</span>
      </div>
    </button>
  </Tooltip>
);

const ControlPanel: React.FC<ControlPanelProps> = ({
  isListening, isAnalyzing, isSummarizing, wpm, onStart, onStop, onClear, onGoImmersive, isImmersiveButtonGlowing,
  themeId, setThemeId, diarizationSettings, setDiarizationSettings, showTimestamps, setShowTimestamps,
  translationLanguage, setTranslationLanguage, onResetLayout
}) => {
  return (
    <div className="flex flex-col h-full cosmo-panel rounded-2xl p-4 gap-4 overflow-y-auto">
      <header className="text-center pb-2 border-b border-[rgba(var(--color-primary-rgb),0.2)]">
        <h1 className="text-2xl font-bold tracking-wider text-white" style={{ textShadow: `0 0 10px rgba(var(--color-primary-rgb), 0.7)`}}>DefScribe AI</h1>
        <p className="text-sm text-slate-400">Advanced Dictation Assistant</p>
      </header>

      <div className="space-y-3">
        {!isListening ? (
          <IconButton icon="fa-microphone" text="Start Listening" onClick={onStart} className="bg-green-600/80 hover:bg-green-600/100 shadow-lg" />
        ) : (
          <IconButton icon="fa-stop-circle" text="Stop Listening" onClick={onStop} className="bg-red-600/80 hover:bg-red-600/100 shadow-lg animate-recording-glow" />
        )}
        <IconButton icon="fa-trash-alt" text="Clear Session" onClick={onClear} disabled={isListening} className="control-button" />
        <IconButton
            icon="fa-rocket"
            text="Immersive Mode"
            onClick={onGoImmersive}
            className={`control-button ${isImmersiveButtonGlowing ? 'animate-cosmic-glow' : ''}`}
            disabled={isListening}
        />
      </div>
      
      <div className="flex-1 flex items-center justify-center">
        <BackgroundPenLogo isListening={isListening} isSummarizing={isSummarizing || isAnalyzing} wpm={wpm} />
      </div>

      <div className="space-y-4 pt-4 border-t border-[rgba(var(--color-primary-rgb),0.2)]">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Settings</h2>
        
        {/* Theme Selector */}
        <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Theme</label>
            <div className="grid grid-cols-5 gap-2">
                {Object.entries(THEME_PRESETS).map(([id, theme]) => (
                    <Tooltip text={`Theme ${id}`} key={id}>
                        <button
                            onClick={() => setThemeId(Number(id))}
                            className={`h-8 w-full rounded-lg transition-all duration-200 ${Number(id) === themeId ? 'ring-2 ring-offset-2 ring-offset-[var(--color-bg-deep)] ring-white' : ''}`}
                            style={{ background: `linear-gradient(to right, ${theme.primary}, ${theme.secondary}, ${theme.accent})` }}
                        />
                    </Tooltip>
                ))}
            </div>
        </div>
        
        {/* Diarization Settings */}
        <div className="space-y-2">
           <div className="flex items-center justify-between">
             <label htmlFor="diarization-toggle" className="text-sm font-medium text-slate-400">Speaker Detection</label>
             <button onClick={() => setDiarizationSettings({ ...diarizationSettings, enabled: !diarizationSettings.enabled })} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${diarizationSettings.enabled ? 'bg-[var(--color-primary)]' : 'bg-slate-600'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${diarizationSettings.enabled ? 'translate-x-6' : 'translate-x-1'}`}/>
             </button>
           </div>
           {diarizationSettings.enabled ? (
             <div className="flex items-center justify-between pl-2 animate-[fadeIn_0.3s_ease-out]">
               <label htmlFor="speakers-count" className="text-sm font-medium text-slate-400">Speakers</label>
               <input 
                 type="number"
                 id="speakers-count"
                 min="1" max="6"
                 value={diarizationSettings.expectedSpeakers}
                 onChange={e => setDiarizationSettings({...diarizationSettings, expectedSpeakers: parseInt(e.target.value, 10)})}
                 className="w-16 cosmo-input rounded-md text-center"
               />
             </div>
           ) : (
             <div className="pl-2 mt-1 text-xs text-slate-400 bg-slate-800/50 p-2 rounded-md animate-[fadeIn_0.3s_ease-out]">
                Enable to automatically identify and label different speakers.
             </div>
           )}
        </div>

        {/* Other Settings */}
        <div className="flex items-center justify-between">
            <label htmlFor="timestamps-toggle" className="text-sm font-medium text-slate-400">Show Timestamps</label>
            <button onClick={() => setShowTimestamps(!showTimestamps)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${showTimestamps ? 'bg-[var(--color-primary)]' : 'bg-slate-600'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showTimestamps ? 'translate-x-6' : 'translate-x-1'}`}/>
            </button>
        </div>
        <div className="flex items-center justify-between">
            <label htmlFor="language-select" className="text-sm font-medium text-slate-400">Translate to</label>
            <select
                id="language-select"
                value={translationLanguage}
                onChange={e => setTranslationLanguage(e.target.value)}
                className="cosmo-input rounded-md text-sm p-1"
            >
                <option>Spanish</option>
                <option>French</option>
                <option>German</option>
                <option>Japanese</option>
                <option>Mandarin</option>
            </select>
        </div>

        <button onClick={onResetLayout} className="control-button text-sm h-10 w-full rounded-lg flex items-center justify-center gap-2"><i className="fas fa-undo"></i> Reset Layout</button>
      </div>
    </div>
  );
};

export default ControlPanel;