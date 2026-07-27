"use client";

import { useChat, useLocalParticipant } from "@livekit/components-react";
import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";

export default function ChatBox() {
  const { send, chatMessages, isSending } = useChat();
  const { localParticipant } = useLocalParticipant();
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (message.trim() && !isSending) {
      send(message.trim());
      setMessage("");
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#fbf9f8]">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="flex justify-center mb-2">
          <span className="text-[11px] text-[#787582] bg-[#f0eded] px-3 py-1 rounded-full font-medium">
            Class started · ask your questions below
          </span>
        </div>
        
        {chatMessages.map((msg) => {
          const isMe = msg.from?.identity === localParticipant?.identity;
          const initials = msg.from?.name?.slice(0, 2).toUpperCase() || msg.from?.identity?.slice(0, 2).toUpperCase() || "U";
          
          return (
            <div key={msg.id} className={`flex gap-2.5 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
              {!isMe && (
                <div className="w-7 h-7 rounded-full bg-[#2e2877] flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mt-1">
                  {initials}
                </div>
              )}
              <div className={`flex flex-col ${isMe ? "items-end" : "items-start"} max-w-[85%]`}>
                {!isMe && (
                  <span className="text-[11px] font-semibold text-[#787582] ml-1 mb-1">
                    {msg.from?.name || msg.from?.identity}
                  </span>
                )}
                <div className={`px-3 py-2 text-[13px] break-words whitespace-pre-wrap
                  ${isMe 
                    ? "bg-[#180d62] text-white rounded-2xl rounded-tr-sm" 
                    : "bg-[#ffffff] text-[#1b1c1c] border border-[#e4e2e1] rounded-2xl rounded-tl-sm shadow-sm"
                  }`}
                >
                  {msg.message}
                </div>
                <span className="text-[9px] text-[#c8c5d2] mt-1 mx-1">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-[#e4e2e1] p-3 bg-white shadow-[0_-4px_20px_rgba(24,13,98,0.02)]">
        <form 
          onSubmit={handleSend}
          className="flex items-center gap-2 bg-[#fbf9f8] border border-[#e4e2e1] rounded-xl px-3 py-2.5 focus-within:border-[#180d62] focus-within:ring-1 focus-within:ring-[#180d62]/20 transition-all"
        >
          <input
            className="flex-1 text-base md:text-[13px] text-[#1b1c1c] placeholder:text-[#787582] outline-none bg-transparent"
            placeholder="Send a message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={isSending}
            autoComplete="off"
          />
          <button 
            type="submit"
            disabled={!message.trim() || isSending}
            className={`transition-colors flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg
              ${message.trim() && !isSending 
                ? "bg-[#180d62] text-white hover:bg-[#2e2877]" 
                : "text-[#c8c5d2]"
              }`}
          >
            <Send size={14} className={message.trim() && !isSending ? "ml-0.5" : ""} />
          </button>
        </form>
      </div>
    </div>
  );
}
