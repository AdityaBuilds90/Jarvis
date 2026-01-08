
export enum JarvisState {
  IDLE = 'IDLE',
  LISTENING = 'LISTENING',
  THINKING = 'THINKING',
  SPEAKING = 'SPEAKING',
  ERROR = 'ERROR',
  GENERATING = 'GENERATING'
}

export interface Message {
  role: 'user' | 'jarvis';
  text: string;
  timestamp: number;
}

export interface Asset {
  id: string;
  type: 'image' | 'code' | 'website';
  content: string; // base64 for image, raw text for code, URL for website
  title?: string;
  language?: string;
  timestamp: number;
}
