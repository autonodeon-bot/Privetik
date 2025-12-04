import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import CallInterface from './components/CallInterface';
import { Chat, Message, CallSession, CallType, User } from './types';
import { generateReply } from './services/geminiService';
import { Lock, LogIn, UserPlus } from 'lucide-react';
import { supabase, subscribeToSignaling, sendSignal } from './services/supabaseClient';
import { RealtimeChannel } from '@supabase/supabase-js';

const App: React.FC = () => {
  // --- STATE ---
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [usernameInput, setUsernameInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [chats, setChats] = useState<Chat[]>([]);
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

  // --- AUTH & INITIAL DATA LOADING ---

  const handleLogin = async () => {
    if (!usernameInput.trim()) return;
    setIsLoading(true);

    try {
      // 1. Пытаемся найти пользователя
      let { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', usernameInput.trim())
        .single();

      // 2. Если нет - создаем
      if (!profile) {
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert([{ 
            username: usernameInput.trim(),
            avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${usernameInput}`
          }])
          .select()
          .single();
        
        if (createError) throw createError;
        profile = newProfile;
      }

      const user: User = {
        id: profile.id,
        name: profile.username,
        avatar: profile.avatar_url || 'https://picsum.photos/200',
        phone: 'Online',
        about: 'Hey there! I am using VioletApp.'
      };

      setCurrentUser(user);
      localStorage.setItem('violet_user', JSON.stringify(user));
      await loadUsersAndChats(user.id);

    } catch (e) {
      console.error("Login error:", e);
      alert("Ошибка входа. Проверьте соединение с Supabase.");
    } finally {
      setIsLoading(false);
    }
  };

  // Восстановление сессии
  useEffect(() => {
    const savedUser = localStorage.getItem('violet_user');
    if (savedUser) {
      const user = JSON.parse(savedUser);
      setCurrentUser(user);
      loadUsersAndChats(user.id);
    }
  }, []);

  const loadUsersAndChats = async (myId: string) => {
    // Загружаем всех пользователей кроме себя
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .neq('id', myId);

    if (profiles) {
      const initialChats: Chat[] = profiles.map(p => ({
        id: p.id, // chat id = user id собеседника для простоты (P2P чат)
        contact: {
          id: p.id,
          name: p.username,
          avatar: p.avatar_url || 'https://picsum.photos/200',
          phone: '',
          about: ''
        },
        messages: [],
        unreadCount: 0,
        lastMessageTime: new Date(p.created_at)
      }));

      // Добавляем ИИ бота
      initialChats.unshift({
        id: 'gemini_bot',
        contact: {
            id: 'gemini_bot',
            name: '✨ AI Assistant',
            avatar: 'https://upload.wikimedia.org/wikipedia/commons/8/8a/Google_Gemini_logo.svg',
            phone: 'Bot',
            about: 'Всегда готов помочь'
        },
        messages: [{
            id: 'welcome',
            text: 'Привет! Я ИИ-ассистент. Спроси меня о чем угодно.',
            sender: 'them',
            timestamp: new Date(),
            status: 'read'
        }],
        unreadCount: 0,
        lastMessageTime: new Date()
      });

      setChats(initialChats);
      
      // Загружаем историю сообщений
      loadMessages(myId);
      
      // Подписываемся на новые сообщения
      subscribeToMessages(myId);
    }
  };

  const loadMessages = async (myId: string) => {
    const { data: messages } = await supabase
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${myId},receiver_id.eq.${myId}`)
      .order('created_at', { ascending: true });

    if (messages) {
      setChats(prevChats => prevChats.map(chat => {
        // Фильтруем сообщения для этого чата
        const chatMessages = messages.filter(m => 
          (m.sender_id === myId && m.receiver_id === chat.id) ||
          (m.sender_id === chat.id && m.receiver_id === myId)
        ).map(m => ({
          id: m.id.toString(),
          text: m.content,
          sender: m.sender_id === myId ? 'me' : 'them',
          timestamp: new Date(m.created_at),
          status: m.is_read ? 'read' : 'delivered'
        } as Message));

        if (chatMessages.length > 0) {
           return { ...chat, messages: chatMessages, lastMessageTime: chatMessages[chatMessages.length-1].timestamp };
        }
        return chat;
      }));
    }
  };

  const subscribeToMessages = (myId: string) => {
    supabase
      .channel('public:messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const newMsg = payload.new;
        // Если сообщение мне или от меня (синхронизация вкладок)
        if (newMsg.receiver_id === myId || newMsg.sender_id === myId) {
            const otherPartyId = newMsg.sender_id === myId ? newMsg.receiver_id : newMsg.sender_id;
            
            setChats(prev => prev.map(chat => {
                if (chat.id === otherPartyId) {
                    return {
                        ...chat,
                        messages: [...chat.messages, {
                            id: newMsg.id.toString(),
                            text: newMsg.content,
                            sender: newMsg.sender_id === myId ? 'me' : 'them',
                            timestamp: new Date(newMsg.created_at),
                            status: 'read'
                        }],
                        lastMessageTime: new Date(newMsg.created_at),
                        unreadCount: newMsg.sender_id !== myId ? chat.unreadCount + 1 : chat.unreadCount
                    };
                }
                return chat;
            }));
        }
      })
      .subscribe();
  };


  // --- CHAT LOGIC ---

  const handleSelectChat = (chatId: string) => {
    setActiveChatId(chatId);
    setChats(prev => prev.map(chat => 
        chat.id === chatId ? { ...chat, unreadCount: 0 } : chat
    ));
  };

  const handleSendMessage = useCallback(async (text: string) => {
    if (!activeChatId || !currentUser) return;

    // Оптимистичное добавление в UI
    const tempId = Date.now().toString();
    const optimisticMessage: Message = {
      id: tempId,
      text,
      sender: 'me',
      timestamp: new Date(),
      status: 'sent'
    };

    // Обновляем UI сразу
    setChats(prev => prev.map(chat => {
      if (chat.id === activeChatId) {
        return {
          ...chat,
          messages: [...chat.messages, optimisticMessage],
          lastMessageTime: new Date(),
        };
      }
      return chat;
    }));

    // Логика для бота
    if (activeChatId === 'gemini_bot') {
        setChats(prev => prev.map(c => c.id === 'gemini_bot' ? {...c, isTyping: true} : c));
        
        const currentChat = chats.find(c => c.id === 'gemini_bot');
        const history = currentChat ? currentChat.messages.slice(-10).map(m => ({
            role: m.sender === 'me' ? 'user' : 'model',
            parts: [{ text: m.text }]
        })) : [];

        const replyText = await generateReply('Bot', history, text);
        
        setChats(prev => prev.map(chat => {
            if (chat.id === 'gemini_bot') {
              return {
                ...chat,
                isTyping: false,
                messages: [...chat.messages, {
                    id: (Date.now() + 1).toString(),
                    text: replyText,
                    sender: 'them',
                    timestamp: new Date(),
                    status: 'read'
                }],
                lastMessageTime: new Date()
              };
            }
            return chat;
          }));
        return;
    }

    // Логика для реальных пользователей (сохранение в Supabase)
    const { error } = await supabase
        .from('messages')
        .insert([{
            content: text,
            sender_id: currentUser.id,
            receiver_id: activeChatId
        }]);

    if (error) {
        console.error("Error sending message:", error);
        // Можно добавить индикатор ошибки
    }

  }, [activeChatId, currentUser, chats]);


  // --- P2P CALLS ---

  // Инициализация PeerConnection
  const createPeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' }
      ]
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && channelRef.current && currentUser) {
        sendSignal(channelRef.current, { 
          type: 'candidate', 
          candidate: event.candidate,
          senderId: currentUser.id 
        });
      }
    };

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setCallSession(prev => ({ ...prev, status: 'connected' }));
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        endCall();
      }
    };

    return pc;
  };

  // Подписка на канал сигнализации текущего пользователя (чтобы мне могли звонить)
  useEffect(() => {
    if (!currentUser) return;

    // Подписываемся на канал "личный" или "общий" для поиска звонков. 
    // В данном упрощенном варианте, каждый чат - это комната.
    // Но лучше слушать канал своего ID для входящих.
    // ДЛЯ ПРОСТОТЫ: Подписываемся на signaling канал при открытии чата, как было.
    // Но правильнее: слушать глобальный канал вызовов. 
    // Оставим логику "звонок внутри чата" для совместимости с предыдущим кодом.
  }, [currentUser]);

  // Подписка на сигналы при открытии чата (симуляция звонка внутри комнаты чата)
  useEffect(() => {
    if (!activeChatId || !currentUser || activeChatId === 'gemini_bot') return;

    const channel = subscribeToSignaling(activeChatId, async (payload) => {
      // Игнорируем свои сигналы
      if (payload.senderId === currentUser.id) return; 

      if (payload.type === 'offer') {
        if (callSession.isActive) return;

        const chat = chats.find(c => c.id === activeChatId);
        if (chat) {
          setCallSession({
            isActive: true,
            type: payload.callType || 'audio',
            status: 'incoming',
            contact: chat.contact
          });
          
          const pc = createPeerConnection();
          peerConnection.current = pc;
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        }

      } else if (payload.type === 'answer') {
        if (peerConnection.current && peerConnection.current.signalingState !== 'stable') {
           await peerConnection.current.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        }

      } else if (payload.type === 'candidate') {
        if (peerConnection.current && peerConnection.current.remoteDescription) {
          try {
            await peerConnection.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
          } catch (e) { console.error(e); }
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
  }, [activeChatId, currentUser, callSession.isActive]);


  const startCall = async (type: CallType) => {
    if (activeChatId === 'gemini_bot') {
        alert("ИИ пока не умеет разговаривать по видео :)");
        return;
    }
    const chat = chats.find(c => c.id === activeChatId);
    if (!chat || !channelRef.current || !currentUser) return;

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
        senderId: currentUser.id
      });

    } catch (err) {
      console.error("Error starting call:", err);
      alert("Ошибка доступа к камере/микрофону.");
      endCall();
    }
  };

  const answerCall = async () => {
    if (!peerConnection.current || !channelRef.current || !currentUser) return;

    setCallSession(prev => ({ ...prev, status: 'connected', startTime: new Date() }));

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callSession.type === 'video'
      });
      setLocalStream(stream);
      
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
        senderId: currentUser.id
      });

    } catch (err) {
      console.error("Error answering call:", err);
      endCall();
    }
  };

  const endCall = () => {
    if (channelRef.current && callSession.isActive && currentUser) {
      sendSignal(channelRef.current, { type: 'end', senderId: currentUser.id });
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


  // --- LOGIN SCREEN ---

  if (!currentUser) {
      return (
          <div className="flex flex-col items-center justify-center h-[100dvh] bg-gray-50 p-6">
              <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm text-center">
                  <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
                      <UserPlus size={40} className="text-primary-600" />
                  </div>
                  <h1 className="text-2xl font-bold text-gray-800 mb-2">Добро пожаловать</h1>
                  <p className="text-gray-500 mb-6">Введите имя, чтобы начать общение</p>
                  
                  <input 
                      type="text" 
                      value={usernameInput}
                      onChange={(e) => setUsernameInput(e.target.value)}
                      placeholder="Ваше имя (например, Alex)"
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none mb-4 transition"
                      onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  />
                  
                  <button 
                      onClick={handleLogin}
                      disabled={isLoading}
                      className="w-full bg-primary-700 hover:bg-primary-800 text-white font-bold py-3 rounded-lg transition flex items-center justify-center disabled:opacity-50"
                  >
                      {isLoading ? (
                          <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full mr-2"></span> 
                      ) : <LogIn size={20} className="mr-2" />}
                      Войти
                  </button>
                  <p className="mt-4 text-xs text-gray-400">
                    Имя будет уникальным идентификатором. Если имя занято, мы войдем в существующий аккаунт.
                  </p>
              </div>
          </div>
      )
  }

  // --- MAIN APP ---

  const sortedChats = [...chats].sort((a, b) => 
    b.lastMessageTime.getTime() - a.lastMessageTime.getTime()
  );

  const activeChat = chats.find(c => c.id === activeChatId);

  return (
    <div className="relative w-full bg-gray-100 overflow-hidden flex justify-center h-[100dvh]">
      <div className="absolute top-0 w-full h-32 bg-primary-600 z-0 md:block hidden"></div>

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
        
        <div className={`w-full md:w-[400px] flex-shrink-0 flex flex-col ${activeChatId ? 'hidden md:flex' : 'flex'}`}>
          <Sidebar 
            chats={sortedChats} 
            activeChatId={activeChatId} 
            onSelectChat={handleSelectChat} 
            className="w-full h-full"
          />
        </div>

        <div className={`flex-1 flex flex-col h-full bg-[#f0f2f5] ${!activeChatId ? 'hidden md:flex' : 'flex'}`}>
          {activeChat ? (
            <ChatWindow 
              chat={activeChat} 
              onBack={() => setActiveChatId(null)} 
              onSendMessage={handleSendMessage}
              onStartCall={startCall}
              className="h-full w-full"
            />
          ) : (
            <div className="hidden md:flex flex-col items-center justify-center h-full text-center p-10 bg-[#f8f9fa]">
               <h1 className="text-3xl font-light text-gray-700 mb-4">VioletApp</h1>
               <p className="text-gray-500 text-sm max-w-md">
                 Вы вошли как <span className="font-bold text-primary-600">{currentUser.name}</span>.
                 <br/>Выберите чат слева, чтобы начать общение.
               </p>
               <div className="mt-10 flex items-center text-gray-400 text-xs">
                 <Lock size={12} className="mr-1" /> Сообщения сохраняются в облаке
               </div>
               <button 
                  onClick={() => { localStorage.removeItem('violet_user'); window.location.reload(); }}
                  className="mt-8 text-red-500 text-sm hover:underline"
               >
                 Выйти из аккаунта
               </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;