import React, { useState, useEffect } from 'react';
import { RecognitionResult } from '../types';
import { Clock, Feather, Activity, Quote, Type, Hash, BarChart3, ScanLine, Copy, Check, Upload, User } from 'lucide-react';
import BhashaLogo from './BhashaLogo';

interface ResultsPanelProps {
  result: RecognitionResult | null;
  isLoading: boolean;
}

// Circular Progress Component - Neon Style
const CircularGauge = ({ value, size = 60, strokeWidth = 5, color = "text-cyan-500" }: { value: number; size?: number; strokeWidth?: number; color?: string }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90 w-full h-full filter drop-shadow-[0_0_5px_rgba(34,211,238,0.3)]">
        <circle
          className="text-slate-800"
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
const MetricPill = ({ icon: Icon, label, value, color = "text-slate-400" }: { icon: any, label: string, value: string | number, color?: string }) => (
  <div className="flex flex-col items-center justify-center bg-white/5 rounded-xl p-3 border border-white/5 hover:border-white/10 transition-all hover:bg-white/10 backdrop-blur-sm group">
    <div className="flex items-center gap-1.5 mb-1 opacity-70 group-hover:opacity-100 transition-opacity">
      <Icon size={12} className={color} />
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
    </div>
    <span className="text-sm font-mono font-medium text-slate-200">{value}</span>
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
      <div className={`${className} rounded-full bg-slate-800 flex items-center justify-center border-2 border-slate-700 group-hover:border-cyan-400 transition-colors`}>
        <User size={20} className="text-slate-500" />
      </div>
    );
  }

  return (
    <div className={`${className} rounded-full overflow-hidden border-2 border-slate-700/50 group-hover:border-cyan-400/50 transition-colors shadow-lg bg-slate-900`}>
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
           <BhashaLogo className="w-20 h-20 text-slate-600 group-hover:text-cyan-500 transition-colors duration-500" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2 tracking-tight">System Ready</h3>
        <p className="text-sm text-slate-500 max-w-xs mx-auto font-light">
          Awaiting input via sketch, upload, or camera feed.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-4">
      {/* Hero Card - Data Prism Style */}
      <div className="relative rounded-3xl overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 opacity-90"></div>
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-cyan-500/20 blur-[60px] rounded-full"></div>
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-violet-500/20 blur-[60px] rounded-full"></div>
        
        <div className="relative z-10 p-6 border border-white/10 rounded-3xl backdrop-blur-sm">
          <div className="flex items-start gap-5">
              <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className="flex items-center gap-2 text-[10px] font-bold text-cyan-400 uppercase tracking-widest">
                      <ScanLine size={12} /> Recognized Content
                    </span>
                    <button 
                      onClick={() => handleCopy(result.recognizedText, 'main')}
                      className="text-slate-500 hover:text-white transition-colors"
                      title="Copy text"
                    >
                      {copiedTextId === 'main' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    </button>
                  </div>
                  
                  <div className="mb-5 relative">
                     <Quote className="absolute -top-2 -left-3 text-white/5 transform -scale-x-100" size={40} />
                     <h2 className="text-3xl font-serif text-white leading-tight tracking-wide drop-shadow-lg break-words pl-2">
                      "{result.recognizedText}"
                     </h2>
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-3 gap-2">
                    <MetricPill icon={Clock} label="Time" value={`${result.processingTimeMs}ms`} color="text-cyan-400" />
                    <MetricPill icon={Type} label="Type" value={result.isQuestion ? 'Query' : 'Text'} color="text-violet-400" />
                    <MetricPill icon={Hash} label="Chars" value={result.recognizedText.length} color="text-emerald-400" />
                  </div>
              </div>

              {/* Circular Gauge */}
              <div className="flex flex-col items-center gap-3 bg-black/20 p-4 rounded-2xl border border-white/5 backdrop-blur-md">
                  <CircularGauge 
                    value={result.confidence} 
                    size={70} 
                    strokeWidth={6} 
                    color={result.confidence > 80 ? "text-emerald-400" : result.confidence > 50 ? "text-amber-400" : "text-red-400"} 
                  />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Confidence</span>
              </div>
          </div>
        </div>
      </div>

      {/* Structural Analysis - Tech Bars */}
      <div>
         <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 px-1 flex items-center gap-2">
           <Activity size={12} className="text-cyan-500" /> Structural Metrics
         </h4>
         <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Stroke Quality", val: Math.min(100, result.confidence + 5), color: "from-cyan-500 to-blue-500" },
              { label: "Linearity", val: Math.min(100, result.confidence - 10), color: "from-blue-500 to-violet-500" },
              { label: "Complexity", val: Math.min(100, result.recognizedText.length * 8), color: "from-violet-500 to-fuchsia-500" }
            ].map((m, i) => (
              <div key={i} className="glass-card rounded-xl p-3 flex flex-col gap-2">
                <div className="flex justify-between items-end">
                   <span className="text-[10px] text-slate-400 font-bold uppercase">{m.label}</span>
                   <span className="text-xs font-mono text-white">{Math.round(m.val)}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
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
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 px-1 flex items-center gap-2">
          <Feather size={12} className="text-violet-500" /> Literary Perspectives
        </h4>
        <div className="space-y-4">
          {result.bhashaInsights.map((insight, idx) => (
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
                    <h5 className="text-base font-bold text-white truncate">{insight.poet}</h5>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-slate-300 border border-white/10 font-medium tracking-wide">
                      {insight.mood}
                    </span>
                  </div>
                  <button 
                    onClick={() => handleCopy(insight.content, `poet-${idx}`)}
                    className="text-slate-600 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                    title="Copy insight"
                  >
                    {copiedTextId === `poet-${idx}` ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed font-serif italic border-l-2 border-cyan-500/20 pl-3">
                  "{insight.content}"
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Confidence Analysis Chart */}
      <div>
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2 px-1">
          <BarChart3 size={12} className="text-emerald-500" /> Prediction Distribution
        </h4>
        <div className="glass-card rounded-2xl p-5 border border-white/5">
          <div className="space-y-4">
            {result.candidates.map((candidate, index) => (
              <div key={index} className="group">
                 <div className="flex justify-between text-xs mb-1.5">
                    <span className={`font-mono font-bold tracking-tight ${index === 0 ? 'text-cyan-400' : 'text-slate-400'}`}>
                      {candidate.label}
                      {index === 0 && <span className="ml-2 text-[9px] bg-cyan-500/10 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-500/20">TOP MATCH</span>}
                    </span>
                    <span className="text-slate-500 font-mono">{(candidate.probability * 100).toFixed(1)}%</span>
                 </div>
                 <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                   <div 
                     className={`h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden ${index === 0 ? 'bg-gradient-to-r from-cyan-500 to-violet-500' : 'bg-slate-700'}`}
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