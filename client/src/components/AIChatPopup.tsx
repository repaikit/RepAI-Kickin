import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, MessageCircle, X, Star, Crown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { API_ENDPOINTS, defaultFetchOptions } from "@/config/api";
import { toast } from "sonner";

interface AIMessage {
  text: string;
  sender: "user" | "ai"; // 'user' or 'ai'
}

export default function AIChatPopup() {
  const { user, checkAuth } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<AIMessage[]>([]); // Explicitly type messages state
  const [inputMessage, setInputMessage] = useState("");
  const [vipCode, setVipCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showVipForm, setShowVipForm] = useState(false);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputMessage.trim()) {
      // Add user message to state
      setMessages((prev) => [...prev, { text: inputMessage, sender: "user" }]);
      setInputMessage("");
      try {
        const token = localStorage.getItem("access_token");
        const res = await fetch(API_ENDPOINTS.chat.eliza, {
          method: "POST",
          headers: {
            ...defaultFetchOptions.headers,
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ message: inputMessage }),
        });
        const data = await res.json();
        if (data.success) {
          setMessages((prev) => [...prev, { text: data.reply, sender: "ai" }]);
        } else {
          setMessages((prev) => [
            ...prev,
            { text: "Xin lỗi, có lỗi xảy ra khi xử lý!", sender: "ai" },
          ]);
        }
      } catch (error) {
        setMessages((prev) => [
          ...prev,
          { text: "Xin lỗi, không thể kết nối server!", sender: "ai" },
        ]);
      }
    }
  };

  const handleVipCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vipCode.trim()) {
      toast.error("Vui lòng nhập mã VIP");
      return;
    }

    setIsSubmitting(true);
    try {
      // Verify code
      const verifyResponse = await fetch(
        API_ENDPOINTS.vip.verifyCode(vipCode),
        {
          ...defaultFetchOptions,
          headers: {
            ...defaultFetchOptions.headers,
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
        }
      );

      if (!verifyResponse.ok) {
        const error = await verifyResponse.json();
        throw new Error(error.detail || "Mã không hợp lệ");
      }

      // Redeem code
      const redeemResponse = await fetch(
        API_ENDPOINTS.vip.redeemCode(vipCode),
        {
          ...defaultFetchOptions,
          method: "POST",
          headers: {
            ...defaultFetchOptions.headers,
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
        }
      );

      if (!redeemResponse.ok) {
        throw new Error("Không thể kích hoạt VIP");
      }

      // Update user status
      await checkAuth();
      toast.success("Kích hoạt VIP thành công!");
      setVipCode("");
    } catch (error: any) {
      toast.error(error.message || "Đã xảy ra lỗi");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Nếu không phải tài khoản VIP, hiển thị thông báo nâng cấp
  if (isOpen && !user?.is_vip) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="bg-white rounded-lg shadow-xl w-80 mb-4"
        >
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

          <div className="p-6">
            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative">
                <div className="absolute inset-0 flex items-center justify-center">
                  <Star className="w-16 h-16 text-yellow-100" />
                </div>
                <Star className="w-12 h-12 text-yellow-400 relative z-10" />
              </div>

              <h3 className="text-xl font-semibold text-gray-800">
                VIP Feature
              </h3>
              <p className="text-gray-600 text-sm">
                AI Chat Assistant là tính năng dành riêng cho thành viên VIP
              </p>

              {!showVipForm ? (
                <div className="space-y-3 w-full">
                  <Button
                    onClick={() => setShowVipForm(true)}
                    className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white"
                  >
                    <Crown className="w-4 h-4 mr-2" />
                    Nhập mã VIP
                  </Button>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-gray-200" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-white text-gray-500">hoặc</span>
                    </div>
                  </div>
                  <Link href="/profile" className="block">
                    <Button className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white">
                      Nâng cấp VIP
                    </Button>
                  </Link>
                </div>
              ) : (
                <form
                  onSubmit={handleVipCodeSubmit}
                  className="space-y-3 w-full"
                >
                  <div className="space-y-2">
                    <Input
                      value={vipCode}
                      onChange={(e) => setVipCode(e.target.value)}
                      placeholder="Nhập mã VIP của bạn"
                      className="w-full"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setShowVipForm(false)}
                    >
                      Quay lại
                    </Button>
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700"
                    >
                      {isSubmitting ? "Đang xử lý..." : "Kích hoạt"}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

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
                      msg.sender === "user"
                        ? "ml-auto bg-blue-500 text-white rounded-tr-none"
                        : "bg-gray-100 rounded-tl-none"
                    }`}
                  >
                    {msg.text}
                  </div>
                ))
              )}
            </div>

            {/* Input Area */}
            <form
              onSubmit={handleSendMessage}
              className="p-3 border-t border-gray-200 flex"
            >
              <Input
                className="flex-1 mr-2 text-sm"
                placeholder="Type your message..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
              />
              <Button
                type="submit"
                size="icon"
                className="bg-blue-600 hover:bg-blue-700"
              >
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
