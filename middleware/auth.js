// middleware/auth.js
const { supabase } = require('../config/supabase');
const UserDataService = require('../services/userDataService');

const verifyToken = async (req, res, next) => {
  try {
    console.log('\n=== [AUTH DEBUG] ===');
    console.log('Path:', req.path);
    
    // Kiểm tra token từ cookie hoặc header
    let token = req.cookies?.sb_token;
    console.log('Cookie token:', token ? `${token.substring(0, 15)}...` : 'Không có');
    
    // Nếu không có trong cookie, kiểm tra trong header Authorization
    if (!token && req.headers.authorization) {
      const authHeader = req.headers.authorization;
      console.log('Auth header:', authHeader ? `${authHeader.substring(0, 15)}...` : 'Không có');
      
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
        console.log('Token từ header:', token ? `${token.substring(0, 15)}...` : 'Không có');
      }
    }
    
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Content-Type:', req.headers['content-type']);
    console.log('Body exists:', !!req.body);
    console.log('Files exists:', !!req.files);
    console.log('Files count:', req.files ? req.files.length : 0);
    
    console.log(`[Auth] Kiểm tra token cho: ${req.path}, token: ${token ? 'Có token' : 'Không có token'}`);
    
    if (!token) {
      // Nếu là request API, trả về lỗi 401
      if (req.path.startsWith('/api/')) {
        return res.status(401).json({ 
          success: false, 
          error: 'Cần đăng nhập để truy cập' 
        });
      }
      // Nếu là request trang web, chuyển hướng về trang login
      return res.redirect('/login');
    }

    // Kiểm tra token với Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      console.log(`[Auth] Token không hợp lệ: ${error?.message || 'Không có thông tin user'}`);
      
      // Xóa token không hợp lệ
      res.clearCookie('sb_token');
      
      // Nếu là request API, trả về lỗi 401
      if (req.path.startsWith('/api/')) {
        return res.status(401).json({ 
          success: false, 
          error: 'Token không hợp lệ hoặc hết hạn' 
        });
      }
      // Nếu là request trang web, chuyển hướng về trang login
      return res.redirect('/login');
    }

    // Token hợp lệ, có thông tin user
    console.log(`[Auth] User hợp lệ: ${user.email}`);
    req.user = user;

    try {
      // Khởi tạo service quản lý dữ liệu nếu cần
      if (!req.path.includes('check-auth')) {
        console.log(`[Auth] Khởi tạo DataService cho user: ${user.id}`);
        req.dataService = new UserDataService(user.id);

        // Chỉ lấy dữ liệu static cho các request trang web (không phải API và không phải check-auth)
        if (!req.path.startsWith('/api/')) {
          console.log(`[Auth] Tải dữ liệu static cho: ${req.path}`);
          req.staticData = await req.dataService.getStaticData();
        }
      }
    } catch (serviceError) {
      console.error('Service initialization error:', serviceError);
      // Tiếp tục xử lý ngay cả khi có lỗi khởi tạo service
      // Không reject request vì lỗi service
    }

    next();
  } catch (error) {
    console.error('Auth error:', error);
    
    // Nếu là request API, trả về lỗi 500
    if (req.path.startsWith('/api/')) {
      return res.status(500).json({ 
        success: false, 
        error: 'Lỗi xác thực', 
        message: error.message 
      });
    }
    // Nếu là request trang web, chuyển hướng về trang login
    return res.redirect('/login');
  }
};

// Middleware kiểm tra đã đăng nhập chưa
const checkAuth = async (req, res, next) => {
  try {
    const token = req.cookies.sb_token;
    
    console.log(`[CheckAuth] Kiểm tra đăng nhập: ${req.path}, token: ${token ? 'Có' : 'Không'}`);
    
    // Nếu không có token, cho phép truy cập trang login
    if (!token) {
      console.log(`[CheckAuth] Không có token, cho phép truy cập ${req.path}`);
      return next();
    }
    
    // Tránh kiểm tra lại nếu đã chuyển hướng trong 10 giây qua
    const lastRedirect = req.session?.lastLoginRedirect || 0;
    const now = Date.now();
    if (now - lastRedirect < 10000) { // 10 giây
      console.log(`[CheckAuth] Đã chuyển hướng gần đây, bỏ qua kiểm tra`);
      return next();
    }
    
    // Kiểm tra token với Supabase
    const { data, error } = await supabase.auth.getUser(token);
    
    if (!error && data.user) {
      console.log(`[CheckAuth] Đã đăng nhập: ${data.user.email}`);
      
      // Nếu đang ở trang login và đã đăng nhập, chuyển hướng về trang chủ
      if (req.path === '/login') {
        console.log(`[CheckAuth] Chuyển hướng từ login về dashboard`);
        
        // Lưu thời điểm chuyển hướng gần nhất
        if (req.session) {
          req.session.lastLoginRedirect = now;
        }
        
        return res.redirect('/dashboard');
      }
    } else if (error) {
      console.log(`[CheckAuth] Token không hợp lệ: ${error.message}`);
      // Xóa token không hợp lệ
      res.clearCookie('sb_token');
    }
    
    next();
  } catch (error) {
    console.error('Check auth error:', error);
    next();
  }
};

module.exports = { verifyToken, checkAuth };