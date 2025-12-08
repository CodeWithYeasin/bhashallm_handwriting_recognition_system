
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, RefreshCw, XCircle, Scan, Aperture } from 'lucide-react';

interface CameraCaptureProps {
  onCapture: (imageData: string) => void;
}

const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      
      let msg = "Unable to access camera.";
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = "Camera access denied.";
      } else if (err.name === 'NotFoundError') {
        msg = "No camera device found.";
      } else if (err.name === 'NotReadableError') {
        msg = "Camera is in use by another app.";
      }
      
      setError(msg);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setIsReady(false);
    }
  }, [stream]);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = canvas.toDataURL('image/png');
        onCapture(imageData);
      }
    }
  };

  const handleVideoLoaded = () => {
    setIsReady(true);
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-black text-amber-50 p-8 text-center">
        <div className="bg-red-500/10 p-4 rounded-full mb-4 border border-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
            <XCircle size={40} className="text-red-500" />
        </div>
        <h3 className="text-lg font-bold text-amber-50 mb-2">Camera Error</h3>
        <p className="text-sm text-amber-200/80 mb-6 max-w-sm">{error}</p>
        
        {error.includes("denied") && (
          <div className="text-xs text-left bg-amber-900/20 p-4 rounded-xl border border-amber-700/20 mb-6 max-w-xs backdrop-blur-sm">
            <p className="font-bold text-amber-50 mb-2">To enable camera:</p>
            <ol className="list-decimal pl-5 space-y-1 text-amber-200/70">
              <li>Click the lock icon in the address bar</li>
              <li>Toggle Camera permission to 'Allow'</li>
              <li>Refresh the page</li>
            </ol>
          </div>
        )}

        <button 
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            startCamera();
          }}
          className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium transition-colors border border-white/10"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="relative h-full flex flex-col bg-black overflow-hidden group">
      <div className="flex-1 relative overflow-hidden flex items-center justify-center bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onLoadedMetadata={handleVideoLoaded}
          className="w-full h-full object-contain opacity-80"
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Scanner Overlay UI */}
        <div className="absolute inset-8 border border-white/20 rounded-3xl pointer-events-none">
           {/* Corners */}
           <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-amber-600 rounded-tl-xl"></div>
           <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-amber-600 rounded-tr-xl"></div>
           <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-amber-600 rounded-bl-xl"></div>
           <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-amber-600 rounded-br-xl"></div>
           
           {/* Center Crosshair */}
           <div className="absolute inset-0 flex items-center justify-center opacity-30">
              <Scan size={48} className="text-white" />
           </div>
        </div>

        {/* Loading Overlay */}
        {!isReady && !error && (
           <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-20">
             <div className="flex flex-col items-center gap-4">
               <div className="relative">
                 <div className="w-12 h-12 border-4 border-amber-600/30 border-t-amber-600 rounded-full animate-spin"></div>
                 <Aperture size={24} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-amber-600 animate-pulse" />
               </div>
               <span className="text-amber-500 text-xs font-bold tracking-widest uppercase">Initializing Sensor...</span>
             </div>
           </div>
        )}
      </div>
      
      {/* Controls Bar - Floating HUD */}
      <div className="absolute bottom-6 left-0 right-0 flex justify-center z-20">
        {isReady && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleCapture();
            }}
            className="group relative flex items-center justify-center w-20 h-20 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md transition-all focus:outline-none border border-white/20 shadow-2xl"
            title="Capture"
          >
            <div className="w-16 h-16 rounded-full border-4 border-amber-600 group-hover:bg-amber-600/20 group-hover:scale-95 transition-all"></div>
          </button>
        )}
      </div>
    </div>
  );
};

export default CameraCapture;
