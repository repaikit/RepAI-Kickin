import { API_ENDPOINTS } from '@/config/api';

// Types
export interface LeaderboardEntry {
  id: string;
  name: string;
  avatar: string;
  level: number;
  total_kicked: number;
  kicked_win: number;
  total_keep: number;
  keep_win: number;
  extra_point: number;
  total_point: number;
  bonus_point: number;
  is_pro: boolean;
  is_vip: boolean;
}

export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

type WebSocketCallbacks = {
  onLeaderboardUpdate?: (message: { leaderboard: LeaderboardEntry[] }) => void;
  onUserList?: (message: { users: any[] }) => void;
  onUserJoined?: (message: { user: any }) => void;
  onUserLeft?: (message: { user_id: string }) => void;
  onUserUpdated?: (message: { user_id: string; user: any }) => void;
  onChallengeInvite?: (message: { from: string; from_name: string }) => void;
  onChallengeResult?: (message: { 
    type: string;
    kicker_id: string;
    goalkeeper_id: string;
    kicker_skill: string;
    goalkeeper_skill: string;
    match_stats: any;
  }) => void;
  onError?: (message: string) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onChatMessage?: (message: any) => void;
};

type CallbackKey = keyof WebSocketCallbacks;

class WebSocketService {
  private ws: WebSocket | null = null;
  private callbacks: Record<CallbackKey, Set<Function>> = {
    onLeaderboardUpdate: new Set(),
    onUserList: new Set(),
    onUserJoined: new Set(),
    onUserLeft: new Set(),
    onUserUpdated: new Set(),
    onChallengeInvite: new Set(),
    onChallengeResult: new Set(),
    onError: new Set(),
    onConnect: new Set(),
    onDisconnect: new Set(),
    onChatMessage: new Set(),
  };
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isConnecting = false;
  private readonly HEARTBEAT_INTERVAL = 15000; // 15 seconds
  private readonly RECONNECT_DELAY = 1000; // Base delay of 1 second
  private readonly MAX_RECONNECT_DELAY = 30000; // Max delay of 30 seconds

  constructor() {
    // Bind methods
    this.connect = this.connect.bind(this);
    this.disconnect = this.disconnect.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
    this.startHeartbeat = this.startHeartbeat.bind(this);
    this.stopHeartbeat = this.stopHeartbeat.bind(this);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.sendMessage({ type: 'ping' });
      }
    }, this.HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private reconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('WebSocketService: Max reconnection attempts reached');
      this.callbacks.onError.forEach(callback => callback('Max reconnection attempts reached'));
      return;
    }

    const delay = Math.min(
      this.RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts),
      this.MAX_RECONNECT_DELAY
    );

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  public setCallbacks(callbacks: Partial<WebSocketCallbacks>) {
    Object.entries(callbacks).forEach(([key, callback]) => {
      if (callback) {
        const callbackKey = key as CallbackKey;
        if (this.callbacks[callbackKey]) {
          this.callbacks[callbackKey].add(callback as Function);
        }
      }
    });
  }

  public removeCallbacks(callbacks: Partial<WebSocketCallbacks>) {
    Object.entries(callbacks).forEach(([key, callback]) => {
      if (callback) {
        const callbackKey = key as CallbackKey;
        if (this.callbacks[callbackKey]) {
          this.callbacks[callbackKey].delete(callback);
        }
      }
    });
  }

  public connect() {
    if (this.isConnecting || this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.isConnecting = true;

    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
      console.error('WebSocketService: No access token found');
      this.callbacks.onError.forEach(callback => callback('No access token found'));
      this.isConnecting = false;
      return;
    }

    const wsUrl = `${API_ENDPOINTS.ws.waitingRoom}?access_token=${accessToken}`;
    
    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        this.callbacks.onConnect.forEach(handler => handler());

        this.sendMessage({ type: 'get_user_list' });
      };

      this.ws.onclose = (event) => {
        this.isConnecting = false;
        this.stopHeartbeat();
        this.callbacks.onDisconnect.forEach(handler => handler());
        
        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocketService: Connection error:', error);
        this.isConnecting = false;
        this.callbacks.onError.forEach(callback => callback('Connection error - Please refresh the page'));
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          switch (message.type) {
            case 'pong':
              break;
            case 'leaderboard_update':
              if (!message.leaderboard || !Array.isArray(message.leaderboard)) {
                console.error('WebSocketService: Invalid leaderboard_update message format', message);
                return;
              }
              this.callbacks.onLeaderboardUpdate.forEach(callback => {
                callback(message);
              });
              break;
            case 'user_list':
              if (!message.users || !Array.isArray(message.users)) {
                console.error('WebSocketService: Invalid user_list message format', message);
                return;
              }
              this.callbacks.onUserList.forEach(callback => callback(message));
              break;
            case 'user_joined':
              if (!message.user) {
                console.error('WebSocketService: Invalid user_joined message format', message);
                return;
              }
              this.callbacks.onUserJoined.forEach(callback => callback(message));
              break;
            case 'user_left':
              if (!message.user_id) {
                console.error('WebSocketService: Invalid user_left message format', message);
                return;
              }
              this.callbacks.onUserLeft.forEach(callback => callback(message));
              break;
            case 'user_updated':
              if (!message.user_id || !message.user) {
                console.error('WebSocketService: Invalid user_updated message format', message);
                return;
              }
              this.callbacks.onUserUpdated.forEach(callback => callback(message));
              break;
            case 'challenge_invite':
              if (!message.from || !message.from_name) {
                console.error('WebSocketService: Invalid challenge_invite message format', message);
                return;
              }
              this.callbacks.onChallengeInvite.forEach(callback => callback(message));
              break;
            case 'challenge_result':
              if (!message.match_stats) {
                console.error('WebSocketService: Invalid challenge_result message format', message);
                return;
              }
              this.callbacks.onChallengeResult.forEach(callback => callback(message));
              break;
            case 'chat_message':
              this.callbacks.onChatMessage.forEach(callback => callback(message));
              break;
            default:

          }
        } catch (error) {
          console.error('WebSocketService: Error parsing message:', error, 'Raw data:', event.data);
        }
      };
    } catch (error) {
      console.error('WebSocketService: Error creating connection:', error);
      this.isConnecting = false;
      this.callbacks.onError.forEach(callback => callback('Failed to establish connection'));
    }
  }

  public disconnect() {
    this.stopHeartbeat();
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close(1000, 'Client disconnecting');
      this.ws = null;
    }
  }

  public isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  public sendMessage(message: WebSocketMessage) {
    if (!this.ws) {
      console.error('WebSocketService: Cannot send message - WebSocket is null');
      return;
    }

    if (this.ws.readyState !== WebSocket.OPEN) {
      console.error('WebSocketService: Cannot send message - WebSocket is not open. Current state:', this.ws.readyState);
      return;
    }

    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('WebSocketService: Error sending message:', error);
      this.callbacks.onError.forEach(callback => callback('Failed to send message'));
    }
  }

  private handleMessage(event: MessageEvent) {
    try {
      const message = JSON.parse(event.data);

      switch (message.type) {
        case 'pong':
          break;

        case 'leaderboard_update':
          if (!message.leaderboard || !Array.isArray(message.leaderboard)) {
            console.error('WebSocketService: Invalid leaderboard_update message format', message);
            return;
          }
          this.callbacks.onLeaderboardUpdate.forEach(callback => {
            callback(message);
          });
          break;

        case 'user_list':
          if (!message.users || !Array.isArray(message.users)) {
            console.error('WebSocketService: Invalid user_list message format', message);
            return;
          }
          this.callbacks.onUserList.forEach(callback => {
            callback(message);
          });
          break;

        case 'user_joined':
          if (!message.user) {
            console.error('WebSocketService: Invalid user_joined message format', message);
            return;
          }
          this.callbacks.onUserJoined.forEach(callback => callback(message));
          break;

        case 'user_left':
          if (!message.user_id) {
            console.error('WebSocketService: Invalid user_left message format', message);
            return;
          }
          this.callbacks.onUserLeft.forEach(callback => callback(message));
          break;

        case 'user_updated':
          if (!message.user_id || !message.user) {
            console.error('WebSocketService: Invalid user_updated message format', message);
            return;
          }
          this.callbacks.onUserUpdated.forEach(callback => callback(message));
          break;

        case 'challenge_invite':
          if (!message.from || !message.from_name) {
            console.error('WebSocketService: Invalid challenge_invite message format', message);
            return;
          }
          this.callbacks.onChallengeInvite.forEach(callback => callback(message));
          break;

        case 'challenge_result':
          if (!message.match_stats) {
            console.error('WebSocketService: Invalid challenge_result message format', message);
            return;
          }
          this.callbacks.onChallengeResult.forEach(callback => callback(message));
          break;

        case 'chat_message':
          this.callbacks.onChatMessage.forEach(callback => callback(message));
          break;

        default:
 
      }
    } catch (error) {
      console.error('WebSocketService: Error handling message:', error);
    }
  }

  // Helper methods for common operations
  public sendChallengeRequest(toId: string) {
    this.sendMessage({
      type: 'challenge_request',
      to: toId
    });
  }

  public acceptChallenge(fromId: string) {
    this.sendMessage({
      type: 'challenge_accept',
      to: fromId
    });
  }

  public declineChallenge(fromId: string) {
    this.sendMessage({
      type: 'challenge_decline',
      to: fromId
    });
  }

  public sendUserUpdate(userData: any) {
    this.sendMessage({
      type: 'user_updated',
      user: userData
    });
  }
}

// Create a singleton instance
export const websocketService = new WebSocketService(); 