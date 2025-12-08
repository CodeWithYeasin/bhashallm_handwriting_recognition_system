import React, { useRef, useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { CanvasRef } from '../types';
import { History, ChevronRight, Clock, RotateCcw } from 'lucide-react';

interface DrawingCanvasProps {
  tool: 'pen' | 'eraser';
  brushSize: number;
  color: string;
  isAnalyzing?: boolean;
}

interface HistoryState {
  id: number;
  imageData: ImageData;
  thumbnail: string;
  timestamp: number;
}

const DrawingCanvas = forwardRef<CanvasRef, DrawingCanvasProps>(({ tool, brushSize, color, isAnalyzing }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  
  // State for Visual History
  const [historyStack, setHistoryStack] = useState<HistoryState[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);

  // Keep track of props for resize logic
  const propsRef = useRef({ tool, brushSize, color });

  useEffect(() => {
    propsRef.current = { tool, brushSize, color };
    if (contextRef.current) {
        contextRef.current.lineWidth = brushSize;
        contextRef.current.strokeStyle = tool === 'eraser' ? '#1a0f05' : color;
    }
  }, [tool, brushSize, color]);

  // Capture the current state of the canvas
  const saveSnapshot = () => {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    if (!canvas || !ctx) return;

    // Get raw pixel data for efficient restore
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Get Data URL for UI thumbnail
    const thumbnail = canvas.toDataURL('image/png', 0.1); // Low quality for thumbnail speed

    const newState: HistoryState = {
      id: Date.now(),
      imageData,
      thumbnail,
      timestamp: Date.now()
    };

    setHistoryStack(prev => {
      // If we are in the middle of the stack and draw, truncate future history
      const newStack = prev.slice(0, currentIndex + 1);
      return [...newStack, newState];
    });
    setCurrentIndex(prev => prev + 1);
  };

  // Restore a specific state
  const restoreSnapshot = (index: number) => {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    const state = historyStack[index];

    if (canvas && ctx && state) {
      ctx.putImageData(state.imageData, 0, 0);
      setCurrentIndex(index);
    }
  };

  // Initialize Canvas & Resize Logic
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const handleResize = () => {
      const { width, height } = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      
      if (canvas.width === width * dpr && canvas.height === height * dpr) return;

      // Temp save content
      let tempCanvas: HTMLCanvasElement | null = null;
      if (canvas.width > 0 && canvas.height > 0) {
        tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        tempCanvas.getContext('2d')?.drawImage(canvas, 0, 0);
      }

      canvas.width = width * dpr;
      canvas.height = height * dpr;

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        const p = propsRef.current;
        ctx.lineWidth = p.brushSize;
        ctx.strokeStyle = p.tool === 'eraser' ? '#1a0f05' : p.color;

        // Fill background
        ctx.fillStyle = '#1a0f05';
        ctx.fillRect(0, 0, width, height);
        
        // Restore Image
        if (tempCanvas) {
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.drawImage(tempCanvas, 0, 0);
            ctx.restore();
        } else if (historyStack.length === 0) {
           // Initial blank state
           saveSnapshot();
        } else if (currentIndex >= 0 && historyStack[currentIndex]) {
           // Restore current active state after resize if exists
           // Note: simple putImageData stretches on resize, sophisticated apps strictly scale.
           // For this demo, we re-apply the last pixel data (which might be smaller/larger).
           // A better approach for resize is re-drawing paths, but pixel-based is standard for basic canvas.
           ctx.putImageData(historyStack[currentIndex].imageData, 0, 0);
        }
        
        contextRef.current = ctx;
      }
    };

    handleResize();
    const observer = new ResizeObserver(handleResize);
    observer.observe(container);
    
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array to run once on mount (and rely on refs)

  useImperativeHandle(ref, () => ({
    clear: () => {
      const canvas = canvasRef.current;
      const ctx = contextRef.current;
      const container = containerRef.current;
      if (canvas && ctx && container) {
        ctx.fillStyle = '#1a0f05'; 
        const { width, height } = container.getBoundingClientRect();
        ctx.fillRect(0, 0, width, height);
        saveSnapshot();
      }
    },
    undo: () => {
      if (currentIndex > 0) {
        restoreSnapshot(currentIndex - 1);
      }
    },
    redo: () => {
      if (currentIndex < historyStack.length - 1) {
        restoreSnapshot(currentIndex + 1);
      }
    },
    getDataUrl: () => {
      return canvasRef.current?.toDataURL('image/png') || null;
    }
  }));

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (isAnalyzing) return; 
    const { offsetX, offsetY } = getCoordinates(e);
    contextRef.current?.beginPath();
    contextRef.current?.moveTo(offsetX, offsetY);
    setIsDrawing(true);
  };

  const finishDrawing = () => {
    if (isDrawing) {
      contextRef.current?.closePath();
      setIsDrawing(false);
      saveSnapshot();
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || isAnalyzing) return;
    e.preventDefault();
    const { offsetX, offsetY } = getCoordinates(e);
    contextRef.current?.lineTo(offsetX, offsetY);
    contextRef.current?.stroke();
  };

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    if (!canvasRef.current) return { offsetX: 0, offsetY: 0 };
    
    if ('touches' in e) {
      const rect = canvasRef.current.getBoundingClientRect();
      const touch = e.touches[0];
      return {
        offsetX: touch.clientX - rect.left,
        offsetY: touch.clientY - rect.top
      };
    } else {
      return {
        offsetX: (e as React.MouseEvent).nativeEvent.offsetX,
        offsetY: (e as React.MouseEvent).nativeEvent.offsetY
      };
    }
  };

  return (
    <div ref={containerRef} className={`w-full h-full relative overflow-hidden group/canvas`}>
      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseUp={finishDrawing}
        onMouseMove={draw}
        onMouseLeave={finishDrawing}
        onTouchStart={startDrawing}
        onTouchEnd={finishDrawing}
        onTouchMove={draw}
        className={`touch-none block w-full h-full ${isAnalyzing ? 'cursor-wait' : ''}`}
      />
      
      {/* Visual History Toggle - Positioned at top-24 to avoid overlapping with toolbar (Undo/Redo) */}
      <div className="absolute top-24 right-4 z-20">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsHistoryOpen(!isHistoryOpen);
          }}
          className={`p-2.5 rounded-xl backdrop-blur-md transition-all border shadow-lg ${
            isHistoryOpen 
              ? 'bg-amber-600/20 text-amber-300 border-amber-600/30' 
              : 'bg-amber-900/20 text-amber-200/60 border-amber-700/20 hover:bg-amber-800/30 hover:text-amber-50'
          }`}
          title="Toggle History"
        >
           <History size={18} />
        </button>
      </div>

      {/* History Sidebar - Floating panel style that starts below the top toolbar */}
      <div 
        className={`absolute top-24 right-4 bottom-4 w-36 bg-[#0b0c0e]/95 border border-white/10 rounded-2xl backdrop-blur-xl z-30 transition-transform duration-300 ease-in-out flex flex-col shadow-2xl ${
          isHistoryOpen ? 'translate-x-0' : 'translate-x-[120%]'
        }`}
      >
        <div className="p-3 border-b border-white/10 flex items-center justify-between">
           <span className="text-[10px] font-bold uppercase tracking-widest text-amber-200/70 flex items-center gap-1">
             <Clock size={10} /> History
           </span>
           <button 
             type="button"
             onClick={(e) => {
               e.preventDefault();
               e.stopPropagation();
               setIsHistoryOpen(false);
             }} 
             className="text-amber-200/70 hover:text-amber-50">
             <ChevronRight size={16} />
           </button>
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
           {historyStack.map((state, idx) => (
             <button
               key={state.id}
               type="button"
               onClick={(e) => {
                 e.preventDefault();
                 e.stopPropagation();
                 restoreSnapshot(idx);
               }}
               className={`w-full group relative flex flex-col items-center gap-1 p-1 rounded-lg border transition-all ${
                 currentIndex === idx 
                   ? 'bg-white/10 border-amber-600/50 shadow-[0_0_10px_rgba(217,119,6,0.1)]' 
                   : 'bg-black/20 border-transparent hover:border-white/10 hover:bg-white/5'
               }`}
             >
               <div className="w-full aspect-video bg-[#1a0f05] rounded overflow-hidden relative">
                 <img src={state.thumbnail} alt={`Step ${idx}`} className="w-full h-full object-contain opacity-80 group-hover:opacity-100 transition-opacity" />
                 {idx === 0 && (
                   <span className="absolute top-0.5 left-0.5 text-[8px] bg-amber-900/40 text-amber-200/70 px-1 rounded">Start</span>
                 )}
               </div>
               <span className={`text-[9px] font-mono ${currentIndex === idx ? 'text-amber-400' : 'text-amber-200/50'}`}>
                 Step {idx + 1}
               </span>
               
               {/* Active Indicator */}
               {currentIndex === idx && (
                 <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-amber-600 rounded-r-full shadow-[0_0_10px_rgba(217,119,6,0.8)]"></div>
               )}
             </button>
           ))}
           {historyStack.length === 0 && (
             <div className="text-center p-4">
               <RotateCcw size={16} className="mx-auto text-amber-200/40 mb-2" />
               <p className="text-[10px] text-amber-200/50">Start drawing to create history</p>
             </div>
           )}
        </div>
      </div>
      
      {isAnalyzing && (
        <div className="absolute inset-0 pointer-events-none z-10">
           <div className="absolute inset-0 bg-[linear-gradient(rgba(217,119,6,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(217,119,6,0.1)_1px,transparent_1px)] bg-[size:40px_40px] opacity-50"></div>
           <div className="absolute top-0 left-0 w-full h-1 bg-amber-600 shadow-[0_0_15px_rgba(217,119,6,0.8)] animate-scan">
              <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-t from-amber-600/20 to-transparent"></div>
           </div>
           <div className="absolute inset-0 border-2 border-amber-600/30 animate-pulse rounded-2xl"></div>
        </div>
      )}
    </div>
  );
});

DrawingCanvas.displayName = 'DrawingCanvas';
export default DrawingCanvas;