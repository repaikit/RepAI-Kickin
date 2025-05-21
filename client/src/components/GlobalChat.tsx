import React, { useState, useEffect, useRef } from 'react';
import { websocketService } from '@/services/websocket';
import { useAuth } from '@/contexts/AuthContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, Users, Smile, PaperclipIcon, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import { API_ENDPOINTS, defaultFetchOptions } from '@/config/api';

interface ChatMessage {
  type: string;
  from_id: string;
  message: string;
  timestamp: string;
  from: {
    id: string;
    name: string;
    avatar: string;
    user_type: string;
    role: string;
    is_active: boolean;
    is_verified: boolean;
    trend: string;
    level: number;
    is_pro: boolean;
    position: string;
    total_point: number;
    bonus_point: number;
    total_kicked: number;
    kicked_win: number;
    total_keep: number;
    keep_win: number;
    legend_level: number;
    vip_level: string;
  };
}

interface UpdatedUser {
  id: string;
  name?: string;
  avatar?: string;
  // add other fields if needed from the user_updated message
}

interface MessageGroup {
  sender: {
    id: string;
    name: string;
    avatar: string;
    user_type: string;
    role: string;
    is_active: boolean;
    is_verified: boolean;
    trend: string;
    level: number;
    is_pro: boolean;
    position: string;
    total_point: number;
    bonus_point: number;
    total_kicked: number;
    kicked_win: number;
    total_keep: number;
    keep_win: number;
    legend_level: number;
    vip_level: string;
  };
  messages: ChatMessage[];
  timestamp: string;
}

export default function GlobalChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [userCount, setUserCount] = useState(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showNewMessageButton, setShowNewMessageButton] = useState(false);
  const { user } = useAuth();
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Function to scroll to the bottom
  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollableElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollableElement) {
         scrollableElement.scrollTop = scrollableElement.scrollHeight;
      } else {
         scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
      }
    }
  };

  useEffect(() => {
    const fetchChatHistory = async () => {
      try {
        const token = localStorage.getItem('access_token');
        if (!token) {
          console.error('[GlobalChat] Access token not found!');
          return;
        }

        const response = await fetch(API_ENDPOINTS.chat.getHistory, {
          method: 'GET',
          headers: {
            ...defaultFetchOptions.headers,
            'Authorization': `Bearer ${token}`,
          },
        });

        const data = await response.json();

        if (data.success) {
          
          const transformedMessages = data.data.messages.map((msg: any) => {
            return {
              ...msg,
              from: msg.from || {
                id: msg.from_id,
                name: 'Unknown User',
                avatar: '',
                user_type: 'user',
                role: 'user',
                is_active: true,
                is_verified: false,
                trend: 'neutral',
                level: 1,
                is_pro: false,
                position: 'both',
                total_point: 0,
                bonus_point: 0,
                total_kicked: 0,
                kicked_win: 0,
                total_keep: 0,
                keep_win: 0,
                legend_level: 0,
                vip_level: 'NONE'
              }
            };
          });
          
          setMessages(transformedMessages);
          
          requestAnimationFrame(() => {
            scrollToBottom();
          });
        } else {
          console.error('[GlobalChat] API response success flag is false');
        }
      } catch (error) {
        console.error('[GlobalChat] Error fetching chat history:', error);
      }
    };

    const handleMessage = (message: any) => {
      if (message.type === 'chat_message') {
        const incomingMessage: ChatMessage = {
          type: message.type,
          from_id: String(message.from_id),
          message: message.message,
          timestamp: message.timestamp,
          from: message.from
        };

        setMessages(prev => {
          const newMessages = [...prev, incomingMessage];
          return newMessages.sort((a, b) => 
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );
        });
      } else if (message.type === 'user_count') {
        setUserCount(message.count);
      } else if (message.type === 'typing_status') {
        setIsTyping(message.isTyping);
      }
    };

    const handleConnect = () => {
      fetchChatHistory();
    };

    const handleUserUpdated = (message: { user_id: string; user: any }) => {
      setMessages(prevMessages =>
        prevMessages.map(msg =>
          msg.from_id === message.user_id
            ? {
                ...msg,
                from: {
                  ...msg.from,
                  name: message.user.name || msg.from.name,
                  avatar: message.user.avatar || msg.from.avatar,
                }
              }
            : msg
        )
      );
    };

    fetchChatHistory();
    
    websocketService.setCallbacks({
      onUserList: (message) => {
        if (message.users && message.users.length) {
          setUserCount(message.users.length);
        }
      },
      onChatMessage: handleMessage,
      onConnect: handleConnect,
      onUserUpdated: handleUserUpdated
    });

    return () => {
      websocketService.removeCallbacks({
        onChatMessage: handleMessage,
        onConnect: handleConnect,
        onUserUpdated: handleUserUpdated
      });
    };
  }, []);

  // Optimize scroll handling
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
    const atBottom = scrollHeight - scrollTop <= clientHeight + 5;
    setIsAtBottom(atBottom);
    if (atBottom) {
      setShowNewMessageButton(false);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    // Chỉ gửi lên server, KHÔNG thêm vào state ở đây nữa
    websocketService.sendMessage({
      type: 'chat_message',
      message: newMessage.trim()
    });

    setNewMessage('');
    // Có thể scrollToBottom nếu muốn
    requestAnimationFrame(() => {
      scrollToBottom();
      setShowNewMessageButton(false);
    });
  };

  const groupedMessages = messages.reduce<MessageGroup[]>((groups, message, index) => {
    const prevMessage = messages[index - 1];
    const currentUserId = user?._id ? String(user._id) : undefined;
    const messageSenderId = String(message.from_id);
    const shouldGroup = prevMessage &&
      String(prevMessage.from_id) === messageSenderId &&
      new Date(message.timestamp).getTime() - new Date(prevMessage.timestamp).getTime() < 60000;

    if (shouldGroup) {
      groups[groups.length - 1].messages.push(message);
    } else {
      groups.push({
        sender: message.from,
        messages: [message],
        timestamp: message.timestamp
      });
    }

    return groups;
  }, []);

  const renderMessageTime = (timestamp: string) => {
    const messageDate = new Date(timestamp);
    const today = new Date();

    if (messageDate.toDateString() === today.toDateString()) {
      return format(messageDate, 'HH:mm');
    } else {
      return format(messageDate, 'MMM d, HH:mm');
    }
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);

    websocketService.sendMessage({
      type: 'typing_status',
      isTyping: e.target.value.length > 0
    });
  };

  // Effect: Khi messages thay đổi, nếu đang ở cuối thì scroll xuống cuối, nếu không thì hiện nút tin nhắn mới
  useEffect(() => {
    if (isAtBottom) {
      requestAnimationFrame(() => {
        scrollToBottom();
        setShowNewMessageButton(false);
      });
    } else {
      setShowNewMessageButton(true);
    }
  }, [messages]);

  // Add effect to log messages state changes
  useEffect(() => {
  }, [messages]);

  return (
    <section className="w-full bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl shadow-lg p-2 flex flex-col h-[500px] border border-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between bg-white p-4 rounded-t-lg border-b border-slate-100">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-500 p-2 rounded-lg">
            <Users className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Global Chat</h2>
            <div className="flex items-center text-xs text-slate-500">
              <span className="flex items-center">
                <span className="h-2 w-2 bg-green-500 rounded-full mr-1"></span>
                {userCount} online
              </span>
              {isTyping && (
                <span className="ml-2 flex items-center">
                  <motion.span
                    className="h-1.5 w-1.5 bg-blue-500 rounded-full mr-0.5"
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                  <motion.span
                    className="h-1.5 w-1.5 bg-blue-500 rounded-full mr-0.5"
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
                  />
                  <motion.span
                    className="h-1.5 w-1.5 bg-blue-500 rounded-full"
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}
                  />
                  <span className="ml-1">Someone is typing...</span>
                </span>
              )}
            </div>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-700">
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 px-4 py-2" ref={scrollAreaRef} onScroll={handleScroll}>
        <div className="space-y-4">
          {groupedMessages.map((group, groupIndex) => {
            // Ensure user?._id is treated as a string for comparison
            const currentUserId = user?._id ? String(user._id) : undefined;
            const isMyMessage = group.sender.id === currentUserId;
            return (
              <motion.div
                key={groupIndex}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex max-w-[80%] ${isMyMessage ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`flex-shrink-0 ${isMyMessage ? 'ml-2' : 'mr-2'}`}>
                    <div className="relative">
                      <img
                        src={group.sender.avatar || '/default-avatar.png'}
                        alt={group.sender.name}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                      <div className="absolute bottom-0 right-0 h-2 w-2 bg-green-500 rounded-full border border-white"></div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className={`${isMyMessage ? 'text-right' : 'text-left'} mb-1`}>
                      <span className="text-xs font-medium text-slate-600">{group.sender.name}</span>
                    </div>

                    {group.messages.map((msg: ChatMessage, msgIndex: number) => (
                      <div key={msgIndex} className="flex flex-col">
                        <div
                          className={`p-3 rounded-2xl ${
                            isMyMessage
                              ? 'bg-blue-500 text-white rounded-tr-none'
                              : 'bg-white text-slate-800 rounded-tl-none border border-slate-200'
                          }`}
                        >
                          <p className={`text-sm ${isMyMessage ? 'text-white' : 'text-slate-800'}`}>
                            {msg.message}
                          </p>
                        </div>

                        {msgIndex === group.messages.length - 1 && (
                          <div className={`mt-1 ${isMyMessage ? 'text-right' : 'text-left'}`}>
                            <span className="text-xs text-slate-500">
                              {renderMessageTime(msg.timestamp)}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </ScrollArea>

      {/* New message button */}
      <AnimatePresence>
        {showNewMessageButton && !isAtBottom && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-20 left-1/2 transform -translate-x-1/2 z-10"
          >
            <Button
              variant="secondary"
              size="sm"
              onClick={scrollToBottom}
              className="shadow-md"
            >
              Tin nhắn mới
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Area */}
      <div className="bg-white p-3 rounded-b-lg border-t border-slate-100">
        <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-slate-500 hover:text-blue-500 hover:bg-blue-50"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          >
            <Smile className="h-5 w-5" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-slate-500 hover:text-blue-500 hover:bg-blue-50"
          >
            <PaperclipIcon className="h-5 w-5" />
          </Button>

          <div className="flex-1 relative">
            <Input
              value={newMessage}
              onChange={handleTyping}
              placeholder="Type your message..."
              className="pr-12 focus-visible:ring-blue-500 bg-slate-50 border-slate-200"
            />
            <Button
              type="submit"
              size="icon"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 bg-blue-500 hover:bg-blue-600 text-white h-8 w-8"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}