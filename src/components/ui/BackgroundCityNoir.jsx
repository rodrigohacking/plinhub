import React, { useEffect, useRef } from 'react';

export function BackgroundCityNoir({ children }) {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        let animationFrameId;

        let mouseX = 0;
        let mouseY = 0;
        let targetX = 0;
        let targetY = 0;

        const handleMouseMove = (e) => {
            mouseX = (e.clientX / window.innerWidth) * 2 - 1;
            mouseY = (e.clientY / window.innerHeight) * 2 - 1;
        };

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            initWorld();
        };

        // --- Configuration ---
        const buildingCount = 60;
        const starCount = 200;
        let buildings = [];
        let stars = [];

        // --- Classes ---
        class Star {
            constructor() {
                this.x = Math.random() * canvas.width;
                this.y = Math.random() * (canvas.height * 0.6); // Top 60% only
                this.size = Math.random() * 1.5;
                this.alpha = Math.random();
                this.twinkleSpeed = 0.01 + Math.random() * 0.03;
            }

            draw() {
                this.alpha += this.twinkleSpeed;
                if (this.alpha > 1 || this.alpha < 0.2) this.twinkleSpeed *= -1;

                ctx.fillStyle = `rgba(255, 255, 255, ${this.alpha})`;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        class Building {
            constructor() {
                this.width = 40 + Math.random() * 80;
                this.height = 150 + Math.random() * 400; // Taller
                this.x = (Math.random() * (canvas.width + 800)) - 400;
                this.y = canvas.height;
                this.z = Math.random() * 3 + 0.5; // Depth

                // Noir Aesthetic: Shades of Gray/Black
                const shade = Math.floor(Math.random() * 50); // 0-50 (Very dark gray)
                this.color = `rgb(${shade}, ${shade}, ${shade})`;
                this.borderColor = `rgba(255, 255, 255, ${0.1 + Math.random() * 0.2})`; // Slight white outline
            }

            draw(offsetX, offsetY) {
                const parallaxX = offsetX * (15 / this.z);
                const parallaxY = offsetY * (5 / this.z);
                const finalX = this.x + parallaxX;
                const finalY = this.y - this.height + parallaxY;

                // Fog/Depth opacity
                const opacity = 1 / (this.z * 0.8);

                // Body
                ctx.fillStyle = this.color;
                ctx.fillRect(finalX, finalY, this.width, this.height);

                // Edge Highlight (Noir style)
                ctx.strokeStyle = this.borderColor;
                ctx.lineWidth = 1;
                ctx.strokeRect(finalX, finalY, this.width, this.height);

                // Windows (White points)
                if (Math.random() > 0.3) {
                    ctx.fillStyle = `rgba(255, 255, 255, ${0.3 * opacity})`;
                    const winSize = 2;
                    const gap = 8;
                    for (let wx = finalX + 5; wx < finalX + this.width - 5; wx += gap) {
                        for (let wy = finalY + 10; wy < finalY + this.height; wy += gap * 2) {
                            if (Math.random() > 0.6) {
                                ctx.fillRect(wx, wy, winSize, winSize);
                            }
                        }
                    }
                }
            }
        }

        const initWorld = () => {
            buildings = [];
            stars = [];

            for (let i = 0; i < starCount; i++) stars.push(new Star());
            for (let i = 0; i < buildingCount; i++) buildings.push(new Building());
            buildings.sort((a, b) => b.z - a.z); // Back to front
        };

        const animate = () => {
            targetX += (mouseX - targetX) * 0.05;
            targetY += (mouseY - targetY) * 0.05;

            // Background: Solid Black
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw Stars (Fixed, no parallax for distance intro)
            stars.forEach(s => s.draw());

            // Gradient Fog from bottom
            const gradient = ctx.createLinearGradient(0, canvas.height / 2, 0, canvas.height);
            gradient.addColorStop(0, 'transparent');
            gradient.addColorStop(1, '#000000');

            // Draw Buildings
            const camX = targetX * 100;
            const camY = targetY * 30;
            buildings.forEach(b => b.draw(-camX, -camY));

            // Apply Fog Overlay
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            animationFrameId = window.requestAnimationFrame(animate);
        };

        window.addEventListener('resize', resize);
        window.addEventListener('mousemove', handleMouseMove);

        resize();
        animate();

        return () => {
            window.removeEventListener('resize', resize);
            window.removeEventListener('mousemove', handleMouseMove);
            window.cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return (
        <div className="relative min-h-screen overflow-hidden bg-black text-white">
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
