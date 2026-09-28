import React from 'react';
import { Bot } from 'lucide-react';

interface FullScreenLoaderProps {
  message?: string;
  subMessage?: string;
}

export const FullScreenLoader: React.FC<FullScreenLoaderProps> = ({
  message = 'Đang tải dữ liệu...',
  subMessage = 'Vui lòng chờ trong giây lát'
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md transition-all duration-300">
      <div className="flex flex-col items-center max-w-sm px-8 py-8 rounded-3xl bg-white/95 dark:bg-slate-900/95 shadow-2xl border border-indigo-100/80 dark:border-slate-800 text-center animate-in zoom-in-95 duration-200">
        
        {/* Animated Modern Tech Logo Container */}
        <div className="relative mb-6 flex items-center justify-center">
          {/* Pulsing ambient glow rings */}
          <div className="absolute w-28 h-28 rounded-full bg-indigo-500/15 animate-ping opacity-60" />
          <div className="absolute w-32 h-32 rounded-full bg-purple-500/10 animate-pulse" />
          
          {/* High-tech rotating gradient ring */}
          <div className="w-20 h-20 rounded-full border-[3px] border-indigo-100 dark:border-indigo-950 border-t-indigo-600 border-r-purple-500 animate-spin flex items-center justify-center shadow-inner" />
          
          {/* Beautiful Gradient Badge & Robot Icon */}
          <div className="absolute w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/30 overflow-hidden group">
            <div className="relative w-full h-full flex items-center justify-center">
              {/* Shimmer light pass */}
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <img 
                src="/avatar/AI_support.svg" 
                alt="AI Support" 
                className="w-11 h-11 object-contain drop-shadow-sm transition-transform hover:scale-110"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
              <div className="hidden w-full h-full items-center justify-center text-white">
                <Bot className="w-8 h-8 text-white animate-bounce" />
              </div>
            </div>
          </div>
        </div>

        {/* Text descriptions */}
        <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 tracking-tight">
          {message}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 font-medium">
          {subMessage}
        </p>

        {/* Modern Progress Bar Animation */}
        <div className="w-48 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-5 shadow-inner">
          <div 
            className="h-full rounded-full w-full" 
            style={{
              backgroundImage: 'linear-gradient(90deg, #4f46e5 0%, #a855f7 50%, #4f46e5 100%)',
              backgroundSize: '200% 100%',
              animation: 'loader-beam 1.4s linear infinite'
            }}
          />
        </div>
      </div>
      <style>{`
        @keyframes loader-beam {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
};
