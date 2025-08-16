
import React from 'react';

interface TooltipProps {
  children: React.ReactNode;
  text: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

const Tooltip: React.FC<TooltipProps> = ({ children, text, position = 'top' }) => {
  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div className="relative group flex items-center">
      {children}
      <div
        className={`absolute ${positionClasses[position]} w-max whitespace-nowrap bg-slate-800 text-white text-xs font-semibold rounded-md px-2 py-1 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-50 pointer-events-none backdrop-blur-sm bg-opacity-80`}
      >
        {text}
      </div>
    </div>
  );
};

export default Tooltip;
