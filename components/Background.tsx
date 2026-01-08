
import React from 'react';

const Background: React.FC = () => {
  return (
    <div className="fixed inset-0 -z-10 bg-slate-950 overflow-hidden">
      {/* Grid Overlay */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `linear-gradient(#1e293b 1px, transparent 1px), linear-gradient(90deg, #1e293b 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }}
      />
      
      {/* Radial Gradient Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(14,165,233,0.1)_0%,transparent_70%)]" />
      
      {/* Particle effects simulation (Static for performance, but layered) */}
      <div className="absolute inset-0">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-cyan-400 opacity-20 blur-[1px]"
            style={{
              width: Math.random() * 4 + 1 + 'px',
              height: Math.random() * 4 + 1 + 'px',
              top: Math.random() * 100 + '%',
              left: Math.random() * 100 + '%',
              animation: `pulse ${2 + Math.random() * 4}s infinite alternate ease-in-out`,
              animationDelay: `${Math.random() * 5}s`
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes pulse {
          0% { opacity: 0.1; transform: scale(1); }
          100% { opacity: 0.4; transform: scale(1.5); }
        }
      `}</style>
    </div>
  );
};

export default Background;
