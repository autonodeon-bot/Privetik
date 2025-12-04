
import React from 'react';
import { Search, MoreVertical, MessageSquarePlus, CircleDashed, Hash } from 'lucide-react';
import { Chat } from '../types';

interface SidebarProps {
  currentUserUin?: number;
  chats: Chat[];
  activeChatId: string | null;
  onSelectChat: (chatId: string) => void;
  className?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ currentUserUin, chats, activeChatId, onSelectChat, className = '' }) => {
  
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`flex flex-col h-full border-r border-gray-200 bg-white ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center overflow-hidden cursor-pointer border border-primary-200">
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUserUin}`} alt="Me" className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col">
                <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Мой UIN</span>
                <span className="text-sm font-bold text-primary-700 font-mono">#{currentUserUin || '...'}</span>
            </div>
        </div>
        
        <div className="flex space-x-2 text-gray-500">
          <button className="hover:bg-gray-200 p-2 rounded-full transition"><CircleDashed size={20} /></button>
          <button className="hover:bg-gray-200 p-2 rounded-full transition"><MessageSquarePlus size={20} /></button>
          <button className="hover:bg-gray-200 p-2 rounded-full transition"><MoreVertical size={20} /></button>
        </div>
      </div>

      {/* Search */}
      <div className="p-2 bg-white border-b border-gray-100">
        <div className="flex items-center bg-gray-100 rounded-lg px-4 py-2">
          <Search size={18} className="text-gray-400 mr-3" />
          <input 
            type="text" 
            placeholder="Поиск по имени или UIN" 
            className="bg-transparent border-none outline-none w-full text-sm placeholder-gray-500"
          />
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {chats.map((chat) => (
          <div 
            key={chat.id}
            onClick={() => onSelectChat(chat.id)}
            className={`flex items-center px-3 py-3 cursor-pointer transition hover:bg-gray-50 ${activeChatId === chat.id ? 'bg-gray-100' : ''}`}
          >
            <div className="relative flex-shrink-0">
                <img 
                    src={chat.contact.avatar} 
                    alt={chat.contact.name} 
                    className="w-12 h-12 rounded-full object-cover border border-gray-100"
                />
            </div>
            <div className="ml-3 flex-1 border-b border-gray-100 pb-3 min-w-0">
              <div className="flex justify-between items-baseline">
                <div className="flex flex-col min-w-0">
                    <h3 className="text-base font-medium text-gray-900 truncate">{chat.contact.name}</h3>
                    {chat.contact.uin > 0 && (
                        <span className="text-[10px] text-primary-600 font-mono flex items-center">
                            <Hash size={8} className="mr-0.5" />
                            {chat.contact.uin}
                        </span>
                    )}
                </div>
                <span className={`text-xs ml-2 flex-shrink-0 ${chat.unreadCount > 0 ? 'text-green-500 font-medium' : 'text-gray-400'}`}>
                    {chat.messages.length > 0 ? formatTime(chat.messages[chat.messages.length-1].timestamp) : ''}
                </span>
              </div>
              <div className="flex justify-between items-center mt-1">
                <p className="text-sm text-gray-500 truncate pr-2">
                   {chat.isTyping ? <span className="text-primary-600 font-medium">печатает...</span> : 
                    (chat.messages.length > 0 ? chat.messages[chat.messages.length-1].text : 'Нет сообщений')
                   }
                </p>
                {chat.unreadCount > 0 && (
                  <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-xs text-white font-medium">{chat.unreadCount}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Sidebar;
