const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');

// Route kiểm tra trạng thái đăng nhập
router.get('/check', async (req, res) => {
  try {
    // Lấy token từ header hoặc cookie
    const token = req.headers.authorization?.split(' ')[1] || req.cookies?.sb_token;

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Không tìm thấy token xác thực'
      });
    }

    // Xác thực token với Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        success: false,
        error: 'Token không hợp lệ hoặc hết hạn'
      });
    }

    // Trả về thông tin người dùng nếu xác thực thành công
    return res.json({
      success: true,
      isAuthenticated: true,
      user: {
        id: user.id,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Lỗi kiểm tra xác thực:', error);
    return res.status(500).json({
      success: false,
      error: 'Lỗi kiểm tra xác thực'
    });
  }
});

// API đăng nhập
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Kiểm tra dữ liệu đầu vào
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng nhập email và mật khẩu'
      });
    }

    // Đăng nhập với Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return res.status(401).json({
        success: false,
        error: error.message
      });
    }

    // Đăng nhập thành công
    // Lưu token vào cookie
    res.cookie('sb_token', data.session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 ngày
    });

    return res.json({
      success: true,
      user: data.user,
      redirect: req.query.redirect || '/expenses'
    });
  } catch (error) {
    console.error('Lỗi đăng nhập:', error);
    return res.status(500).json({
      success: false,
      error: 'Lỗi đăng nhập'
    });
  }
});

// API đăng xuất
router.post('/logout', async (req, res) => {
  try {
    // Xóa cookie
    res.clearCookie('sb_token');

    // Đăng xuất với Supabase
    const token = req.cookies?.sb_token;
    if (token) {
      await supabase.auth.signOut({ token });
    }

    return res.json({
      success: true,
      message: 'Đăng xuất thành công'
    });
  } catch (error) {
    console.error('Lỗi đăng xuất:', error);
    return res.status(500).json({
      success: false,
      error: 'Lỗi đăng xuất'
    });
  }
});

module.exports = router; 