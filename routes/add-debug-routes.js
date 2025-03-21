const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { supabase, getAdminClient } = require('../config/supabase');

// Route hiển thị cấu trúc bảng
router.get('/db-info', verifyToken, async (req, res) => {
  try {
    // Kiểm tra thông tin user
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Không có thông tin người dùng, vui lòng đăng nhập lại'
      });
    }
    
    // Lấy admin client để truy vấn
    const adminSupabase = getAdminClient();
    if (!adminSupabase) {
      return res.status(500).json({
        success: false,
        message: 'Lỗi cấu hình server'
      });
    }
    
    // Lấy thông tin schema
    const { data: tableInfo, error: tableError } = await adminSupabase
      .from('information_schema.columns')
      .select('table_name, column_name, data_type, is_nullable')
      .eq('table_schema', 'public')
      .eq('table_name', 'child_expenses');
    
    if (tableError) {
      return res.status(500).json({
        success: false,
        message: 'Không thể lấy thông tin bảng',
        error: tableError.message
      });
    }
    
    // Lấy mẫu dữ liệu
    const { data: sampleData, error: sampleError } = await adminSupabase
      .from('child_expenses')
      .select('*')
      .eq('user_id', req.user.id)
      .limit(3);
    
    if (sampleError) {
      return res.status(500).json({
        success: false,
        message: 'Không thể lấy mẫu dữ liệu',
        error: sampleError.message
      });
    }
    
    // Trả về kết quả
    return res.json({
      success: true,
      tableInfo,
      sampleData
    });
    
  } catch (error) {
    console.error('Lỗi lấy thông tin DB:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: error.message
    });
  }
});

module.exports = router; 