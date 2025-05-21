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
  onMysteryBoxOpened?: (data: any) => void;
  onTaskCompleted?: (data: any) => void;
  onMatchesClaimed?: (data: any) => void;
  onChatHistory?: (message: WebSocketMessage) => void;
  onChatMessage?: (message: WebSocketMessage) => void;
};

class WebSocketService {
  private ws: WebSocket | null = null;
  private messageHandlers: ((message: any) => void)[] = [];
  private connectHandlers: (() => void)[] = [];
  private disconnectHandlers: (() => void)[] = [];
  private callbacks: { [key: string]: Set<Function> } = {};
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private messageQueue: WebSocketMessage[] = [];
  private isConnecting = false;

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
      onUserUpdated: new Set(),
      onMysteryBoxOpened: new Set(),
      onTaskCompleted: new Set(),
      onMatchesClaimed: new Set(),
      onChatHistory: new Set(),
      onChatMessage: new Set()
    };

    // Bind methods
    this.connect = this.connect.bind(this);
    this.disconnect = this.disconnect.bind(this);
    this.sendMessage = this.sendMessage.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
    this.startHeartbeat = this.startHeartbeat.bind(this);
    this.stopHeartbeat = this.stopHeartbeat.bind(this);
  }

  private startHeartbeat() {
    this.stopHeartbeat(); // Clear any existing heartbeat
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.sendMessage({ type: 'ping' });
      }
    }, 30000); // Send ping every 30 seconds
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
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
    if (this.isConnecting || this.ws?.readyState === WebSocket.OPEN) {
      console.log('WebSocketService: Already connected or connecting');
      return;
    }

    this.isConnecting = true;
    console.log('WebSocketService: Connecting...');

    // Get access token from localStorage
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
      console.error('WebSocketService: No access token found');
      this.callbacks.onError.forEach(callback => callback('No access token found'));
      this.isConnecting = false;
      return;
    }

    // Connect to WebSocket with access token
    const wsUrl = `${API_ENDPOINTS.ws.waitingRoom}?access_token=${accessToken}`;
    console.log('WebSocketService: Connecting to', wsUrl);
    
    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocketService: Connected successfully');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        this.connectHandlers.forEach(handler => handler());
        
        // Send any queued messages
        while (this.messageQueue.length > 0) {
          const message = this.messageQueue.shift();
          if (message) {
            this.sendMessage(message);
          }
        }
      };

      this.ws.onclose = (event) => {
        console.log('WebSocketService: Connection closed:', event.code, event.reason);
        this.isConnecting = false;
        this.stopHeartbeat();
        this.disconnectHandlers.forEach(handler => handler());
        
        // Attempt to reconnect
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
          console.log(`WebSocketService: Attempting to reconnect in ${delay}ms...`);
          
          this.reconnectTimeout = setTimeout(() => {
            this.connect();
          }, delay);
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
          console.log('WebSocketService: Received message:', message);
          this.handleMessage(message);
        } catch (error) {
          console.error('WebSocketService: Error parsing message:', error);
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
      this.ws.close();
      this.ws = null;
    }
  }

  public isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  public sendMessage(message: WebSocketMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        console.log('WebSocketService: Sending message:', message);
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
        this.callbacks.onError.forEach(callback => callback('Failed to send message'));
      }
    } else {
      console.log('WebSocketService: Connection not open, queueing message:', message);
      // Queue message for later if not connected
      this.messageQueue.push(message);
      if (!this.isConnecting) {
        this.connect();
      }
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

  public sendUserUpdate(userData: any) {
    this.sendMessage({
      type: 'user_update',
      user: userData
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

      case 'chat_history':
        console.log('WebSocketService: Handling chat_history. Message content:', message);
        this.callbacks.onChatHistory.forEach(callback => {
          console.log('WebSocketService: Calling onChatHistory callback with message:', message);
          callback(message);
        });
        break;

      case 'chat_message':
        console.log('WebSocketService: Handling chat_message. Message content:', message);
        this.callbacks.onChatMessage.forEach(callback => {
          console.log('WebSocketService: Calling onChatMessage callback with message:', message);
          callback(message);
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
        console.log('WebSocketService: Handling user_updated', message.user);
        this.callbacks.onUserUpdated.forEach(callback => callback(message.user));
        break;

      case 'mystery_box_opened':
        console.log('WebSocketService: Handling mystery_box_opened');
        this.callbacks.onMysteryBoxOpened.forEach(callback => callback(message));
        break;

      case 'task_completed':
        console.log('WebSocketService: Handling task_completed');
        this.callbacks.onTaskCompleted.forEach(callback => callback(message));
        break;

      case 'matches_claimed':
        console.log('WebSocketService: Handling matches_claimed');
        this.callbacks.onMatchesClaimed.forEach(callback => callback(message));
        break;

      case 'me':
        console.log('WebSocketService: Handling me message');
        // Store the user data if needed
        break;

      default:
        console.log('WebSocketService: Unknown message type:', message.type);
    }
  }

  onMessage(handler: (message: any) => void) {
    this.messageHandlers.push(handler);
    return () => {
      this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
    };
  }

  onConnect(handler: () => void) {
    this.connectHandlers.push(handler);
    return () => {
      this.connectHandlers = this.connectHandlers.filter(h => h !== handler);
    };
  }

  onDisconnect(handler: () => void) {
    this.disconnectHandlers.push(handler);
    return () => {
      this.disconnectHandlers = this.disconnectHandlers.filter(h => h !== handler);
    };
  }
}

// Create a singleton instance
export const websocketService = new WebSocketService(); 