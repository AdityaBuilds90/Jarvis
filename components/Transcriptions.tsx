
import React from 'react';
import { Message } from '../types';

interface TranscriptionsProps {
  messages: Message[];
  currentInput: string;
  currentOutput: string;
}

const Transcriptions: React.FC<TranscriptionsProps> = ({ messages, currentInput, currentOutput }) => {
  return (
    <div className="fixed bottom-32 left-1/2 -translate-x-1/2 w-full max-w-2xl px-6 pointer-events-none">
      <div className="flex flex-col gap-4 text-center">
        {/* Active Model Output */}
        {currentOutput && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <p className="text-xl md:text-2xl font-light text-cyan-100 drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] leading-relaxed">
              {currentOutput}
            </p>
          </div>
        )}

        {/* Active User Input */}
        {currentInput && (
          <div className="animate-in fade-in slide-in-from-bottom-1 duration-200">
            <p className="text-sm md:text-base font-medium text-cyan-400/80 uppercase tracking-widest">
              {currentInput}
            </p>
          </div>
        )}

        {/* Short History */}
        {!currentInput && !currentOutput && messages.length > 0 && (
          <div className="opacity-40 hover:opacity-100 transition-opacity">
            <p className="text-sm text-cyan-500/60 font-medium tracking-wide">
              {messages[messages.length - 1].text}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Transcriptions;
