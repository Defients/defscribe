import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Chat } from "@google/genai";
import { type ChatMessage } from '../types';
import Tooltip from './Tooltip';
import { translateText } from '../services/geminiService';

const API_KEY = typeof process !== 'undefined' && process.env?.API_KEY;
let ai: GoogleGenAI | null = null;
if (API_KEY) {
    try {
        ai = new GoogleGenAI({ apiKey: API_KEY });
    } catch (e) {
        console.error("Failed to initialize GoogleGenAI for chat.", e);
    }
} else {
    console.warn("Gemini API key not found. Chat feature will be disabled.");
}

interface TranscriptChatProps {
  transcript: string;
  onClose: () => void;
  translationLanguage: string;
}

const TranscriptChat: React.FC<TranscriptChatProps> = ({ transcript, onClose, translationLanguage }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // --- UX State ---
  const [autoScroll, setAutoScroll] = useState(true);
  const [newContent, setNewContent] = useState(false);
  const [textSize, setTextSize] = useState<'sm' | 'base' | 'lg'>('base');
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [isTranslatingId, setIsTranslatingId] = useState<string | null>(null);

  const chatRef = useRef<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // --- UX Constants ---
  const textSizeClasses = { sm: 'text-sm', base: 'text-base', lg: 'text-lg' };
  const textSizeLabels = { sm: 'Small', base: 'Medium', lg: 'Large' };
  const nextTextSizeLabel = { sm: 'Medium', base: 'Large', lg: 'Small' };

  const initializeChat = () => {
     if (!ai) return;
     chatRef.current = ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
          systemInstruction: `You are an intelligent assistant that answers questions based ONLY on the provided transcript. The transcript is a record of a conversation. Your task is to be helpful and accurate. Do not make up information. If the answer is not in the transcript, say so. \n\n--- TRANSCRIPT ---\n${transcript}`,
        },
      });
  };

  useEffect(() => {
    if (transcript) {
      initializeChat();
      setMessages([]);
      setAutoScroll(true);
    }
  }, [transcript]);
  
  useEffect(() => {
    if (autoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    let scrollTimeout: number;
    const handleScroll = () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = window.setTimeout(() => {
            const { scrollTop, scrollHeight, clientHeight } = container;
            const isAtBottom = scrollHeight - scrollTop <= clientHeight + 10;
            if (isAtBottom) {
                if (!autoScroll) setAutoScroll(true);
                if (newContent) setNewContent(false);
            } else {
                if (autoScroll) setAutoScroll(false);
            }
        }, 150);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
        clearTimeout(scrollTimeout);
        container.removeEventListener('scroll', handleScroll);
    };
  }, [autoScroll, newContent]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !chatRef.current) return;

    setAutoScroll(true);
    
    const userMessage: ChatMessage = { id: `user-${Date.now()}`, role: 'user', text: input };
    const modelMessage: ChatMessage = { id: `model-${Date.now()}`, role: 'model', text: '', isLoading: true };
    setMessages(prev => [...prev, userMessage, modelMessage]);
    setInput('');
    setIsLoading(true);

    let streamingStarted = false;

    try {
      const result = await chatRef.current.sendMessageStream({ message: input });
      let fullText = '';
      for await (const chunk of result) {
        if (!streamingStarted) {
            if (!autoScroll) setNewContent(true);
            streamingStarted = true;
        }
        fullText += chunk.text;
        setMessages(prev =>
          prev.map(msg =>
            msg.id === modelMessage.id ? { ...msg, text: fullText } : msg
          )
        );
      }
      setMessages(prev =>
        prev.map(msg =>
          msg.id === modelMessage.id ? { ...msg, isLoading: false } : msg
        )
      );
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev =>
        prev.map(msg =>
          msg.id === modelMessage.id ? { ...msg, text: 'Sorry, I encountered an error.', isLoading: false } : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    if (transcript) {
        initializeChat(); // Re-creates chat to clear server-side history
    }
  };

  const cycleTextSize = () => {
    setTextSize(current => current === 'base' ? 'lg' : current === 'lg' ? 'sm' : 'base');
  };

  const handleAutoScrollClick = () => {
    setAutoScroll(true);
    setNewContent(false);
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
        setCopiedMessageId(id);
        setTimeout(() => setCopiedMessageId(null), 2000);
    }).catch(err => console.error('Failed to copy text: ', err));
  };
  
  const handleTranslate = useCallback(async (messageId: string, text: string) => {
    if (isTranslatingId) return;
    setIsTranslatingId(messageId);
    try {
        const translated = await translateText(text, translationLanguage);
        setMessages(prev => prev.map(msg => 
            msg.id === messageId ? { ...msg, translatedText: translated } : msg
        ));
    } catch (error) {
        console.error("Translation error in chat:", error);
        setMessages(prev => prev.map(msg => 
            msg.id === messageId ? { ...msg, translatedText: "Translation failed." } : msg
        ));
    } finally {
        setIsTranslatingId(null);
    }
  }, [translationLanguage, isTranslatingId]);


  return (
    <div className="fixed inset-0 bg-black/50 z-[90] animate-[fadeIn_0.3s_ease-out]" onClick={onClose}>
      <div
        className="fixed bottom-0 right-0 h-[60vh] max-h-[600px] w-full max-w-2xl cosmo-panel border-t-2 border-[var(--color-primary)] rounded-t-2xl shadow-2xl flex flex-col animate-[char-slide-in_0.5s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex-shrink-0 flex items-center justify-between p-4 border-b border-[rgba(var(--color-primary-rgb),0.2)]">
          <h2 className="text-lg font-bold flex items-center gap-2"><i className="fas fa-comments text-[var(--color-primary)]"></i> Chat with Transcript</h2>
          <div className="flex items-center gap-2">
            <Tooltip text="Clear Chat" position="bottom">
              <button onClick={handleClearChat} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors cosmo-button"><i className="fas fa-trash-alt"></i></button>
            </Tooltip>

            <Tooltip text={`Change to ${nextTextSizeLabel[textSize]} text`} position="bottom">
                <button onClick={cycleTextSize} className="h-8 px-3 rounded-lg flex items-center justify-center gap-2 transition-colors cosmo-button">
                    <i className="fas fa-text-height"></i>
                    <span className="text-xs font-semibold w-12 text-center">{textSizeLabels[textSize]}</span>
                </button>
            </Tooltip>

            <Tooltip text={autoScroll ? "Auto-scroll On" : "Scroll to Bottom"} position="bottom">
              <button onClick={handleAutoScrollClick} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 cosmo-button ${autoScroll ? 'text-[var(--color-primary)]' : `text-slate-400 ${newContent ? 'animate-cosmic-glow' : ''}`}`}>
                <i className={`fas ${autoScroll ? 'fa-anchor' : 'fa-arrow-down'}`}></i>
              </button>
            </Tooltip>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white transition-colors"><i className="fas fa-times"></i></button>
          </div>
        </header>

        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
          {!ai ? (
             <div className="text-center text-slate-400 p-6">
                <i className="fas fa-exclamation-triangle text-4xl mb-3 text-amber-400"></i>
                <p>Chat is disabled.</p>
                <p className="text-sm">API key not configured.</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center text-slate-400 p-6">
                <i className="fas fa-question-circle text-4xl mb-3"></i>
                <p>Ask anything about your transcript.</p>
                <p className="text-sm">e.g., "What were the action items for Speaker 1?"</p>
            </div>
          ) : (
            messages.map(msg => (
                <div key={msg.id} className={`relative group flex gap-3 ${msg.role === 'user' ? 'justify-end items-end' : 'items-start'} pt-5`}>
                  {msg.role === 'model' && <div className="w-8 h-8 rounded-full bg-[var(--color-primary)] flex items-center justify-center flex-shrink-0 hex-clip"><i className="fas fa-robot text-black"></i></div>}
                  <div className={`max-w-[80%] rounded-2xl p-3 leading-relaxed ${msg.role === 'user' ? 'bg-[var(--color-secondary)] text-white' : 'bg-slate-700'}`}>
                      <p className={`${textSizeClasses[textSize]}`}>{msg.text}</p>
                      {msg.isLoading && <span className="inline-block w-2 h-2 bg-slate-300 rounded-full ml-2 animate-ping"></span>}
                      {msg.translatedText && <p className={`italic text-slate-400 mt-2 pt-2 border-t border-slate-600/50 ${textSizeClasses[textSize]}`}>{msg.translatedText}</p>}
                  </div>
                   {msg.role === 'model' && !msg.isLoading && msg.text && (
                       <div className="absolute top-0 left-12 z-20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-slate-800/90 backdrop-blur-sm rounded-full border border-slate-600 p-1 shadow-lg">
                           <Tooltip text="Translate" position='top'>
                                <button onClick={() => handleTranslate(msg.id, msg.text)} disabled={!!isTranslatingId} className="w-7 h-7 bg-slate-600 rounded-full flex items-center justify-center text-slate-300 hover:bg-slate-500 disabled:opacity-50 disabled:cursor-wait" aria-label="Translate message">
                                    {isTranslatingId === msg.id ? <i className="fas fa-spinner fa-spin text-xs"></i> : <i className="fas fa-language text-xs"></i>}
                                </button>
                           </Tooltip>
                           <Tooltip text={copiedMessageId === msg.id ? "Copied!" : "Copy"} position='top'>
                                <button onClick={() => handleCopy(msg.text, msg.id)} className="w-7 h-7 bg-slate-600 rounded-full flex items-center justify-center text-slate-300 hover:bg-slate-500" aria-label="Copy message">
                                    <i className={`fas ${copiedMessageId === msg.id ? 'fa-check text-green-400' : 'fa-copy'} text-xs`}></i>
                                </button>
                           </Tooltip>
                       </div>
                   )}
                  {msg.role === 'user' && <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center flex-shrink-0 hex-clip"><i className="fas fa-user text-white"></i></div>}
                </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSubmit} className="flex-shrink-0 p-4 border-t border-[rgba(var(--color-primary-rgb),0.2)]">
          <div className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={ai ? "Ask a question..." : "Chat is disabled"}
              disabled={isLoading || !ai}
              className="w-full cosmo-input rounded-lg py-3 pl-4 pr-12 text-sm focus:outline-none disabled:opacity-50"
            />
            <button type="submit" disabled={isLoading || !input.trim() || !ai} className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-[var(--color-primary)] rounded-lg text-black flex items-center justify-center transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed">
              <i className="fas fa-paper-plane"></i>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TranscriptChat;