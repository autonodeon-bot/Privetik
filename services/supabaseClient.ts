import { createClient } from '@supabase/supabase-js';

// ПРИМЕЧАНИЕ: В реальном проекте эти значения берутся из process.env
// При деплое на Vercel настройте переменные окружения:
// NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xyzcompany.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'public-anon-key';

export const supabase = createClient(supabaseUrl, supabaseKey);

// Сервис для сигнализации (обмен SDP и ICE кандидатами)
export const subscribeToSignaling = (chatId: string, onSignal: (payload: any) => void) => {
  const channel = supabase.channel(`chat:${chatId}`);
  
  channel
    .on('broadcast', { event: 'signal' }, (payload) => {
      onSignal(payload);
    })
    .subscribe();

  return channel;
};

export const sendSignal = async (channel: any, payload: any) => {
  if (!channel) return;
  await channel.send({
    type: 'broadcast',
    event: 'signal',
    payload: payload,
  });
};