import React, { useState, useRef } from 'react';
import { Upload, PenTool, Camera as CameraIcon, Trash2, Send, Eraser, Undo, Redo, Download, Sparkles, Image as ImageIcon, CheckCircle2 } from 'lucide-react';
import DrawingCanvas from './components/DrawingCanvas';
import CameraCapture from './components/CameraCapture';
import ResultsPanel from './components/ResultsPanel';
import ChatInterface from './components/ChatInterface';
import BhashaLogo from './components/BhashaLogo';
import { analyzeHandwriting } from './services/geminiService';
import { RecognitionResult, InputMode, CanvasRef } from './types';

const App: React.FC = () => {
  const [inputMode, setInputMode] = useState<InputMode>(InputMode.DRAW);
  const [result, setResult] = useState<RecognitionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Canvas State
  const canvasRef = useRef<CanvasRef>(null);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [brushSize, setBrushSize] = useState(4);
  const [brushColor] = useState('#ffffff'); 
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);

  const handleAnalyze = async (imageData: string | null) => {
    if (!imageData) return;
    
    setIsLoading(true);
    setResult(null);
    
    try {
      const data = await analyzeHandwriting(imageData);
      setResult(data);
    } catch (error) {
      console.error("Analysis failed", error);
    } finally {
      setIsLoading(false);
    }
  };

  const onCanvasSubmit = () => {
    const dataUrl = canvasRef.current?.getDataUrl();
    handleAnalyze(dataUrl || null);
  };

  const onClearCanvas = () => {
    canvasRef.current?.clear();
    setResult(null);
  };

  const onUndoCanvas = () => {
    canvasRef.current?.undo();
  };

  const onRedoCanvas = () => {
    canvasRef.current?.redo();
  };

  const onDownloadCanvas = () => {
    const dataUrl = canvasRef.current?.getDataUrl();
    if (dataUrl) {
      const link = document.createElement('a');
      link.download = `bhasha-sketch-${Date.now()}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setUploadedImage(result);
        handleAnalyze(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCameraCapture = (imageData: string) => {
    handleAnalyze(imageData);
  };

  return (
    <div className="min-h-screen text-slate-200 font-sans selection:bg-cyan-500/30">
      
      {/* Hidden Input always rendered to preserve ref and prevent errors */}
      <input 
        type="file" 
        ref={fileInputRef}
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Floating Island Header */}
      <div className="fixed top-6 left-0 right-0 z-50 flex justify-center">
        <header className="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-full px-6 py-3 shadow-2xl flex items-center gap-8 animate-slide-up">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8">
              <BhashaLogo className="w-full h-full text-cyan-400" />
            </div>
            <h1 className="font-bold text-white text-lg tracking-tight flex items-center">
              BHASHA<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-violet-500">LLM</span>
            </h1>
          </div>
          
          <div className="hidden md:flex h-4 w-px bg-white/10"></div>
          
          <div className="hidden md:flex items-center gap-2">
             <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">v5.3.0 Pro</span>
             </div>
          </div>
        </header>
      </div>

      <main className="max-w-[1600px] mx-auto px-6 pt-28 pb-12">
        
        {/* Top Section: Split Grid (Input | Output) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          
          {/* LEFT: Input Column */}
          <div className="glass-panel rounded-3xl overflow-hidden flex flex-col h-[700px] shadow-[0_0_40px_-10px_rgba(0,0,0,0.3)] animate-fade-in group hover:border-white/10 transition-colors duration-500">
            
            {/* Tab Navigation - Segmented Control */}
            <div className="p-2 bg-black/20 backdrop-blur-md">
              <div className="flex bg-white/5 rounded-2xl p-1 relative">
                {[
                  { id: InputMode.DRAW, icon: PenTool, label: 'Sketch' },
                  { id: InputMode.UPLOAD, icon: ImageIcon, label: 'Upload' },
                  { id: InputMode.CAMERA, icon: CameraIcon, label: 'Camera' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setInputMode(tab.id);
                      setResult(null);
                      setUploadedImage(null);
                    }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-xl transition-all relative z-10 ${
                      inputMode === tab.id 
                        ? 'text-white shadow-lg bg-slate-800/80 border border-white/10' 
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                    }`}
                  >
                    <tab.icon size={16} className={inputMode === tab.id ? 'text-cyan-400' : ''} />
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Input Content Area */}
            <div className="flex-1 relative bg-[#0f172a]/40 overflow-hidden">
              {inputMode === InputMode.DRAW && (
                <div className="h-full flex flex-col">
                  {/* Floating Toolbar */}
                  <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between pointer-events-none">
                    <div className="glass-card rounded-xl p-1 pointer-events-auto flex gap-1 shadow-lg">
                      <button 
                        onClick={() => setTool('pen')}
                        className={`p-2.5 rounded-lg transition-all ${tool === 'pen' ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/50' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                      >
                        <PenTool size={18} />
                      </button>
                      <button 
                        onClick={() => setTool('eraser')}
                        className={`p-2.5 rounded-lg transition-all ${tool === 'eraser' ? 'bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/50' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                      >
                        <Eraser size={18} />
                      </button>
                    </div>

                    <div className="glass-card rounded-xl px-4 py-2 pointer-events-auto flex items-center gap-3 shadow-lg">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Size</span>
                      <input 
                        type="range" 
                        min="2" 
                        max="20" 
                        value={brushSize} 
                        onChange={(e) => setBrushSize(Number(e.target.value))}
                        className="w-24 accent-cyan-500 h-1 bg-slate-700 rounded-full appearance-none cursor-pointer"
                      />
                    </div>

                    <div className="glass-card rounded-xl p-1 pointer-events-auto flex gap-1 shadow-lg">
                      <button onClick={onUndoCanvas} className="p-2.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg" title="Undo">
                        <Undo size={18} />
                      </button>
                      <button onClick={onRedoCanvas} className="p-2.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg" title="Redo">
                        <Redo size={18} />
                      </button>
                      <div className="w-px h-6 bg-white/10 my-auto mx-1"></div>
                      <button onClick={onDownloadCanvas} className="p-2.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg" title="Download">
                        <Download size={18} />
                      </button>
                    </div>
                  </div>

                  {/* Canvas */}
                  <div className="flex-1 relative cursor-crosshair m-4 rounded-2xl overflow-hidden border border-white/5 shadow-inner"> 
                     <DrawingCanvas 
                        ref={canvasRef} 
                        tool={tool}
                        brushSize={brushSize}
                        color={brushColor}
                        isAnalyzing={isLoading}
                      />
                  </div>
                  
                  {/* Action Footer */}
                  <div className="p-4 pt-0 flex gap-4">
                    <button 
                      onClick={onClearCanvas}
                      className="px-5 py-3 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl text-sm font-medium transition-colors border border-white/5 hover:border-red-500/20"
                    >
                      Clear Board
                    </button>
                    <button 
                      onClick={onCanvasSubmit}
                      disabled={isLoading}
                      className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 text-white rounded-xl text-sm font-bold tracking-wide transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-900/20 active:scale-[0.98] border border-white/10"
                    >
                      {isLoading ? (
                        <span className="flex items-center gap-2"><Sparkles className="animate-spin w-4 h-4" /> Analyzing...</span>
                      ) : (
                        <>
                          <Send size={16} />
                          Analyze Text
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {inputMode === InputMode.UPLOAD && (
                <div className="h-full flex flex-col items-center justify-center p-8 relative">
                  
                  {uploadedImage ? (
                    <div className="relative w-full h-full flex items-center justify-center rounded-2xl border border-white/10 bg-black/20 backdrop-blur overflow-hidden">
                      <img src={uploadedImage} alt="Uploaded" className="max-w-full max-h-full object-contain shadow-2xl" />
                      <button 
                        onClick={() => { 
                          setUploadedImage(null); 
                          if (fileInputRef.current) fileInputRef.current.value = ''; 
                        }}
                        className="absolute top-4 right-4 bg-black/60 text-white p-2 rounded-full hover:bg-red-500/80 transition-colors backdrop-blur border border-white/10"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  ) : (
                    <div className="text-center w-full h-full border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all group">
                      <div className="w-20 h-20 bg-gradient-to-br from-slate-800 to-slate-900 rounded-full flex items-center justify-center mb-6 border border-white/10 text-slate-400 group-hover:text-cyan-400 group-hover:scale-110 transition-all shadow-xl">
                        <Upload size={32} />
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2">Upload Image</h3>
                      <p className="text-slate-500 text-sm mb-8">Supports PNG, JPG, or WEBP</p>
                      
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="px-8 py-3 bg-white text-slate-900 hover:bg-cyan-50 rounded-xl font-bold transition-colors shadow-lg shadow-white/10"
                      >
                        Select File
                      </button>
                    </div>
                  )}
                </div>
              )}

              {inputMode === InputMode.CAMERA && (
                <div className="h-full bg-black">
                  <CameraCapture onCapture={handleCameraCapture} />
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Output Column */}
          <div className="glass-panel rounded-3xl overflow-hidden flex flex-col h-[700px] shadow-[0_0_40px_-10px_rgba(0,0,0,0.3)] hover:border-white/10 transition-colors duration-500">
             <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-black/20">
               <h3 className="font-bold text-slate-200 flex items-center gap-2 text-sm tracking-wide">
                 <BhashaLogo className="text-cyan-400 w-5 h-5" />
                 ANALYSIS RESULTS
               </h3>
               {result && (
                 <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.2)] animate-fade-in">
                   <CheckCircle2 size={10} />
                   COMPLETE
                 </span>
               )}
             </div>
             
             <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                <ResultsPanel result={result} isLoading={isLoading} />
             </div>
          </div>
        </div>

        {/* BOTTOM: Full Width Chat */}
        <div className="w-full animate-slide-up">
          <ChatInterface 
            contextText={result?.recognizedText || ''} 
            initialSuggestions={result?.suggestedQuestions || []} 
          />
        </div>

      </main>
    </div>
  );
};

export default App;