import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import { INITIAL_CHATS } from './constants';
import { Chat, Message } from './types';
import { generateReply } from './services/geminiService';
import { User, Lock } from 'lucide-react';

const App: React.FC = () => {
  const [chats, setChats] = useState<Chat[]>(INITIAL_CHATS);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  // Обработчик выбора чата
  const handleSelectChat = (chatId: string) => {
    setActiveChatId(chatId);
    // Сбросить счетчик непрочитанных
    setChats(prev => prev.map(chat => 
        chat.id === chatId ? { ...chat, unreadCount: 0 } : chat
    ));
  };

  // Возврат к списку (для мобильных)
  const handleBack = () => {
    setActiveChatId(null);
  };

  // Отправка сообщения
  const handleSendMessage = useCallback(async (text: string) => {
    if (!activeChatId) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      text,
      sender: 'me',
      timestamp: new Date(),
      status: 'sent'
    };

    // 1. Добавляем сообщение пользователя сразу
    setChats(prev => prev.map(chat => {
      if (chat.id === activeChatId) {
        return {
          ...chat,
          messages: [...chat.messages, newMessage],
          lastMessageTime: new Date(),
          isTyping: true // Включаем индикатор "печатает"
        };
      }
      return chat;
    }));

    // Помечаем сообщение как прочитанное через секунду (имитация)
    setTimeout(() => {
        setChats(prev => prev.map(c => {
            if(c.id === activeChatId) {
                return {
                    ...c,
                    messages: c.messages.map(m => m.id === newMessage.id ? {...m, status: 'read'} : m)
                }
            }
            return c;
        }))
    }, 1500);

    // 2. Готовим историю для Gemini
    const currentChat = chats.find(c => c.id === activeChatId);
    const history = currentChat ? currentChat.messages.slice(-10).map(m => ({
        role: m.sender === 'me' ? 'user' : 'model',
        parts: [{ text: m.text }]
    })) : [];

    // 3. Получаем ответ от ИИ
    const replyText = await generateReply(currentChat?.contact.name || 'Friend', history, text);

    // 4. Добавляем ответ
    setChats(prev => prev.map(chat => {
      if (chat.id === activeChatId) {
        return {
          ...chat,
          isTyping: false,
          messages: [
            ...chat.messages, 
            {
              id: (Date.now() + 1).toString(),
              text: replyText,
              sender: 'them',
              timestamp: new Date(),
              status: 'read'
            }
          ],
          lastMessageTime: new Date()
        };
      }
      return chat;
    }));

  }, [activeChatId, chats]);


  // Сортировка чатов по времени последнего сообщения
  const sortedChats = [...chats].sort((a, b) => 
    b.lastMessageTime.getTime() - a.lastMessageTime.getTime()
  );

  const activeChat = chats.find(c => c.id === activeChatId);

  return (
    <div className="relative h-screen w-full bg-gray-100 overflow-hidden flex justify-center xl:py-5">
      {/* Green background strip for desktop (like WhatsApp Web) */}
      <div className="absolute top-0 w-full h-32 bg-primary-600 z-0 md:block hidden"></div>

      <div className="z-10 w-full h-full bg-white md:max-w-[1600px] md:h-[calc(100vh-40px)] md:rounded-lg shadow-lg flex overflow-hidden">
        
        {/* Sidebar */}
        <div className={`w-full md:w-[400px] flex-shrink-0 flex flex-col ${activeChatId ? 'hidden md:flex' : 'flex'}`}>
          <Sidebar 
            chats={sortedChats} 
            activeChatId={activeChatId} 
            onSelectChat={handleSelectChat} 
            className="w-full h-full"
          />
        </div>

        {/* Chat Window or Empty State */}
        <div className={`flex-1 flex flex-col h-full bg-[#f0f2f5] ${!activeChatId ? 'hidden md:flex' : 'flex'}`}>
          {activeChat ? (
            <ChatWindow 
              chat={activeChat} 
              onBack={handleBack} 
              onSendMessage={handleSendMessage}
              className="h-full w-full"
            />
          ) : (
            /* Empty State (Desktop only) */
            <div className="hidden md:flex flex-col items-center justify-center h-full text-center p-10 bg-[#f8f9fa] border-l border-gray-200">
               <div className="w-64 h-64 mb-8 relative">
                    <img src="https://cdni.iconscout.com/illustration/premium/thumb/friends-chatting-illustration-download-in-svg-png-gif-file-formats--chat-messages-bubble-text-pack-people-illustrations-4545229.png" alt="Connect" className="opacity-80 object-contain" />
               </div>
               <h1 className="text-3xl font-light text-gray-700 mb-4">VioletApp для Windows</h1>
               <p className="text-gray-500 text-sm max-w-md leading-6">
                 Отправляйте и получайте сообщения без необходимости держать телефон подключенным.
                 <br />Используйте VioletApp на четырех устройствах и одном телефоне одновременно.
               </p>
               <div className="mt-10 flex items-center text-gray-400 text-xs">
                 <Lock size={12} className="mr-1" /> Защищено сквозным шифрованием
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
