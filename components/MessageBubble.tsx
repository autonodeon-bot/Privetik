import React from 'react';
import { Message } from '../types';
import { Check, CheckCheck } from 'lucide-react';

interface MessageBubbleProps {
  message: Message;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isMe = message.sender === 'me';
  
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`flex w-full mb-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
      <div 
        className={`relative max-w-[80%] md:max-w-[60%] px-3 py-1.5 rounded-lg shadow-sm text-[15px] leading-snug break-words
          ${isMe ? 'bg-primary-100 rounded-tr-none' : 'bg-white rounded-tl-none'}
        `}
      >
        <div className="pr-2 pb-1">
            {message.text}
        </div>
        <div className="flex items-center justify-end space-x-1 absolute bottom-1 right-2">
          <span className="text-[10px] text-gray-500 pt-1">
            {formatTime(message.timestamp)}
          </span>
          {isMe && (
            <span className={`text-[15px] ${message.status === 'read' ? 'text-blue-500' : 'text-gray-400'}`}>
               {message.status === 'read' ? <CheckCheck size={14} /> : <Check size={14} />}
            </span>
          )}
        </div>
        {/* Placeholder for timestamp spacing to avoid overlap */}
        <div className="h-2 w-10 float-right"></div>
      </div>
    </div>
  );
};

export default MessageBubble;
