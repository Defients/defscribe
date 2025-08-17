import React from 'react';
import { type TranscriptEntry, type SpeakerProfile, type SpeakerId } from '../types';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  transcriptEntries: TranscriptEntry[];
  speakerProfiles: Record<SpeakerId, SpeakerProfile>;
}

const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, transcriptEntries, speakerProfiles }) => {
    const modalRef = React.useRef<HTMLDivElement>(null);
    useFocusTrap(modalRef, isOpen);

    if (!isOpen) return null;

    const formatTranscript = (format: 'txt' | 'md'): string => {
        return transcriptEntries.map(entry => {
            const speakerLabel = entry.speakerIds && entry.speakerIds[0] 
                ? speakerProfiles[entry.speakerIds[0]]?.label || entry.speakerIds[0] 
                : 'Unknown Speaker';
            
            const timestamp = entry.timestamp;
            const text = entry.text;

            if (format === 'md') {
                return `**${speakerLabel}** (${timestamp}): ${text}`;
            }
            // txt format
            return `[${timestamp}] ${speakerLabel}: ${text}`;
        }).join('\n\n');
    };

    const handleDownload = (format: 'txt' | 'md') => {
        const content = formatTranscript(format);
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `DefScribe-Transcript-${new Date().toISOString().slice(0, 10)}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center animate-[fadeIn_0.2s_ease-out]" onClick={onClose}>
            <div
                ref={modalRef}
                className="cosmo-panel rounded-xl shadow-2xl p-6 w-full max-w-sm"
                onClick={e => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="export-title"
            >
                <h2 id="export-title" className="text-xl font-bold mb-6 text-center">Export Transcript</h2>
                <div className="flex flex-col gap-4">
                    <button onClick={() => handleDownload('txt')} className="cosmo-button w-full h-12 flex items-center justify-center gap-3 text-lg">
                        <i className="fas fa-file-alt"></i> Export as .txt
                    </button>
                    <button onClick={() => handleDownload('md')} className="cosmo-button w-full h-12 flex items-center justify-center gap-3 text-lg">
                        <i className="fab fa-markdown"></i> Export as .md
                    </button>
                </div>
                <div className="mt-6 text-center">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white">Cancel</button>
                </div>
            </div>
        </div>
    );
};

export default ExportModal;
