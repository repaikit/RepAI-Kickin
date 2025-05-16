import { API_ENDPOINTS } from '@/config/api';

type WebSocketMessage = {
  type: string;
  [key: string]: any;
};

type WebSocketCallbacks = {
  onUserList?: (users: any[]) => void;
  onChallengeInvite?: (from: string, fromName: string) => void;
  onChallengeAccepted?: (matchId: string) => void;
  onChallengeDeclined?: () => void;
  onError?: (message: string) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
};

class WebSocketService {
  private ws: WebSocket | null = null;
  private callbacks: WebSocketCallbacks = {};
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor() {
    // Bind methods
    this.connect = this.connect.bind(this);
    this.disconnect = this.disconnect.bind(this);
    this.sendMessage = this.sendMessage.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
  }

  public setCallbacks(callbacks: WebSocketCallbacks) {
    this.callbacks = callbacks;
  }

  public connect() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    // Get access token from localStorage
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
      console.error('No access token found');
      this.callbacks.onError?.('No access token found');
      return;
    }

    // Connect to WebSocket with access token
    const wsUrl = `${API_ENDPOINTS.ws.waitingRoom}?access_token=${accessToken}`;
    console.log('Connecting to WebSocket:', wsUrl);
    
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.callbacks.onConnect?.();
    };

    this.ws.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
      this.callbacks.onDisconnect?.();
      
      // Attempt to reconnect
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        console.log(`Attempting to reconnect in ${delay}ms...`);
        
        this.reconnectTimeout = setTimeout(() => {
          this.connect();
        }, delay);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.callbacks.onError?.('WebSocket connection error');
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
  }

  public disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  public sendMessage(message: WebSocketMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('WebSocket is not connected');
      this.callbacks.onError?.('WebSocket is not connected');
    }
  }

  public sendChallengeRequest(toUserId: string) {
    this.sendMessage({
      type: 'challenge_request',
      to: toUserId
    });
  }

  public acceptChallenge(challengerId: string) {
    this.sendMessage({
      type: 'challenge_accept',
      to: challengerId
    });
  }

  public declineChallenge(challengerId: string) {
    this.sendMessage({
      type: 'challenge_decline',
      to: challengerId
    });
  }

  private handleMessage(message: WebSocketMessage) {
    console.log('Received message:', message);

    switch (message.type) {
      case 'user_list':
        this.callbacks.onUserList?.(message.users);
        break;

      case 'challenge_invite':
        this.callbacks.onChallengeInvite?.(message.from, message.from_name);
        break;

      case 'challenge_accepted':
        this.callbacks.onChallengeAccepted?.(message.match_id);
        break;

      case 'challenge_declined':
        this.callbacks.onChallengeDeclined?.();
        break;

      case 'error':
        this.callbacks.onError?.(message.message);
        break;

      case 'ping':
        this.sendMessage({ type: 'pong' });
        break;

      default:
        console.log('Unknown message type:', message.type);
    }
  }
}

// Create a singleton instance
export const websocketService = new WebSocketService(); 