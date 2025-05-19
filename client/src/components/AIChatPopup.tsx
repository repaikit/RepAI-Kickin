import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, MessageCircle, X } from 'lucide-react';

interface AIMessage {
  text: string;
  sender: 'user' | 'ai'; // 'user' or 'ai'
}

export default function AIChatPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<AIMessage[]>([]); // Explicitly type messages state
  const [inputMessage, setInputMessage] = useState('');

  const handleSendMessage = (e: React.FormEvent) => { // Explicitly type event
    e.preventDefault();
    if (inputMessage.trim()) {
      // Add user message to state
      setMessages([...messages, { text: inputMessage, sender: 'user' }]);
      
      // Simulate AI response (replace with actual API call)
      setTimeout(() => {
        setMessages(prev => [...prev, { 
          text: `This is an automatic response to: "${inputMessage}"`, 
          sender: 'ai' 
        }]);
      }, 1000);
      
      setInputMessage('');
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <AnimatePresence mode="wait">
        {isOpen ? (
          // Chat Box
          <motion.div
            key="chatbox"
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="bg-white rounded-lg shadow-xl flex flex-col w-80 h-96 mb-4 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-3 bg-blue-600 text-white">
              <h3 className="font-medium">AI Chat Assistant</h3>
              <Button 
                variant="ghost" 
                size="sm" 
                className="p-1 hover:bg-blue-700 text-white"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 p-3 overflow-y-auto space-y-3">
              {messages.length === 0 ? (
                <div className="text-center text-gray-500 mt-12">
                  <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p>Hello! How can I help you?</p>
                </div>
              ) : (
                messages.map((msg: AIMessage, index) => (
                  <div 
                    key={index} 
                    className={`p-2 rounded-lg max-w-[85%] ${
                      msg.sender === 'user' 
                        ? 'ml-auto bg-blue-500 text-white rounded-tr-none' 
                        : 'bg-gray-100 rounded-tl-none'
                    }`}
                  >
                    {msg.text}
                  </div>
                ))
              )}
            </div>

            {/* Input Area */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-gray-200 flex">
              <Input
                className="flex-1 mr-2 text-sm"
                placeholder="Type your message..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
              />
              <Button type="submit" size="icon" className="bg-blue-600 hover:bg-blue-700">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </motion.div>
        ) : (
          // Circular Button
          <motion.div
            key="circleButton"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            <Button
              className="rounded-full w-14 h-14 bg-blue-600 hover:bg-blue-700 shadow-lg flex items-center justify-center"
              onClick={() => setIsOpen(true)}
            >
              <MessageCircle className="h-6 w-6" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}