import { useEffect, useRef } from 'react';
import { websocketService } from '@/services/websocket';

export function useWebSocket() {
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Connect to WebSocket when component mounts
    websocketService.connect();

    // Get the WebSocket instance
    const ws = websocketService['ws'];
    socketRef.current = ws;

    // Cleanup on unmount
    return () => {
      websocketService.disconnect();
    };
  }, []);

  return {
    socket: socketRef.current,
    sendMessage: websocketService.sendMessage.bind(websocketService)
  };
} 