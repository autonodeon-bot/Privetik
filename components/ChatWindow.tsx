import React, { useRef, useEffect, useState } from 'react';
import { Chat } from '../types';
import { ArrowLeft, Search, MoreVertical, Paperclip, Smile, Mic, Send } from 'lucide-react';
import MessageBubble from './MessageBubble';

interface ChatWindowProps {
  chat: Chat;
  onBack: () => void;
  onSendMessage: (text: string) => void;
  className?: string;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ chat, onBack, onSendMessage, className = '' }) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chat.messages, chat.isTyping]);

  const handleSend = () => {
    if (inputText.trim()) {
      onSendMessage(inputText);
      setInputText('');
      // Keep focus on desktop, dismiss on mobile might be better but let's keep focus for now
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={`flex flex-col h-full bg-[#efeae2] relative ${className}`}>
      {/* Background Pattern Overlay */}
      <div className="absolute inset-0 opacity-[0.06] bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] pointer-events-none"></div>

      {/* Header */}
      <div className="flex items-center px-4 py-2.5 bg-primary-700 text-white shadow-sm z-10 flex-shrink-0">
        <button onClick={onBack} className="md:hidden mr-2 p-1 rounded-full hover:bg-primary-600 transition">
          <ArrowLeft size={24} />
        </button>
        
        <div className="flex items-center flex-1 cursor-pointer">
          <img src={chat.contact.avatar} alt={chat.contact.name} className="w-10 h-10 rounded-full object-cover bg-white" />
          <div className="ml-3 flex flex-col">
            <h3 className="text-base font-medium leading-none mb-1">{chat.contact.name}</h3>
            <span className="text-xs text-primary-200 truncate">
               {chat.isTyping ? 'печатает...' : 'был(а) недавно'}
            </span>
          </div>
        </div>

        <div className="flex space-x-4 ml-4">
          <button className="hover:bg-primary-600 p-2 rounded-full transition"><Search size={20} /></button>
          <button className="hover:bg-primary-600 p-2 rounded-full transition"><MoreVertical size={20} /></button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 z-10 space-y-1">
        {chat.messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {chat.isTyping && (
           <div className="flex justify-start w-full mb-2">
              <div className="bg-white px-4 py-3 rounded-lg rounded-tl-none shadow-sm flex space-x-1 items-center">
                 <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0s'}}></div>
                 <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                 <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
              </div>
           </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-2 bg-gray-100 flex items-end space-x-2 z-10">
        <div className="flex-1 bg-white rounded-2xl flex items-center px-2 py-1 shadow-sm min-h-[44px]">
          <button className="p-2 text-gray-500 hover:text-gray-600 transition">
            <Smile size={24} />
          </button>
          <input 
            ref={inputRef}
            type="text" 
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Введите сообщение"
            className="flex-1 bg-transparent outline-none text-base px-2 py-2 max-h-32 overflow-y-auto"
          />
          <button className="p-2 text-gray-500 hover:text-gray-600 transition rotate-[-45deg]">
             <Paperclip size={24} />
          </button>
        </div>
        
        <button 
          onClick={handleSend}
          className={`p-3 rounded-full shadow-md flex items-center justify-center transition-all duration-200 ${inputText.trim() ? 'bg-primary-600 text-white hover:bg-primary-700' : 'bg-primary-600 text-white hover:bg-primary-700'}`}
        >
          {inputText.trim() ? <Send size={20} /> : <Mic size={20} />}
        </button>
      </div>
    </div>
  );
};

export default ChatWindow;
