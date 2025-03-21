const { supabase } = require('../config/supabase');

// Middleware xác thực token
const authenticateToken = async (req, res, next) => {
  try {
    // Lấy token từ header hoặc cookie
    const authHeader = req.headers['authorization'];
    const token = authHeader?.split(' ')[1] || req.cookies?.sb_token;
    
    console.log('[Auth Middleware] Kiểm tra token:', token ? 'Có token' : 'Không có token');
    
    if (!token) {
      console.log('[Auth Middleware] Token không tồn tại');
      // Phân biệt request từ API và web
      if (req.path.startsWith('/api/')) {
        return res.status(401).json({ 
          success: false, 
          error: 'Vui lòng đăng nhập' 
        });
      }
      
      // Chuyển hướng về trang login nếu là request từ web
      return res.redirect('/login');
    }

    // Kiểm tra token với Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      console.log('[Auth Middleware] Token không hợp lệ:', error?.message);
      
      // Phân biệt request từ API và web
      if (req.path.startsWith('/api/')) {
        return res.status(401).json({ 
          success: false, 
          error: 'Token không hợp lệ' 
        });
      }
      
      // Chuyển hướng về trang login nếu là request từ web
      return res.redirect('/login');
    }

    // Lưu thông tin người dùng vào request
    req.user = user;
    req.token = token;
    
    console.log('[Auth Middleware] User đã xác thực:', user.email);
    next();
  } catch (error) {
    console.error('[Auth Middleware] Lỗi xác thực:', error.message);
    
    // Phân biệt request từ API và web
    if (req.path.startsWith('/api/')) {
      return res.status(500).json({ 
        success: false, 
        error: 'Lỗi xác thực' 
      });
    }
    
    // Chuyển hướng về trang login nếu là request từ web
    return res.redirect('/login');
  }
};

// Middleware kiểm tra nếu người dùng đã đăng nhập
const checkAuth = async (req, res, next) => {
  try {
    // Lấy token từ cookie hoặc header
    const authHeader = req.headers['authorization'];
    const token = authHeader?.split(' ')[1] || req.cookies?.sb_token;
    
    // Không yêu cầu token
    if (!token) {
      return next();
    }

    // Kiểm tra token với Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    // Nếu token hợp lệ
    if (!error && user) {
      // Nếu đang ở trang login và đã đăng nhập, chuyển hướng về dashboard
      if (req.path === '/login') {
        return res.redirect('/dashboard');
      }
      
      // Lưu thông tin người dùng vào request
      req.user = user;
      req.token = token;
    }
    
    next();
  } catch (error) {
    console.error('[Check Auth] Lỗi:', error.message);
    next();
  }
};

module.exports = {
  authenticateToken,
  checkAuth
}; 