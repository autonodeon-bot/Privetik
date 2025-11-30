export interface Message {
  id: string;
  text: string;
  sender: 'me' | 'them';
  timestamp: Date;
  status: 'sent' | 'delivered' | 'read';
}

export interface User {
  id: string;
  name: string;
  avatar: string;
  phone: string;
  about: string;
}

export interface Chat {
  id: string;
  contact: User;
  messages: Message[];
  unreadCount: number;
  lastMessageTime: Date;
  isTyping?: boolean;
}
