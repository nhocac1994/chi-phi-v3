const { supabase } = require('../config/supabase');
const cache = require('../utils/cache');

class DashboardService {
  constructor(userId) {
    this.userId = userId;
  }

  // Lấy tổng quan chi phí
  async getExpensesSummary(filters = {}) {
    try {
      const currentDate = new Date();
      let firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      let lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      
      // Áp dụng bộ lọc date nếu có
      if (filters.startDate) {
        firstDayOfMonth = new Date(filters.startDate);
      }
      
      if (filters.endDate) {
        lastDayOfMonth = new Date(filters.endDate);
      }
      
      // Tạo truy vấn cơ bản
      let query = supabase
        .from('child_expenses')
        .select('gia_tien')
        .eq('user_id', this.userId)
        .gte('ngay_thang', firstDayOfMonth.toISOString())
        .lte('ngay_thang', lastDayOfMonth.toISOString());
      
      // Áp dụng bộ lọc trạng thái nếu có
      if (filters.status) {
        query = query.eq('trang_thai', filters.status === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán');
      }
      
      // Áp dụng bộ lọc danh mục nếu có
      if (filters.category) {
        query = query.eq('danh_muc', filters.category);
      }
      
      const { data: currentMonthExpenses } = await query;

      // Tính thời gian tháng trước tương ứng với bộ lọc
      const daysInFiltered = Math.ceil((lastDayOfMonth - firstDayOfMonth) / (1000 * 60 * 60 * 24));
      const firstDayOfLastPeriod = new Date(firstDayOfMonth);
      firstDayOfLastPeriod.setDate(firstDayOfLastPeriod.getDate() - daysInFiltered);
      const lastDayOfLastPeriod = new Date(firstDayOfMonth);
      lastDayOfLastPeriod.setDate(lastDayOfLastPeriod.getDate() - 1);
      
      // Tạo truy vấn cho giai đoạn trước
      let previousQuery = supabase
        .from('child_expenses')
        .select('gia_tien')
        .eq('user_id', this.userId)
        .gte('ngay_thang', firstDayOfLastPeriod.toISOString())
        .lte('ngay_thang', lastDayOfLastPeriod.toISOString());
      
      // Áp dụng các bộ lọc nếu có, ngoại trừ ngày
      if (filters.status) {
        previousQuery = previousQuery.eq('trang_thai', filters.status === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán');
      }
      
      if (filters.category) {
        previousQuery = previousQuery.eq('danh_muc', filters.category);
      }
      
      const { data: lastMonthExpenses } = await previousQuery;

      // Tính toán các chỉ số
      const currentMonthTotal = currentMonthExpenses?.reduce((sum, exp) => sum + (exp.gia_tien || 0), 0) || 0;
      const lastMonthTotal = lastMonthExpenses?.reduce((sum, exp) => sum + (exp.gia_tien || 0), 0) || 0;
      
      const percentChange = lastMonthTotal === 0 ? 100 : ((currentMonthTotal - lastMonthTotal) / lastMonthTotal * 100);
      const averageDaily = daysInFiltered === 0 ? 0 : currentMonthTotal / daysInFiltered;

      console.log('Dữ liệu tổng quan:', {
        currentMonthExpenses: currentMonthExpenses?.length || 0,
        lastMonthExpenses: lastMonthExpenses?.length || 0,
        currentMonthTotal,
        lastMonthTotal,
        percentChange,
        averageDaily,
        filters
      });

      return {
        currentMonthTotal,
        lastMonthTotal,
        percentChange,
        averageDaily
      };
    } catch (error) {
      console.error('Lỗi lấy tổng quan chi phí:', error);
      throw error;
    }
  }

  // Lấy chi phí theo thời gian
  async getExpensesByTime(range = 7, filters = {}) {
    try {
      let startDate;
      let endDate;
      
      // Kiểm tra xem có phải là bộ lọc "Hôm nay" không
      if (filters.period === 'today') {
        // Nếu là "Hôm nay", chỉ lấy dữ liệu của ngày hiện tại
        const today = new Date();
        startDate = new Date(today);
        startDate.setHours(0, 0, 0, 0);
        
        endDate = new Date(today);
        endDate.setHours(23, 59, 59, 999);
        
        console.log('Áp dụng bộ lọc Hôm nay cho timeline:', startDate, endDate);
      } else {
        // Xử lý các trường hợp khác
        endDate = filters.endDate ? new Date(filters.endDate) : new Date();
        
        if (filters.startDate) {
          startDate = new Date(filters.startDate);
        } else {
          startDate = new Date();
          startDate.setDate(startDate.getDate() - range);
        }
      }

      // Tạo truy vấn cơ bản
      let query = supabase
        .from('child_expenses')
        .select('ngay_thang, gia_tien')
        .eq('user_id', this.userId)
        .gte('ngay_thang', startDate.toISOString())
        .lte('ngay_thang', endDate.toISOString());
      
      // Áp dụng bộ lọc trạng thái nếu có
      if (filters.status) {
        query = query.eq('trang_thai', filters.status === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán');
      }
      
      // Áp dụng bộ lọc danh mục nếu có
      if (filters.category) {
        query = query.eq('danh_muc', filters.category);
      }
      
      query = query.order('ngay_thang', { ascending: true });
      
      const { data: expenses } = await query;

      console.log('Dữ liệu timeline:', { 
        count: expenses?.length || 0,
        filters,
        startDate,
        endDate
      });

      // Tạo mảng dữ liệu theo ngày
      const dailyExpenses = {};
      
      // Tạo các ngày trong khoảng thời gian đã chọn
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        dailyExpenses[d.toISOString().split('T')[0]] = 0;
      }

      // Cộng dồn chi phí theo ngày
      expenses?.forEach(exp => {
        const date = exp.ngay_thang.split('T')[0];
        dailyExpenses[date] = (dailyExpenses[date] || 0) + (exp.gia_tien || 0);
      });

      return Object.entries(dailyExpenses).map(([date, amount]) => ({
        date,
        amount
      }));
    } catch (error) {
      console.error('Lỗi lấy chi phí theo thời gian:', error);
      throw error;
    }
  }

  // Lấy chi phí theo danh mục
  async getExpensesByCategory(period = 'month', filters = {}) {
    try {
      const currentDate = new Date();
      let startDate;
      let endDate;
      
      // Kiểm tra xem có phải là bộ lọc "Hôm nay" không
      if (filters.period === 'today') {
        // Nếu là "Hôm nay", chỉ lấy dữ liệu của ngày hiện tại
        startDate = new Date(currentDate);
        startDate.setHours(0, 0, 0, 0);
        
        endDate = new Date(currentDate);
        endDate.setHours(23, 59, 59, 999);
        
        console.log('Áp dụng bộ lọc Hôm nay cho danh mục:', startDate, endDate);
      } else if (period === 'custom' && filters.startDate && filters.endDate) {
        // Nếu là filter tùy chỉnh và có startDate và endDate
        startDate = new Date(filters.startDate);
        endDate = new Date(filters.endDate);
        console.log('Áp dụng bộ lọc tùy chỉnh cho danh mục:', startDate, endDate);
      } else {
        // Nếu không, sử dụng period
        switch (period) {
          case 'month':
            startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
            break;
          case 'quarter':
            startDate = new Date(currentDate.getFullYear(), Math.floor(currentDate.getMonth() / 3) * 3, 1);
            endDate = currentDate;
            break;
          case 'year':
            startDate = new Date(currentDate.getFullYear(), 0, 1);
            endDate = new Date(currentDate.getFullYear(), 11, 31);
            break;
          case 'week':
            // Tính ngày đầu tuần (thứ 2)
            const dayOfWeek = currentDate.getDay(); // 0 = CN, 1 = T2, ...
            const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            startDate = new Date(currentDate);
            startDate.setDate(currentDate.getDate() - diff);
            startDate.setHours(0, 0, 0, 0);
            
            endDate = new Date(currentDate);
            break;
          default:
            startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            endDate = currentDate;
        }
      }
      
      // Sử dụng startDate và endDate từ filters nếu có
      if (filters.startDate && !filters.period) {
        startDate = new Date(filters.startDate);
      }
      
      if (filters.endDate && !filters.period) {
        endDate = new Date(filters.endDate);
      }

      // Tạo truy vấn cơ bản
      let query = supabase
        .from('child_expenses')
        .select('danh_muc, gia_tien')
        .eq('user_id', this.userId)
        .gte('ngay_thang', startDate.toISOString())
        .lte('ngay_thang', endDate.toISOString());
      
      // Áp dụng bộ lọc trạng thái nếu có
      if (filters.status) {
        query = query.eq('trang_thai', filters.status === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán');
      }
      
      // Áp dụng bộ lọc danh mục nếu có (chỉ cho trường hợp xem chi tiết)
      if (filters.category) {
        query = query.eq('danh_muc', filters.category);
      }
      
      const { data: expenses } = await query;

      console.log('Dữ liệu danh mục:', { 
        count: expenses?.length || 0,
        period,
        filters,
        startDate,
        endDate
      });

      // Tính tổng chi phí theo danh mục
      const categoryData = {};
      expenses?.forEach(exp => {
        const category = exp.danh_muc || 'Không phân loại';
        categoryData[category] = (categoryData[category] || 0) + (exp.gia_tien || 0);
      });

      // Đảm bảo có dữ liệu trả về ngay cả khi không có chi phí
      if (Object.keys(categoryData).length === 0) {
        categoryData['Chưa có dữ liệu'] = 0;
      }

      // Chuyển đổi thành mảng và sắp xếp theo giá trị
      const sortedCategories = Object.entries(categoryData)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

      return sortedCategories;
    } catch (error) {
      console.error('Lỗi lấy chi phí theo danh mục:', error);
      throw error;
    }
  }

  // Lấy chi phí gần đây
  async getRecentExpenses(limit = 5, filters = {}) {
    try {
      // Tạo truy vấn cơ bản
      let query = supabase
        .from('child_expenses')
        .select('id, ngay_thang, noi_dung, gia_tien, danh_muc, trang_thai')
        .eq('user_id', this.userId);
      
      // Áp dụng bộ lọc thời gian nếu có
      if (filters.startDate) {
        query = query.gte('ngay_thang', new Date(filters.startDate).toISOString());
      }
      
      if (filters.endDate) {
        query = query.lte('ngay_thang', new Date(filters.endDate).toISOString());
      }
      
      // Áp dụng bộ lọc trạng thái nếu có
      if (filters.status) {
        query = query.eq('trang_thai', filters.status === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán');
      }
      
      // Áp dụng bộ lọc danh mục nếu có
      if (filters.category) {
        query = query.eq('danh_muc', filters.category);
      }
      
      // Sắp xếp và giới hạn kết quả
      query = query.order('ngay_thang', { ascending: false }).limit(limit);
      
      const { data: expenses } = await query;

      console.log('Dữ liệu chi phí gần đây:', { 
        count: expenses?.length || 0,
        filters
      });
      
      return expenses || [];
    } catch (error) {
      console.error('Lỗi lấy chi phí gần đây:', error);
      throw error;
    }
  }

  // Lấy chi phí định kỳ sắp đến hạn
  async getRecurringExpenses(filters = {}) {
    try {
      const currentDate = new Date();
      const nextWeek = new Date(currentDate);
      nextWeek.setDate(nextWeek.getDate() + 7);

      // Tạo truy vấn cơ bản: chi phí định kỳ là những chi phí chưa thanh toán và sắp đến ngày
      let query = supabase
        .from('child_expenses')
        .select('id, ngay_thang, noi_dung, gia_tien, danh_muc')
        .eq('user_id', this.userId)
        .is('trang_thai', null)  // Chưa thanh toán 
        .gte('ngay_thang', currentDate.toISOString())
        .lte('ngay_thang', nextWeek.toISOString());
      
      // Áp dụng bộ lọc danh mục nếu có
      if (filters.category) {
        query = query.eq('danh_muc', filters.category);
      }
      
      // Sắp xếp kết quả theo ngày tăng dần
      query = query.order('ngay_thang', { ascending: true });
      
      const { data: expenses } = await query;

      console.log('Dữ liệu chi phí định kỳ:', { 
        count: expenses?.length || 0,
        filters
      });
      
      return expenses || [];
    } catch (error) {
      console.error('Lỗi lấy chi phí định kỳ:', error);
      throw error;
    }
  }
}

module.exports = DashboardService; 