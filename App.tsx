import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import CallInterface from './components/CallInterface';
import { INITIAL_CHATS } from './constants';
import { Chat, Message, CallSession, CallType } from './types';
import { generateReply } from './services/geminiService';
import { Lock } from 'lucide-react';
import { supabase, subscribeToSignaling, sendSignal } from './services/supabaseClient';
import { RealtimeChannel } from '@supabase/supabase-js';

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

  // WebRTC & Signaling refs
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const handleSelectChat = (chatId: string) => {
    setActiveChatId(chatId);
    setChats(prev => prev.map(chat => 
        chat.id === chatId ? { ...chat, unreadCount: 0 } : chat
    ));
  };

  const handleBack = () => {
    setActiveChatId(null);
  };

  // --- ЛОГИКА P2P ЗВОНКОВ (WebRTC + Supabase) ---

  // Инициализация PeerConnection
  const createPeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' }
      ]
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && channelRef.current) {
        sendSignal(channelRef.current, { 
          type: 'candidate', 
          candidate: event.candidate,
          senderId: 'me' // В реальном приложении это реальный ID
        });
      }
    };

    pc.ontrack = (event) => {
      console.log('Received remote track', event.streams[0]);
      setRemoteStream(event.streams[0]);
    };

    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        setCallSession(prev => ({ ...prev, status: 'connected' }));
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        endCall();
      }
    };

    return pc;
  };

  // Подписка на сигналы при входе в чат
  useEffect(() => {
    if (!activeChatId) return;

    console.log("Subscribing to channel:", activeChatId);
    
    // Подписываемся на канал текущего чата
    const channel = subscribeToSignaling(activeChatId, async (payload) => {
      console.log("Signal received:", payload);
      
      // Игнорируем свои же сообщения (простая проверка)
      // Если бы у нас была полноценная авторизация, проверяли бы ID пользователя
      if (payload.senderId === 'me' && callSession.status === 'calling') return; 

      if (payload.type === 'offer') {
        // Входящий звонок
        if (callSession.isActive) return; // Уже в звонке

        const chat = chats.find(c => c.id === activeChatId);
        if (chat) {
          setCallSession({
            isActive: true,
            type: payload.callType || 'audio',
            status: 'incoming',
            contact: chat.contact
          });
          
          // Инициализируем PC для входящего
          const pc = createPeerConnection();
          peerConnection.current = pc;
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        }

      } else if (payload.type === 'answer') {
        // Ответ на наш звонок
        if (peerConnection.current && peerConnection.current.signalingState !== 'stable') {
           await peerConnection.current.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        }

      } else if (payload.type === 'candidate') {
        // ICE кандидат
        if (peerConnection.current && peerConnection.current.remoteDescription) {
          try {
            await peerConnection.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
          } catch (e) {
            console.error("Error adding ice candidate", e);
          }
        }
      } else if (payload.type === 'end') {
        endCall();
      }
    });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [activeChatId, callSession.isActive, callSession.status]);


  const startCall = async (type: CallType) => {
    const chat = chats.find(c => c.id === activeChatId);
    if (!chat || !channelRef.current) return;

    setCallSession({
      isActive: true,
      type,
      status: 'calling',
      contact: chat.contact
    });

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === 'video'
      });
      setLocalStream(stream);
      setIsVideoEnabled(type === 'video');

      const pc = createPeerConnection();
      peerConnection.current = pc;

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      sendSignal(channelRef.current, {
        type: 'offer',
        sdp: offer,
        callType: type,
        senderId: 'me'
      });

    } catch (err) {
      console.error("Error starting call:", err);
      alert("Ошибка доступа к медиаустройствам.");
      endCall();
    }
  };

  const answerCall = async () => {
    if (!peerConnection.current || !channelRef.current) return;

    setCallSession(prev => ({ ...prev, status: 'connected', startTime: new Date() }));

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callSession.type === 'video'
      });
      setLocalStream(stream);
      
      // Добавляем свои треки
      stream.getTracks().forEach(track => {
        if (peerConnection.current) {
            peerConnection.current.addTrack(track, stream);
        }
      });

      const answer = await peerConnection.current.createAnswer();
      await peerConnection.current.setLocalDescription(answer);

      sendSignal(channelRef.current, {
        type: 'answer',
        sdp: answer,
        senderId: 'me'
      });

    } catch (err) {
      console.error("Error answering call:", err);
      endCall();
    }
  };

  const endCall = () => {
    if (channelRef.current && callSession.isActive) {
      sendSignal(channelRef.current, { type: 'end', senderId: 'me' });
    }

    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    
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
         localStream.getVideoTracks().forEach(track => {
            track.enabled = !track.enabled;
         });
         setIsVideoEnabled(!isVideoEnabled);
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

    // Используем Gemini только если это не реальный P2P чат
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
    <div className="relative w-full bg-gray-100 overflow-hidden flex justify-center h-[100dvh]">
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
          onAnswerCall={answerCall}
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
               <h1 className="text-3xl font-light text-gray-700 mb-4">VioletApp для Android</h1>
               <p className="text-gray-500 text-sm max-w-md leading-6">
                 Отправляйте и получайте сообщения и звонки без ограничений.
                 <br />Теперь с поддержкой видеозвонков в HD качестве (P2P).
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