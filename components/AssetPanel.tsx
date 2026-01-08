
import React, { useState } from 'react';
import { Asset } from '../types';
import { X, ExternalLink, Code, Image as ImageIcon, Download, Globe, Maximize2 } from 'lucide-react';

interface AssetPanelProps {
  assets: Asset[];
  onClose: () => void;
  isOpen: boolean;
}

const AssetPanel: React.FC<AssetPanelProps> = ({ assets, onClose, isOpen }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!isOpen && assets.length === 0) return null;

  return (
    <div className={`fixed right-0 top-0 h-full bg-slate-900/90 backdrop-blur-2xl border-l border-cyan-500/30 transition-all duration-500 z-50 ${isOpen ? 'translate-x-0' : 'translate-x-full'} ${expandedId ? 'w-full md:w-[80vw]' : 'w-full md:w-96'}`}>
      <div className="p-6 h-full flex flex-col">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <h3 className="text-sm font-bold tracking-widest text-cyan-400 uppercase">System Output Log</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar">
          {assets.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-600 text-center px-8">
              <div className="w-16 h-16 border border-dashed border-slate-800 rounded-full flex items-center justify-center mb-4">
                <Globe className="w-6 h-6" />
              </div>
              <p className="text-xs uppercase tracking-widest">Awaiting system instructions...</p>
            </div>
          ) : (
            assets.map((asset) => (
              <div key={asset.id} className={`group relative bg-slate-950/50 border border-slate-800 rounded-xl overflow-hidden hover:border-cyan-500/50 transition-all ${expandedId === asset.id ? 'min-h-[600px]' : ''}`}>
                <div className="p-3 border-b border-slate-800 bg-slate-900/30 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    {asset.type === 'image' && <ImageIcon className="w-3 h-3 text-cyan-400" />}
                    {asset.type === 'code' && <Code className="w-3 h-3 text-cyan-400" />}
                    {asset.type === 'website' && <Globe className="w-3 h-3 text-cyan-400" />}
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter truncate max-w-[150px]">{asset.title || asset.type}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setExpandedId(expandedId === asset.id ? null : asset.id)}
                      className="p-1 hover:text-cyan-400 transition-colors"
                    >
                      <Maximize2 className="w-3 h-3" />
                    </button>
                    <span className="text-[9px] text-slate-600">{new Date(asset.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>

                <div className="p-4 h-full">
                  {asset.type === 'image' ? (
                    <div className="relative aspect-square rounded-lg overflow-hidden bg-slate-900">
                      <img src={asset.content} alt={asset.title} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                         <a href={asset.content} download={`jarvis-${asset.id}.png`} className="p-2 bg-cyan-500 rounded-full text-slate-950">
                           <Download className="w-4 h-4" />
                         </a>
                      </div>
                    </div>
                  ) : asset.type === 'code' ? (
                    <div className="relative">
                      <pre className="text-[11px] font-mono text-cyan-100/80 overflow-x-auto p-3 bg-slate-900 rounded-lg leading-relaxed whitespace-pre-wrap">
                        <code>{asset.content}</code>
                      </pre>
                      <button 
                        onClick={() => navigator.clipboard.writeText(asset.content)}
                        className="absolute top-2 right-2 p-1.5 bg-slate-800/80 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-cyan-500 hover:text-slate-950"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 h-full min-h-[400px]">
                      <div className="flex items-center gap-2 bg-slate-900 p-2 rounded text-[10px] font-mono text-slate-500 overflow-hidden">
                        <Globe className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{asset.content}</span>
                        <a href={asset.content} target="_blank" rel="noopener noreferrer" className="ml-auto text-cyan-400 hover:underline">
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <div className="flex-1 bg-white rounded-lg overflow-hidden border border-slate-800 h-full">
                        <iframe 
                          src={asset.content} 
                          className="w-full h-full border-none"
                          title={asset.title}
                          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #0891b2; }
      `}</style>
    </div>
  );
};

export default AssetPanel;
