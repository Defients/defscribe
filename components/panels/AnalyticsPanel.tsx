import React, { useState } from 'react';
import { type SummaryStyle, type ActionItem, type Snippet, type SpeakerProfile, type SpeakerId, type SpeechAnalytics } from '../../types';
import TalkTimeVisualizer from '../TalkTimeVisualizer';

interface AnalyticsPanelProps {
  isSummarizing: boolean;
  summary: string;
  summaryStyle: SummaryStyle | null;
  onSummarize: (style: SummaryStyle) => void;
  actionItems: ActionItem[];
  snippets: Snippet[];
  topics: string[];
  isAnalyzing: boolean;
  speechAnalytics: Partial<SpeechAnalytics>;
  speakerProfiles: Record<SpeakerId, SpeakerProfile>;
}

type ActiveTab = 'summary' | 'actions' | 'snippets' | 'stats';

const SummaryButton: React.FC<{ style: SummaryStyle; current: SummaryStyle | null; onClick: () => void; children: React.ReactNode; }> = ({ style, current, onClick, children }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex-1 cosmo-button ${style === current ? 'bg-[var(--color-primary)] text-black border-transparent' : ''}`}
  >
    {children}
  </button>
);

const StatCard: React.FC<{ icon: string; label: string; value: string | number; unit?: string; }> = ({ icon, label, value, unit }) => (
    <div className="stat-card-full p-4 flex items-center gap-4 rounded-lg">
        <div className="w-12 h-12 bg-slate-900/50 rounded-full flex items-center justify-center text-[var(--color-accent)] text-2xl flex-shrink-0 border-2 border-[rgba(var(--color-accent-rgb),0.2)]">
            <i className={`fas ${icon}`}></i>
        </div>
        <div className="flex-1 text-right">
            <div className="text-sm text-slate-300">{label}</div>
            <div className="text-3xl font-bold text-white">
                {value}
                {unit && <span className="text-lg font-normal text-slate-300 ml-1">{unit}</span>}
            </div>
        </div>
    </div>
);


const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({ 
  isSummarizing, summary, summaryStyle, onSummarize, actionItems, 
  snippets, topics, isAnalyzing, speechAnalytics, speakerProfiles 
}) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('stats');

  return (
    <div className="flex flex-col h-full cosmo-panel rounded-2xl p-4 gap-4">
      <header className="flex items-center justify-center z-10">
        <nav className="flex w-full relative">
            <TabButton name="Summary" tab="summary" activeTab={activeTab} onClick={setActiveTab} />
            <TabButton name="Stats" tab="stats" activeTab={activeTab} onClick={setActiveTab} />
            <TabButton name="Actions" tab="actions" activeTab={activeTab} onClick={setActiveTab} count={actionItems.length} />
            <TabButton name="Snippets" tab="snippets" activeTab={activeTab} onClick={setActiveTab} count={snippets.length} />
             <div className="absolute bottom-[-8px] h-6 w-6 bg-[var(--color-primary)] shadow-[0_0_8px_var(--color-primary)] rounded-full transition-all duration-300 hex-clip" 
                  style={{ 
                      left: `calc(${{summary: 12.5, stats: 37.5, actions: 62.5, snippets: 87.5}[activeTab]}% - 12px)`
                  }}/>
        </nav>
      </header>
      
      {isAnalyzing && (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 z-10">
            <i className="fas fa-brain text-4xl mb-3 spinner-animation"></i>
            <p>Analyzing transcript...</p>
        </div>
      )}

      {!isAnalyzing && (
        <>
            {activeTab === 'summary' && (
            <div className="flex-1 flex flex-col min-h-0 z-10">
                <TalkTimeVisualizer talkTimeData={speechAnalytics.talkTime || {}} speakerProfiles={speakerProfiles} />
                <div className="flex gap-2 mb-3">
                    <SummaryButton style="basic" current={summaryStyle} onClick={() => onSummarize('basic')}>Basic</SummaryButton>
                    <SummaryButton style="detailed" current={summaryStyle} onClick={() => onSummarize('detailed')}>Detailed</SummaryButton>
                    <SummaryButton style="full" current={summaryStyle} onClick={() => onSummarize('full')}>Full</SummaryButton>
                </div>
                {isSummarizing ? (
                    <div className="flex-1 flex flex-col items-center justify-center space-y-2 rounded-lg bg-slate-900/50 p-4">
                        <div className="w-full h-4 rounded skeleton-loader" />
                        <div className="w-full h-4 rounded skeleton-loader" />
                        <div className="w-3/4 h-4 rounded skeleton-loader" />
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto bg-slate-900/50 rounded-lg p-4 prose prose-sm prose-invert max-w-none prose-p:text-slate-300">
                        <p style={{ whiteSpace: 'pre-wrap' }}>{summary}</p>
                    </div>
                )}
                {(topics || []).length > 0 && (
                    <div className="pt-3 mt-3 border-t border-[rgba(var(--color-primary-rgb),0.2)]">
                        <h3 className="text-xs font-semibold text-slate-400 uppercase mb-2">Topics</h3>
                        <div className="flex flex-wrap gap-2">
                            {topics.map(topic => <span key={topic} className="px-2 py-1 text-xs rounded-full bg-[var(--color-accent)]/20 text-[var(--color-accent)]">{topic}</span>)}
                        </div>
                    </div>
                )}
            </div>
            )}
            
            {activeTab === 'stats' && (
                <div className="flex-1 overflow-y-auto space-y-3 pr-2 z-10">
                    {!speechAnalytics.wpm ? <EmptyState icon="fa-chart-bar" text="No analytics yet. Start listening to see stats." /> : (
                        <div className="flex flex-col gap-3">
                           <StatCard icon="fa-tachometer-alt" label="Avg. Speed" value={speechAnalytics.wpm?.toFixed(0) || 0} unit="WPM" />
                           <StatCard icon="fa-bullseye" label="Clarity" value={speechAnalytics.clarity?.toFixed(0) || 0} unit="%" />
                           <StatCard icon="fa-stopwatch" label="Duration" value={speechAnalytics.duration ? new Date(speechAnalytics.duration * 1000).toISOString().substr(14, 5) : '00:00'} unit="MM:SS"/>
                           <StatCard icon="fa-pause-circle" label="Pauses" value={speechAnalytics.pauses || 0} />
                           <StatCard icon="fa-comment-dots" label="Filler Words" value={speechAnalytics.fillers || 0} />
                           <StatCard icon="fa-file-word" label="Total Words" value={speechAnalytics.words || 0} />
                           <StatCard icon="fa-rocket" label="Speaking Rate" value={speechAnalytics.speakingRateLabel || 'Medium'} />
                        </div>
                    )}
                </div>
            )}


            {activeTab === 'actions' && (
                <div className="flex-1 overflow-y-auto space-y-3 z-10">
                    {actionItems.length === 0 && <EmptyState icon="fa-tasks" text="No action items found." />}
                    {actionItems.map(item => <ListItem key={item.id} icon={item.type === 'action' ? 'fa-bolt' : 'fa-gavel'} content={item.content} />)}
                </div>
            )}

            {activeTab === 'snippets' && (
                <div className="flex-1 overflow-y-auto space-y-3 z-10">
                    {snippets.length === 0 && <EmptyState icon="fa-highlighter" text="No key snippets found." />}
                    {snippets.map(item => <ListItem key={item.id} icon={item.type === 'quote' ? 'fa-quote-left' : item.type === 'question' ? 'fa-question-circle' : 'fa-lightbulb'} content={item.content} />)}
                </div>
            )}
        </>
      )}
    </div>
  );
};

const TabButton: React.FC<{name: string, tab: ActiveTab, activeTab: ActiveTab, onClick: (tab: ActiveTab) => void, count?: number}> = ({name, tab, activeTab, onClick, count}) => (
    <button
        onClick={() => onClick(tab)}
        className={`flex-1 text-center font-semibold p-3 pb-4 transition-colors relative z-10 border-b-2 border-transparent ${activeTab === tab ? 'text-white' : 'text-slate-400 hover:text-white'}`}
    >
        {name}
        {count != null && count > 0 && <span className="absolute top-1 right-2 text-xs bg-[var(--color-secondary)] text-white rounded-full h-5 w-5 flex items-center justify-center">{count}</span>}
    </button>
);

const EmptyState: React.FC<{icon: string, text: string}> = ({ icon, text }) => (
    <div className="flex flex-col items-center justify-center text-slate-400 h-full p-6 text-center">
        <i className={`fas ${icon} text-3xl mb-3`}></i>
        <p>{text}</p>
    </div>
);

const ListItem: React.FC<{icon: string, content: string}> = ({icon, content}) => (
    <div className="flex items-start gap-3 bg-slate-800/50 p-3 rounded-lg">
        <i className={`fas ${icon} text-[var(--color-accent)] pt-1 w-5 text-center`}></i>
        <p className="flex-1 text-sm text-slate-300">{content}</p>
    </div>
)

export default AnalyticsPanel;
