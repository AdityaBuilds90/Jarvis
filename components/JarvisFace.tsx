
import React from 'react';
import { JarvisState } from '../types';

interface JarvisFaceProps {
  state: JarvisState;
  volumeLevel?: number; // 0 to 1
}

const JarvisFace: React.FC<JarvisFaceProps> = ({ state, volumeLevel = 0 }) => {
  const getRingProps = (index: number) => {
    let speed = 20 + index * 10;
    let opacity = 0.3 + (index * 0.1);
    let scale = 1 + (volumeLevel * 0.3);

    switch (state) {
      case JarvisState.LISTENING:
        speed = 5 + index * 2;
        opacity = 0.6;
        break;
      case JarvisState.THINKING:
        speed = 1.5 + index * 0.5;
        opacity = 0.8;
        scale = 1 + (Math.sin(Date.now() / 150) * 0.05);
        break;
      case JarvisState.SPEAKING:
        speed = 10 + index * 3;
        opacity = 0.7;
        scale = 1 + (volumeLevel * 0.6);
        break;
      case JarvisState.ERROR:
        opacity = 0.2;
        speed = 100;
        break;
      default:
        speed = 20 + index * 10;
    }

    return { speed, opacity, scale };
  };

  return (
    <div className="relative w-64 h-64 md:w-96 md:h-96 flex items-center justify-center">
      {/* Outer Glow */}
      <div className={`absolute inset-0 rounded-full blur-3xl transition-all duration-1000 ${
        state === JarvisState.ERROR ? 'bg-red-500/20' : 
        state === JarvisState.SPEAKING ? 'bg-cyan-400/20' : 'bg-cyan-500/10'
      }`} />

      {/* Rings */}
      {[0, 1, 2, 3].map((i) => {
        const { speed, opacity, scale } = getRingProps(i);
        const size = 100 - (i * 15);
        return (
          <div
            key={i}
            className="absolute rounded-full border-2 border-cyan-400 transition-all duration-150"
            style={{
              width: `${size}%`,
              height: `${size}%`,
              opacity: state === JarvisState.IDLE ? opacity * 0.5 : opacity,
              transform: `scale(${scale}) rotate(${i * 45}deg)`,
              borderStyle: i % 2 === 0 ? 'solid' : 'dashed',
              borderWidth: i === 0 ? '1px' : '2px',
              animation: `rotate ${speed}s linear infinite ${i % 2 === 0 ? 'normal' : 'reverse'}`,
              boxShadow: i === 0 ? `0 0 ${20 + volumeLevel * 30}px rgba(34, 211, 238, 0.4)` : 'none'
            }}
          />
        );
      })}

      {/* Core */}
      <div 
        className={`relative z-10 w-24 h-24 md:w-32 md:h-32 rounded-full flex items-center justify-center transition-all duration-500 ${
          state === JarvisState.ERROR ? 'bg-red-900/50' : 'bg-cyan-950/50'
        } backdrop-blur-sm border border-cyan-400/30 overflow-hidden`}
        style={{
           boxShadow: state === JarvisState.SPEAKING 
            ? `0 0 ${40 + volumeLevel * 60}px rgba(34, 211, 238, 0.8)` 
            : state === JarvisState.THINKING 
            ? '0 0 40px rgba(34, 211, 238, 0.8)' 
            : '0 0 20px rgba(34, 211, 238, 0.4)'
        }}
      >
        <div 
          className={`w-16 h-16 md:w-20 md:h-20 rounded-full transition-all duration-150 ${
            state === JarvisState.ERROR ? 'bg-red-500 shadow-[0_0_30px_rgba(239,68,68,0.8)]' : 'bg-cyan-400 shadow-[0_0_30px_rgba(34,211,238,0.6)]'
          }`}
          style={{
            transform: `scale(${1 + (volumeLevel * 0.8) + (state === JarvisState.THINKING ? Math.sin(Date.now()/100)*0.1 : 0)})`,
            filter: state === JarvisState.SPEAKING ? `brightness(${1 + volumeLevel})` : 'none'
          }}
        />
        
        {/* Core Detail Rings */}
        <div className={`absolute inset-0 border border-white/10 rounded-full ${state !== JarvisState.IDLE ? 'animate-ping' : ''}`} style={{ animationDuration: state === JarvisState.SPEAKING ? '0.5s' : '3s' }} />
      </div>

      <style>{`
        @keyframes rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default JarvisFace;
