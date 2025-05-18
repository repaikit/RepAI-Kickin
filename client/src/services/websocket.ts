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
  onChallengeResult?: (result: any) => void;
  onLeaderboardUpdate?: (message: WebSocketMessage) => void;
  onUserJoined?: (user: any) => void;
  onUserLeft?: (userId: string) => void;
  onUserUpdated?: (user: any) => void;
};

class WebSocketService {
  private ws: WebSocket | null = null;
  private callbacks: { [key: string]: Set<Function> } = {};
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor() {
    // Initialize callback sets
    this.callbacks = {
      onUserList: new Set(),
      onChallengeInvite: new Set(),
      onChallengeAccepted: new Set(),
      onChallengeDeclined: new Set(),
      onError: new Set(),
      onConnect: new Set(),
      onDisconnect: new Set(),
      onChallengeResult: new Set(),
      onLeaderboardUpdate: new Set(),
      onUserJoined: new Set(),
      onUserLeft: new Set(),
      onUserUpdated: new Set()
    };

    // Bind methods
    this.connect = this.connect.bind(this);
    this.disconnect = this.disconnect.bind(this);
    this.sendMessage = this.sendMessage.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
  }

  public setCallbacks(callbacks: Partial<WebSocketCallbacks>) {
    Object.entries(callbacks).forEach(([key, callback]) => {
      if (callback) {
        this.callbacks[key].add(callback);
        if (key === 'onUserList') {
          console.log('WebSocketService: Registered onUserList callback');
        }
      }
    });
  }

  public removeCallbacks(callbacks: Partial<WebSocketCallbacks>) {
    Object.entries(callbacks).forEach(([key, callback]) => {
      if (callback) {
        this.callbacks[key].delete(callback);
        if (key === 'onUserList') {
          console.log('WebSocketService: Removed onUserList callback');
        }
      }
    });
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
      this.callbacks.onError.forEach(callback => callback('No access token found'));
      return;
    }

    // Connect to WebSocket with access token
    const wsUrl = `${API_ENDPOINTS.ws.waitingRoom}?access_token=${accessToken}`;
    console.log('Connecting to WebSocket:', wsUrl);
    
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.callbacks.onConnect.forEach(callback => callback());
    };

    this.ws.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
      this.callbacks.onDisconnect.forEach(callback => callback());
      
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
      this.callbacks.onError.forEach(callback => callback('Connection error - Please refresh the page'));
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

  public isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  public sendMessage(message: WebSocketMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('WebSocket is not connected');
      this.callbacks.onError.forEach(callback => callback('WebSocket is not connected'));
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
    console.log('WebSocketService: Received message:', message);

    switch (message.type) {
      case 'user_list':
        console.log('WebSocketService: Handling user_list', message.users);
        this.callbacks.onUserList.forEach(callback => {
          console.log('WebSocketService: Calling onUserList callback');
          callback(message.users);
        });
        break;

      case 'challenge_invite':
        console.log('WebSocketService: Handling challenge_invite');
        this.callbacks.onChallengeInvite.forEach(callback => callback(message.from, message.from_name));
        break;

      case 'challenge_accepted':
        console.log('WebSocketService: Handling challenge_accepted');
        this.callbacks.onChallengeAccepted.forEach(callback => callback(message.match_id));
        break;

      case 'challenge_declined':
        console.log('WebSocketService: Handling challenge_declined');
        this.callbacks.onChallengeDeclined.forEach(callback => callback());
        break;

      case 'challenge_result':
        console.log('WebSocketService: Handling challenge_result');
        this.callbacks.onChallengeResult.forEach(callback => callback(message));
        break;

      case 'error':
        console.log('WebSocketService: Handling error');
        this.callbacks.onError.forEach(callback => callback(message.message));
        break;

      case 'ping':
        console.log('WebSocketService: Handling ping');
        this.sendMessage({ type: 'pong' });
        break;

      case 'leaderboard_update':
        console.log('WebSocketService: Handling leaderboard_update', message);
        if (this.callbacks.onLeaderboardUpdate.size > 0) {
          console.log('WebSocketService: Calling onLeaderboardUpdate callbacks');
          this.callbacks.onLeaderboardUpdate.forEach(callback => callback(message));
        } else {
          console.log('WebSocketService: No onLeaderboardUpdate callbacks registered');
        }
        break;

      case 'user_joined':
        console.log('WebSocketService: Handling user_joined');
        this.callbacks.onUserJoined.forEach(callback => callback(message.user));
        break;

      case 'user_left':
        console.log('WebSocketService: Handling user_left');
        this.callbacks.onUserLeft.forEach(callback => callback(message.user_id));
        break;

      case 'user_updated':
        console.log('WebSocketService: Handling user_updated');
        this.callbacks.onUserUpdated.forEach(callback => callback(message.user));
        break;

      default:
        console.log('WebSocketService: Unknown message type:', message.type);
    }
  }
}

// Create a singleton instance
export const websocketService = new WebSocketService(); 