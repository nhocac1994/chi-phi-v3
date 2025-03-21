// Thiết lập WebSocket
const setupWebSocket = (server) => {
  const wss = new WebSocket.Server({ 
    server,
    path: '/ws', // Đặt đường dẫn cụ thể cho WebSocket
    // Tăng thời gian timeout cho WebSocket
    clientTracking: true,
    perMessageDeflate: {
      zlibDeflateOptions: {
        // Cấu hình nén để giảm kích thước gói tin
        chunkSize: 1024,
        memLevel: 7,
        level: 3
      },
      zlibInflateOptions: {
        chunkSize: 10 * 1024
      },
      // Không nén các tin nhắn nhỏ hơn 64 bytes
      threshold: 64
    }
  });
  
  console.log('WebSocket server đã được khởi tạo tại đường dẫn /ws');
  
  // Lưu trữ các kết nối theo userId
  const clients = new Map();
  
  // Theo dõi ping-pong để kiểm tra kết nối
  const heartbeats = new Map();
  
  wss.on('connection', async (ws, req) => {
    console.log('Có kết nối WebSocket mới từ:', req.socket.remoteAddress);
    
    // Lấy token từ URL
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    let userId = null;
    
    try {
      // Xác thực token
      if (!token) {
        console.log('Không có token, đóng kết nối WebSocket');
        ws.send(JSON.stringify({ type: 'auth_error', message: 'Không có token xác thực' }));
        ws.close(1008, 'Không có token xác thực');
        return;
      }
      
      // Xác thực token với Supabase
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (error || !user) {
        console.log('Token không hợp lệ, đóng kết nối WebSocket');
        ws.send(JSON.stringify({ type: 'auth_error', message: 'Token không hợp lệ' }));
        ws.close(1008, 'Token không hợp lệ');
        return;
      }
      
      userId = user.id;
      console.log(`WebSocket đã xác thực cho user: ${userId}`);
      
      // Lưu kết nối vào danh sách
      if (!clients.has(userId)) {
        clients.set(userId, new Set());
      }
      clients.get(userId).add(ws);
      
      // Lưu userId vào đối tượng WebSocket để sử dụng sau này
      ws.userId = userId;
      
      // Thiết lập heartbeat cho kết nối này
      heartbeats.set(ws, {
        lastPing: Date.now(),
        lastPong: Date.now(),
        pingInterval: setInterval(() => {
          try {
            // Kiểm tra xem client có phản hồi ping trước đó không
            const heartbeat = heartbeats.get(ws);
            if (!heartbeat) return;
            
            const now = Date.now();
            const timeSinceLastPong = now - heartbeat.lastPong;
            
            // Nếu không nhận được pong trong 60 giây, đóng kết nối
            if (timeSinceLastPong > 60000) {
              console.log(`WebSocket cho user ${userId} không phản hồi trong ${timeSinceLastPong}ms, đóng kết nối`);
              clearInterval(heartbeat.pingInterval);
              heartbeats.delete(ws);
              ws.terminate();
              return;
            }
            
            // Gửi ping để kiểm tra kết nối
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'ping', timestamp: now }));
              heartbeat.lastPing = now;
            }
          } catch (error) {
            console.error('Lỗi khi gửi ping:', error);
          }
        }, 30000) // Ping mỗi 30 giây
      });
      
      // Gửi thông báo xác thực thành công
      ws.send(JSON.stringify({ type: 'auth_success', userId }));
      
    } catch (error) {
      console.error('Lỗi xác thực WebSocket:', error);
      ws.send(JSON.stringify({ type: 'auth_error', message: 'Lỗi xác thực' }));
      ws.close(1011, 'Lỗi xác thực');
      return;
    }
    
    // Xử lý heartbeat
    ws.isAlive = true;
    
    ws.on('message', (message) => {
      try {
        // Xử lý tin nhắn từ client
        const data = JSON.parse(message);
        
        // Xử lý ping từ client
        if (data.type === 'ping') {
          ws.isAlive = true;
          
          // Cập nhật thời gian heartbeat
          const heartbeat = heartbeats.get(ws);
          if (heartbeat) {
            heartbeat.lastPong = Date.now();
          }
          
          // Gửi pong về client
          ws.send('pong');
          return;
        }
        
        // Xử lý các loại tin nhắn khác nếu cần
        console.log('Nhận tin nhắn từ client:', data);
        
      } catch (error) {
        console.error('Lỗi xử lý tin nhắn WebSocket:', error);
      }
    });
    
    ws.on('close', (code, reason) => {
      console.log(`WebSocket đóng kết nối cho user: ${userId}, Mã: ${code}, Lý do: ${reason || 'Không có lý do'}`);
      
      // Xóa kết nối khỏi danh sách
      if (userId && clients.has(userId)) {
        clients.get(userId).delete(ws);
        
        // Nếu không còn kết nối nào cho user này, xóa user khỏi Map
        if (clients.get(userId).size === 0) {
          clients.delete(userId);
        }
      }
      
      // Xóa heartbeat
      const heartbeat = heartbeats.get(ws);
      if (heartbeat) {
        clearInterval(heartbeat.pingInterval);
        heartbeats.delete(ws);
      }
    });
    
    ws.on('error', (error) => {
      console.error('Lỗi WebSocket:', error);
    });
    
    // Thiết lập ping-pong để giữ kết nối
    ws.on('pong', () => {
      ws.isAlive = true;
      
      // Cập nhật thời gian heartbeat
      const heartbeat = heartbeats.get(ws);
      if (heartbeat) {
        heartbeat.lastPong = Date.now();
      }
    });
  });
  
  // Kiểm tra kết nối định kỳ và đóng các kết nối không phản hồi
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        console.log('Đóng kết nối WebSocket không phản hồi');
        return ws.terminate();
      }
      
      ws.isAlive = false;
      try {
        ws.ping('');
      } catch (error) {
        console.error('Lỗi khi gửi ping:', error);
      }
    });
  }, 30000); // Kiểm tra mỗi 30 giây
  
  // Xử lý khi server đóng
  wss.on('close', () => {
    clearInterval(interval);
    
    // Xóa tất cả các heartbeat interval
    for (const [ws, heartbeat] of heartbeats.entries()) {
      clearInterval(heartbeat.pingInterval);
    }
    heartbeats.clear();
  });
  
  // Hàm gửi thông báo đến một user cụ thể
  const notifyUser = (userId, data) => {
    if (clients.has(userId)) {
      clients.get(userId).forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          try {
            client.send(JSON.stringify(data));
          } catch (error) {
            console.error(`Lỗi khi gửi thông báo đến user ${userId}:`, error);
          }
        }
      });
    }
  };
  
  // Hàm gửi thông báo đến tất cả người dùng
  const notifyAll = (data) => {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(JSON.stringify(data));
        } catch (error) {
          console.error('Lỗi khi gửi thông báo đến tất cả người dùng:', error);
        }
      }
    });
  };
  
  return {
    notifyUser,
    notifyAll,
    getActiveConnections: () => wss.clients.size
  };
}; 

// Thêm code khởi tạo Express và WebSocket
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const { supabase } = require('./config/supabase');
const routes = require('./routes');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const dotenv = require('dotenv');
const expensesRouter = require('./routes/expenses');
const debugRouter = require('./routes/add-debug-routes');

// Tải biến môi trường
dotenv.config();

// Khởi tạo Express
const app = express();
const PORT = process.env.PORT || 3000;

// Thiết lập middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    // Đặt Content-Type đúng cho file CSS
    if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    }
    // Đặt header cache điều khiển cho static files
    res.setHeader('Cache-Control', 'max-age=86400'); // Cache 1 ngày
  }
}));

// Thiết lập session
app.use(session({
  secret: process.env.SESSION_SECRET || 'chi-phi-app-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Thiết lập view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Sử dụng routes
app.use('/', routes);

// Đăng ký router expenses
console.log('Đăng ký router /api/expenses...');
app.use('/api/expenses', expensesRouter);
app.use('/api/debug', debugRouter);

// Thêm route cho trang expenses
app.get('/expenses', async (req, res) => {
  try {
    // Lấy token từ cookie
    const token = req.cookies.sb_token;
    
    if (!token) {
      // Nếu không có token, chuyển hướng về trang login
      console.log('Không tìm thấy token, chuyển hướng về trang login');
      return res.redirect('/login');
    }
    
    try {
      // Kiểm tra token với Supabase
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (error || !user) {
        console.log('Token không hợp lệ:', error);
        // Xóa token không hợp lệ
        res.clearCookie('sb_token');
        return res.redirect('/login');
      }
      
      // Token hợp lệ, render trang expenses
      console.log('Xác thực thành công, render trang expenses');
      return res.render('expenses');
      
    } catch (authError) {
      console.error('Lỗi xác thực token:', authError);
      return res.redirect('/login');
    }
    
  } catch (error) {
    console.error('Lỗi khi xử lý request /expenses:', error);
    res.status(500).send('Có lỗi xảy ra');
  }
});

// Thêm route cho trang dashboard
app.get('/dashboard', async (req, res) => {
  try {
    // Lấy token từ cookie
    const token = req.cookies.sb_token;
    
    if (!token) {
      // Nếu không có token, chuyển hướng về trang login
      console.log('Không tìm thấy token, chuyển hướng về trang login');
      return res.redirect('/login');
    }
    
    try {
      // Kiểm tra token với Supabase
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (error || !user) {
        console.log('Token không hợp lệ:', error);
        // Xóa token không hợp lệ
        res.clearCookie('sb_token');
        return res.redirect('/login');
      }
      
      // Token hợp lệ, render trang dashboard
      console.log('Xác thực thành công, render trang dashboard');
      return res.render('dashboard', { user });
      
    } catch (authError) {
      console.error('Lỗi xác thực token:', authError);
      return res.redirect('/login');
    }
    
  } catch (error) {
    console.error('Lỗi khi xử lý request /dashboard:', error);
    res.status(500).send('Có lỗi xảy ra');
  }
});

// Thiết lập điều kiện để chỉ sử dụng WebSocket trong môi trường phát triển
let wsServer = null;

// Điều kiện cho môi trường không phải Vercel
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  // Tạo HTTP server
  const server = http.createServer(app);
  
  // Khởi tạo WebSocket chỉ trong môi trường phát triển
  wsServer = setupWebSocket(server);
  
  // Lưu wsServer vào app để sử dụng trong routes
  app.set('wsServer', wsServer);
  
  // Khởi động server truyền thống
  server.listen(PORT, () => {
    console.log(`Server đang chạy tại http://localhost:${PORT}`);
  });
} else {
  // Trong môi trường Vercel, tạo một mock wsServer
  app.set('wsServer', {
    notifyUser: () => console.log('WebSocket không được hỗ trợ trên Vercel'),
    notifyAll: () => console.log('WebSocket không được hỗ trợ trên Vercel'),
    getActiveConnections: () => 0
  });
  
  // Không cần server.listen trong môi trường Vercel
}

// API endpoint để kiểm tra WebSocket (điều chỉnh để hoạt động cả hai môi trường)
app.get('/api/ws-status', (req, res) => {
  const connections = app.get('wsServer')?.getActiveConnections() || 0;
  res.json({
    status: 'ok',
    connections,
    environment: process.env.NODE_ENV || 'development',
    isVercel: !!process.env.VERCEL
  });
});

// Xuất app cho serverless functions trong Vercel
module.exports = app;