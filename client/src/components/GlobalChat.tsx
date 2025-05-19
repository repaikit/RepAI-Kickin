import React, { useState, useEffect, useRef } from 'react';
import { websocketService } from '@/services/websocket';
import { useAuth } from '@/contexts/AuthContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, Users, Smile, PaperclipIcon, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';

interface ChatMessage {
  from: {
    id: string;
    name: string;
    avatar: string;
  };
  message: string;
  timestamp: string;
}

interface UpdatedUser {
  id: string;
  name?: string;
  avatar?: string;
  // add other fields if needed from the user_updated message
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
    const handleMessage = (message: any) => {
      console.log('GlobalChat received message:', message);
      if (message.type === 'chat_history') {
        // The messages are already in the correct format, no need to transform
        setMessages(message.messages);
        console.log('Chat History set:', message.messages);
        setTimeout(scrollToBottom, 100);

      } else if (message.type === 'chat_message') {
        setMessages(prev => {
          const newMessages = [...prev, message];
          console.log('New Chat Message added and set:', message);
          return newMessages;
        });
        if (isAtBottom) {
          setTimeout(scrollToBottom, 100);
        } else {
          // If not at the bottom, show the new message button
          setShowNewMessageButton(true);
        }

      } else if (message.type === 'user_count') {
        setUserCount(message.count);
      } else if (message.type === 'typing_status') {
        setIsTyping(message.isTyping);
      }
    };

    const handleConnect = () => {
      console.log('GlobalChat: WebSocket connected');
      // Request chat history after connection is established
      console.log('GlobalChat: Requesting chat history...');
      websocketService.sendMessage({ type: 'get_chat_history' });
      console.log('GlobalChat: get_chat_history message sent.');
    };

    const handleUserUpdated = (updatedUser: UpdatedUser) => {
      console.log('GlobalChat: User updated via WebSocket', updatedUser);
      // Update the name and avatar in existing messages from this user
      setMessages(prevMessages =>
        prevMessages.map(msg =>
          msg.from.id === updatedUser.id
            ? { ...msg, from: { ...msg.from, name: updatedUser.name ?? msg.from.name, avatar: updatedUser.avatar ?? msg.from.avatar } }
            : msg
        )
      );
    };

    websocketService.setCallbacks({
      onUserList: (users) => {
        if (users && users.length) {
          setUserCount(users.length);
        }
      },
      onChatHistory: handleMessage,
      onChatMessage: handleMessage,
      onConnect: handleConnect,
      onUserUpdated: handleUserUpdated
    });

    if (websocketService.isConnected()) {
        console.log('GlobalChat: WebSocket already connected, requesting history immediately.');
        handleConnect(); // Call handleConnect if already connected
    }

    return () => {
      websocketService.removeCallbacks({
        onChatHistory: handleMessage,
        onChatMessage: handleMessage,
        onConnect: handleConnect,
        onUserUpdated: handleUserUpdated
      });
    };
  }, [isAtBottom]); // Add isAtBottom as a dependency

  // Handle scrolling to update isAtBottom state
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
    const atBottom = scrollHeight - scrollTop <= clientHeight + 1; // Add a small buffer
    setIsAtBottom(atBottom);

    // Hide new message button if user manually scrolls to bottom
    if (atBottom) {
      setShowNewMessageButton(false);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    websocketService.sendMessage({
      type: 'chat_message',
      message: newMessage.trim()
    });

    setNewMessage('');
    // After sending message, scroll to bottom and hide button
    setTimeout(scrollToBottom, 100);
    setShowNewMessageButton(false);
  };

  const groupedMessages = messages.reduce((groups: any[], message, index) => {
    const prevMessage = messages[index - 1];

    const shouldGroup = prevMessage &&
                        prevMessage.from.id === message.from.id &&
                        new Date(message.timestamp).getTime() - new Date(prevMessage.timestamp).getTime() < 60000; // 1 minute threshold

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
            const isMyMessage = group.sender.id === user?._id;
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