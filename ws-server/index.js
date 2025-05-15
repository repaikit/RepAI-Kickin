const { Server } = require('ws');
const url = require('url');
const { Redis } = require('@upstash/redis');
require('dotenv').config();

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

function log(...args) {
  console.log('[WS]', ...args);
}

// Dynamic import node-fetch cho CommonJS
const nodeFetch = (...args) => import('node-fetch').then(mod => mod.default(...args));

module.exports = (req, res) => {
  if (!global.wss) {
    global.wss = new Server({ noServer: true });

    global.wss.on('connection', (ws, request, sessionId) => {
      log('New connection:', sessionId);

      ws.on('message', async (msg) => {
        log('Received message from', sessionId, ':', msg);
        let message;
        try {
          message = JSON.parse(msg);
        } catch {
          log('Invalid JSON from', sessionId);
          return;
        }

        if (message.type === 'init') {
          // Gọi API Python để xác thực sessionId
          const apiUrl =
            process.env.API_BASE_URL ||
            'http://localhost:5000/api/me?session_id=' + sessionId;
          log('Validating sessionId with API:', apiUrl);
          try {
            const apiRes = await nodeFetch(apiUrl);
            log('API response status:', apiRes.status);
            if (!apiRes.ok) {
              log('User not found for sessionId', sessionId);
              ws.close(4001, 'User not found');
              return;
            }
            const userData = await apiRes.json();
            if (!userData || userData.detail || Object.keys(userData).length === 0) {
              log('User not found in response for sessionId', sessionId);
              ws.close(4001, 'User not found');
              return;
            }
            log('User validated:', userData);
            // Lưu trạng thái online vào Redis với TTL 60s
            await redis.set(`online:${sessionId}`, JSON.stringify({
              id: userData._id || sessionId,
              name: userData.name || 'Unknown',
              type: userData.user_type || 'unknown',
              avatar: userData.avatar || '',
              remaining_matches: userData.remaining_matches || 0,
              wins: userData.wins || 0,
              losses: userData.losses || 0,
              connected_at: new Date().toISOString()
            }), { ex: 60 });

            // Gửi thông tin user vừa connect
            ws.send(JSON.stringify({
              type: 'me',
              user: {
                user_id: userData._id || sessionId,
                name: userData.name || 'Unknown',
                type: userData.user_type || 'unknown',
                avatar: userData.avatar || '',
                wins: userData.wins || 0,
                losses: userData.losses || 0,
                connected_at: new Date().toISOString(),
                remaining_matches: userData.remaining_matches || 0
              }
            }));

            // Lấy danh sách user online từ Redis
            const keys = await redis.keys('online:*');
            const users = [];
            for (const key of keys) {
              const val = await redis.get(key);
              if (val) users.push(JSON.parse(val));
            }
            ws.send(JSON.stringify({
              type: 'user_list',
              users
            }));
            // Broadcast user_joined cho các client khác
            global.wss.clients.forEach(client => {
              if (client !== ws && client.readyState === ws.OPEN) {
                client.send(JSON.stringify({ type: 'user_joined', user: {
                  id: userData._id || sessionId,
                  name: userData.name || 'Unknown',
                  type: userData.user_type || 'unknown',
                  avatar: userData.avatar || '',
                  remaining_matches: userData.remaining_matches || 0,
                  wins: userData.wins || 0,
                  losses: userData.losses || 0,
                  connected_at: new Date().toISOString()
                }}));
              }
            });
          } catch (err) {
            log('Error validating user:', err);
            ws.close(4001, 'User not found');
          }
        }

        if (message.type === 'chat') {
          log('Broadcast chat from', sessionId, ':', message.message);
          // Lấy user info từ Redis
          let user = { id: sessionId, name: 'Unknown' };
          try {
            const val = await redis.get(`online:${sessionId}`);
            if (val) user = JSON.parse(val);
          } catch {}
          global.wss.clients.forEach(client => {
            if (client.readyState === client.OPEN) {
              client.send(JSON.stringify({
                type: 'chat',
                user,
                message: message.message,
                timestamp: new Date().toISOString()
              }));
            }
          });
        }

        if (message.type === 'ping') {
          // Cập nhật TTL để giữ online
          const val = await redis.get(`online:${sessionId}`);
          if (val) {
            await redis.set(`online:${sessionId}`, val, { ex: 60 });
          }
          ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
        }
      });

      ws.on('close', async () => {
        log('Connection closed:', sessionId);
        await redis.del(`online:${sessionId}`);
        // Broadcast user_left cho các client khác
        global.wss.clients.forEach(client => {
          if (client.readyState === client.OPEN) {
            client.send(JSON.stringify({
              type: 'user_left',
              user_id: sessionId,
              timestamp: new Date().toISOString()
            }));
          }
        });
      });
    });
  }

  // Xử lý upgrade WebSocket
  if (req.method === 'GET') {
    const { pathname } = url.parse(req.url, true);
    // /ws/waitingroom/:sessionId
    const match = pathname.match(/^\/ws\/waitingroom\/([^/]+)$/);
    if (match) {
      const sessionId = match[1];
      global.wss.handleUpgrade(req, req.socket, Buffer.alloc(0), (ws) => {
        global.wss.emit('connection', ws, req, sessionId);
      });
    } else {
      res.statusCode = 404;
      res.end('Not found');
    }
  } else {
    res.statusCode = 426;
    res.end('Upgrade required');
  }
};

// Chạy local: nếu chạy bằng node index.js thì mở server HTTP và attach WebSocket
if (require.main === module) {
  const http = require('http');
  const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('WebSocket server is running!');
  });
  const { Server } = require('ws');
  const wss = new Server({ server });

  const connections = new Map();
  const userInfo = new Map();

  function log(...args) {
    console.log('[WS]', ...args);
  }

  function broadcast(message, excludeSessionId = null) {
    const data = JSON.stringify(message);
    for (const [sessionId, ws] of connections.entries()) {
      if (sessionId !== excludeSessionId && ws.readyState === ws.OPEN) {
        ws.send(data);
      }
    }
  }

  wss.on('connection', (ws, req) => {
    // Lấy sessionId từ URL
    const urlParts = req.url.split('/');
    const sessionId = urlParts[urlParts.length - 1];
    log('New connection:', sessionId);
    connections.set(sessionId, ws);

    ws.on('message', (msg) => {
        log('Received message from', sessionId, ':', msg);
    let message;
      try {
        message = JSON.parse(msg);
      } catch {
        log('Invalid JSON from', sessionId);
        return;
      }
      if (message.type === 'init') {
        // Gọi API Python để xác thực sessionId
        const apiUrl =
          process.env.API_BASE_URL ||
          'http://localhost:5000/api/me?session_id=' + sessionId;
        log('Validating sessionId with API:', apiUrl);
        nodeFetch(apiUrl)
          .then(res => {
            log('API response status:', res.status);
            if (!res.ok) {
              log('User not found for sessionId', sessionId);
              ws.close(4001, 'User not found');
              return;
            }
            return res.json();
          })
          .then(userData => {
            if (!userData || userData.detail || Object.keys(userData).length === 0) {
              log('User not found in response for sessionId', sessionId);
              ws.close(4001, 'User not found');
              return;
            }
            log('User validated:', userData);
            userInfo.set(sessionId, {
              id: userData._id || sessionId,
              name: userData.name || 'Unknown',
              type: userData.user_type || 'unknown',
              avatar: userData.avatar || '',
              remaining_matches: userData.remaining_matches || 0,
              wins: userData.wins || 0,
              losses: userData.losses || 0,
              connected_at: new Date().toISOString()
            });

            // Gửi thông tin user vừa connect
            ws.send(JSON.stringify({
              type: 'me',
              user: {
                user_id: userData._id || sessionId,
                name: userData.name || 'Unknown',
                type: userData.user_type || 'unknown',
                avatar: userData.avatar || '',
                wins: userData.wins || 0,
                losses: userData.losses || 0,
                connected_at: new Date().toISOString(),
                remaining_matches: userData.remaining_matches || 0
              }
            }));

            // Gửi danh sách user hiện tại cho client mới
            ws.send(JSON.stringify({
              type: 'user_list',
              users: Array.from(userInfo.values())
            }));
            broadcast({
              type: 'user_joined',
              user: userInfo.get(sessionId)
            }, sessionId);
          })
          .catch((err) => {
            log('Error validating user:', err);
            ws.close(4001, 'User not found');
          });
      }
      if (message.type === 'chat') {
        log('Broadcast chat from', sessionId, ':', message.message);
        broadcast({
          type: 'chat',
          user: { id: sessionId, name: userInfo.get(sessionId)?.name || 'Unknown' },
          message: message.message,
          timestamp: new Date().toISOString()
        });
      }
      if (message.type === 'ping') {
        log('Received ping from', sessionId);
        ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
      }
    });
    ws.on('close', () => {
      log('Connection closed:', sessionId);
      connections.delete(sessionId);
      userInfo.delete(sessionId);
      broadcast({
        type: 'user_left',
        user_id: sessionId,
        timestamp: new Date().toISOString()
      });
    });
  });

  const PORT = process.env.WS_PORT || 4000;
  server.listen(PORT, () => {
    log(`WebSocket server running at ws://localhost:${PORT}/waitingroom/:sessionId`);
  });
}