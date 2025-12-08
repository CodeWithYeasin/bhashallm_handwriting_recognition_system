import React, { useState, useEffect } from 'react';
import { RecognitionResult } from '../types';
import { Clock, Feather, Activity, Quote, Type, Hash, BarChart3, ScanLine, Copy, Check, Upload, User } from 'lucide-react';
import BhashaLogo from './BhashaLogo';

interface ResultsPanelProps {
  result: RecognitionResult | null;
  isLoading: boolean;
}

// Circular Progress Component - Neon Style
const CircularGauge = ({ value, size = 60, strokeWidth = 5, color = "text-amber-600" }: { value: number; size?: number; strokeWidth?: number; color?: string }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90 w-full h-full filter drop-shadow-[0_0_5px_rgba(217,119,6,0.3)]">
        <circle
          className="text-amber-950"
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <circle
          className={`${color} transition-all duration-1000 ease-out`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-white animate-fade-in">
        <span className="text-sm font-bold font-mono tracking-tighter">{Math.round(value)}%</span>
      </div>
    </div>
  );
};

// Metric Pill Component - Glass Style
const MetricPill = ({ icon: Icon, label, value, color = "text-amber-200/70" }: { icon: any, label: string, value: string | number, color?: string }) => (
  <div className="flex flex-col items-center justify-center bg-amber-900/20 rounded-xl p-3 border border-amber-700/20 hover:border-amber-600/30 transition-all hover:bg-amber-800/30 backdrop-blur-sm group">
    <div className="flex items-center gap-1.5 mb-1 opacity-70 group-hover:opacity-100 transition-opacity">
      <Icon size={12} className={color} />
      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-200/70">{label}</span>
    </div>
    <span className="text-sm font-mono font-medium text-amber-50">{value}</span>
  </div>
);

// Poet Image Component with absolute file paths
const PoetImage = ({ poetName, className = "" }: { poetName: string; className?: string }) => {
  const [imageError, setImageError] = useState(false);

  // Reset error state when the poet name changes to ensure we try loading the new image
  useEffect(() => {
    setImageError(false);
  }, [poetName]);

  const getPoetImageUrl = (name: string) => {
    const n = name.toLowerCase();
    
    // Using absolute paths starting with / ensures we check the root public directory
    // regardless of the current path
    if (n.includes('tagore') || n.includes('rabindranath')) 
      return "/images/tagore.jpg";
    if (n.includes('nazrul') || n.includes('islam')) 
      return "/images/nazrul.jpg";
    if (n.includes('jasim') || n.includes('uddin')) 
      return "/images/jasim.jpg";
    
    return null;
  };

  const imageUrl = getPoetImageUrl(poetName);

  if (!imageUrl || imageError) {
    return (
      <div className={`${className} rounded-full bg-amber-900/40 flex items-center justify-center border-2 border-amber-800/30 group-hover:border-amber-500 transition-colors`}>
        <User size={20} className="text-amber-200/60" />
      </div>
    );
  }

  return (
    <div className={`${className} rounded-full overflow-hidden border-2 border-amber-800/30 group-hover:border-amber-500/50 transition-colors shadow-lg bg-amber-950/50`}>
      <img 
        src={imageUrl} 
        alt={poetName}
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        onError={() => {
            // Error handling silent to avoid console noise
            setImageError(true);
        }}
      />
    </div>
  );
};

const ResultsPanel: React.FC<ResultsPanelProps> = ({ result, isLoading }) => {
  const [copiedTextId, setCopiedTextId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTextId(id);
    setTimeout(() => setCopiedTextId(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="h-full flex flex-col p-2 space-y-6 animate-pulse">
        <div className="h-44 bg-white/5 rounded-2xl border border-white/5"></div>
        <div className="grid grid-cols-3 gap-3">
          <div className="h-20 bg-white/5 rounded-xl"></div>
          <div className="h-20 bg-white/5 rounded-xl"></div>
          <div className="h-20 bg-white/5 rounded-xl"></div>
        </div>
        <div className="space-y-4">
          <div className="h-32 bg-white/5 rounded-2xl"></div>
          <div className="h-32 bg-white/5 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-12 text-center">
        <div className="bg-white/5 p-8 rounded-full mb-6 border border-white/5 shadow-[0_0_30px_-5px_rgba(255,255,255,0.05)] group animate-pulse-slow">
           <BhashaLogo className="w-20 h-20 text-amber-200/50 group-hover:text-amber-500 transition-colors duration-500" />
        </div>
        <h3 className="text-xl font-bold text-amber-50 mb-2 tracking-tight">System Ready</h3>
        <p className="text-sm text-amber-200/70 max-w-xs mx-auto font-light">
          Awaiting input via sketch, upload, or camera feed.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-4">
      {/* Hero Card - Data Prism Style */}
      <div className="relative rounded-3xl overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-950 to-amber-900 opacity-90"></div>
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-amber-600/20 blur-[60px] rounded-full"></div>
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-amber-800/20 blur-[60px] rounded-full"></div>
        
        <div className="relative z-10 p-6 border border-white/10 rounded-3xl backdrop-blur-sm">
          <div className="flex items-start gap-5">
              <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className="flex items-center gap-2 text-[10px] font-bold text-amber-400 uppercase tracking-widest">
                      <ScanLine size={12} /> Recognized Content
                    </span>
                    <button 
                      onClick={() => {
                        if (result.recognizedText) {
                          handleCopy(result.recognizedText, 'main');
                        }
                      }}
                      className="text-amber-200/70 hover:text-amber-50 transition-colors"
                      title="Copy full text"
                    >
                      {copiedTextId === 'main' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    </button>
                  </div>
                  
                  <div className="mb-5 relative max-h-96 overflow-y-auto custom-scrollbar">
                     <Quote className="absolute -top-2 -left-3 text-white/5 transform -scale-x-100" size={40} />
                     <h2 className="text-base md:text-xl font-serif text-amber-50 leading-relaxed tracking-wide drop-shadow-lg break-words pl-2 select-text whitespace-pre-wrap">
                      "{result.recognizedText}"
                     </h2>
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-3 gap-2">
                    <MetricPill icon={Clock} label="Time" value={`${result.processingTimeMs}ms`} color="text-amber-400" />
                    <MetricPill icon={Type} label="Type" value={result.isQuestion ? 'Query' : 'Text'} color="text-amber-500" />
                    <MetricPill icon={Hash} label="Chars" value={result.recognizedText.length} color="text-amber-300" />
                  </div>
              </div>

              {/* Circular Gauge */}
              <div className="flex flex-col items-center gap-3 bg-black/20 p-4 rounded-2xl border border-white/5 backdrop-blur-md">
                  <CircularGauge 
                    value={result.confidence} 
                    size={70} 
                    strokeWidth={6} 
                    color={result.confidence > 80 ? "text-amber-500" : result.confidence > 50 ? "text-amber-600" : "text-red-400"} 
                  />
                  <span className="text-[10px] font-bold text-amber-200/70 uppercase tracking-widest">Confidence</span>
              </div>
          </div>
        </div>
      </div>

      {/* Structural Analysis - Tech Bars */}
      <div>
         <h4 className="text-xs font-bold text-amber-200/80 uppercase tracking-widest mb-3 px-1 flex items-center gap-2">
           <Activity size={12} className="text-amber-500" /> Structural Metrics
         </h4>
         <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Stroke Quality", val: Math.min(100, result.confidence + 5), color: "from-amber-600 to-amber-700" },
              { label: "Linearity", val: Math.min(100, result.confidence - 10), color: "from-amber-700 to-amber-800" },
              { label: "Complexity", val: Math.min(100, result.recognizedText.length * 8), color: "from-amber-800 to-amber-900" }
            ].map((m, i) => (
              <div key={i} className="glass-card rounded-xl p-3 flex flex-col gap-2">
                <div className="flex justify-between items-end">
                   <span className="text-[10px] text-amber-200/70 font-bold uppercase">{m.label}</span>
                   <span className="text-xs font-mono text-amber-50">{Math.round(m.val)}%</span>
                </div>
                <div className="h-1.5 w-full bg-amber-950/50 rounded-full overflow-hidden">
                   <div 
                     className={`h-full bg-gradient-to-r ${m.color} rounded-full`} 
                     style={{ width: `${m.val}%` }}
                   ></div>
                </div>
              </div>
            ))}
         </div>
      </div>

      {/* Literary Insights - Glass Cards with Prominent Images */}
      <div>
        <h4 className="text-xs font-bold text-amber-200/80 uppercase tracking-widest mb-3 px-1 flex items-center gap-2">
          <Feather size={12} className="text-amber-500" /> Literary Perspectives
        </h4>
        <div className="space-y-4">
          {result.bhashaInsights && result.bhashaInsights.length > 0 ? (
            result.bhashaInsights.map((insight, idx) => (
              <div 
                key={idx} 
                className="glass-card rounded-2xl p-5 border border-white/5 flex gap-5 group hover:border-white/20 hover:bg-white/5 transition-all duration-500 relative overflow-hidden"
              >
                {/* Poet Image */}
                <div className="flex-shrink-0 relative z-10">
                  <PoetImage 
                    poetName={insight.poet} 
                    className="w-16 h-16"
                  />
                </div>

                <div className="flex-1 min-w-0 flex flex-col justify-center relative z-10">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h5 className="text-base font-bold text-amber-50 truncate">{insight.poet}</h5>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-900/30 text-amber-200 border border-amber-700/30 font-medium tracking-wide">
                        {insight.mood}
                      </span>
                    </div>
                    <button 
                      onClick={() => handleCopy(insight.content, `poet-${idx}`)}
                      className="text-amber-200/60 hover:text-amber-50 transition-colors opacity-0 group-hover:opacity-100"
                      title="Copy insight"
                    >
                      {copiedTextId === `poet-${idx}` ? <Check size={14} className="text-amber-400" /> : <Copy size={14} />}
                    </button>
                  </div>
                  <p className="text-sm text-amber-100 leading-relaxed font-serif italic border-l-2 border-amber-600/20 pl-3 break-words">
                    "{insight.content}"
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="glass-card rounded-2xl p-6 border border-amber-800/20 text-center">
              <Feather size={24} className="text-amber-500/50 mx-auto mb-3" />
              <p className="text-sm text-amber-200/70">
                {result.recognizedText && result.recognizedText.trim() 
                  ? "কবি-দৃষ্টিভঙ্গি তৈরি হচ্ছে... অনুগ্রহ করে অপেক্ষা করুন। (Generating poet perspectives... Please wait.)"
                  : "কবি-দৃষ্টিভঙ্গি পাওয়া যায়নি। (Poet perspectives not available.)"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Confidence Analysis Chart */}
      <div>
        <h4 className="text-xs font-bold text-amber-200/80 uppercase tracking-widest mb-3 flex items-center gap-2 px-1">
          <BarChart3 size={12} className="text-amber-500" /> Prediction Distribution
        </h4>
        <div className="glass-card rounded-2xl p-5 border border-amber-800/20">
          <div className="space-y-4">
            {result.candidates.map((candidate, index) => (
              <div key={index} className="group">
                 <div className="flex justify-between text-xs mb-1.5">
                    <span className={`font-mono font-bold tracking-tight ${index === 0 ? 'text-amber-400' : 'text-amber-200/70'}`}>
                      {candidate.label}
                      {index === 0 && <span className="ml-2 text-[9px] bg-amber-600/10 text-amber-300 px-1.5 py-0.5 rounded border border-amber-600/20">TOP MATCH</span>}
                    </span>
                    <span className="text-amber-200/70 font-mono">{(candidate.probability * 100).toFixed(1)}%</span>
                 </div>
                 <div className="h-2 w-full bg-amber-950/50 rounded-full overflow-hidden">
                   <div 
                     className={`h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden ${index === 0 ? 'bg-gradient-to-r from-amber-600 to-amber-800' : 'bg-amber-900/40'}`}
                     style={{ width: `${candidate.probability * 100}%` }}
                   >
                     <div className="absolute inset-0 w-full h-full opacity-30" style={{ backgroundImage: 'linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%,transparent)', backgroundSize: '0.5rem 0.5rem' }}></div>
                   </div>
                 </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResultsPanel;