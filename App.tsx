
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from '@google/genai';
import { Mic, MicOff, Power, Info, Volume2, Volume1, VolumeX, Database, ShieldCheck, SlidersHorizontal, UserCircle2, ChevronUp } from 'lucide-react';
import JarvisFace from './components/JarvisFace';
import Background from './components/Background';
import Transcriptions from './components/Transcriptions';
import AssetPanel from './components/AssetPanel';
import FrequencyVisualizer from './components/FrequencyVisualizer';
import { JarvisState, Message, Asset } from './types';

// Available voices in Gemini Live API
const AVAILABLE_VOICES = ['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr'];

// Audio Helpers
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const TOOLS: FunctionDeclaration[] = [
  {
    name: 'open_url',
    description: 'Displays a website or application URL on the screen for the student.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        url: { type: Type.STRING, description: 'The full URL to display' },
        description: { type: Type.STRING, description: 'Brief description of what is being displayed' }
      },
      required: ['url']
    }
  },
  {
    name: 'generate_image',
    description: 'Generates an educational or illustrative image based on a prompt.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        prompt: { type: Type.STRING, description: 'Detailed visual description for the image' },
        title: { type: Type.STRING, description: 'Title for the image asset' }
      },
      required: ['prompt']
    }
  },
  {
    name: 'create_snippet',
    description: 'Creates a formatted code snippet or text document for the student to copy.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        content: { type: Type.STRING, description: 'The source code or text content' },
        language: { type: Type.STRING, description: 'The programming language (e.g., python, javascript)' },
        title: { type: Type.STRING, description: 'Filename or title' }
      },
      required: ['content', 'title']
    }
  },
  {
    name: 'get_site_state',
    description: 'Returns the current state of the Jarvis interface, including active assets and conversation history.',
    parameters: {
      type: Type.OBJECT,
      properties: {}
    }
  },
  {
    name: 'control_interface',
    description: 'Directly controls the UI elements of the website.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: { 
          type: Type.STRING, 
          description: 'The action to perform: "open_panel", "close_panel", "clear_assets", "reset_face"' 
        }
      },
      required: ['action']
    }
  }
];

const App: React.FC = () => {
  const [state, setState] = useState<JarvisState>(JarvisState.IDLE);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [currentOutput, setCurrentOutput] = useState('');
  const [inputVolume, setInputVolume] = useState(0);
  const [outputVolume, setOutputVolume] = useState(0);
  const [systemVolume, setSystemVolume] = useState(0.7);
  const [selectedVoice, setSelectedVoice] = useState('Kore');
  const [isVoiceMenuOpen, setIsVoiceMenuOpen] = useState(false);
  
  // Asset Management
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  // Refs for Tool access to state
  const assetsRef = useRef<Asset[]>([]);
  const messagesRef = useRef<Message[]>([]);
  useEffect(() => { assetsRef.current = assets; }, [assets]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // Refs for hardware
  const audioContextsRef = useRef<{ input: AudioContext; output: AudioContext } | null>(null);
  const outputGainRef = useRef<GainNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  const sessionRef = useRef<any>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const currentInputRef = useRef('');
  const currentOutputRef = useRef('');

  useEffect(() => {
    if (outputGainRef.current) {
      outputGainRef.current.gain.setTargetAtTime(systemVolume, 0, 0.05);
    }
  }, [systemVolume]);

  const cleanupSession = useCallback(() => {
    if (sessionRef.current) {
      try { sessionRef.current.close(); } catch(e) {}
      sessionRef.current = null;
    }
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
    sourcesRef.current.clear();
    setIsConnected(false);
    setState(JarvisState.IDLE);
    setInputVolume(0);
    setOutputVolume(0);
  }, []);

  useEffect(() => {
    let animationFrame: number;
    const updateVolumes = () => {
      if (outputAnalyserRef.current) {
        const dataArray = new Uint8Array(outputAnalyserRef.current.frequencyBinCount);
        outputAnalyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length;
        setOutputVolume(Math.min(1, avg / 128));
      }
      animationFrame = requestAnimationFrame(updateVolumes);
    };
    updateVolumes();
    return () => cancelAnimationFrame(animationFrame);
  }, []);

  const handleToolCall = async (fc: any, session: any) => {
    console.log("Jarvis tool call:", fc.name, fc.args);
    let result: any = "Action completed successfully.";

    try {
      if (fc.name === 'open_url') {
        const asset: Asset = {
          id: Math.random().toString(36).substr(2, 9),
          type: 'website',
          content: fc.args.url,
          title: fc.args.description || 'Web Resource',
          timestamp: Date.now()
        };
        setAssets(prev => [asset, ...prev]);
        setIsPanelOpen(true);
        result = `Displaying web resource: ${fc.args.url}`;
      } else if (fc.name === 'generate_image') {
        setState(JarvisState.GENERATING);
        setIsPanelOpen(true);
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: { parts: [{ text: fc.args.prompt }] },
        });

        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            const asset: Asset = {
              id: Math.random().toString(36).substr(2, 9),
              type: 'image',
              content: `data:image/png;base64,${part.inlineData.data}`,
              title: fc.args.title || 'Generated Illustration',
              timestamp: Date.now()
            };
            setAssets(prev => [asset, ...prev]);
            result = "Image generated and displayed in the asset panel.";
            break;
          }
        }
        setState(JarvisState.LISTENING);
      } else if (fc.name === 'create_snippet') {
        const asset: Asset = {
          id: Math.random().toString(36).substr(2, 9),
          type: 'code',
          content: fc.args.content,
          title: fc.args.title,
          language: fc.args.language,
          timestamp: Date.now()
        };
        setAssets(prev => [asset, ...prev]);
        setIsPanelOpen(true);
        result = "Code snippet created and logged.";
      } else if (fc.name === 'get_site_state') {
        result = {
          assets_count: assetsRef.current.length,
          recent_messages_count: messagesRef.current.length,
          active_ui_panel: isPanelOpen ? 'Asset Panel Open' : 'Asset Panel Closed',
          system_status: 'Optimal',
          environment: 'Web Browser Interface (React)'
        };
      } else if (fc.name === 'control_interface') {
        switch (fc.args.action) {
          case 'open_panel': setIsPanelOpen(true); break;
          case 'close_panel': setIsPanelOpen(false); break;
          case 'clear_assets': setAssets([]); break;
          case 'reset_face': setState(JarvisState.IDLE); break;
        }
        result = `Action ${fc.args.action} executed on system core.`;
      }
    } catch (err) {
      console.error("Tool execution failed:", err);
      result = "Failed to execute tool.";
    }

    session.sendToolResponse({
      functionResponses: { id: fc.id, name: fc.name, response: { result } }
    });
  };

  const startSession = async () => {
    try {
      const apiKey = process.env.API_KEY;
      if (!apiKey) return setState(JarvisState.ERROR);

      const ai = new GoogleGenAI({ apiKey });

      if (!audioContextsRef.current) {
        const inputCtx = new AudioContext({ sampleRate: 16000 });
        const outputCtx = new AudioContext({ sampleRate: 24000 });
        const gainNode = outputCtx.createGain();
        gainNode.gain.value = systemVolume;
        const analyser = outputCtx.createAnalyser();
        analyser.fftSize = 512;
        gainNode.connect(analyser);
        analyser.connect(outputCtx.destination);
        audioContextsRef.current = { input: inputCtx, output: outputCtx };
        outputGainRef.current = gainNode;
        outputAnalyserRef.current = analyser;
      }

      const { input: inputAudioContext, output: outputAudioContext } = audioContextsRef.current;
      await inputAudioContext.resume();
      await outputAudioContext.resume();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice } } },
          systemInstruction: 'You are Jarvis, the resident intelligence. You can view the site state, control the UI, display websites, generate images, and write code. You have administrative access to this system.',
          outputAudioTranscription: {},
          inputAudioTranscription: {},
          tools: [{ functionDeclarations: TOOLS }]
        },
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            setState(JarvisState.LISTENING);
            const source = inputAudioContext.createMediaStreamSource(stream);
            const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              let sum = 0;
              for(let i=0; i<inputData.length; i++) sum += inputData[i] * inputData[i];
              setInputVolume(Math.min(1, Math.sqrt(sum / inputData.length) * 10));
              const l = inputData.length;
              const int16 = new Int16Array(l);
              for (let i = 0; i < l; i++) int16[i] = inputData[i] * 32768;
              const pcmBlob = { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
              sessionPromise.then(s => s.sendRealtimeInput({ media: pcmBlob }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContext.destination);
            scriptProcessorRef.current = scriptProcessor;
          },
          onmessage: async (message: LiveServerMessage) => {
            try {
              if (message.toolCall) {
                const session = await sessionPromise;
                for (const fc of message.toolCall.functionCalls) {
                  await handleToolCall(fc, session);
                }
              }

              if (message.serverContent?.outputTranscription) {
                currentOutputRef.current += message.serverContent.outputTranscription.text;
                setCurrentOutput(currentOutputRef.current);
                setState(JarvisState.SPEAKING);
              } else if (message.serverContent?.inputTranscription) {
                currentInputRef.current += message.serverContent.inputTranscription.text;
                setCurrentInput(currentInputRef.current);
                setState(JarvisState.THINKING);
              }

              if (message.serverContent?.turnComplete) {
                const fullInput = currentInputRef.current;
                const fullOutput = currentOutputRef.current;
                if (fullInput || fullOutput) {
                  setMessages(prev => [...prev, { role: 'user' as const, text: fullInput, timestamp: Date.now() }, { role: 'jarvis' as const, text: fullOutput, timestamp: Date.now() }].slice(-10));
                }
                currentInputRef.current = ''; currentOutputRef.current = '';
                setCurrentInput(''); setCurrentOutput('');
                setState(JarvisState.LISTENING);
              }

              const parts = message.serverContent?.modelTurn?.parts;
              if (parts) {
                for (const part of parts) {
                  if (part.inlineData?.data && outputGainRef.current) {
                    nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContext.currentTime);
                    const buffer = await decodeAudioData(decode(part.inlineData.data), outputAudioContext, 24000, 1);
                    const source = outputAudioContext.createBufferSource();
                    source.buffer = buffer;
                    source.connect(outputGainRef.current);
                    source.addEventListener('ended', () => sourcesRef.current.delete(source));
                    source.start(nextStartTimeRef.current);
                    nextStartTimeRef.current += buffer.duration;
                    sourcesRef.current.add(source);
                  }
                }
              }

              if (message.serverContent?.interrupted) {
                sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
                sourcesRef.current.clear();
                nextStartTimeRef.current = 0; setOutputVolume(0);
              }
            } catch (msgErr) { console.error("Msg Error:", msgErr); }
          },
          onerror: (e) => { setState(JarvisState.ERROR); cleanupSession(); },
          onclose: () => cleanupSession()
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err) { setState(JarvisState.ERROR); }
  };

  const toggleConnection = useCallback(() => {
    if (isConnected) cleanupSession();
    else startSession();
  }, [isConnected, cleanupSession, startSession]);

  return (
    <div className="relative min-h-screen w-full text-slate-100 flex flex-col items-center justify-center p-6 overflow-hidden">
      <Background />

      <header className="fixed top-0 left-0 right-0 p-8 flex justify-between items-start pointer-events-none z-40">
        <div className="flex flex-col gap-1 pointer-events-auto">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tighter text-cyan-400">JARVIS</h1>
            <ShieldCheck className="w-4 h-4 text-cyan-500/50" />
          </div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-widest">Global Admin Access</p>
        </div>
        
        <div className="flex gap-4 pointer-events-auto">
          <button 
            onClick={() => setIsPanelOpen(!isPanelOpen)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all ${assets.length > 0 ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-400' : 'bg-slate-900/50 border-slate-800 text-slate-400'}`}
          >
            <Database className={`w-4 h-4 ${state === JarvisState.GENERATING ? 'animate-spin' : ''}`} />
            <span className="text-[10px] font-bold tracking-widest uppercase">Nodes ({assets.length})</span>
          </button>
        </div>
      </header>

      <main className="flex flex-col items-center justify-center gap-8 z-10 w-full max-w-4xl transition-all duration-500" style={{ transform: isPanelOpen ? 'translateX(-20%)' : 'none' }}>
        <div className="relative group cursor-pointer" onClick={toggleConnection}>
          <JarvisFace 
            state={state} 
            volumeLevel={state === JarvisState.SPEAKING ? outputVolume : inputVolume} 
          />
          {!isConnected && state !== JarvisState.ERROR && (
            <div className="absolute inset-0 flex flex-col items-center justify-center animate-pulse opacity-60">
              <Power className="w-12 h-12 text-cyan-400 mb-2" />
              <span className="text-xs font-bold text-cyan-400 tracking-[0.2em] uppercase">Initialize Link</span>
            </div>
          )}
        </div>

        <FrequencyVisualizer analyser={outputAnalyserRef.current} isActive={state === JarvisState.SPEAKING} />

        <div className="text-center space-y-4 max-w-lg">
          <h2 className="text-3xl font-light tracking-tight text-slate-200">
            {state === JarvisState.GENERATING ? "Accessing Core..." : state === JarvisState.ERROR ? "Uplink Error" : isConnected ? (state === JarvisState.SPEAKING ? "Transmitting..." : "Monitoring...") : "Jarvis Dormant"}
          </h2>
        </div>
      </main>

      <Transcriptions messages={messages} currentInput={currentInput} currentOutput={currentOutput} />
      
      <AssetPanel assets={assets} isOpen={isPanelOpen} onClose={() => setIsPanelOpen(false)} />

      <footer className="fixed bottom-12 left-0 right-0 flex justify-center z-20 px-8">
        <div className="flex items-center gap-6 bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-2 pl-6 pr-2 rounded-full">
          
          {/* Voice Selector Group */}
          <div className="relative flex items-center group/voice">
            <button 
              onClick={() => setIsVoiceMenuOpen(!isVoiceMenuOpen)}
              className="flex items-center gap-2 p-1.5 px-3 rounded-full hover:bg-slate-800 transition-colors text-slate-400 hover:text-cyan-400"
            >
              <UserCircle2 className="w-5 h-5" />
              <span className="text-[10px] font-bold uppercase tracking-tighter hidden md:block">{selectedVoice}</span>
              <ChevronUp className={`w-3 h-3 transition-transform ${isVoiceMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {isVoiceMenuOpen && (
              <div className="absolute bottom-full mb-4 left-0 bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-xl overflow-hidden shadow-2xl min-w-[120px] animate-in slide-in-from-bottom-2 duration-200">
                <div className="p-2 border-b border-slate-800 bg-slate-950/50">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 px-2">Select Persona</span>
                </div>
                {AVAILABLE_VOICES.map((voice) => (
                  <button
                    key={voice}
                    onClick={() => {
                      setSelectedVoice(voice);
                      setIsVoiceMenuOpen(false);
                      if (isConnected) {
                        // Notify user that change requires reconnection
                        setCurrentOutput("Voice persona will update upon system reconnection.");
                        setTimeout(() => setCurrentOutput(""), 3000);
                      }
                    }}
                    className={`w-full text-left px-4 py-2 text-[11px] font-medium transition-all hover:bg-cyan-500/10 hover:text-cyan-400 ${selectedVoice === voice ? 'text-cyan-400 bg-cyan-500/5' : 'text-slate-400'}`}
                  >
                    {voice}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="w-px h-6 bg-slate-800" />

          {/* Volume Control Group */}
          <div className="flex items-center gap-4 group/vol">
            <div className="text-slate-500 group-hover/vol:text-cyan-400 transition-colors">
              {systemVolume === 0 ? <VolumeX className="w-5 h-5" /> : systemVolume < 0.5 ? <Volume1 className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </div>
            <div className="w-24 md:w-32 h-1.5 bg-slate-800 rounded-full relative overflow-hidden flex items-center">
              <input 
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={systemVolume}
                onChange={(e) => setSystemVolume(parseFloat(e.target.value))}
                className="absolute inset-0 opacity-0 cursor-pointer z-10"
              />
              <div 
                className="h-full bg-cyan-500 shadow-[0_0_10px_rgba(34,211,238,0.5)] transition-all duration-75" 
                style={{ width: `${systemVolume * 100}%` }}
              />
            </div>
          </div>

          <div className="w-px h-8 bg-slate-800" />

          <button 
            onClick={toggleConnection}
            className={`flex items-center gap-3 px-6 py-3 rounded-full font-bold transition-all ${isConnected ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-cyan-500 text-slate-950 shadow-[0_0_20px_rgba(34,211,238,0.4)]'}`}
          >
            {isConnected ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            <span className="uppercase text-[11px] tracking-widest">{isConnected ? 'Offline' : 'Uplink'}</span>
          </button>
        </div>
      </footer>
    </div>
  );
};

export default App;
