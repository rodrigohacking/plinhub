
import React, { useEffect, useRef } from 'react';

export function Background3D({ children }) {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        let animationFrameId;

        // Scene Config: NIGHT GOLD THEME
        const CONFIG = {
            focalLength: 400,
            cameraY: 150,
            speed: 4,
            skyColorTop: '#020617',    // slate-950 (Deep Night)
            skyColorBottom: '#1e293b', // slate-800
            buildingBaseColor: '#0f172a', // slate-900 (Silhouette)
            buildingStroke: '#334155',    // slate-700 (Subtle edge)
            windowColor: 'rgba(253, 41, 94,', // #FD295E (Pink) base for windows
            starCount: 100
        };

        let buildings = [];
        let stars = [];

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            CONFIG.focalLength = canvas.width * 0.6;
            initCity();
        };

        class Star {
            constructor() {
                this.x = Math.random() * canvas.width;
                this.y = Math.random() * canvas.height * 0.6; // Top 60% only
                this.size = Math.random() * 2;
                this.alpha = Math.random();
                this.twinkleSpeed = Math.random() * 0.02 + 0.005;
            }

            update() {
                this.alpha += this.twinkleSpeed;
                if (this.alpha > 1 || this.alpha < 0.2) this.twinkleSpeed *= -1;
            }

            draw() {
                ctx.fillStyle = `rgba(255, 255, 255, ${this.alpha})`;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        class Building {
            constructor(zParam) {
                this.x = (Math.random() - 0.5) * 8000;
                this.y = 0;
                this.z = zParam || Math.random() * 10000;
                this.width = Math.random() * 200 + 100;
                this.height = Math.random() * 800 + 200;

                // Procedural Windows
                this.windows = [];
                const floors = Math.floor(this.height / 40);
                const cols = Math.floor(this.width / 30);

                for (let f = 0; f < floors; f++) {
                    for (let c = 0; c < cols; c++) {
                        // 30% chance of a light being on (Occupancy)
                        if (Math.random() > 0.6) {
                            this.windows.push({ r: f, c: c });
                        }
                    }
                }
            }

            update() {
                this.z -= CONFIG.speed;
                if (this.z < 10) {
                    this.z = 10000;
                    this.x = (Math.random() - 0.5) * 8000;
                    this.height = Math.random() * 800 + 200;
                    // Regenerate windows
                    this.windows = [];
                    const floors = Math.floor(this.height / 40);
                    const cols = Math.floor(this.width / 30);
                    for (let f = 0; f < floors; f++) {
                        for (let c = 0; c < cols; c++) {
                            if (Math.random() > 0.6) this.windows.push({ r: f, c: c });
                        }
                    }
                }
            }

            draw() {
                const scale = CONFIG.focalLength / (CONFIG.focalLength + this.z);
                const screenX = canvas.width / 2 + this.x * scale;
                const screenY = canvas.height / 2 + (this.y + CONFIG.cameraY) * scale;
                const screenW = this.width * scale;
                const screenH = this.height * scale;

                if (scale < 0 || this.z < 10) return;

                const roofY = screenY - screenH;

                // 1. Building Body (Dark Silhouette)
                ctx.fillStyle = CONFIG.buildingBaseColor;
                ctx.strokeStyle = CONFIG.buildingStroke;
                ctx.lineWidth = 1;

                ctx.beginPath();
                ctx.rect(screenX - screenW / 2, roofY, screenW, screenH);
                ctx.fill();
                ctx.stroke();

                // 2. Windows (Glowing Amber)
                if (screenW > 10) {
                    const floorH = screenH / Math.floor(this.height / 40);
                    const colW = screenW / Math.floor(this.width / 30);

                    // Optimization: batch draw active windows? 
                    // For style, drawing rects is fast enough for < 200 buildings
                    ctx.fillStyle = CONFIG.windowColor + '0.6)'; // Base glow

                    this.windows.forEach(w => {
                        const winX = (screenX - screenW / 2) + w.c * colW + colW * 0.2;
                        const winY = roofY + w.r * floorH + floorH * 0.2;
                        const winW = colW * 0.6;
                        const winH = floorH * 0.6;

                        // Simple LOD
                        if (winW > 1) ctx.fillRect(winX, winY, winW, winH);
                    });
                }

                // 3. Roof Top (Perspective)
                ctx.fillStyle = '#020617'; // Darker top
                ctx.strokeStyle = '#334155';
                ctx.beginPath();
                ctx.moveTo(screenX - screenW / 2, roofY);
                ctx.lineTo(screenX + screenW / 2, roofY);
                ctx.lineTo(screenX + screenW * 0.4, roofY - screenW * 0.15);
                ctx.lineTo(screenX - screenW * 0.4, roofY - screenW * 0.15);
                ctx.fill();
                ctx.stroke();
            }
        }

        const initCity = () => {
            buildings = [];
            stars = [];
            for (let i = 0; i < 200; i++) {
                buildings.push(new Building(Math.random() * 10000));
            }
            for (let i = 0; i < CONFIG.starCount; i++) {
                stars.push(new Star());
            }
        };

        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // 1. Sky Gradient (Night)
            const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
            gradient.addColorStop(0, CONFIG.skyColorTop);
            gradient.addColorStop(1, CONFIG.skyColorBottom);
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // 2. Stars
            stars.forEach(s => {
                s.update();
                s.draw();
            });

            // 3. Buildings
            buildings.sort((a, b) => b.z - a.z);
            buildings.forEach(b => {
                b.update();
                b.draw();
            });

            // 4. Subtle Vignette
            const rad = canvas.width * 0.8;
            const vig = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, rad * 0.5, canvas.width / 2, canvas.height / 2, rad);
            vig.addColorStop(0, 'rgba(0,0,0,0)');
            vig.addColorStop(1, 'rgba(0,0,0,0.6)');
            ctx.fillStyle = vig;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            animationFrameId = window.requestAnimationFrame(animate);
        };

        window.addEventListener('resize', resize);
        resize();
        animate();

        return () => {
            window.removeEventListener('resize', resize);
            window.cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return (
        <div className="relative min-h-screen w-full bg-slate-950">
            <canvas
                ref={canvasRef}
                className="fixed inset-0 z-0 bg-slate-950"
            />
            <div className="relative z-10 w-full min-h-screen">
                {children}
            </div>
        </div>
    );
}
