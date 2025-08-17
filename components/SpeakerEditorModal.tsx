import React, { useState, useEffect, useRef } from 'react';
import { type SpeakerProfile } from '../types';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface SpeakerEditorModalProps {
  isOpen: boolean;
  speakerProfile: SpeakerProfile | null;
  onSave: (speakerId: string, newLabel: string) => void;
  onClose: () => void;
}

const SpeakerEditorModal: React.FC<SpeakerEditorModalProps> = ({ isOpen, speakerProfile, onSave, onClose }) => {
  const [label, setLabel] = useState('');
  const modalRef = useRef<HTMLFormElement>(null);

  useFocusTrap(modalRef, isOpen);

  useEffect(() => {
    if (speakerProfile) {
      setLabel(speakerProfile.label);
    }
  }, [speakerProfile]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
        }
    };
    if (isOpen) {
        window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !speakerProfile) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (label.trim()) {
      onSave(speakerProfile.id, label.trim());
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center animate-[fadeIn_0.2s_ease-out]" onClick={onClose}>
      <form 
        ref={modalRef}
        onSubmit={handleSave}
        className="cosmo-panel rounded-xl shadow-2xl p-6 w-full max-w-sm" 
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="speaker-editor-title"
      >
        <h2 id="speaker-editor-title" className="text-xl font-bold mb-4">Edit Speaker</h2>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold text-white flex-shrink-0 hex-clip" style={{ backgroundColor: speakerProfile.color }}>
            {speakerProfile.id.replace('S', '')}
          </div>
          <input
            type="text"
            value={label}
            onChange={e => setLabel(e.target.value)}
            className="w-full cosmo-input rounded-lg p-2 focus:outline-none"
            placeholder="e.g., Alice"
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg cosmo-button">Cancel</button>
          <button type="submit" className="px-4 py-2 rounded-lg bg-[var(--color-primary)] text-black font-semibold hover:opacity-90 transition-opacity">Save</button>
        </div>
      </form>
    </div>
  );
};

export default SpeakerEditorModal;
