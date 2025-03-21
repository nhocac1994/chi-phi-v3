// websocket/index.js
const WebSocket = require('ws');
const cache = require('../utils/cache');

function setupWebSocket(server) {
  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws, req) => {
    const userId = req.user?.id;
    if (!userId) {
      ws.close();
      return;
    }

    // Lưu connection theo userId
    ws.userId = userId;

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message);
        
        // Xử lý các event
        switch (data.type) {
          case 'expense_added':
          case 'expense_updated':
          case 'expense_deleted':
            // Broadcast cho tất cả client của user này
            wss.clients.forEach((client) => {
              if (client.userId === userId && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(data));
              }
            });
            break;
        }
      } catch (error) {
        console.error('WebSocket error:', error);
      }
    });
  });

  return wss;
}

module.exports = setupWebSocket;