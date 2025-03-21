const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
require('dotenv').config();
const { verifyToken } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const { supabase, getAdminClient } = require('../config/supabase');

// Cấu hình multer để lưu file vào memory
const storage = multer.memoryStorage();

// Kiểm tra file upload
const fileFilter = (req, file, cb) => {
  // Chỉ chấp nhận file ảnh
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Chỉ chấp nhận file ảnh'), false);
  }
};

// Cấu hình multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 5 // Tối đa 5 file
  }
});

// GET /api/expenses - Lấy danh sách chi phí
router.get('/', verifyToken, async (req, res) => {
  try {
    console.log('API: Lấy danh sách chi phí cho user:', req.user.id);
    
    // Lấy tham số truy vấn
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    
    // Lấy dữ liệu từ database
    const { data: expenses, error } = await supabase
      .from('child_expenses')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (error) {
      console.error('Lỗi lấy danh sách chi phí:', error);
      return res.status(500).json({ success: false, error: 'Lỗi khi lấy danh sách chi phí' });
    }
    
    console.log(`Đã tìm thấy ${expenses?.length || 0} chi phí`);

    // Đảm bảo định dạng images đúng trước khi trả về
    const processedExpenses = expenses.map(expense => {
      // Trường hợp images là chuỗi JSON
      if (expense.images && typeof expense.images === 'string') {
        try {
          expense.images = JSON.parse(expense.images);
        } catch (e) {
          console.error('Lỗi parse JSON cho images:', e);
          expense.images = [];
        }
      }
      
      // Đảm bảo images luôn là mảng
      if (!expense.images) {
        expense.images = [];
      } else if (!Array.isArray(expense.images)) {
        expense.images = [expense.images];
      }
      
      return expense;
    });
    
    // Trả về dữ liệu
    res.json({ 
      success: true, 
      expenses: processedExpenses,
      pagination: {
        page,
        limit,
        total: processedExpenses.length 
      }
    });
    
  } catch (error) {
    console.error('Lỗi lấy danh sách chi phí:', error);
    res.status(500).json({ success: false, error: 'Lỗi máy chủ nội bộ' });
  }
});

// API thêm chi phí mới (JSON)
router.post('/', verifyToken, async (req, res) => {
  try {
    console.log('\n=== POST /api/expenses (JSON) ===');
    console.log('Content-Type:', req.headers['content-type']);
    console.log('Thông tin user:', req.user ? `${req.user.id} (${req.user.email})` : 'Không có');
    console.log('Body:', req.body);
    
    // Kiểm tra thông tin user
    if (!req.user || !req.user.id) {
      console.log('❌ Không có thông tin user');
      return res.status(401).json({
        success: false,
        message: 'Không có thông tin người dùng, vui lòng đăng nhập lại'
      });
    }

    // Validate dữ liệu đầu vào
    const requiredFields = ['noi_dung', 'gia_tien', 'danh_muc'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      console.log('❌ Thiếu các trường:', missingFields);
      return res.status(400).json({
        success: false, 
        message: `Thiếu thông tin bắt buộc: ${missingFields.join(', ')}`,
        received: req.body
      });
    }

    // Kiểm tra và xử lý giá tiền
    let gia_tien = 0;
    try {
      // Đảm bảo gia_tien là chuỗi trước khi xử lý
      const gia_tien_str = String(req.body.gia_tien).trim();
      console.log('Giá tiền gốc:', gia_tien_str);
      
      // Xử lý chuỗi, loại bỏ dấu phẩy hoặc chấm phân cách hàng nghìn
      const formatted_gia_tien = gia_tien_str.replace(/[.,\s]/g, '');
      console.log('Giá tiền sau khi định dạng:', formatted_gia_tien);
      
      gia_tien = parseFloat(formatted_gia_tien);
      console.log('Giá tiền sau khi chuyển đổi:', gia_tien);
    } catch (e) {
      console.error('❌ Lỗi chuyển đổi giá tiền:', e);
    }
    
    if (isNaN(gia_tien) || gia_tien <= 0) {
      console.log('❌ Giá tiền không hợp lệ:', req.body.gia_tien);
      return res.status(400).json({
        success: false,
        message: 'Giá tiền phải là số dương'
      });
    }

    // Xử lý dữ liệu images nếu được cung cấp
    let images = [];
    if (req.body.images) {
      if (Array.isArray(req.body.images)) {
        images = req.body.images;
      } else if (typeof req.body.images === 'string') {
        try {
          const parsedImages = JSON.parse(req.body.images);
          images = Array.isArray(parsedImages) ? parsedImages : [parsedImages];
        } catch (e) {
          // Nếu không phải là JSON, có thể là URL đơn
          if (req.body.images.startsWith('http')) {
            images = [req.body.images];
          }
        }
      }
      console.log('Images được xử lý:', images);
    }

    // Chuẩn bị dữ liệu cho bảng child_expenses
    const expenseData = {
      user_id: req.user.id,
      noi_dung: req.body.noi_dung.trim(),
      gia_tien: gia_tien,
      danh_muc: req.body.danh_muc,
      dia_diem: (req.body.dia_diem || '').trim(),
      ngay_thang: req.body.ngay_thang || new Date().toISOString(),
      ghi_chu: (req.body.ghi_chu || '').trim(),
      trang_thai: req.body.trang_thai || 'Chưa thanh toán',
      images: images.length > 0 ? images : [],
      created_at: new Date().toISOString()
    };

    console.log('📝 Dữ liệu chi phí chuẩn bị gửi:', JSON.stringify(expenseData, null, 2));

    // Thử xem lỗi RLS là gì bằng cách kiểm tra quyền
    console.log('🔍 Kiểm tra quyền hạn của user trên bảng child_expenses');
    
    // Lấy admin client để bypass RLS
    const adminSupabase = getAdminClient();
    if (!adminSupabase) {
      console.error('❌ Không thể lấy admin client');
      return res.status(500).json({
        success: false,
        message: 'Lỗi cấu hình server'
      });
    }
    
    console.log('✅ Đã lấy admin client để bypass RLS');
    
    // Thêm dữ liệu
    const { data: expense, error: expenseError } = await adminSupabase
      .from('child_expenses')
      .insert(expenseData)
      .select()
      .single();

    if (expenseError) {
      console.error('❌ Lỗi thêm chi phí:', expenseError);
      return res.status(500).json({
        success: false,
        message: 'Không thể thêm chi phí',
        error: expenseError.message,
        details: expenseError
      });
    }

    console.log('✅ Đã thêm chi phí:', expense.id);

    // Trả về kết quả thành công
    return res.status(201).json({
      success: true,
      message: 'Thêm chi phí thành công',
      expense: expense
    });
  } catch (error) {
    console.error('❌ Lỗi server:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server, vui lòng thử lại sau',
      error: error.message
    });
  }
});

// API để upload hình ảnh cho chi phí
router.post('/upload-images', verifyToken, upload.array('images', 5), async (req, res) => {
  try {
    // Hiển thị thông tin để debug
    console.log('\n=== POST /api/expenses/upload-images ===');
    console.log('Content-Type:', req.headers['content-type']);
    console.log('Authorization:', req.headers.authorization ? 'Bearer: ' + req.headers.authorization.substring(0, 20) + '...' : 'Không có');
    console.log('Cookies:', req.cookies?.sb_token ? 'sb_token: ' + req.cookies.sb_token.substring(0, 20) + '...' : 'Không có cookie sb_token');
    console.log('Thông tin user:', req.user ? `${req.user.id} (${req.user.email})` : 'Không có');
    console.log('Body:', req.body);
    console.log('req.body.expense_id:', req.body.expense_id);
    console.log('Files:', req.files?.length || 0);
    
    // In giá trị trực tiếp để debug
    if (req.files && req.files.length > 0) {
      req.files.forEach((file, index) => {
        console.log(`File ${index + 1}:`, {
          fieldname: file.fieldname,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          buffer: file.buffer ? 'Có buffer dữ liệu' : 'Không có buffer'
        });
      });
    } else {
      console.log('❌ KHÔNG NHẬN ĐƯỢC FILE');
    }
  
    // Kiểm tra thông tin user
    if (!req.user || !req.user.id) {
      console.log('❌ Không có thông tin user');
      return res.status(401).json({
        success: false,
        message: 'Không có thông tin người dùng, vui lòng đăng nhập lại'
      });
    }
    
    // Kiểm tra ID chi phí
    const expenseId = req.body.expense_id;
    if (!expenseId) {
      console.log('❌ Thiếu ID chi phí');
      return res.status(400).json({
        success: false,
        message: 'Thiếu ID chi phí'
      });
    }
    
    // Tạo supabase admin client với service role để bypass RLS
    const adminSupabase = getAdminClient();
    if (!adminSupabase) {
      console.error('❌ Không thể lấy admin client');
      return res.status(500).json({
        success: false,
        message: 'Lỗi cấu hình server'
      });
    }
    
    console.log('✅ Đã lấy admin client để bypass RLS');
    
    // Kiểm tra chi phí tồn tại và thuộc về user
    const { data: expense, error: expenseError } = await adminSupabase
      .from('child_expenses')
      .select('id')
      .eq('id', expenseId)
      .eq('user_id', req.user.id)
      .single();
      
    if (expenseError || !expense) {
      console.log('❌ Chi phí không tồn tại hoặc không thuộc về user này');
      return res.status(404).json({
        success: false,
        message: 'Chi phí không tồn tại hoặc không thuộc về bạn'
      });
    }
    
    // Kiểm tra files
    if (!req.files || req.files.length === 0) {
      console.log('❌ Không có file nào được gửi lên');
      return res.status(400).json({
        success: false,
        message: 'Không có file nào được gửi lên'
      });
    }
    
    console.log(`📁 Số file nhận được: ${req.files.length}`);
    console.log('📁 Thông tin files:', req.files.map(f => ({
      originalname: f.originalname,
      mimetype: f.mimetype,
      size: f.size,
      fieldname: f.fieldname
    })));
    
    // Xử lý tải ảnh lên
    const imageUrls = [];
    for (const file of req.files) {
      const fileName = `${uuidv4()}_${file.originalname.replace(/\s+/g, '_')}`;
      const filePath = `public/${req.user.id}/${fileName}`;
      
      console.log(`📤 Đang tải lên ${fileName}, kích thước: ${file.size} bytes`);
      
      // Tải lên Supabase Storage
      const { data: uploadData, error: uploadError } = await adminSupabase.storage
        .from('expenses')
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          cacheControl: '3600'
        });

      if (uploadError) {
        console.error('❌ Lỗi tải ảnh lên:', uploadError);
        continue; // Tiếp tục với ảnh tiếp theo nếu có lỗi
      }
      
      console.log('✅ Upload thành công:', uploadData);
      
      // Lấy URL public
      const { data: urlData } = adminSupabase.storage
        .from('expenses')
        .getPublicUrl(filePath);

      if (urlData && urlData.publicUrl) {
        imageUrls.push(urlData.publicUrl);
        console.log('✅ Đã tải lên ảnh:', urlData.publicUrl);
        
        // Lưu thông tin ảnh vào bảng expense_images
        const { error: imageError } = await adminSupabase
          .from('expense_images')
          .insert({
            expense_id: expenseId,
            image_url: urlData.publicUrl,
            file_name: fileName,
            file_path: filePath,
            created_at: new Date().toISOString()
          });

        if (imageError) {
          console.error('❌ Lỗi lưu thông tin ảnh:', imageError);
        }
      }
    }
    
    // Cập nhật trường images trong bảng child_expenses
    if (imageUrls.length > 0) {
      console.log('📝 Cập nhật trường images trong bảng child_expenses');
      
      // Đầu tiên lấy dữ liệu images hiện tại (nếu có)
      const { data: currentExpense, error: getError } = await adminSupabase
        .from('child_expenses')
        .select('images')
        .eq('id', expenseId)
        .single();
      
      let existingImages = [];
      if (!getError && currentExpense) {
        try {
          // Xử lý trường hợp images là chuỗi JSON
          if (currentExpense.images && typeof currentExpense.images === 'string') {
            existingImages = JSON.parse(currentExpense.images);
          } 
          // Trường hợp đã là mảng
          else if (Array.isArray(currentExpense.images)) {
            existingImages = currentExpense.images;
          }
          // Trường hợp là giá trị đơn
          else if (currentExpense.images) {
            existingImages = [currentExpense.images];
          }
        } catch (e) {
          console.error('❌ Lỗi parse JSON images hiện tại:', e);
          existingImages = [];
        }
      }
      
      // Kết hợp ảnh hiện tại với ảnh mới
      const allImages = [...existingImages, ...imageUrls];
      console.log('📝 Tổng số ảnh sau khi kết hợp:', allImages.length);
      
      // Cập nhật vào database
      const { error: updateError } = await adminSupabase
        .from('child_expenses')
        .update({ 
          images: allImages,
          updated_at: new Date().toISOString()
        })
        .eq('id', expenseId);
      
      if (updateError) {
        console.error('❌ Lỗi cập nhật trường images:', updateError);
      } else {
        console.log('✅ Đã cập nhật trường images thành công');
      }
    }
    
    // Trả về kết quả
    return res.status(200).json({
      success: true,
      message: `Đã tải lên ${imageUrls.length} hình ảnh`,
      imageUrls: imageUrls
    });
    
  } catch (error) {
    console.error('❌ Lỗi xử lý upload ảnh:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server, vui lòng thử lại sau',
      error: error.message
    });
  }
});

module.exports = router;