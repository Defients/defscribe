import { useEffect, useRef } from 'react';

export const useFocusTrap = (ref: React.RefObject<HTMLElement>, enabled: boolean) => {
  const firstFocusableElement = useRef<HTMLElement | null>(null);
  const lastFocusableElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (enabled && ref.current) {
      const focusableElements = ref.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      firstFocusableElement.current = focusableElements[0];
      lastFocusableElement.current = focusableElements[focusableElements.length - 1];

      firstFocusableElement.current?.focus();

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key !== 'Tab') return;

        if (e.shiftKey) { // Shift+Tab
          if (document.activeElement === firstFocusableElement.current) {
            lastFocusableElement.current?.focus();
            e.preventDefault();
          }
        } else { // Tab
          if (document.activeElement === lastFocusableElement.current) {
            firstFocusableElement.current?.focus();
            e.preventDefault();
          }
        }
      };

      const currentRef = ref.current;
      currentRef.addEventListener('keydown', handleKeyDown);
      return () => currentRef.removeEventListener('keydown', handleKeyDown);
    }
  }, [enabled, ref]);
};
