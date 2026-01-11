import React, { useEffect, useRef } from 'react';

export function BackgroundCity3D({ children }) {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        let animationFrameId;

        // Mouse state
        let mouseX = 0;
        let mouseY = 0;
        let targetX = 0;
        let targetY = 0;

        const handleMouseMove = (e) => {
            // Normalize mouse position from -1 to 1
            mouseX = (e.clientX / window.innerWidth) * 2 - 1;
            mouseY = (e.clientY / window.innerHeight) * 2 - 1;
        };

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            initCity();
        };

        // City Generation
        let buildings = [];
        const buildingCount = 50;

        class Building {
            constructor() {
                this.width = 50 + Math.random() * 100;
                this.height = 100 + Math.random() * 300;
                this.x = (Math.random() * (canvas.width + 1000)) - 500; // Wider range for parallax
                this.y = canvas.height;
                this.z = Math.random() * 3 + 1; // Depth factor (1 is close, 4 is far)
                this.color = Math.random() > 0.9 ? '#3b82f6' : '#1e293b'; // Occasional blue building
            }

            draw(offsetX, offsetY) {
                // Parallax calculation
                const parallaxX = offsetX * (10 / this.z);
                const parallaxY = offsetY * (5 / this.z);

                const finalX = this.x + parallaxX;
                const finalY = this.y - this.height + parallaxY;

                // Opacity based on depth (fog effect)
                const opacity = 1 / this.z;

                ctx.fillStyle = `rgba(15, 23, 42, ${opacity})`; // slate-900 base

                // Glow effect for "lights"
                if (this.color === '#3b82f6') {
                    ctx.shadowBlur = 20;
                    ctx.shadowColor = 'rgba(59, 130, 246, 0.5)';
                    ctx.fillStyle = `rgba(30, 58, 138, ${opacity})`; // Blue tint
                } else {
                    ctx.shadowBlur = 0;
                }

                ctx.fillRect(finalX, finalY, this.width, this.height);

                // Windows (Lights)
                if (Math.random() > 0.5) {
                    ctx.fillStyle = `rgba(148, 163, 184, ${opacity * 0.5})`; // Slate-400
                    for (let wx = finalX + 10; wx < finalX + this.width - 10; wx += 20) {
                        for (let wy = finalY + 10; wy < finalY + this.height - 10; wy += 40) {
                            if (Math.random() > 0.8) { // Random lights on/off
                                ctx.fillRect(wx, wy, 8, 20);
                            }
                        }
                    }
                }
            }
        }

        const initCity = () => {
            buildings = [];
            // Create layers
            for (let i = 0; i < buildingCount; i++) {
                buildings.push(new Building());
            }
            // Sort by Z (far to near) so we draw back-to-front
            buildings.sort((a, b) => b.z - a.z);
        };

        const animate = () => {
            // Smooth camera movement
            targetX += (mouseX - targetX) * 0.05;
            targetY += (mouseY - targetY) * 0.05;

            // Clear with dark night sky
            const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
            gradient.addColorStop(0, '#020617'); // slate-950
            gradient.addColorStop(1, '#0f172a'); // slate-900
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw Stars
            ctx.fillStyle = '#ffffff';
            for (let i = 0; i < 50; i++) {
                const sx = (Math.sin(i * 132.1) * canvas.width + Date.now() * 0.02) % canvas.width;
                const sy = (Math.cos(i * 53.7) * canvas.height) % (canvas.height / 2);
                ctx.globalAlpha = Math.random();
                ctx.fillRect(Math.abs(sx), Math.abs(sy), 2, 2);
            }
            ctx.globalAlpha = 1;

            // Draw Buildings with Parallax
            // Offset logic: Mouse left -> Grid moves right (Camera moves left)
            const camX = targetX * 100;
            const camY = targetY * 20;

            buildings.forEach(b => b.draw(-camX, -camY));

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
        <div className="relative min-h-screen overflow-hidden bg-slate-950">
            <canvas
                ref={canvasRef}
                className="absolute inset-0 z-0"
            />
            {/* Dark overlay for better text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent z-0 pointer-events-none"></div>

            <div className="relative z-10 w-full h-full">
                {children}
            </div>
        </div>
    );
}
