import React from 'react';
import { type SpeakerProfile, type SpeakerId, type SpeechAnalytics } from '../types';
import Tooltip from './Tooltip';

interface TalkTimeVisualizerProps {
  talkTimeData: SpeechAnalytics['talkTime'];
  speakerProfiles: Record<SpeakerId, SpeakerProfile>;
}

const TalkTimeVisualizer: React.FC<TalkTimeVisualizerProps> = ({ talkTimeData, speakerProfiles }) => {

  const sortedTalkTime = React.useMemo(() => {
      if (!talkTimeData) return [];
      return Object.entries(talkTimeData)
        .map(([speakerId, data]) => ({ speakerId, ...data }))
        .sort((a, b) => b.percentage - a.percentage);
  }, [talkTimeData]);


  if (sortedTalkTime.length === 0) {
    return null; // Don't render if no data
  }

  return (
    <div className="mb-4 pt-2">
      <h3 className="text-xs font-semibold text-slate-400 uppercase mb-2">Talk Time</h3>
      <div className="space-y-2">
        {sortedTalkTime.map(({ speakerId, percentage }) => {
          const profile = speakerProfiles[speakerId];
          if (!profile) return null;
          return (
            <Tooltip key={speakerId} text={`${profile.label} (${percentage.toFixed(1)}%)`} position="top">
              <div className="flex items-center gap-2 text-sm w-full">
                <div 
                  className="w-4 h-4 rounded-full flex-shrink-0 hex-clip"
                  style={{ backgroundColor: profile.color }}
                />
                <div className="flex-1 bg-slate-700/50 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ 
                        width: `${percentage}%`, 
                        backgroundColor: profile.color,
                        boxShadow: `0 0 8px ${profile.color}`
                    }}
                  />
                </div>
                <span className="w-12 text-right font-roboto-mono text-xs">{percentage.toFixed(0)}%</span>
              </div>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
};

export default TalkTimeVisualizer;