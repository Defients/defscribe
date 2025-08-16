import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Chat } from "@google/genai";
import { type ChatMessage } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

interface TranscriptChatProps {
  transcript: string;
  onClose: () => void;
}

const TranscriptChat: React.FC<TranscriptChatProps> = ({ transcript, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatRef = useRef<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (transcript) {
      chatRef.current = ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
          systemInstruction: `You are an intelligent assistant that answers questions based ONLY on the provided transcript. The transcript is a record of a conversation. Your task is to be helpful and accurate. Do not make up information. If the answer is not in the transcript, say so. \n\n--- TRANSCRIPT ---\n${transcript}`,
        },
      });
       setMessages([]);
    }
  }, [transcript]);
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !chatRef.current) return;

    const userMessage: ChatMessage = { id: `user-${Date.now()}`, role: 'user', text: input };
    const modelMessage: ChatMessage = { id: `model-${Date.now()}`, role: 'model', text: '', isLoading: true };
    setMessages(prev => [...prev, userMessage, modelMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const result = await chatRef.current.sendMessageStream({ message: input });
      let fullText = '';
      for await (const chunk of result) {
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

  return (
    <div className="fixed inset-0 bg-black/50 z-[90] animate-[fadeIn_0.3s_ease-out]" onClick={onClose}>
      <div
        className="fixed bottom-0 right-0 h-[60vh] max-h-[600px] w-full max-w-2xl bg-slate-800/80 backdrop-blur-xl border-t-2 border-[var(--color-primary)] rounded-t-2xl shadow-2xl flex flex-col animate-[char-slide-in_0.5s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-slate-700/50">
          <h2 className="text-lg font-bold flex items-center gap-2"><i className="fas fa-comments text-[var(--color-primary)]"></i> Chat with Transcript</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><i className="fas fa-times"></i></button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-slate-400 p-6">
                <i className="fas fa-question-circle text-4xl mb-3"></i>
                <p>Ask anything about your transcript.</p>
                <p className="text-sm">e.g., "What were the action items for Speaker 1?"</p>
            </div>
          )}
          {messages.map(msg => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
              {msg.role === 'model' && <div className="w-8 h-8 rounded-full bg-[var(--color-primary)] flex items-center justify-center flex-shrink-0"><i className="fas fa-robot text-black"></i></div>}
              <div className={`max-w-[80%] rounded-2xl p-3 text-sm leading-relaxed ${msg.role === 'user' ? 'bg-[var(--color-secondary)] text-white' : 'bg-slate-700'}`}>
                {msg.text}
                {msg.isLoading && <span className="inline-block w-2 h-2 bg-slate-300 rounded-full ml-2 animate-ping"></span>}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSubmit} className="p-4 border-t border-slate-700/50">
          <div className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question..."
              disabled={isLoading}
              className="w-full bg-slate-900/70 border border-slate-600 rounded-lg py-3 pl-4 pr-12 text-sm focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-none transition-shadow disabled:opacity-50"
            />
            <button type="submit" disabled={isLoading || !input.trim()} className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-[var(--color-primary)] rounded-lg text-black flex items-center justify-center transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed">
              <i className="fas fa-paper-plane"></i>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TranscriptChat;
