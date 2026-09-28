import React, { useState, useEffect, useRef } from 'react';

export interface BackgroundScene {
  id: string;
  name: string;
  url: string;
}

export const AUTH_SCENES: BackgroundScene[] = [
  {
    id: 'server-room',
    name: 'Hạ tầng Máy chủ Datacenter',
    url: '/backgrounds/bg-server-room.jpg',
  },
  {
    id: 'cyber-hq',
    name: 'Trung tâm Điều hành NOC',
    url: '/backgrounds/bg-cyber-hq.jpg',
  },
  {
    id: 'cyber-soc',
    name: 'Giám sát An ninh SOC',
    url: '/backgrounds/bg-cyber-soc.jpg',
  },
];

interface BackgroundSlideProps {
  scene: BackgroundScene;
  isActive: boolean;
}

const BackgroundSlide: React.FC<BackgroundSlideProps> = ({ scene, isActive }) => {
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    if (isActive) {
      setAnimKey((prev) => prev + 1);
    }
  }, [isActive]);

  return (
    <div
      className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden select-none"
      style={{
        opacity: isActive ? 1 : 0,
        zIndex: isActive ? 1 : 0,
        transition: 'opacity 1600ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}
      aria-hidden={!isActive}
    >
      <img
        key={animKey}
        src={scene.url}
        alt={scene.name}
        className={`w-full h-full object-cover select-none pointer-events-none ${
          isActive ? 'auth-bg-zoom-deep' : 'auth-bg-zoom-hold'
        }`}
      />
    </div>
  );
};

interface AuthBackgroundProps {
  children?: React.ReactNode;
}

export const AuthBackground: React.FC<AuthBackgroundProps> = ({ children }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % AUTH_SCENES.length);
    }, 7500);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4 py-8 bg-slate-950 select-none">
      {/* Dynamic Multi-Scene Continuous Fly-Through Layers */}
      {AUTH_SCENES.map((scene, idx) => (
        <BackgroundSlide
          key={scene.id}
          scene={scene}
          isActive={idx === activeIndex}
        />
      ))}

      {/* Cinematic Depth Tunnel Vignette */}
      <div 
        className="absolute inset-0 z-[2] pointer-events-none" 
        style={{
          background: 'radial-gradient(ellipse 90% 75% at 50% 50%, rgba(2, 6, 23, 0.15) 0%, rgba(2, 6, 23, 0.55) 60%, rgba(2, 6, 23, 0.94) 100%)'
        }}
      />
      <div className="absolute inset-0 z-[2] bg-gradient-to-b from-slate-950/70 via-slate-950/40 to-slate-950/85 pointer-events-none" />

      {/* Floating Animated Cyber Orbs */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none auth-orb-1 z-[2]" />
      <div className="absolute -bottom-24 -right-24 w-[32rem] h-[32rem] bg-indigo-600/25 rounded-full blur-3xl pointer-events-none auth-orb-2 z-[2]" />
      <div className="absolute top-1/2 left-1/4 w-80 h-80 bg-blue-500/15 rounded-full blur-3xl pointer-events-none animate-pulse z-[2]" />

      {/* Subtle Cyber Grid Accent */}
      <div className="absolute inset-0 auth-cyber-grid opacity-35 pointer-events-none z-[2]" />

      {/* Main Foreground Form / Content Card */}
      <div className="relative z-10 w-full flex justify-center">
        {children}
      </div>
    </div>
  );
};

export default AuthBackground;
