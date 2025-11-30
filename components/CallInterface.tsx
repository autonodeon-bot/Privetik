import React, { useEffect, useState, useRef } from 'react';
import { User, CallType, CallStatus } from '../types';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Phone, Volume2 } from 'lucide-react';

interface CallInterfaceProps {
  contact: User;
  type: CallType;
  status: CallStatus;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  onEndCall: () => void;
  onAnswerCall: () => void;
  isMuted: boolean;
  toggleMute: () => void;
  isVideoEnabled: boolean;
  toggleVideo: () => void;
}

const CallInterface: React.FC<CallInterfaceProps> = ({
  contact,
  type,
  status,
  localStream,
  remoteStream,
  onEndCall,
  onAnswerCall,
  isMuted,
  toggleMute,
  isVideoEnabled,
  toggleVideo
}) => {
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    let timer: number;
    if (status === 'connected') {
      timer = window.setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [status]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Привязка потоков к видео элементам
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, isVideoEnabled]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, status]);

  const isIncoming = status === 'incoming';

  return (
    <div className="fixed inset-0 z-50 bg-[#1c1c1e] text-white flex flex-col items-center justify-between overflow-hidden">
      
      {/* Remote Video (Full Screen Layer) */}
      <div className="absolute inset-0 w-full h-full bg-gray-900">
        {status === 'connected' && (type === 'video' || remoteStream) ? (
          <video 
            ref={remoteVideoRef} 
            autoPlay 
            playsInline 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gray-800 bg-opacity-90 backdrop-blur-md">
            <img 
              src={contact.avatar} 
              alt={contact.name} 
              className="w-32 h-32 rounded-full border-4 border-gray-700 shadow-2xl mb-6 object-cover animate-pulse"
            />
          </div>
        )}
      </div>

      {/* Header Overlay */}
      <div className="relative z-10 w-full p-6 pt-10 flex flex-col items-center bg-gradient-to-b from-black/60 to-transparent">
        <h2 className="text-2xl font-semibold tracking-wide">{contact.name}</h2>
        <p className="text-sm font-medium text-gray-300 mt-1 uppercase tracking-wider">
          {status === 'calling' ? 'Вызов...' : 
           status === 'incoming' ? 'Входящий звонок...' : 
           status === 'connected' ? formatDuration(duration) :
           status}
        </p>
        <div className="flex items-center text-xs text-gray-400 mt-1">
             <Volume2 size={12} className="mr-1" /> Защищено сквозным шифрованием
        </div>
      </div>

      {/* Local Video (PiP) */}
      {type === 'video' && localStream && status === 'connected' && (
        <div className="absolute top-24 right-4 w-32 h-48 bg-black rounded-xl overflow-hidden shadow-2xl border border-gray-700 z-20">
          <video 
            ref={localVideoRef} 
            autoPlay 
            playsInline 
            muted 
            className="w-full h-full object-cover mirror"
            style={{ transform: 'scaleX(-1)' }} 
          />
        </div>
      )}

      {/* Controls Bar */}
      <div className="relative z-10 w-full px-8 pb-10 pt-6 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex items-center justify-center space-x-6 md:space-x-10">
          
          {isIncoming ? (
            <>
              {/* Decline */}
              <button 
                onClick={onEndCall}
                className="p-5 rounded-full bg-red-500 text-white shadow-lg hover:bg-red-600 active:scale-95 transition-all duration-200 animate-bounce"
              >
                <PhoneOff size={32} fill="white" />
              </button>
              
              {/* Answer */}
              <button 
                onClick={onAnswerCall}
                className="p-5 rounded-full bg-green-500 text-white shadow-lg hover:bg-green-600 active:scale-95 transition-all duration-200 animate-bounce"
                style={{ animationDelay: '0.1s' }}
              >
                <Phone size={32} fill="white" />
              </button>
            </>
          ) : (
            <>
               <button 
                onClick={toggleVideo}
                className={`p-4 rounded-full transition-all duration-200 ${!isVideoEnabled ? 'bg-white text-black' : 'bg-gray-700/60 backdrop-blur-md text-white hover:bg-gray-600'}`}
              >
                {isVideoEnabled ? <Video size={28} /> : <VideoOff size={28} />}
              </button>

              <button 
                onClick={toggleMute}
                className={`p-4 rounded-full transition-all duration-200 ${isMuted ? 'bg-white text-black' : 'bg-gray-700/60 backdrop-blur-md text-white hover:bg-gray-600'}`}
              >
                {isMuted ? <MicOff size={28} /> : <Mic size={28} />}
              </button>

              <button 
                onClick={onEndCall}
                className="p-5 rounded-full bg-red-500 text-white shadow-lg hover:bg-red-600 active:scale-95 transition-all duration-200"
              >
                <PhoneOff size={32} fill="white" />
              </button>
            </>
          )}
          
        </div>
      </div>
    </div>
  );
};

export default CallInterface;