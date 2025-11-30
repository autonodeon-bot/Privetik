import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import CallInterface from './components/CallInterface';
import { INITIAL_CHATS } from './constants';
import { Chat, Message, CallSession, CallType } from './types';
import { generateReply } from './services/geminiService';
import { User, Lock } from 'lucide-react';

// Для реальной P2P связи через Supabase раскомментируйте импорт
// import { supabase, subscribeToSignaling, sendSignal } from './services/supabaseClient';

const App: React.FC = () => {
  const [chats, setChats] = useState<Chat[]>(INITIAL_CHATS);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  // Состояние звонка
  const [callSession, setCallSession] = useState<CallSession>({
    isActive: false,
    type: 'audio',
    status: 'idle',
    contact: null
  });

  // Медиа потоки
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);

  // WebRTC refs
  const peerConnection = useRef<RTCPeerConnection | null>(null);

  const handleSelectChat = (chatId: string) => {
    setActiveChatId(chatId);
    setChats(prev => prev.map(chat => 
        chat.id === chatId ? { ...chat, unreadCount: 0 } : chat
    ));
  };

  const handleBack = () => {
    setActiveChatId(null);
  };

  // --- ЛОГИКА ЗВОНКОВ ---

  const startCall = async (type: CallType) => {
    const chat = chats.find(c => c.id === activeChatId);
    if (!chat) return;

    setCallSession({
      isActive: true,
      type,
      status: 'calling',
      contact: chat.contact
    });

    try {
      // 1. Получаем доступ к медиа
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === 'video'
      });
      setLocalStream(stream);
      setIsVideoEnabled(type === 'video');

      // Симуляция: через 2 секунды "собеседник" отвечает
      // В реальном приложении здесь отправляется offer через Supabase
      setTimeout(() => {
        setCallSession(prev => ({ ...prev, status: 'connected', startTime: new Date() }));
        
        // Для демонстрации: используем свой же поток как удаленный (Loopback)
        // Чтобы пользователь видел хоть что-то вместо черного экрана
        // В продакшене здесь будет поток от peerConnection.ontrack
        const mockRemoteStream = new MediaStream();
        stream.getTracks().forEach(track => mockRemoteStream.addTrack(track.clone()));
        setRemoteStream(mockRemoteStream);

      }, 2000);

    } catch (err) {
      console.error("Ошибка доступа к камере/микрофону:", err);
      alert("Не удалось получить доступ к камере или микрофону. Проверьте разрешения.");
      endCall();
    }
  };

  const endCall = () => {
    // Останавливаем треки
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (remoteStream) {
        remoteStream.getTracks().forEach(track => track.stop());
    }
    
    // Сбрасываем PeerConnection
    if (peerConnection.current) {
        peerConnection.current.close();
        peerConnection.current = null;
    }

    setLocalStream(null);
    setRemoteStream(null);
    setCallSession({
      isActive: false,
      type: 'audio',
      status: 'idle',
      contact: null
    });
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
        // Если это видеозвонок, включаем/выключаем видео трек
        if (callSession.type === 'video') {
             localStream.getVideoTracks().forEach(track => {
                track.enabled = !track.enabled;
             });
             setIsVideoEnabled(!isVideoEnabled);
        } else {
            // Если это аудиозвонок, попытка включить видео (требует нового запроса прав в реальности)
            // Упростим для демо: просто меняем стейт
             setIsVideoEnabled(!isVideoEnabled);
        }
    }
  };


  // --- ЛОГИКА СООБЩЕНИЙ ---

  const handleSendMessage = useCallback(async (text: string) => {
    if (!activeChatId) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      text,
      sender: 'me',
      timestamp: new Date(),
      status: 'sent'
    };

    setChats(prev => prev.map(chat => {
      if (chat.id === activeChatId) {
        return {
          ...chat,
          messages: [...chat.messages, newMessage],
          lastMessageTime: new Date(),
          isTyping: true
        };
      }
      return chat;
    }));

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

    const currentChat = chats.find(c => c.id === activeChatId);
    const history = currentChat ? currentChat.messages.slice(-10).map(m => ({
        role: m.sender === 'me' ? 'user' : 'model',
        parts: [{ text: m.text }]
    })) : [];

    const replyText = await generateReply(currentChat?.contact.name || 'Friend', history, text);

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


  const sortedChats = [...chats].sort((a, b) => 
    b.lastMessageTime.getTime() - a.lastMessageTime.getTime()
  );

  const activeChat = chats.find(c => c.id === activeChatId);

  return (
    <div className="relative h-screen w-full bg-gray-100 overflow-hidden flex justify-center xl:py-5">
      {/* Green background strip */}
      <div className="absolute top-0 w-full h-32 bg-primary-600 z-0 md:block hidden"></div>

      {/* Call Interface Modal */}
      {callSession.isActive && callSession.contact && (
        <CallInterface 
          contact={callSession.contact}
          type={callSession.type}
          status={callSession.status}
          localStream={localStream}
          remoteStream={remoteStream}
          onEndCall={endCall}
          isMuted={isMuted}
          toggleMute={toggleMute}
          isVideoEnabled={isVideoEnabled}
          toggleVideo={toggleVideo}
        />
      )}

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

        {/* Chat Window */}
        <div className={`flex-1 flex flex-col h-full bg-[#f0f2f5] ${!activeChatId ? 'hidden md:flex' : 'flex'}`}>
          {activeChat ? (
            <ChatWindow 
              chat={activeChat} 
              onBack={handleBack} 
              onSendMessage={handleSendMessage}
              onStartCall={startCall}
              className="h-full w-full"
            />
          ) : (
            <div className="hidden md:flex flex-col items-center justify-center h-full text-center p-10 bg-[#f8f9fa] border-l border-gray-200">
               <div className="w-64 h-64 mb-8 relative">
                    <img src="https://cdni.iconscout.com/illustration/premium/thumb/friends-chatting-illustration-download-in-svg-png-gif-file-formats--chat-messages-bubble-text-pack-people-illustrations-4545229.png" alt="Connect" className="opacity-80 object-contain" />
               </div>
               <h1 className="text-3xl font-light text-gray-700 mb-4">VioletApp для Windows</h1>
               <p className="text-gray-500 text-sm max-w-md leading-6">
                 Отправляйте и получайте сообщения и звонки без ограничений.
                 <br />Теперь с поддержкой видеозвонков в HD качестве.
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