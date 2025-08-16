import React, { useRef, useEffect } from 'react';

const CosmicBackground: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let width = window.innerWidth;
        let height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;

        const resizeHandler = () => {
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = width;
            canvas.height = height;
        };
        window.addEventListener('resize', resizeHandler);

        const stars = Array.from({ length: 1000 }, () => ({
            x: Math.random() * width,
            y: Math.random() * height,
            radius: Math.random() * 1.5,
            alpha: Math.random(),
            velocity: Math.random() * 0.1 + 0.05
        }));
        
        const shootingStars = Array.from({ length: 3 }, () => ({
            x: Math.random() * width,
            y: Math.random() * height,
            len: Math.random() * 80 + 20,
            speed: Math.random() * 5 + 5,
            active: true
        }));

        let time = 0;
        let animationFrameId: number;
        
        const draw = (timestamp: number) => {
            if (time === 0) time = timestamp;
            const elapsed = timestamp - time;
            time = timestamp;
            
            const timeSeconds = timestamp * 0.0001;

            ctx.clearRect(0, 0, width, height);

            // Draw Nebula/Aurora
            const gradient = ctx.createLinearGradient(0, 0, width, height);
            const color1 = `hsl(${240 + Math.sin(timeSeconds) * 20}, 100%, 70%)`;
            const color2 = `hsl(${280 + Math.cos(timeSeconds) * 20}, 100%, 60%)`;
            gradient.addColorStop(0, color1);
            gradient.addColorStop(1, color2);
            
            ctx.globalAlpha = 0.08;
            ctx.fillStyle = gradient;
            
            for (let i = 0; i < 3; i++) {
                ctx.beginPath();
                ctx.moveTo(width * Math.sin(timeSeconds * (i + 1) * 0.2), 0);
                ctx.bezierCurveTo(width / 2, height / 2, width / 2, height / 2, width, height * Math.cos(timeSeconds * (i + 1) * 0.3));
                ctx.lineTo(width, 0);
                ctx.closePath();
                ctx.fill();
            }
            
            ctx.globalAlpha = 1;

            // Draw stars
            stars.forEach(star => {
                star.y -= star.velocity * (elapsed / 16.67);
                if (star.y < 0) {
                    star.y = height;
                }
                ctx.beginPath();
                ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
                ctx.fill();
            });

            // Draw shooting stars
            shootingStars.forEach(s => {
                if (s.active) {
                    const starGradient = ctx.createLinearGradient(s.x, s.y, s.x - s.len, s.y + s.len);
                    starGradient.addColorStop(0, `rgba(255, 255, 255, 0.8)`);
                    starGradient.addColorStop(1, `rgba(255, 255, 255, 0)`);
                    ctx.strokeStyle = starGradient;
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(s.x, s.y);
                    ctx.lineTo(s.x - s.len, s.y + s.len);
                    ctx.stroke();
                    s.x -= s.speed;
                    s.y += s.speed;
                    if (s.x < -s.len || s.y > height + s.len) {
                        s.active = false;
                    }
                } else {
                    if (Math.random() < 0.001) { // Chance per frame to respawn
                        s.x = Math.random() * width + 50;
                        s.y = Math.random() * height - 50;
                        s.len = Math.random() * 80 + 20;
                        s.speed = Math.random() * 5 + 5;
                        s.active = true;
                    }
                }
            });

            animationFrameId = requestAnimationFrame(draw);
        };

        draw(0);

        return () => {
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener('resize', resizeHandler);
        };
    }, []);

    return <canvas ref={canvasRef} className="fixed inset-0 -z-20 w-full h-full" />;
};

export default React.memo(CosmicBackground);