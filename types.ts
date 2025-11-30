
export interface PredictionCandidate {
  label: string;
  probability: number;
}

export interface PoetResponse {
  poet: string;
  mood: string;
  content: string;
}

export interface RecognitionResult {
  recognizedText: string;
  confidence: number;
  isQuestion: boolean;
  bhashaInsights: PoetResponse[];
  suggestedQuestions: string[];
  candidates: PredictionCandidate[];
  processingTimeMs: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  timestamp: number;
}

export enum InputMode {
  DRAW = 'DRAW',
  UPLOAD = 'UPLOAD',
  CAMERA = 'CAMERA'
}

export interface CanvasRef {
  clear: () => void;
  undo: () => void;
  redo: () => void;
  getDataUrl: () => string | null;
}

export type ChatPersona = 'tutor' | 'analyst' | 'muse';