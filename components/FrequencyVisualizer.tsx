
import React, { useRef, useEffect } from 'react';

interface FrequencyVisualizerProps {
  analyser: AnalyserNode | null;
  isActive: boolean;
}

const FrequencyVisualizer: React.FC<FrequencyVisualizerProps> = ({ analyser, isActive }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!analyser || !isActive) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    let animationId: number;

    const draw = () => {
      animationId = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / (bufferLength / 2)) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength / 2; i++) {
        barHeight = (dataArray[i] / 255) * canvas.height;

        // Gradient for bars
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
        gradient.addColorStop(0, 'rgba(34, 211, 238, 0.1)');
        gradient.addColorStop(0.5, 'rgba(34, 211, 238, 0.4)');
        gradient.addColorStop(1, 'rgba(34, 211, 238, 0.8)');

        ctx.fillStyle = gradient;
        
        // Draw centered bars
        const centerY = canvas.height / 2;
        ctx.fillRect(x, centerY - barHeight / 2, barWidth - 1, barHeight);

        x += barWidth + 1;
      }
    };

    draw();
    return () => cancelAnimationFrame(animationId);
  }, [analyser, isActive]);

  return (
    <div className="w-full max-w-xl h-24 opacity-40 mask-linear-fade">
      <canvas 
        ref={canvasRef} 
        width={800} 
        height={100} 
        className="w-full h-full"
      />
      <style>{`
        .mask-linear-fade {
          mask-image: linear-gradient(to right, transparent, black 15%, black 85%, transparent);
        }
      `}</style>
    </div>
  );
};

export default FrequencyVisualizer;
