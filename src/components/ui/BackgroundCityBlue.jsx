import React, { useEffect, useRef } from 'react';

export function BackgroundCityBlue({ children }) {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        let animationFrameId;

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            initWorld();
        };

        // --- Configuration ---
        const buildingCount = 100; // Increased density for flyover
        const starCount = 200;
        let buildings = [];
        let stars = [];
        const speed = 0.002; // Slow forward movement

        // --- Classes ---
        class Star {
            constructor() {
                this.x = Math.random() * canvas.width;
                this.y = Math.random() * (canvas.height * 0.7);
                this.size = Math.random() * 2;
                this.alpha = Math.random();
                this.twinkleSpeed = 0.005 + Math.random() * 0.02;
            }

            draw() {
                this.alpha += this.twinkleSpeed;
                if (this.alpha > 0.8 || this.alpha < 0.2) this.twinkleSpeed *= -1;

                // Blue-tinted stars
                ctx.fillStyle = `rgba(200, 220, 255, ${this.alpha})`;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        class Building {
            constructor() {
                this.width = 40 + Math.random() * 80;
                this.height = 100 + Math.random() * 600;
                this.x = (Math.random() * (canvas.width + 1000)) - 500;
                this.y = canvas.height;
                this.z = Math.random() * 5 + 1; // Initial depth spread

                const shade = 10 + Math.random() * 20;
                this.color = `rgb(${0}, ${shade}, ${shade + 20})`;
                this.highlightColor = '#106EBE';
                this.borderColor = `rgba(16, 110, 190, 0.4)`;
            }

            update() {
                this.z -= speed;
                // If building passes camera (or gets too close), reset directly to back
                if (this.z <= 0.2) {
                    this.z = 5;
                    this.x = (Math.random() * (canvas.width + 1000)) - 500;
                    this.height = 100 + Math.random() * 600;
                    this.width = 40 + Math.random() * 80;
                }
            }

            draw() {
                // Perspective projection based on Z
                // As Z gets smaller (closer), scale increases
                const scale = 1.5 / this.z;

                // Vanishing point is center of screen
                const centerX = canvas.width / 2;
                // const centerY = canvas.height / 2; // unused for Y in this simplified projection, but conceptually relevant

                // Calculate screen X relative to vanishing point
                // (this.x - centerX) is offset from center. Scale it, then add center back.
                const screenX = centerX + (this.x - centerX) * scale;
                const screenW = this.width * scale;
                const screenH = this.height * scale;

                // Y is pinned to bottom (canvas.height)
                // We want the bottom of the building to be at bottom of screen, 
                // but scaled parallax might pull it down or up. 
                // Simple approach: pin bottom to canvas height
                const screenY = canvas.height - screenH;

                // Fog/Fade based on Z
                const alpha = Math.min(1, Math.max(0, 1 - (this.z / 5)));

                ctx.globalAlpha = alpha;

                // Body
                ctx.fillStyle = this.color;
                ctx.fillRect(screenX, screenY, screenW, screenH);

                // Tech-Grid Effect
                ctx.strokeStyle = `rgba(16, 110, 190, ${0.3 * alpha})`;
                ctx.lineWidth = 1;
                ctx.strokeRect(screenX, screenY, screenW, screenH);

                // Top Line Highlight
                ctx.strokeStyle = this.highlightColor;
                ctx.lineWidth = 2 * scale;
                ctx.beginPath();
                ctx.moveTo(screenX, screenY);
                ctx.lineTo(screenX + screenW, screenY);
                ctx.stroke();

                // Windows
                if (Math.random() > 0.05) { // Redraw random windows each frame for "glitch/active" effect? 
                    // No, static window state is better for smooth flyover. 
                    // But for this simple refactor, we just draw standard shapes

                    // Optimized window drawing (simple strip)
                    ctx.fillStyle = `rgba(50, 150, 255, ${0.5 * alpha})`;
                    const winW = 4 * scale;
                    const winH = 10 * scale;
                    const gap = 20 * scale;

                    // Draw a central strip of lights
                    for (let wy = screenY + 10; wy < screenY + screenH - 10; wy += gap) {
                        ctx.fillRect(screenX + (screenW / 2) - (winW / 2), wy, winW, winH);
                    }
                }

                ctx.globalAlpha = 1.0;
            }
        }

        const initWorld = () => {
            buildings = [];
            stars = [];

            for (let i = 0; i < starCount; i++) stars.push(new Star());
            for (let i = 0; i < buildingCount; i++) buildings.push(new Building());
        };

        const animate = () => {
            // Background: Deep Dark Blue Gradient
            const skyGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
            skyGradient.addColorStop(0, '#020617');
            skyGradient.addColorStop(1, '#082f49');
            ctx.fillStyle = skyGradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw Stars
            stars.forEach(s => s.draw());

            // Sort and Draw Buildings
            buildings.forEach(b => b.update());
            buildings.sort((a, b) => b.z - a.z); // Draw back to front
            buildings.forEach(b => b.draw());

            animationFrameId = window.requestAnimationFrame(animate);
        };

        window.addEventListener('resize', resize);
        // Mouse listener removed

        resize();
        animate();

        return () => {
            window.removeEventListener('resize', resize);
            window.cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return (
        <div className="relative min-h-screen overflow-hidden bg-[#020617] text-white">
            <canvas
                ref={canvasRef}
                className="absolute inset-0 z-0"
            />
            <div className="relative z-10 w-full h-full">
                {children}
            </div>
        </div>
    );
}
