import React, { useState, useRef, useEffect } from 'react';
import { Upload, PenTool, Camera as CameraIcon, Trash2, Send, Eraser, Undo, Redo, Download, Sparkles, Image as ImageIcon, CheckCircle2, MessageSquare, ArrowRight, ArrowLeft, ChevronDown } from 'lucide-react';
import DrawingCanvas from './components/DrawingCanvas';
import CameraCapture from './components/CameraCapture';
import ResultsPanel from './components/ResultsPanel';
import ChatInterface from './components/ChatInterface';
import BhashaLogo from './components/BhashaLogo';
import { analyzeHandwriting } from './services/geminiService';
import { RecognitionResult, InputMode, CanvasRef } from './types';

// New State to handle the 4 phases: Input -> Analysis -> Chat -> All Active
type AppStep = 'INPUT' | 'ANALYSIS' | 'CHAT' | 'ALL';

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>('INPUT');
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

  // Section Refs for scrolling
  const inputSectionRef = useRef<HTMLDivElement>(null);
  const analysisSectionRef = useRef<HTMLDivElement>(null);
  const chatSectionRef = useRef<HTMLDivElement>(null);

  // Track previous step to only scroll on meaningful transitions
  const prevStepRef = useRef<AppStep>(step);
  // Track last analyzed image data to prevent re-analyzing the same image
  const lastAnalyzedImageRef = useRef<string | null>(null);
  
  // Scroll to active section when step changes (only for guided phases)
  // Only scroll when transitioning from INPUT to ANALYSIS or ANALYSIS to CHAT
  // Don't scroll when just switching input modes or when already in a step
  // DISABLED: Don't auto-scroll to prevent unwanted scrolling when clicking buttons
  useEffect(() => {
    // Disable auto-scroll completely - let users control their own scrolling
    prevStepRef.current = step;
  }, [step]);

  const handleAnalyze = async (imageData: string | null) => {
    if (!imageData) {
      console.warn("handleAnalyze: No image data provided");
      return;
    }
    
    // Only analyze if this is a different image than the last one analyzed
    // Use a hash of the first and last parts of the image data for quick comparison
    const imageHash = imageData.length > 100 
      ? imageData.substring(0, 50) + imageData.substring(imageData.length - 50)
      : imageData;
    
    if (lastAnalyzedImageRef.current === imageHash) {
      console.log("handleAnalyze: Same image detected, skipping analysis");
      return; // Don't re-analyze the same image
    }
    
    console.log("handleAnalyze: Starting analysis", {
      imageDataLength: imageData.length,
      imageDataType: imageData.substring(0, 30),
      timestamp: new Date().toISOString()
    });
    
    // Mark this image as analyzed
    lastAnalyzedImageRef.current = imageHash;
    
    // Transition to Phase 2: Analysis Active (only if not already in ALL mode)
    if (step !== 'ALL') {
      setStep('ANALYSIS');
    }
    setIsLoading(true);
    setResult(null);
    
    try {
      console.log("handleAnalyze: Calling analyzeHandwriting API...");
      const data = await analyzeHandwriting(imageData);
      console.log("handleAnalyze: API response received", {
        recognizedText: data.recognizedText?.substring(0, 50) || "empty",
        confidence: data.confidence,
        bhashaInsightsCount: data.bhashaInsights?.length || 0,
        processingTime: data.processingTimeMs
      });
      setResult(data);
      // Only transition to CHAT if not already in ALL mode
      if (step !== 'ALL') {
        setStep('CHAT');
      }
    } catch (error: any) {
      console.error("Analysis failed", error);
      // Set error result so user can see what went wrong
      setResult({
        recognizedText: error?.message || "Analysis failed. Check console for details.",
        confidence: 0,
        isQuestion: false,
        bhashaInsights: [],
        suggestedQuestions: [],
        candidates: [],
        processingTimeMs: 0,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onCanvasSubmit = () => {
    const dataUrl = canvasRef.current?.getDataUrl();
    console.log("onCanvasSubmit: Canvas data URL", {
      hasDataUrl: !!dataUrl,
      dataUrlLength: dataUrl?.length || 0,
      source: "DRAWING_CANVAS"
    });
    handleAnalyze(dataUrl || null);
  };

  const onClearCanvas = () => {
    canvasRef.current?.clear();
    // Don't clear result - keep analysis and chat active
    // Result will only be cleared when a new analysis is performed
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
    e.preventDefault();
    e.stopPropagation();
    const file = e.target.files?.[0];
    if (file) {
      console.log("handleFileUpload: File selected", {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        source: "FILE_UPLOAD"
      });
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        console.log("handleFileUpload: File read complete", {
          resultLength: result?.length || 0,
          resultType: result?.substring(0, 30)
        });
        setUploadedImage(result);
        // Don't automatically analyze - let user preview first
      };
      reader.onerror = (error) => {
        console.error("handleFileUpload: FileReader error", error);
      };
      reader.readAsDataURL(file);
    } else {
      console.warn("handleFileUpload: No file selected");
    }
  };

  const handleUploadSubmit = () => {
    if (uploadedImage) {
      console.log("handleUploadSubmit: Submitting uploaded image for analysis");
      handleAnalyze(uploadedImage);
    }
  };

  const handleCameraCapture = (imageData: string) => {
    console.log("handleCameraCapture: Camera image captured", {
      imageDataLength: imageData?.length || 0,
      imageDataType: imageData?.substring(0, 30),
      source: "CAMERA_CAPTURE"
    });
    handleAnalyze(imageData);
  };

  // Triggered when user engages with chat - Unlocks all sections (Phase 4)
  const handleChatInteraction = () => {
    if (step === 'CHAT') {
        setStep('ALL');
    }
  };

  // Helper to determine if a section is active
  const isSectionActive = (section: 'INPUT' | 'ANALYSIS' | 'CHAT') => {
    if (step === 'ALL') return true;
    // INPUT section should ALWAYS be active - users should always be able to switch between input modes
    if (section === 'INPUT') return true;
    // Keep sections active if results are present (for ANALYSIS and CHAT)
    if (result && !isLoading && (section === 'ANALYSIS' || section === 'CHAT')) return true;
    return step === section;
  }

  // Helper to calculate dynamic height based on content
  const getDynamicHeight = (section: 'INPUT' | 'ANALYSIS' | 'CHAT') => {
    if (section === 'CHAT') {
      const messageCount = result ? 2 : 0; // Approximate message count
      const baseHeight = 500;
      const contextHeight = result?.recognizedText ? 80 : 0;
      return Math.min(Math.max(baseHeight + contextHeight + (messageCount * 50), 500), 900);
    }
    if (section === 'ANALYSIS') {
      const textLength = result?.recognizedText?.length || 0;
      const insightsCount = result?.bhashaInsights?.length || 0;
      const baseHeight = 400;
      const textHeight = Math.min(textLength * 0.5, 200); // Max 200px for text
      const insightsHeight = insightsCount * 150; // ~150px per insight
      return Math.min(Math.max(baseHeight + textHeight + insightsHeight, 500), 900);
    }
    return 650; // Default for INPUT
  };

  // Helper to get section styling
  const getSectionStyles = (section: 'INPUT' | 'ANALYSIS' | 'CHAT') => {
    const active = isSectionActive(section);
    const dynamicHeight = getDynamicHeight(section);
    return `transition-all duration-700 ease-in-out transform border rounded-3xl overflow-hidden relative shadow-2xl
      ${active 
        ? 'opacity-100 scale-100 shadow-[0_0_50px_-10px_rgba(139,69,19,0.15)] border-amber-700/30 grayscale-0 z-10' 
        : 'opacity-40 scale-[0.98] shadow-none border-white/5 grayscale pointer-events-none'
      }`;
  };

  // Helper to get heading text
  const getHeadingText = (section: 'INPUT' | 'ANALYSIS' | 'CHAT') => {
    const active = isSectionActive(section);
    const baseText = {
        'INPUT': '🟤 Input Section',
        'ANALYSIS': '🟡 Analysis Result',
        'CHAT': '🟢 Chatbot Section'
    }[section];
    
    return (
        <span className="flex items-center gap-3">
            {baseText}
            <span className={`text-xs uppercase tracking-widest font-bold px-2 py-0.5 rounded-md border ${
                active 
                ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' 
                : 'text-amber-100/60 bg-amber-950/30 border-amber-900/30'
            }`}>
                {active ? '(active)' : '(inactive)'}
            </span>
        </span>
    );
  };

  return (
    <div className="min-h-screen text-amber-50 font-sans selection:bg-amber-600/30 pb-32">
      
      {/* Hidden Input */}
      <input 
        type="file" 
        ref={fileInputRef}
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Header */}
      <div className="fixed top-6 left-0 right-0 z-50 flex justify-center pointer-events-none">
        <header className="pointer-events-auto bg-amber-950/40 backdrop-blur-xl border border-amber-800/20 rounded-full px-6 py-3 shadow-2xl flex items-center gap-8 animate-slide-up">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8">
              <BhashaLogo className="w-full h-full text-amber-500" />
            </div>
            <h1 className="font-bold text-white text-lg tracking-tight flex items-center">
              BHASHA<span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-amber-800">LLM</span>
            </h1>
          </div>
        </header>
      </div>

      {/* Main Grid Layout */}
      <main className="max-w-[1600px] mx-auto px-6 pt-32 space-y-8 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-8">
        
        {/* ROW 1: INPUT SECTION (FULL WIDTH) */}
        <div ref={inputSectionRef} className="col-span-1 lg:col-span-2">
           <h2 className={`text-xl font-bold mb-4 flex items-center gap-2 transition-colors duration-500 ${isSectionActive('INPUT') ? 'text-amber-400' : 'text-amber-200/50'}`}>
              {getHeadingText('INPUT')}
           </h2>
           <div className={getSectionStyles('INPUT')}>
                <div className="glass-panel overflow-hidden flex flex-col h-full">
                
                {/* Tab Navigation */}
                <div className="p-2 bg-amber-900/20 backdrop-blur-md">
                    <div className="flex bg-amber-800/20 rounded-2xl p-1 relative">
                    {[
                        { id: InputMode.DRAW, icon: PenTool, label: 'Sketch' },
                        { id: InputMode.UPLOAD, icon: ImageIcon, label: 'Upload' },
                        { id: InputMode.CAMERA, icon: CameraIcon, label: 'Camera' }
                    ].map((tab) => (
                        <button
                        key={tab.id}
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setInputMode(tab.id);
                            setUploadedImage(null);
                            // Don't reset result or step when switching input modes
                            // Keep chat and analysis active - only reset on new analysis
                        }}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-xl transition-all relative z-10 ${
                            inputMode === tab.id 
                            ? 'text-amber-50 shadow-lg bg-amber-700/60 border border-amber-600/30' 
                            : 'text-amber-200/70 hover:text-amber-50 hover:bg-amber-800/30'
                        }`}
                        >
                        <tab.icon size={16} className={inputMode === tab.id ? 'text-amber-300' : 'text-amber-200/60'} />
                        {tab.label}
                        </button>
                    ))}
                    </div>
                </div>

                {/* Input Content */}
                <div className="flex-1 relative bg-[#1a0f05]/40 overflow-hidden">
                    {inputMode === InputMode.DRAW && (
                    <div className="h-full flex flex-col">
                        {/* Toolbar */}
                        <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between pointer-events-none">
                        <div className="glass-card rounded-xl p-1 pointer-events-auto flex gap-1 shadow-lg">
                            <button 
                            type="button"
                            tabIndex={-1}
                            onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setTool('pen');
                                // Immediately blur to prevent focus and scroll
                                if (e.currentTarget instanceof HTMLElement) {
                                    e.currentTarget.blur();
                                }
                            }}
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (e.currentTarget instanceof HTMLElement) {
                                    e.currentTarget.blur();
                                }
                            }}
                            onFocus={(e) => {
                                e.preventDefault();
                                if (e.currentTarget instanceof HTMLElement) {
                                    e.currentTarget.blur();
                                }
                            }}
                            className={`p-2.5 rounded-lg transition-all ${tool === 'pen' ? 'bg-amber-600/20 text-amber-300 ring-1 ring-amber-600/50' : 'text-amber-200/60 hover:text-amber-50 hover:bg-amber-800/20'}`}
                            >
                            <PenTool size={18} />
                            </button>
                            <button 
                            type="button"
                            tabIndex={-1}
                            onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setTool('eraser');
                                // Immediately blur to prevent focus and scroll
                                if (e.currentTarget instanceof HTMLElement) {
                                    e.currentTarget.blur();
                                }
                            }}
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (e.currentTarget instanceof HTMLElement) {
                                    e.currentTarget.blur();
                                }
                            }}
                            onFocus={(e) => {
                                e.preventDefault();
                                if (e.currentTarget instanceof HTMLElement) {
                                    e.currentTarget.blur();
                                }
                            }}
                            className={`p-2.5 rounded-lg transition-all ${tool === 'eraser' ? 'bg-amber-800/20 text-amber-300 ring-1 ring-amber-800/50' : 'text-amber-200/60 hover:text-amber-50 hover:bg-amber-800/20'}`}
                            >
                            <Eraser size={18} />
                            </button>
                        </div>

                        <div className="glass-card rounded-xl px-4 py-2 pointer-events-auto flex items-center gap-3 shadow-lg">
                            <span className="text-[10px] text-amber-200/80 font-bold uppercase tracking-wider">Size</span>
                            <input 
                            type="range" 
                            min="2" 
                            max="20" 
                            value={brushSize} 
                            tabIndex={-1}
                            onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                // Immediately blur to prevent focus and scroll
                                if (e.target instanceof HTMLElement) {
                                    e.target.blur();
                                }
                            }}
                            onChange={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const newValue = Number(e.target.value);
                                setBrushSize(newValue);
                                // Blur after change
                                if (e.target instanceof HTMLElement) {
                                    e.target.blur();
                                }
                            }}
                            onInput={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const newValue = Number((e.target as HTMLInputElement).value);
                                setBrushSize(newValue);
                                // Blur after input
                                if (e.target instanceof HTMLElement) {
                                    e.target.blur();
                                }
                            }}
                            onMouseUp={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (e.target instanceof HTMLElement) {
                                    e.target.blur();
                                }
                            }}
                            onFocus={(e) => {
                                e.preventDefault();
                                if (e.target instanceof HTMLElement) {
                                    e.target.blur();
                                }
                            }}
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (e.target instanceof HTMLElement) {
                                    e.target.blur();
                                }
                            }}
                            className="w-24 accent-amber-600 h-1 bg-amber-900/40 rounded-full appearance-none cursor-pointer"
                            />
                        </div>

                        <div className="glass-card rounded-xl p-1 pointer-events-auto flex gap-1 shadow-lg">
                            <button 
                            type="button"
                            tabIndex={-1}
                            onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onUndoCanvas();
                                // Immediately blur to prevent focus and scroll
                                if (e.currentTarget instanceof HTMLElement) {
                                    e.currentTarget.blur();
                                }
                            }}
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (e.currentTarget instanceof HTMLElement) {
                                    e.currentTarget.blur();
                                }
                            }}
                            onFocus={(e) => {
                                e.preventDefault();
                                if (e.currentTarget instanceof HTMLElement) {
                                    e.currentTarget.blur();
                                }
                            }}
                            className="p-2.5 text-amber-200/60 hover:text-amber-50 hover:bg-amber-800/20 rounded-lg" 
                            title="Undo">
                            <Undo size={18} />
                            </button>
                            <button 
                            type="button"
                            tabIndex={-1}
                            onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onRedoCanvas();
                                // Immediately blur to prevent focus and scroll
                                if (e.currentTarget instanceof HTMLElement) {
                                    e.currentTarget.blur();
                                }
                            }}
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (e.currentTarget instanceof HTMLElement) {
                                    e.currentTarget.blur();
                                }
                            }}
                            onFocus={(e) => {
                                e.preventDefault();
                                if (e.currentTarget instanceof HTMLElement) {
                                    e.currentTarget.blur();
                                }
                            }}
                            className="p-2.5 text-amber-200/60 hover:text-amber-50 hover:bg-amber-800/20 rounded-lg" 
                            title="Redo">
                            <Redo size={18} />
                            </button>
                            <div className="w-px h-6 bg-amber-700/30 my-auto mx-1"></div>
                            <button 
                            type="button"
                            tabIndex={-1}
                            onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onDownloadCanvas();
                                // Immediately blur to prevent focus and scroll
                                if (e.currentTarget instanceof HTMLElement) {
                                    e.currentTarget.blur();
                                }
                            }}
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (e.currentTarget instanceof HTMLElement) {
                                    e.currentTarget.blur();
                                }
                            }}
                            onFocus={(e) => {
                                e.preventDefault();
                                if (e.currentTarget instanceof HTMLElement) {
                                    e.currentTarget.blur();
                                }
                            }}
                            className="p-2.5 text-amber-200/60 hover:text-amber-50 hover:bg-amber-800/20 rounded-lg" 
                            title="Download">
                            <Download size={18} />
                            </button>
                        </div>
                        </div>

                        {/* Canvas */}
                        <div 
                            className="flex-1 relative cursor-crosshair m-4 rounded-2xl overflow-hidden border border-white/5 shadow-inner"
                            onWheel={(e) => {
                                // Prevent page scroll when scrolling over canvas area
                                e.stopPropagation();
                            }}
                        > 
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
                            type="button"
                            tabIndex={-1}
                            onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onClearCanvas();
                                // Immediately blur to prevent focus and scroll
                                if (e.currentTarget instanceof HTMLElement) {
                                    e.currentTarget.blur();
                                }
                            }}
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (e.currentTarget instanceof HTMLElement) {
                                    e.currentTarget.blur();
                                }
                            }}
                            onFocus={(e) => {
                                e.preventDefault();
                                if (e.currentTarget instanceof HTMLElement) {
                                    e.currentTarget.blur();
                                }
                            }}
                            className="px-5 py-3 text-amber-200/70 hover:text-red-400 hover:bg-red-500/10 rounded-xl text-sm font-medium transition-colors border border-amber-800/20 hover:border-red-500/20"
                        >
                            Clear Board
                        </button>
                        <button 
                            type="button"
                            tabIndex={-1}
                            onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                // Prevent focus immediately on mousedown
                                if (e.currentTarget instanceof HTMLElement) {
                                    e.currentTarget.blur();
                                }
                            }}
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (!isLoading) {
                                    onCanvasSubmit();
                                }
                                // Ensure blur after click
                                if (e.currentTarget instanceof HTMLElement) {
                                    e.currentTarget.blur();
                                }
                            }}
                            onFocus={(e) => {
                                // Immediately remove focus if it somehow gets focused
                                e.preventDefault();
                                if (e.currentTarget instanceof HTMLElement) {
                                    e.currentTarget.blur();
                                }
                            }}
                            disabled={isLoading}
                            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-700 to-amber-900 hover:from-amber-600 hover:to-amber-800 text-white rounded-xl text-sm font-bold tracking-wide transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-900/20 active:scale-[0.98] border border-white/10"
                        >
                            {isLoading ? (
                            <span className="flex items-center gap-2"><Sparkles className="animate-spin w-4 h-4" /> Processing...</span>
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
                        <div className="w-full h-full flex flex-col">
                            <div className="relative flex-1 flex items-center justify-center rounded-2xl border border-white/10 bg-black/20 backdrop-blur overflow-hidden mb-4">
                                <img src={uploadedImage} alt="Uploaded" className="max-w-full max-h-full object-contain shadow-2xl" />
                                <button
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setUploadedImage(null);
                                    if (fileInputRef.current) fileInputRef.current.value = '';
                                }}
                                className="absolute top-4 right-4 bg-black/60 text-white p-2 rounded-full hover:bg-red-500/80 transition-colors backdrop-blur border border-white/10"
                                >
                                <Trash2 size={20} />
                                </button>
                            </div>
                            <div className="flex gap-4">
                                <button
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setUploadedImage(null);
                                    if (fileInputRef.current) fileInputRef.current.value = '';
                                }}
                                className="px-5 py-3 text-amber-200/70 hover:text-red-400 hover:bg-red-500/10 rounded-xl text-sm font-medium transition-colors border border-amber-800/20 hover:border-red-500/20"
                                >
                                Clear Image
                                </button>
                                <button
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (!isLoading) {
                                        handleUploadSubmit();
                                    }
                                }}
                                disabled={isLoading}
                                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-700 to-amber-900 hover:from-amber-600 hover:to-amber-800 text-white rounded-xl text-sm font-bold tracking-wide transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-900/20 active:scale-[0.98] border border-white/10"
                                >
                                    {isLoading ? (
                                    <span className="flex items-center gap-2"><Sparkles className="animate-spin w-4 h-4" /> Processing...</span>
                                    ) : (
                                    <>
                                        <Send size={16} />
                                        Analyze Text
                                    </>
                                    )}
                                </button>
                            </div>
                        </div>
                        ) : (
                        <div className="text-center w-full h-full border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center hover:border-amber-600/50 hover:bg-amber-600/5 transition-all group">
                            <div className="w-20 h-20 bg-gradient-to-br from-amber-800 to-amber-900 rounded-full flex items-center justify-center mb-6 border border-amber-700/30 text-amber-200/70 group-hover:text-amber-400 group-hover:scale-110 transition-all shadow-xl">
                            <Upload size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-amber-50 mb-2">Upload Image</h3>
                            <p className="text-amber-200/80 text-sm mb-8">Supports PNG, JPG, or WEBP</p>
                            
                            <button 
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                fileInputRef.current?.click();
                            }}
                            className="px-8 py-3 bg-white text-amber-950 hover:bg-amber-50 rounded-xl font-bold transition-colors shadow-lg shadow-white/10"
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
           </div>
        </div>

        {/* ROW 2 LEFT: CHATBOT SECTION */}
        <div ref={chatSectionRef} className="col-span-1">
            <h2 className={`text-xl font-bold mb-4 flex items-center gap-2 transition-colors duration-500 ${isSectionActive('CHAT') ? 'text-amber-400' : 'text-amber-200/50'}`}>
               {getHeadingText('CHAT')}
            </h2>
            <div className={getSectionStyles('CHAT')} style={{ height: `${getDynamicHeight('CHAT')}px` }}>
                <div className="glass-panel overflow-hidden flex flex-col h-full">
                    <ChatInterface 
                        contextText={result?.recognizedText || ''} 
                        initialSuggestions={result?.suggestedQuestions || []} 
                        onInteraction={handleChatInteraction}
                    />
                </div>
            </div>
        </div>

        {/* ROW 2 RIGHT: ANALYSIS SECTION */}
        <div ref={analysisSectionRef} className="col-span-1">
            <h2 className={`text-xl font-bold mb-4 flex items-center gap-2 transition-colors duration-500 ${isSectionActive('ANALYSIS') ? 'text-amber-500' : 'text-amber-200/50'}`}>
               {getHeadingText('ANALYSIS')}
            </h2>
            <div className={getSectionStyles('ANALYSIS')} style={{ height: `${getDynamicHeight('ANALYSIS')}px` }}>
                <div className="glass-panel overflow-hidden flex flex-col h-full shadow-[0_0_40px_-10px_rgba(0,0,0,0.3)]">
                    {/* Analysis Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-black/20">
                        <div className="flex items-center gap-3">
                            <h3 className="font-bold text-amber-50 flex items-center gap-2 text-sm tracking-wide">
                            <BhashaLogo className="text-amber-500 w-5 h-5" />
                            ANALYSIS RESULTS
                            </h3>
                        </div>
                        {result && (
                        <span className="flex items-center gap-1.5 text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20 shadow-[0_0_10px_rgba(217,119,6,0.2)] animate-fade-in">
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
        </div>

      </main>
    </div>
  );
};

export default App;
