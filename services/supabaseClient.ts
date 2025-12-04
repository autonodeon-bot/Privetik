import { createClient, RealtimeChannel } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://umvcvhntawijmlxxrteg.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_secret_2nWrHdcmUfsLbtoPLzuA_Q_6s5nveNF';

// Проверка на валидность URL, чтобы избежать крэша при пустых env
const isValidUrl = (url: string) => {
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
};

export const supabase = createClient(
  isValidUrl(supabaseUrl) ? supabaseUrl : 'https://placeholder.supabase.co',
  supabaseKey
);

// Сервис для сигнализации (обмен SDP и ICE кандидатами)
export const subscribeToSignaling = (chatId: string, onSignal: (payload: any) => void) => {
  const channel = supabase.channel(`chat:${chatId}`);
  
  channel
    .on('broadcast', { event: 'signal' }, (payload) => {
      // Игнорируем свои же сообщения (в реальном приложении лучше фильтровать по senderId)
      onSignal(payload.payload);
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`Subscribed to signaling channel: chat:${chatId}`);
      }
    });

  return channel;
};

export const sendSignal = async (channel: RealtimeChannel | null, payload: any) => {
  if (!channel) {
    console.warn("No signaling channel available");
    return;
  }
  await channel.send({
    type: 'broadcast',
    event: 'signal',
    payload: payload,
  });
};