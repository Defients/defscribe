import React, { useState, useMemo } from 'react';

interface BackgroundPenLogoProps {
    isListening: boolean;
    isSummarizing: boolean;
    wpm: number;
}

const BackgroundPenLogo: React.FC<BackgroundPenLogoProps> = ({ isListening, isSummarizing, wpm }) => {
    const [easterEgg, setEasterEgg] = useState(false);
    
    const animationStyle = useMemo(() => {
        if (easterEgg) {
            return { animation: 'easter-egg-spin 1.5s ease-in-out' };
        }
        if (isSummarizing) {
            return { animation: 'scribble-active 0.5s ease-in-out infinite' };
        }
        if (isListening) {
            // Scale animation speed based on WPM, making it faster as the user speaks faster
            // Capping at a reasonable speed to avoid being too jerky.
            const speed = Math.max(0.5, 3 - (wpm / 80)); 
            return { animation: `scribble-active ${speed}s ease-in-out infinite` };
        }
        // Idle animation
        return { animation: 'float-idle 8s ease-in-out infinite' };
    }, [isListening, isSummarizing, wpm, easterEgg]);
    
    const handleEasterEgg = () => {
        setEasterEgg(true);
        setTimeout(() => setEasterEgg(false), 1500); // Duration of the animation
    };

    return (
        <div 
            className="flex justify-center transition-opacity duration-500"
            style={{ opacity: isListening || isSummarizing ? '1' : '0.7' }}
            aria-hidden="true"
        >
            <div className="relative w-64 h-64">
                <img
                    src="https://static.wixstatic.com/media/2ef790_8834bc46053541f9b07873cdb91f5649~mv2.png"
                    alt="DefScribe Pen"
                    onClick={handleEasterEgg}
                    className="w-full h-full object-contain drop-shadow-2xl cursor-pointer"
                    style={animationStyle}
                />
            </div>
        </div>
    );
};

export default BackgroundPenLogo;