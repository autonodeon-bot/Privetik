import { Chat } from './types';

export const INITIAL_CHATS: Chat[] = [
  {
    id: '1',
    contact: {
      id: 'u1',
      name: 'Анна Дизайнер',
      avatar: 'https://picsum.photos/200/200?random=1',
      phone: '+7 999 123-45-67',
      about: 'Живу дизайном 🎨'
    },
    messages: [
      {
        id: 'm1',
        text: 'Привет! Как тебе новый макет?',
        sender: 'them',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
        status: 'read'
      }
    ],
    unreadCount: 0,
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 60 * 2)
  },
  {
    id: '2',
    contact: {
      id: 'u2',
      name: 'Борис (Работа)',
      avatar: 'https://picsum.photos/200/200?random=2',
      phone: '+7 900 555-35-35',
      about: 'Срочно в номер'
    },
    messages: [
      {
        id: 'm2',
        text: 'Скинь отчет до вечера, пожалуйста.',
        sender: 'them',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5),
        status: 'read'
      },
      {
        id: 'm3',
        text: 'Хорошо, занимаюсь.',
        sender: 'me',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4.9),
        status: 'read'
      }
    ],
    unreadCount: 0,
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 60 * 4.9)
  },
  {
    id: '3',
    contact: {
      id: 'u3',
      name: 'Мама ❤️',
      avatar: 'https://picsum.photos/200/200?random=3',
      phone: '+7 916 000-00-00',
      about: 'Семья - это главное'
    },
    messages: [
      {
        id: 'm4',
        text: 'Купи хлеба по дороге домой',
        sender: 'them',
        timestamp: new Date(Date.now() - 1000 * 60 * 30),
        status: 'read'
      }
    ],
    unreadCount: 1,
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 30)
  },
  {
    id: '4',
    contact: {
      id: 'u4',
      name: 'Илон Маск',
      avatar: 'https://picsum.photos/200/200?random=4',
      phone: '+1 555 MARS',
      about: 'To the moon 🚀'
    },
    messages: [],
    unreadCount: 0,
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 60 * 24)
  }
];
