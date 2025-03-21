// routes.js
const express = require('express');
const router = express.Router();
const { verifyToken, checkAuth } = require('./middleware/auth');
const { supabase } = require('./config/supabase');
const UserDataService = require('./services/userDataService');
const DashboardService = require('./services/dashboardService');

// Trang chủ và UI routes
router.get('/', verifyToken, (req, res) => res.redirect('/dashboard'));

// Các route không cần xác thực
router.get('/login', checkAuth, (req, res) => {
  res.render('login', { 
    title: 'Đăng nhập | Quản lý Chi phí'
  });
});

// Các route cần xác thực
router.get('/dashboard', verifyToken, async (req, res) => {
  try {
    // Lấy dữ liệu tổng quan
    const [recentExpenses, monthlyStats] = await Promise.all([
      req.dataService.getDynamicData('expenses', { limit: 5 }),
      req.dataService.getDynamicData('reports', { 
        filters: { period: 'monthly', date: new Date().toISOString() }
      })
    ]);

    res.render('index', {
      title: 'Tổng quan | Quản lý Chi phí',
      page: 'dashboard',
      user: req.user,
      staticData: req.staticData,
      recentExpenses,
      monthlyStats
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).send('Có lỗi xảy ra');
  }
});

router.get('/expenses', verifyToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    // Lấy danh sách chi phí
    const expenses = await req.dataService.getDynamicData('expenses', {
      page,
      limit,
      filters: req.query
    });

    res.render('index', {
      title: 'Chi phí | Quản lý Chi phí',
      page: 'expenses',
      user: req.user,
      staticData: req.staticData,
      expenses,
      pagination: { page, limit }
    });
  } catch (error) {
    console.error('Expenses error:', error);
    res.status(500).send('Có lỗi xảy ra');
  }
});

router.get('/reports', verifyToken, (req, res) => {
  res.render('index', { 
    title: 'Báo cáo | Quản lý Chi phí',
    page: 'reports',
    user: req.user
  });
});

router.get('/settings', verifyToken, (req, res) => {
  res.render('index', { 
    title: 'Cài đặt | Quản lý Chi phí',
    page: 'settings',
    user: req.user
  });
});

// API đăng nhập
router.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email và mật khẩu là bắt buộc'
      });
    }
    
    // Đăng nhập với Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) {
      console.error('[Login API] Lỗi đăng nhập:', error.message);
      
      // Trả về lỗi cụ thể
      let errorMessage = 'Đăng nhập thất bại';
      
      if (error.message.includes('Invalid login credentials')) {
        errorMessage = 'Email hoặc mật khẩu không đúng';
      } else if (error.message.includes('Email not confirmed')) {
        errorMessage = 'Email chưa được xác thực, vui lòng kiểm tra email của bạn';
      }
      
      return res.status(401).json({
        success: false,
        error: errorMessage
      });
    }
    
    // Lấy token từ kết quả đăng nhập
    const token = data.session.access_token;
    
    // Lưu token vào cookie
    res.cookie('sb_token', token, {
      httpOnly: true, // Không thể truy cập bằng JavaScript
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
      sameSite: 'lax' // Bảo vệ CSRF
    });
    
    console.log('[Login API] Đăng nhập thành công cho user:', data.user.email);
    
    // Khởi tạo service để lấy dữ liệu
    const userDataService = new UserDataService(data.user.id);
    
    try {
      // Lấy dữ liệu static của user
      const staticData = await userDataService.getStaticData();
      
      // Trả về thông tin người dùng và token
      return res.json({
        success: true,
        user: data.user,
        token: token,
        staticData
      });
    } catch (dataError) {
      console.error('[Login API] Lỗi khi lấy dữ liệu user:', dataError);
      
      // Vẫn trả về thành công dù không lấy được dữ liệu
      return res.json({
        success: true,
        user: data.user,
        token: token,
        staticData: null
      });
    }
  } catch (err) {
    console.error('[Login API] Lỗi server:', err);
    
    return res.status(500).json({
      success: false,
      error: 'Lỗi máy chủ, vui lòng thử lại sau'
    });
  }
});

// API kiểm tra xác thực
router.get('/api/check-auth', (req, res) => {
  try {
    // Lấy token từ cookie hoặc header Authorization
    let token = req.cookies?.sb_token;
    
    // Nếu không có trong cookie, kiểm tra trong header Authorization
    if (!token && req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Cần đăng nhập để truy cập'
      });
    }
    
    // Kiểm tra token với Supabase
    supabase.auth.getUser(token)
      .then(({ data, error }) => {
        if (error || !data.user) {
          console.log('Token không hợp lệ:', error);
          return res.status(401).json({
            success: false,
            error: 'Token không hợp lệ hoặc hết hạn'
          });
        }
        
        // Token hợp lệ
        return res.json({
          success: true,
          user: {
            id: data.user.id,
            email: data.user.email,
            user_metadata: data.user.user_metadata
          }
        });
      })
      .catch(error => {
        console.error('Lỗi xác thực:', error);
        return res.status(500).json({
          success: false,
          error: 'Lỗi xác thực'
        });
      });
  } catch (error) {
    console.error('Lỗi xác thực:', error);
    return res.status(500).json({
      success: false,
      error: 'Lỗi xác thực'
    });
  }
});

// API lấy chi phí
router.get('/api/expenses', verifyToken, async (req, res) => {
  try {
    const { limit = 10, page = 1, status, category, startDate, endDate } = req.query;
    const offset = (page - 1) * limit;
    
    // Sử dụng adminSupabase để bypass RLS
    const { getAdminClient } = require('./config/supabase');
    const adminSupabase = getAdminClient();
    
    if (!adminSupabase) {
      console.error('❌ Không thể khởi tạo admin client');
      return res.status(500).json({ error: 'Lỗi cấu hình server' });
    }
    
    // Xây dựng truy vấn cơ bản
    let query = adminSupabase
      .from('child_expenses')
      .select('*', { count: 'exact' })
      .eq('user_id', req.user.id);
    
    // Áp dụng các bộ lọc nếu có
    if (status && status !== 'all') {
      query = query.eq('trang_thai', status === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán');
    }
    
    if (category && category !== 'all') {
      query = query.eq('danh_muc', category);
    }
    
    if (startDate) {
      query = query.gte('ngay_thang', startDate);
    }
    
    if (endDate) {
      query = query.lte('ngay_thang', endDate);
    }
    
    // Thực hiện truy vấn với phân trang
    const { data, error, count } = await query
      .order('ngay_thang', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (error) {
      console.error('Lỗi khi lấy danh sách chi phí:', error);
      return res.status(400).json({ error: error.message });
    }
    
    return res.json({ 
      expenses: data, 
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Lỗi ngoại lệ khi lấy danh sách chi phí:', error);
    return res.status(500).json({ error: 'Lỗi lấy danh sách chi phí' });
  }
});

// API thêm chi phí mới
router.post('/api/expenses', verifyToken, async (req, res) => {
  try {
    const { noi_dung, gia_tien, ngay_thang, danh_muc, trang_thai, dia_diem, ghi_chu } = req.body;
    
    // Kiểm tra dữ liệu đầu vào
    if (!noi_dung || !gia_tien || !ngay_thang) {
      return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' });
    }
    
    const expenseData = {
      user_id: req.user.id,
      noi_dung,
      gia_tien: parseFloat(gia_tien),
      ngay_thang,
      danh_muc: danh_muc || 'Khác',
      trang_thai: trang_thai || null,
      dia_diem: dia_diem || null,
      ghi_chu: ghi_chu || null,
      created_at: new Date().toISOString()
    };
    
    console.log('Thêm mới chi phí với dữ liệu:', expenseData);
    
    // Sử dụng adminSupabase để bypass RLS
    const { getAdminClient } = require('./config/supabase');
    const adminSupabase = getAdminClient();
    
    if (!adminSupabase) {
      console.error('❌ Không thể khởi tạo admin client');
      return res.status(500).json({ error: 'Lỗi cấu hình server' });
    }
    
    // Thực hiện thêm mới chi phí với admin client
    const { data, error } = await adminSupabase
      .from('child_expenses')
      .insert(expenseData)
      .select();
    
    if (error) {
      console.error('Lỗi khi thêm chi phí:', error);
      return res.status(400).json({ error: error.message });
    }
    
    console.log('Đã thêm chi phí thành công:', data[0]);
    
    // Thông báo qua WebSocket nếu có
    const wsServer = req.app.get('wsServer');
    if (wsServer) {
      wsServer.notifyUser(req.user.id, {
        type: 'expense_added',
        expense: data[0]
      });
    }
    
    return res.json({ success: true, data: data[0] });
  } catch (error) {
    console.error('Lỗi ngoại lệ khi thêm chi phí:', error);
    return res.status(500).json({ error: 'Lỗi thêm chi phí' });
  }
});

// API cập nhật chi phí
router.put('/api/expenses/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { noi_dung, gia_tien, ngay_thang, danh_muc, trang_thai, dia_diem, ghi_chu, images } = req.body;
    
    // Sử dụng adminSupabase để bypass RLS
    const { getAdminClient } = require('./config/supabase');
    const adminSupabase = getAdminClient();
    
    if (!adminSupabase) {
      console.error('❌ Không thể khởi tạo admin client');
      return res.status(500).json({ error: 'Lỗi cấu hình server' });
    }
    
    // Kiểm tra chi phí có thuộc về người dùng không
    const { data: expense, error: checkError } = await adminSupabase
      .from('child_expenses')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();
    
    if (checkError || !expense) {
      console.error('Không tìm thấy chi phí hoặc không có quyền:', checkError);
      return res.status(404).json({ error: 'Chi phí không tồn tại hoặc không có quyền truy cập' });
    }
    
    const updateData = {
      noi_dung: noi_dung || expense.noi_dung,
      gia_tien: gia_tien ? parseFloat(gia_tien) : expense.gia_tien,
      ngay_thang: ngay_thang || expense.ngay_thang,
      danh_muc: danh_muc || expense.danh_muc,
      trang_thai: trang_thai !== undefined ? trang_thai : expense.trang_thai,
      dia_diem: dia_diem !== undefined ? dia_diem : expense.dia_diem,
      ghi_chu: ghi_chu !== undefined ? ghi_chu : expense.ghi_chu,
      updated_at: new Date().toISOString()
    };
    
    // Cập nhật images nếu có
    if (images !== undefined) {
      updateData.images = images;
    }
    
    console.log('Cập nhật chi phí với dữ liệu:', updateData);
    
    const { data, error } = await adminSupabase
      .from('child_expenses')
      .update(updateData)
      .eq('id', id)
      .select();
    
    if (error) {
      console.error('Lỗi khi cập nhật chi phí:', error);
      return res.status(400).json({ error: error.message });
    }
    
    console.log('Đã cập nhật chi phí thành công:', data[0]);
    
    // Thông báo qua WebSocket nếu có
    const wsServer = req.app.get('wsServer');
    if (wsServer) {
      wsServer.notifyUser(req.user.id, {
        type: 'expense_updated',
        expense: data[0]
      });
    }
    
    return res.json({ success: true, data: data[0] });
  } catch (error) {
    console.error('Lỗi ngoại lệ khi cập nhật chi phí:', error);
    return res.status(500).json({ error: 'Lỗi cập nhật chi phí' });
  }
});

// API xóa chi phí
router.delete('/api/expenses/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Sử dụng adminSupabase để bypass RLS
    const { getAdminClient } = require('./config/supabase');
    const adminSupabase = getAdminClient();
    
    if (!adminSupabase) {
      console.error('❌ Không thể khởi tạo admin client');
      return res.status(500).json({ error: 'Lỗi cấu hình server' });
    }
    
    // Kiểm tra chi phí có thuộc về người dùng không
    const { data: expense, error: checkError } = await adminSupabase
      .from('child_expenses')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();
    
    if (checkError || !expense) {
      return res.status(404).json({ error: 'Chi phí không tồn tại hoặc không có quyền truy cập' });
    }
    
    const { error } = await adminSupabase
      .from('child_expenses')
      .delete()
      .eq('id', id);
    
    if (error) return res.status(400).json({ error: error.message });
    
    // Thông báo qua WebSocket nếu có
    const wsServer = req.app.get('wsServer');
    if (wsServer) {
      wsServer.notifyUser(req.user.id, {
        type: 'expense_deleted',
        expenseId: id
      });
    }
    
    return res.json({ success: true, message: 'Đã xóa chi phí thành công' });
  } catch (error) {
    console.error('Lỗi khi xóa chi phí:', error);
    return res.status(500).json({ error: 'Lỗi xóa chi phí' });
  }
});

// API lấy thống kê
router.get('/api/statistics/summary', verifyToken, async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    
    // Lấy chi phí theo tháng
    const { data: monthlyData, error: monthlyError } = await supabase
      .from('child_expenses')
      .select('ngay_thang, gia_tien')
      .eq('user_id', req.user.id)
      .gte('ngay_thang', `${currentYear}-01-01`)
      .lte('ngay_thang', `${currentYear}-12-31`);
    
    if (monthlyError) return res.status(400).json({ error: monthlyError.message });
    
    // Tổng hợp chi phí theo tháng
    const monthlyExpenses = Array(12).fill(0);
    monthlyData.forEach(item => {
      const date = new Date(item.ngay_thang);
      const month = date.getMonth();
      monthlyExpenses[month] += item.gia_tien;
    });
    
    // Lấy chi phí theo danh mục
    const { data: categoryData, error: categoryError } = await supabase
      .from('child_expenses')
      .select('danh_muc, gia_tien')
      .eq('user_id', req.user.id);
    
    if (categoryError) return res.status(400).json({ error: categoryError.message });
    
    // Tổng hợp chi phí theo danh mục
    const categoryExpenses = {};
    categoryData.forEach(item => {
      const category = item.danh_muc || 'Không phân loại';
      if (!categoryExpenses[category]) categoryExpenses[category] = 0;
      categoryExpenses[category] += item.gia_tien;
    });
    
    // Mặc định khi không có dữ liệu
    if (Object.keys(categoryExpenses).length === 0) {
      categoryExpenses['Chưa có dữ liệu'] = 0;
    }
    
    return res.json({
      monthlyExpenses,
      categoryExpenses
    });
  } catch (error) {
    return res.status(500).json({ error: 'Lỗi lấy thống kê' });
  }
});

// API lấy dữ liệu báo cáo theo thời gian
router.get('/api/reports/time', verifyToken, async (req, res) => {
  try {
    const { timeRange = 'year' } = req.query;
    let startDate, endDate, groupBy;
    const currentDate = new Date();
    
    // Xác định phạm vi thời gian
    if (timeRange === 'month') {
      // Tháng hiện tại
      startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      groupBy = 'day';
    } else if (timeRange === 'quarter') {
      // Quý hiện tại
      const quarter = Math.floor(currentDate.getMonth() / 3);
      startDate = new Date(currentDate.getFullYear(), quarter * 3, 1);
      endDate = new Date(currentDate.getFullYear(), (quarter + 1) * 3, 0);
      groupBy = 'month';
    } else {
      // Năm hiện tại (mặc định)
      startDate = new Date(currentDate.getFullYear(), 0, 1);
      endDate = new Date(currentDate.getFullYear(), 11, 31);
      groupBy = 'month';
    }
    
    // Chuyển đổi thành chuỗi ISO
    const startDateString = startDate.toISOString().split('T')[0];
    const endDateString = endDate.toISOString().split('T')[0];
    
    // Lấy dữ liệu chi phí trong khoảng thời gian
    const { data, error } = await supabase
      .from('child_expenses')
      .select('ngay_thang, gia_tien')
      .eq('user_id', req.user.id)
      .gte('ngay_thang', startDateString)
      .lte('ngay_thang', endDateString)
      .order('ngay_thang');
    
    if (error) return res.status(400).json({ error: error.message });
    
    // Tính tổng chi phí và chi phí cao nhất
    let totalExpense = 0;
    let highestExpense = 0;
    
    data.forEach(item => {
      totalExpense += item.gia_tien;
      highestExpense = Math.max(highestExpense, item.gia_tien);
    });
    
    // Tính chi phí trung bình theo tháng
    const months = (timeRange === 'year') ? 12 : (timeRange === 'quarter' ? 3 : 1);
    const averageExpense = months > 0 ? totalExpense / months : 0;
    
    // Trả về kết quả
    return res.json({
      timeData: data,
      summary: {
        totalExpense,
        highestExpense,
        averageExpense
      }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Lỗi lấy báo cáo theo thời gian' });
  }
});

// API lấy dữ liệu báo cáo theo danh mục
router.get('/api/reports/category', verifyToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let query = supabase
      .from('child_expenses')
      .select('danh_muc, gia_tien')
      .eq('user_id', req.user.id);
    
    if (startDate) {
      query = query.gte('ngay_thang', startDate);
    }
    
    if (endDate) {
      query = query.lte('ngay_thang', endDate);
    }
    
    const { data, error } = await query;
    
    if (error) return res.status(400).json({ error: error.message });
    
    // Tổng hợp chi phí theo danh mục
    const categoryExpenses = {};
    let totalExpense = 0;
    
    data.forEach(item => {
      const category = item.danh_muc || 'Không phân loại';
      if (!categoryExpenses[category]) categoryExpenses[category] = 0;
      categoryExpenses[category] += item.gia_tien;
      totalExpense += item.gia_tien;
    });
    
    // Chuyển đổi thành mảng và tính phần trăm
    const categoryData = Object.entries(categoryExpenses).map(([name, value]) => ({
      name,
      value,
      percentage: totalExpense > 0 ? (value / totalExpense * 100).toFixed(2) : 0
    }));
    
    return res.json({
      categoryData,
      totalExpense
    });
  } catch (error) {
    return res.status(500).json({ error: 'Lỗi lấy báo cáo theo danh mục' });
  }
});

// API lấy thông tin người dùng
router.get('/api/user/profile', verifyToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .single();
    
    if (error) {
      // Nếu không tìm thấy profile, tạo mới
      if (error.code === 'PGRST116') {
        const newProfile = {
          id: req.user.id,
          full_name: req.user.user_metadata?.full_name || '',
          display_name: req.user.user_metadata?.full_name || req.user.email.split('@')[0],
          email: req.user.email,
          phone: '',
          bio: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        const { data: newData, error: insertError } = await supabase
          .from('profiles')
          .insert(newProfile)
          .select();
        
        if (insertError) {
          return res.status(400).json({ error: insertError.message });
        }
        
        return res.json({ profile: newData[0] });
      }
      
      return res.status(400).json({ error: error.message });
    }
    
    return res.json({ profile: data });
  } catch (error) {
    return res.status(500).json({ error: 'Lỗi lấy thông tin người dùng' });
  }
});

// API cập nhật thông tin người dùng
router.put('/api/user/profile', verifyToken, async (req, res) => {
  try {
    const { full_name, display_name, phone, bio } = req.body;
    
    const profileData = {
      full_name,
      display_name,
      phone,
      bio,
      updated_at: new Date().toISOString()
    };
    
    const { data, error } = await supabase
      .from('profiles')
      .update(profileData)
      .eq('id', req.user.id)
      .select();
    
    if (error) return res.status(400).json({ error: error.message });
    
    // Cập nhật metadata của user
    await supabase.auth.updateUser({
      data: { full_name }
    });
    
    return res.json({ profile: data[0] });
  } catch (error) {
    return res.status(500).json({ error: 'Lỗi cập nhật thông tin người dùng' });
  }
});

// API đổi mật khẩu
router.post('/api/user/change-password', verifyToken, async (req, res) => {
  try {
    const { new_password } = req.body;
    
    const { error } = await supabase.auth.updateUser({
      password: new_password
    });
    
    if (error) return res.status(400).json({ error: error.message });
    
    return res.json({ success: true, message: 'Đổi mật khẩu thành công' });
  } catch (error) {
    return res.status(500).json({ error: 'Lỗi đổi mật khẩu' });
  }
});

// API cập nhật dữ liệu
router.put('/api/profile', verifyToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update(req.body)
      .eq('user_id', req.user.id)
      .single();

    if (error) throw error;

    // Cập nhật cache
    await req.dataService.updateStaticData('profile', data);

    res.json({ success: true, data });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Có lỗi xảy ra' });
  }
});

// Hàm xử lý bộ lọc thời gian nhanh
function processDateFilters(req) {
  const filters = {};
  const { period, startDate, endDate } = req.query;
  
  // Lưu period vào filters nếu có
  if (period) {
    filters.period = period;
    console.log(`Đã thêm period=${period} vào filters`);
  }
  
  // Nếu có startDate và endDate cụ thể, ưu tiên sử dụng
  if (startDate && endDate) {
    // Kiểm tra tính hợp lệ của ngày tháng
    try {
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);
      
      // Nếu ngày không hợp lệ, sử dụng ngày mặc định
      if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
        console.warn('Ngày tháng không hợp lệ, sử dụng ngày mặc định');
        const today = new Date();
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        
        filters.startDate = firstDayOfMonth.toISOString().split('T')[0];
        filters.endDate = today.toISOString().split('T')[0];
      } else {
        filters.startDate = startDate;
        filters.endDate = endDate;
      }
    } catch (error) {
      console.error('Lỗi xử lý ngày tháng:', error);
      const today = new Date();
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      
      filters.startDate = firstDayOfMonth.toISOString().split('T')[0];
      filters.endDate = today.toISOString().split('T')[0];
    }
    
    return filters;
  }
  
  // Xử lý các bộ lọc nhanh
  const today = new Date();
  
  switch (period) {
    case 'today':
      // Hôm nay
      filters.startDate = today.toISOString().split('T')[0];
      filters.endDate = today.toISOString().split('T')[0];
      break;
      
    case 'week':
      // Tuần này (từ thứ 2 đến chủ nhật)
      const dayOfWeek = today.getDay(); // 0 = CN, 1 = T2, ...
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Điều chỉnh để T2 = 0
      const monday = new Date(today);
      monday.setDate(today.getDate() - diff);
      
      filters.startDate = monday.toISOString().split('T')[0];
      filters.endDate = today.toISOString().split('T')[0];
      break;
      
    case 'month':
      // Tháng này
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      
      filters.startDate = firstDayOfMonth.toISOString().split('T')[0];
      filters.endDate = lastDayOfMonth.toISOString().split('T')[0];
      break;
      
    case 'year':
      // Năm nay
      const firstDayOfYear = new Date(today.getFullYear(), 0, 1);
      const lastDayOfYear = new Date(today.getFullYear(), 11, 31);
      
      filters.startDate = firstDayOfYear.toISOString().split('T')[0];
      filters.endDate = lastDayOfYear.toISOString().split('T')[0];
      break;
      
    default:
      // Mặc định: tháng hiện tại nếu không có bộ lọc nào
      if (!filters.startDate && !filters.endDate) {
        const defaultFirstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        
        filters.startDate = defaultFirstDay.toISOString().split('T')[0];
        filters.endDate = today.toISOString().split('T')[0];
      }
  }
  
  return filters;
}

// API endpoints cho dashboard
router.get('/api/dashboard/summary', verifyToken, async (req, res) => {
  try {
    // Xử lý bộ lọc thời gian
    const dateFilters = processDateFilters(req);
    
    // Lấy các bộ lọc khác
    const { status, category } = req.query;
    const filters = {
      ...dateFilters,
      status,
      category
    };
    
    const dashboardService = new DashboardService(req.user.id);
    // Sử dụng phương thức getExpensesSummary
    const summaryData = await dashboardService.getExpensesSummary(filters);
    res.json(summaryData);
  } catch (error) {
    console.error('Lỗi khi lấy dữ liệu tổng quan:', error);
    res.status(500).json({ error: 'Không thể lấy dữ liệu tổng quan', message: error.message });
  }
});

router.get('/api/dashboard/timeline', verifyToken, async (req, res) => {
  try {
    // Xử lý bộ lọc thời gian
    const dateFilters = processDateFilters(req);
    
    // Lấy các bộ lọc khác
    const { status, category, range = 30 } = req.query;
    const filters = {
      ...dateFilters,
      status,
      category
    };
    
    const dashboardService = new DashboardService(req.user.id);
    // Sử dụng phương thức getExpensesByTime
    const expenses = await dashboardService.getExpensesByTime(parseInt(range), filters);
    res.json({ expenses });
  } catch (error) {
    console.error('Lỗi khi lấy dữ liệu timeline:', error);
    res.status(500).json({ error: 'Không thể lấy dữ liệu timeline', message: error.message });
  }
});

router.get('/api/dashboard/categories', verifyToken, async (req, res) => {
  try {
    // Xử lý bộ lọc thời gian
    const dateFilters = processDateFilters(req);
    
    // Lấy các bộ lọc khác
    const { status, category, period = 'month' } = req.query;
    const filters = {
      ...dateFilters,
      status,
      category
    };
    
    const dashboardService = new DashboardService(req.user.id);
    // Sử dụng phương thức getExpensesByCategory
    const categories = await dashboardService.getExpensesByCategory(period, filters);
    res.json(categories);
  } catch (error) {
    console.error('Lỗi khi lấy dữ liệu danh mục:', error);
    res.status(500).json({ error: 'Không thể lấy dữ liệu danh mục', message: error.message });
  }
});

router.get('/api/dashboard/recent', verifyToken, async (req, res) => {
  try {
    // Xử lý bộ lọc thời gian
    const dateFilters = processDateFilters(req);
    
    // Lấy các bộ lọc khác
    const { status, category, limit = 5 } = req.query;
    const filters = {
      ...dateFilters,
      status,
      category
    };
    
    const dashboardService = new DashboardService(req.user.id);
    // Sử dụng phương thức getRecentExpenses
    const expenses = await dashboardService.getRecentExpenses(parseInt(limit), filters);
    res.json({ expenses });
  } catch (error) {
    console.error('Lỗi khi lấy chi phí gần đây:', error);
    res.status(500).json({ error: 'Không thể lấy chi phí gần đây', message: error.message });
  }
});

router.get('/api/dashboard/recurring', verifyToken, async (req, res) => {
  try {
    // Xử lý bộ lọc thời gian
    const dateFilters = processDateFilters(req);
    
    // Lấy các bộ lọc khác
    const { status, category } = req.query;
    const filters = {
      ...dateFilters,
      status,
      category
    };
    
    const dashboardService = new DashboardService(req.user.id);
    // Sử dụng phương thức getRecurringExpenses
    const expenses = await dashboardService.getRecurringExpenses(filters);
    res.json({ expenses });
  } catch (error) {
    console.error('Lỗi khi lấy chi phí định kỳ:', error);
    res.status(500).json({ error: 'Không thể lấy chi phí định kỳ', message: error.message });
  }
});

// Thêm endpoint mới để lấy cấu hình Supabase
router.get('/api/supabase-config', (req, res) => {
  try {
    const { getSupabaseConfig } = require('./config/supabase');
    const config = getSupabaseConfig();
    res.json(config);
  } catch (error) {
    console.error('Lỗi khi lấy cấu hình Supabase:', error);
    res.status(500).json({ error: 'Không thể lấy cấu hình Supabase' });
  }
});

module.exports = router;