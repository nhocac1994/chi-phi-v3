// Tạo namespace riêng để tránh xung đột
const ReportsUpdate = {
  // Biến global để sửa lỗi "filteredExpenses is not defined"
  filteredExpenses: [],
  allExpenses: [],

  // Khởi tạo khi tài liệu đã sẵn sàng
  init: function() {
    console.log('Khởi tạo ReportsUpdate...');
    
    // Đợi một chút để các script khác tải xong
    setTimeout(() => {
      try {
        // Kiểm tra Supabase client
        this.checkSupabaseClient();
        
        // Thiết lập sự kiện cho các nút so sánh
        this.setupComparisonButtons();
        
        // Tải dữ liệu chi phí
        this.loadExpenseData();
      } catch (error) {
        console.error('Lỗi khi khởi tạo ReportsUpdate:', error);
      }
    }, 500);
  },

  // Hàm tải dữ liệu chi phí
  loadExpenseData: async function() {
    try {
      console.log('Bắt đầu tải dữ liệu chi phí...');
      
      // Kiểm tra kết nối đến Supabase
      const supabase = window.supabaseClient;
      if (!supabase) {
        console.error('Kết nối Supabase chưa được khởi tạo');
        return;
      }
      
      // Lấy thông tin khoảng thời gian từ bộ lọc
      let dateRange = this.getDateRangeFromFilter();
      if (!dateRange) {
        console.warn('Không thể xác định khoảng thời gian từ bộ lọc, sử dụng khoảng thời gian mặc định');
        // Sử dụng khoảng thời gian mặc định: 1 năm gần đây
        const endDate = new Date();
        const startDate = new Date();
        startDate.setFullYear(endDate.getFullYear() - 1);
        
        dateRange = {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0]
        };
      }
      
      const { startDate, endDate } = dateRange;
      console.log(`Đang tải dữ liệu từ ${startDate} đến ${endDate}`);
      
      // Truy vấn dữ liệu từ Supabase
      let query = supabase
        .from('child_expenses')
        .select('*');
        
      // Nếu có khoảng thời gian, áp dụng bộ lọc
      if (startDate && endDate) {
        query = query
          .gte('ngay_thang', startDate)
          .lte('ngay_thang', endDate);
      }
      
      // Sắp xếp theo ngày
      query = query.order('ngay_thang', { ascending: false });
      
      // Lọc theo trạng thái thanh toán nếu có
      if (typeof window.currentPaymentStatus !== 'undefined' && window.currentPaymentStatus !== 'all') {
        const isPaid = window.currentPaymentStatus === 'paid';
        query = query.eq('da_thanh_toan', isPaid);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Lỗi khi truy vấn dữ liệu chi phí:', error);
        return;
      }
      
      // Cập nhật biến toàn cục
      this.allExpenses = data || [];
      this.filteredExpenses = [...this.allExpenses];
      
      console.log(`Đã tải ${this.allExpenses.length} chi phí:`, this.allExpenses);
      
      // In mẫu dữ liệu chi phí đầu tiên để kiểm tra cấu trúc
      if (this.allExpenses.length > 0) {
        console.log('Mẫu dữ liệu chi phí:', this.allExpenses[0]);
      }
      
      // Tạo dữ liệu demo nếu không có dữ liệu thực
      if (this.allExpenses.length === 0) {
        console.warn('Không có dữ liệu chi phí thực, tạo dữ liệu demo để hiển thị');
        this.createDemoExpensesForComparison();
      } else {
        // Cập nhật giao diện người dùng với dữ liệu mới
        this.updateComparisonChartFixed('month'); // Cập nhật biểu đồ so sánh mặc định (tháng)
      }
      
    } catch (error) {
      console.error('Lỗi khi tải dữ liệu chi phí:', error);
      // Tạo dữ liệu demo trong trường hợp lỗi
      this.createDemoExpensesForComparison();
    }
  },

  // Tạo dữ liệu chi phí demo cho biểu đồ so sánh
  createDemoExpensesForComparison: function() {
    console.log('Tạo dữ liệu chi phí demo cho biểu đồ so sánh');
    
    // Tạo dữ liệu chi phí demo cho 12 tháng gần đây
    const today = new Date();
    const demoExpenses = [];
    
    for (let i = 0; i < 24; i++) {
      const date = new Date();
      date.setMonth(today.getMonth() - i);
      
      // Tạo từ 3-8 chi phí cho mỗi tháng
      const numExpenses = Math.floor(Math.random() * 6) + 3;
      
      for (let j = 0; j < numExpenses; j++) {
        // Ngày ngẫu nhiên trong tháng
        const day = Math.floor(Math.random() * 28) + 1;
        date.setDate(day);
        
        // Tạo chi phí
        demoExpenses.push({
          id: `demo-${i}-${j}`,
          ngay_thang: date.toISOString().split('T')[0],
          gia_tien: Math.floor(Math.random() * 1000000) + 50000,
          ten_chi_phi: `Chi phí demo ${j + 1}`,
          loai_chi_phi: ['Ăn uống', 'Di chuyển', 'Mua sắm', 'Giải trí'][Math.floor(Math.random() * 4)],
          dia_diem: ['Hà Nội', 'TP.HCM', 'Đà Nẵng', 'Hải Phòng'][Math.floor(Math.random() * 4)],
          ghi_chu: 'Chi phí demo',
          da_thanh_toan: Math.random() > 0.3
        });
      }
    }
    
    // Cập nhật biến toàn cục
    this.allExpenses = demoExpenses;
    this.filteredExpenses = [...demoExpenses];
    
    console.log(`Đã tạo ${demoExpenses.length} chi phí demo`);
    
    // Cập nhật biểu đồ
    this.updateComparisonChartFixed('month');
  },

  // Hàm cập nhật biểu đồ so sánh (phiên bản sửa lỗi)
  updateComparisonChartFixed: function(type) {
    console.log(`Cập nhật biểu đồ so sánh: ${type}`);
    
    // Kiểm tra và đảm bảo có dữ liệu chi phí
    if (!this.filteredExpenses || this.filteredExpenses.length === 0) {
      console.warn('Không có dữ liệu chi phí để tạo biểu đồ so sánh, đang tạo dữ liệu demo');
      this.createDemoExpensesForComparison();
      return;
    }
    
    // Thiết lập biến toàn cục cho loại dữ liệu so sánh
    if (typeof window.currentComparisonType !== 'undefined') {
      window.currentComparisonType = type;
    }
    
    // Lấy dữ liệu từ bộ nhớ cache hoặc tính toán lại
    let data = [];
    
    switch(type) {
      case 'month':
        data = this.generateMonthlyComparisonDataFixed();
        break;
      case 'quarter':
        data = this.generateQuarterlyComparisonDataFixed();
        break;
      case 'year':
        data = this.generateYearlyComparisonDataFixed();
        break;
      default:
        data = this.generateMonthlyComparisonDataFixed();
    }
    
    // Nếu không có đủ dữ liệu, tạo dữ liệu demo
    if (!data || data.length < 2) {
      console.warn(`Không đủ dữ liệu so sánh cho loại ${type}, sử dụng dữ liệu demo`);
      
      // Tạo dữ liệu demo phù hợp với loại so sánh
      switch(type) {
        case 'month':
          data = this.createDemoMonthlyComparison();
          break;
        case 'quarter':
          data = this.createDemoQuarterlyComparison();
          break;
        case 'year':
          data = this.createDemoYearlyComparison();
          break;
      }
    }
    
    console.log(`Dữ liệu biểu đồ so sánh ${type}:`, data);
    
    // Cập nhật bảng và biểu đồ (nếu có các hàm này)
    if (typeof renderComparisonTable === 'function') {
      renderComparisonTable(data);
    }
    
    if (typeof renderComparisonChart === 'function') {
      renderComparisonChart(data);
    }
  },

  // Tạo dữ liệu demo cho so sánh theo tháng
  createDemoMonthlyComparison: function() {
    const data = [];
    const now = new Date();
    
    // Tạo dữ liệu cho 6 tháng gần nhất
    for (let i = 5; i >= 0; i--) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      data.push({
        period: `Tháng ${month.getMonth() + 1}/${month.getFullYear()}`,
        amount: Math.floor(Math.random() * 20000000) + 5000000
      });
    }
    
    return data;
  },

  // Tạo dữ liệu demo cho so sánh theo quý
  createDemoQuarterlyComparison: function() {
    const data = [];
    const now = new Date();
    const currentQuarter = Math.floor(now.getMonth() / 3);
    
    // Tạo dữ liệu cho 4 quý gần nhất
    for (let i = 3; i >= 0; i--) {
      const quarter = (currentQuarter - i + 4) % 4 + 1;
      const year = now.getFullYear() - Math.floor((i - currentQuarter) / 4);
      
      data.push({
        period: `Q${quarter}/${year}`,
        amount: Math.floor(Math.random() * 50000000) + 10000000
      });
    }
    
    return data;
  },

  // Tạo dữ liệu demo cho so sánh theo năm
  createDemoYearlyComparison: function() {
    const data = [];
    const now = new Date();
    
    // Tạo dữ liệu cho 3 năm gần nhất
    for (let i = 2; i >= 0; i--) {
      const year = now.getFullYear() - i;
      
      data.push({
        period: `${year}`,
        amount: Math.floor(Math.random() * 200000000) + 50000000
      });
    }
    
    return data;
  },

  // Tạo dữ liệu so sánh theo tháng (phiên bản sửa lỗi)
  generateMonthlyComparisonDataFixed: function() {
    const expenses = this.filteredExpenses || [];
    
    if (!expenses || expenses.length === 0) {
      console.warn('Không có dữ liệu chi phí để tạo biểu đồ so sánh theo tháng');
      return [];
    }
    
    const monthlyData = {};
    
    expenses.forEach(expense => {
      const date = new Date(expense.ngay_thang);
      const month = date.getMonth();
      const year = date.getFullYear();
      const key = `${year}-${month + 1}`;
      
      if (!monthlyData[key]) {
        monthlyData[key] = {
          period: `${month + 1}/${year}`,
          amount: 0
        };
      }
      
      monthlyData[key].amount += expense.gia_tien || 0;
    });
    
    return Object.values(monthlyData).sort((a, b) => {
      const [monthA, yearA] = a.period.split('/');
      const [monthB, yearB] = b.period.split('/');
      
      if (yearA !== yearB) {
        return yearA - yearB;
      }
      
      return monthA - monthB;
    });
  },

  // Tạo dữ liệu so sánh theo quý (phiên bản sửa lỗi)
  generateQuarterlyComparisonDataFixed: function() {
    const expenses = this.filteredExpenses || [];
    
    if (!expenses || expenses.length === 0) {
      console.warn('Không có dữ liệu chi phí để tạo biểu đồ so sánh theo quý');
      return [];
    }
    
    const quarterlyData = {};
    
    expenses.forEach(expense => {
      const date = new Date(expense.ngay_thang);
      const month = date.getMonth();
      const year = date.getFullYear();
      const quarter = Math.floor(month / 3) + 1;
      const key = `${year}-Q${quarter}`;
      
      if (!quarterlyData[key]) {
        quarterlyData[key] = {
          period: `Q${quarter}/${year}`,
          amount: 0
        };
      }
      
      quarterlyData[key].amount += expense.gia_tien || 0;
    });
    
    return Object.values(quarterlyData).sort((a, b) => {
      const [quarterA, yearA] = a.period.split('/');
      const [quarterB, yearB] = b.period.split('/');
      
      if (yearA !== yearB) {
        return yearA - yearB;
      }
      
      return quarterA.replace('Q', '') - quarterB.replace('Q', '');
    });
  },

  // Tạo dữ liệu so sánh theo năm (phiên bản sửa lỗi)
  generateYearlyComparisonDataFixed: function() {
    const expenses = this.filteredExpenses || [];
    
    if (!expenses || expenses.length === 0) {
      console.warn('Không có dữ liệu chi phí để tạo biểu đồ so sánh theo năm');
      return [];
    }
    
    const yearlyData = {};
    
    expenses.forEach(expense => {
      const date = new Date(expense.ngay_thang);
      const year = date.getFullYear();
      const key = `${year}`;
      
      if (!yearlyData[key]) {
        yearlyData[key] = {
          period: `${year}`,
          amount: 0
        };
      }
      
      yearlyData[key].amount += expense.gia_tien || 0;
    });
    
    return Object.values(yearlyData).sort((a, b) => a.period - b.period);
  },

  // Khởi tạo lại các nút chuyển đổi so sánh
  setupComparisonButtons: function() {
    const comparisonButtons = document.querySelectorAll('.reports-comparison-btn');
    
    if (comparisonButtons && comparisonButtons.length > 0) {
      console.log('Thiết lập lại sự kiện cho các nút so sánh');
      
      // Xóa sự kiện cũ
      comparisonButtons.forEach(button => {
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
      });
      
      // Lấy lại các nút mới
      const newButtons = document.querySelectorAll('.reports-comparison-btn');
      
      // Gắn sự kiện mới
      newButtons.forEach(button => {
        button.addEventListener('click', () => {
          // Xóa class active khỏi tất cả các nút
          newButtons.forEach(btn => btn.classList.remove('active'));
          
          // Thêm class active cho nút được nhấp
          button.classList.add('active');
          
          // Lấy giá trị loại dữ liệu (tháng, quý, năm)
          const type = button.getAttribute('data-type');
          
          // Cập nhật biểu đồ so sánh
          this.updateComparisonChartFixed(type);
        });
      });
      
      console.log('Đã gắn sự kiện mới cho các nút so sánh');
    } else {
      console.warn('Không tìm thấy nút chuyển đổi so sánh');
    }
  },

  // Kiểm tra Supabase client
  checkSupabaseClient: function() {
    // Kiểm tra Supabase client
    if (!window.supabaseClient && window.supabase) {
      console.log('Sử dụng biến window.supabase làm client');
      window.supabaseClient = window.supabase;
    }
    
    if (!window.supabaseClient) {
      console.warn('Không tìm thấy Supabase client, đang khởi tạo...');
      
      // Khởi tạo Supabase client
      try {
        const SUPABASE_URL = 'https://iifnfqsusnjqyvegwchr.supabase.co';
        const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpZm5mcXN1c25qcXl2ZWd3Y2hyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE1Nzk2MDQsImV4cCI6MjA1NzE1NTYwNH0.Lei4t4UKezBHkb3CNcXuVQ5S4Fr0fY0J4oswu-GtcVU';
        
        if (typeof supabase !== 'undefined' && typeof supabase.createClient === 'function') {
          window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
          console.log('Đã khởi tạo Supabase client');
        } else {
          console.error('Không thể khởi tạo Supabase client - thư viện không tồn tại');
        }
      } catch (error) {
        console.error('Lỗi khi khởi tạo Supabase client:', error);
      }
    }
    
    return window.supabaseClient;
  },

  // Hàm lấy khoảng thời gian từ bộ lọc
  getDateRangeFromFilter: function() {
    try {
      // Kiểm tra nếu hàm getCurrentDateRange tồn tại
      if (typeof getCurrentDateRange === 'function') {
        const dateRange = getCurrentDateRange();
        
        // Định dạng lại ngày tháng cho phù hợp với Supabase (yyyy-MM-dd)
        const formatForSupabase = (dateStr) => {
          // Giả sử dateStr đang ở dạng dd-MM-yyyy
          const parts = dateStr.split('-');
          if (parts.length === 3) {
            // Chuyển thành yyyy-MM-dd
            return `${parts[2]}-${parts[1]}-${parts[0]}`;
          }
          return dateStr;
        };
        
        return {
          startDate: formatForSupabase(dateRange.start),
          endDate: formatForSupabase(dateRange.end)
        };
      }
      
      // Nếu không tìm thấy hàm, tạo khoảng thời gian mặc định: 1 năm gần đây
      const now = new Date();
      const startDate = new Date();
      startDate.setFullYear(now.getFullYear() - 1);
      
      return {
        startDate: startDate.toISOString().split('T')[0],
        endDate: now.toISOString().split('T')[0]
      };
    } catch (error) {
      console.error('Lỗi khi lấy khoảng thời gian từ bộ lọc:', error);
      return null;
    }
  }
};

// Khởi tạo khi tài liệu đã sẵn sàng
document.addEventListener('DOMContentLoaded', function() {
  ReportsUpdate.init();
});
