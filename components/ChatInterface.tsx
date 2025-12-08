
import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, Paperclip, Copy, Check, Plus, Sliders, History, ArrowUp, Zap, Bot, FileText, Image as ImageIcon, X, AudioLines, Globe, ChevronDown, GraduationCap, Briefcase, Sparkles, MessageSquare } from 'lucide-react';
import { ChatMessage, ChatPersona } from '../types';
import { chatWithBhasha } from '../services/geminiService';
import BhashaLogo from './BhashaLogo';

interface ChatInterfaceProps {
  contextText: string;
  initialSuggestions: string[];
  onInteraction?: () => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ contextText, initialSuggestions, onInteraction }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [inputLang, setInputLang] = useState<'en-US' | 'bn-BD'>('en-US');
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  
  // Persona State
  const [persona, setPersona] = useState<ChatPersona>('tutor');
  const [showPersonaMenu, setShowPersonaMenu] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastProcessedTextRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Speech Recognition Refs
  const recognitionRef = useRef<any>(null);
  const textBeforeListening = useRef('');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Sync suggestions when props change
  useEffect(() => {
    setSuggestions(initialSuggestions);
  }, [initialSuggestions]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, suggestions]);

  useEffect(() => {
    // Only update chat when there's a genuinely NEW contextText (new analysis from new image)
    // Don't reset if contextText becomes empty - keep existing chat active
    if (contextText && contextText.trim() && contextText !== lastProcessedTextRef.current) {
      const newContextText = contextText;
      lastProcessedTextRef.current = newContextText;
      // Create a user message that explicitly asks for analysis
      const analysisRequest = `এই পাঠ্যটি বিশ্লেষণ করুন: "${newContextText}"`;
      const initialUserMsg: ChatMessage = { role: 'user', content: analysisRequest, timestamp: Date.now() };
      // Start fresh conversation for new analysis
      setMessages([initialUserMsg]);
      setIsLoading(true);

      chatWithBhasha([initialUserMsg], newContextText, persona)
        .then(responseText => {
          if (responseText && responseText.trim()) {
            setMessages(prev => [...prev, { role: 'model', content: responseText.trim(), timestamp: Date.now() }]);
          } else {
            // Fallback if response is empty
            setMessages(prev => [...prev, { 
              role: 'model', 
              content: "দুঃখিত, আমি এখনই আপনার প্রশ্নের উত্তর দিতে পারছি না। অনুগ্রহ করে আবার চেষ্টা করুন।", 
              timestamp: Date.now() 
            }]);
          }
        })
        .catch(err => {
          console.error("Auto-chat failed", err);
          setMessages(prev => [...prev, { 
            role: 'model', 
            content: "দুঃখিত, একটি ত্রুটি হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন। (Sorry, an error occurred. Please try again.)", 
            timestamp: Date.now() 
          }]);
        })
        .finally(() => setIsLoading(false));
    }
    // Don't clear messages when contextText becomes empty - keep chat active
    // Only trigger on contextText change, not persona change to prevent freezing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextText]); 
  
  // Speech Recognition Initialization
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        // Default lang, will be updated dynamically on start
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          setIsListening(true);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognition.onresult = (event: any) => {
          let transcript = '';
          for (let i = 0; i < event.results.length; ++i) {
            transcript += event.results[i][0].transcript;
          }
          const base = textBeforeListening.current;
          const spacing = base && !base.endsWith(' ') && transcript ? ' ' : '';
          setInput(base + spacing + transcript);
        };

        recognition.onerror = (event: any) => {
          console.error("Speech recognition error", event.error);
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      if (recognitionRef.current) {
        // Update language before starting
        recognitionRef.current.lang = inputLang;
        
        // Store current input so we can append to it
        textBeforeListening.current = input;
        try {
          recognitionRef.current.start();
        } catch (e) {
          console.error("Failed to start recognition:", e);
        }
      } else {
        alert("Speech recognition is not supported in this browser.");
      }
    }
  };

  const handleSend = async (text: string = input) => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }

    if ((!text.trim() && !attachedFile) || isLoading) return;

    // Trigger interaction callback to unlock all sections
    onInteraction?.();

    let content = text;
    if (attachedFile) {
      content = `[FILE SENT: ${attachedFile.name}] ${text}`;
    }

    const userMsg: ChatMessage = { role: 'user', content: content, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setAttachedFile(null);
    setIsLoading(true);

    try {
      if (attachedFile) {
          await new Promise(resolve => setTimeout(resolve, 800));
      }

      const responseText = await chatWithBhasha([...messages, userMsg], contextText, persona);
      
      // Ensure we have a valid response
      if (responseText && responseText.trim()) {
        const botMsg: ChatMessage = { role: 'model', content: responseText.trim(), timestamp: Date.now() };
        setMessages(prev => [...prev, botMsg]);
      } else {
        // Fallback if response is empty
        const errorMsg: ChatMessage = { 
          role: 'model', 
          content: "দুঃখিত, আমি এখনই আপনার প্রশ্নের উত্তর দিতে পারছি না। অনুগ্রহ করে আবার চেষ্টা করুন।", 
          timestamp: Date.now() 
        };
        setMessages(prev => [...prev, errorMsg]);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMsg: ChatMessage = { 
        role: 'model', 
        content: "দুঃখিত, একটি ত্রুটি হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন। (Sorry, an error occurred. Please try again.)", 
        timestamp: Date.now() 
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAttachedFile(e.target.files[0]);
    }
  };

  const handleCopy = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getPlaceholder = () => {
    if (isListening) {
      return inputLang === 'bn-BD' ? "শুনছি..." : "Listening...";
    }
    return inputLang === 'bn-BD' ? "কিছু জিজ্ঞাসা করুন..." : "Ask anything...";
  };

  const getPersonaIcon = (p: ChatPersona) => {
    switch(p) {
      case 'analyst': return <Briefcase size={16} />;
      case 'muse': return <Sparkles size={16} />;
      default: return <GraduationCap size={16} />;
    }
  };

  const getPersonaLabel = (p: ChatPersona) => {
    switch(p) {
      case 'analyst': return 'Analyst';
      case 'muse': return 'Muse';
      default: return 'Tutor';
    }
  };

  // Calculate dynamic height based on content
  const messageCount = messages.length;
  const hasContext = contextText && contextText.trim();
  const baseHeight = 500; // Base height
  const contextHeight = hasContext ? 80 : 0; // Height for context display
  const messageHeight = Math.min(messageCount * 100, 400); // Max 400px for messages
  const dynamicHeight = Math.max(baseHeight, baseHeight + contextHeight + messageHeight);
  const finalHeight = Math.min(dynamicHeight, 900); // Cap at 900px

  return (
    <div 
      className="rounded-3xl border border-white/5 shadow-2xl flex flex-col overflow-hidden bg-[#0b0c0e] relative transition-all duration-300"
      style={{ height: `${finalHeight}px`, minHeight: '500px', maxHeight: '900px' }}
    >
      
      {/* Header - Minimalist with Persona Selector */}
      <div className="absolute top-0 left-0 right-0 p-6 z-10 flex justify-between items-start pointer-events-none">
        <div className="pointer-events-auto">
          <BhashaLogo className="w-8 h-8 text-white/20 hover:text-white/40 transition-colors" />
        </div>

        {/* Persona Selector Dropdown */}
        <div className="pointer-events-auto relative">
          <button 
            onClick={() => setShowPersonaMenu(!showPersonaMenu)}
            className="flex items-center gap-2 bg-amber-900/20 hover:bg-amber-800/30 border border-amber-700/20 rounded-full px-4 py-2 text-sm text-amber-50 transition-all shadow-lg backdrop-blur-md"
          >
            <span className={`text-amber-400`}>{getPersonaIcon(persona)}</span>
            <span className="font-medium">{getPersonaLabel(persona)}</span>
            <ChevronDown size={14} className={`text-amber-200/70 transition-transform ${showPersonaMenu ? 'rotate-180' : ''}`} />
          </button>

          {showPersonaMenu && (
            <div className="absolute top-full right-0 mt-2 w-48 bg-[#1e1e1e] border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-fade-in z-50">
               <div className="p-1">
                 {(['tutor', 'analyst', 'muse'] as ChatPersona[]).map((p) => (
                   <button
                     key={p}
                     onClick={() => {
                       setPersona(p);
                       setShowPersonaMenu(false);
                     }}
                     className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                       persona === p 
                         ? 'bg-amber-600/10 text-amber-400' 
                         : 'text-amber-200/70 hover:text-amber-50 hover:bg-amber-800/20'
                     }`}
                   >
                     {getPersonaIcon(p)}
                     <span className="flex-1 text-left">{getPersonaLabel(p)}</span>
                     {persona === p && <Check size={14} />}
                   </button>
                 ))}
               </div>
            </div>
          )}
        </div>
      </div>


      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto p-4 md:px-20 pt-20 pb-4 space-y-8 custom-scrollbar">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50">
             <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
                {getPersonaIcon(persona)}
             </div>
             <div className="space-y-1">
                <p className="text-amber-200/80 font-sans text-lg">
                  {inputLang === 'bn-BD' ? "আমি আপনাকে কিভাবে সাহায্য করতে পারি?" : "How can I help you today?"}
                </p>
                <p className="text-amber-200/60 text-sm">
                   Using {getPersonaLabel(persona)} Persona
                </p>
             </div>
          </div>
        )}

        {messages.map((msg, idx) => {
          const isUser = msg.role === 'user';
          return (
            <div key={idx} className={`flex w-full animate-fade-in ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] md:max-w-[75%] ${isUser ? '' : 'w-full'}`}>
                {isUser ? (
                   <div className="bg-amber-900/30 text-amber-50 px-5 py-3 rounded-2xl rounded-tr-sm text-[15px] leading-relaxed font-sans">
                      {msg.content.includes('[FILE SENT:') && (
                        <div className="flex items-center gap-2 text-xs text-amber-400 mb-2 border-b border-amber-700/30 pb-2">
                           <Paperclip size={12} /> {msg.content.match(/\[FILE SENT: (.*?)\]/)?.[1]}
                        </div>
                      )}
                      {msg.content.replace(/\[FILE SENT: .*\] /, '')}
                   </div>
                ) : (
                   <div className="group relative pr-8">
                      <div className="font-sans text-[16px] md:text-[17px] leading-7 text-amber-50 tracking-wide">
                        {msg.content}
                      </div>
                      <div className="mt-2 flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button 
                            onClick={() => handleCopy(msg.content, idx)}
                            className="text-amber-200/60 hover:text-amber-50 transition-colors p-1 rounded hover:bg-amber-800/20"
                         >
                            {copiedId === idx ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                         </button>
                      </div>
                   </div>
                )}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex w-full justify-start animate-fade-in pl-1">
             <span className="w-2 h-2 bg-amber-600 rounded-full animate-pulse"></span>
          </div>
        )}

        {/* Suggested Questions */}
        {suggestions.length > 0 && !isLoading && messages.length > 0 && (
           <div className="mt-6 px-2 animate-fade-in">
              <p className="text-xs text-amber-200/70 font-medium uppercase tracking-widest mb-3 ml-1 flex items-center gap-2">
                  <Sparkles size={12} className="text-amber-400" /> Suggested Follow-ups
              </p>
              <div className="flex flex-wrap gap-2">
                   {suggestions.map((s, i) => (
                       <button 
                          key={i}
                          onClick={() => handleSend(s)}
                          className="text-left bg-amber-900/20 hover:bg-amber-800/30 border border-amber-700/20 hover:border-amber-600/40 px-4 py-2 rounded-xl text-sm text-amber-50 transition-all group flex items-center gap-2"
                       >
                          <MessageSquare size={14} className="text-amber-200/60 group-hover:text-amber-400 transition-colors" />
                          <span>{s}</span>
                       </button>
                   ))}
              </div>
           </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Floating Input Area - Simplified Sonnet Style */}
      <div className="p-6 pt-2 flex justify-center bg-gradient-to-t from-[#0b0c0e] to-transparent z-20">
        <div className={`w-full max-w-3xl bg-[#1e1e1e] rounded-[28px] p-4 shadow-2xl border transition-all duration-300 relative group
            ${isListening ? 'border-amber-600/30 ring-1 ring-amber-600/20' : 'border-white/5 ring-1 ring-white/5 focus-within:ring-amber-600/30'}
        `}>
            
            {/* Attached File Preview */}
            {attachedFile && (
               <div className="mx-2 mb-2 inline-flex items-center gap-2 bg-amber-900/20 px-3 py-1.5 rounded-lg border border-amber-700/20 text-xs text-amber-50">
                  <FileText size={12} className="text-amber-400" />
                  {attachedFile.name}
                  <button onClick={() => setAttachedFile(null)} className="hover:text-red-400 ml-1"><X size={12} /></button>
               </div>
            )}

            {/* Input Field and Visualizer Container */}
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={getPlaceholder()}
                disabled={isLoading}
                className={`w-full bg-transparent text-amber-50 placeholder:text-amber-200/50 text-[16px] resize-none outline-none min-h-[56px] px-2 py-1 pr-12 transition-opacity ${isListening ? 'opacity-70' : 'opacity-100'}`}
                rows={1}
              />
              
              {/* Waveform Visualizer Overlay */}
              {isListening && (
                 <div className="absolute right-2 top-2 flex items-center gap-1 h-6 pointer-events-none">
                    <div className="w-1 bg-amber-600 rounded-full animate-wave" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-1 bg-amber-600 rounded-full animate-wave" style={{ animationDelay: '200ms' }}></div>
                    <div className="w-1 bg-amber-600 rounded-full animate-wave" style={{ animationDelay: '400ms' }}></div>
                    <div className="w-1 bg-amber-600 rounded-full animate-wave" style={{ animationDelay: '100ms' }}></div>
                 </div>
              )}
            </div>

            {/* Bottom Controls Row */}
            <div className="flex items-center justify-between mt-3 px-1">
                {/* Left Group */}
                <div className="flex items-center gap-1">
                     <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />
                     <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 hover:bg-amber-800/20 rounded-xl text-amber-200/70 hover:text-amber-50 transition-colors"
                        title="Add Attachment"
                     >
                        <Plus size={20} />
                     </button>
                </div>

                {/* Right Group */}
                <div className="flex items-center gap-2">
                    {/* Language Switcher */}
                    <button
                      onClick={() => setInputLang(prev => prev === 'en-US' ? 'bn-BD' : 'en-US')}
                      className={`h-9 px-3 rounded-xl flex items-center gap-1.5 text-[10px] font-bold tracking-wider transition-all border
                        ${inputLang === 'bn-BD' 
                           ? 'bg-amber-600/10 text-amber-400 border-amber-600/20' 
                           : 'bg-amber-900/20 text-amber-200/70 border-amber-700/20 hover:bg-amber-800/30 hover:text-amber-50'
                        }
                      `}
                      title="Switch Language"
                    >
                      <Globe size={12} />
                      {inputLang === 'en-US' ? 'ENG' : 'BNG'}
                    </button>

                    {/* Voice Input Button */}
                    <button
                      onClick={toggleListening}
                      className={`p-2 rounded-xl transition-all duration-300 relative overflow-hidden ${
                        isListening 
                          ? 'text-amber-300 bg-amber-600/20' 
                          : 'text-amber-200/70 hover:text-amber-50 hover:bg-amber-800/20'
                      }`}
                      title={isListening ? "Stop Listening" : "Voice Input"}
                    >
                      {isListening && (
                        <span className="absolute inset-0 bg-amber-600/20 animate-pulse"></span>
                      )}
                      {isListening ? <AudioLines size={20} /> : <Mic size={20} />}
                    </button>

                    <div className="w-px h-5 bg-white/10 mx-1"></div>

                    <button 
                        onClick={() => handleSend()}
                        disabled={!input.trim() && !attachedFile}
                        className={`p-2.5 rounded-xl transition-all duration-300 ${
                          input.trim() || attachedFile 
                            ? 'bg-amber-700 text-amber-50 shadow-lg hover:bg-amber-600' 
                            : 'bg-amber-900/20 text-amber-200/40 cursor-not-allowed'
                        }`}
                    >
                        <ArrowUp size={20} strokeWidth={2.5} />
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
