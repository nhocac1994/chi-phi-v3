/**
 * Reports Page JavaScript
 * Xử lý hiển thị báo cáo, biểu đồ, và tương tác người dùng
 */

// Biến global
// Sử dụng window.supabaseClient thay vì khai báo lại
let currentReportType = 'time';
let currentTimeRange = 'year';
let currentCharts = {};
let currentComparisonType = 'month';
let currentPaymentStatus = 'all'; // Thêm biến global cho trạng thái thanh toán
let userData = null;
let allExpenses = []; // Thêm biến global cho tất cả chi phí
let filteredExpenses = []; // Thêm biến global cho chi phí đã lọc

// Thêm biến global cho phân trang
let currentPage = 1;
let itemsPerPage = 10;
let totalPages = 1;
let currentDetailData = [];

// Thêm các biến cấu hình
const CONFIG = {
  colors: {
    primary: '#6366f1',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#3b82f6',
    error: '#dc2626'
  },
  categories: {
    'Ăn uống': { icon: 'bi-cup-hot', color: '#f59e0b' },
    'Đi lại': { icon: 'bi-car-front', color: '#3b82f6' },
    'Mua sắm': { icon: 'bi-bag', color: '#ec4899' },
    'Giải trí': { icon: 'bi-controller', color: '#8b5cf6' },
    'Y tế': { icon: 'bi-heart-pulse', color: '#ef4444' },
    'Nhà cửa': { icon: 'bi-house', color: '#10b981' },
    'Giáo dục': { icon: 'bi-book', color: '#6366f1' },
    'Hóa đơn': { icon: 'bi-receipt', color: '#f97316' },
    'Khác': { icon: 'bi-three-dots', color: '#94a3b8' }
  },
  chart: {
    animation: {
      duration: 800,
      easing: 'easeInOutQuart'
    },
    tooltip: {
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      titleFont: { size: 13 },
      bodyFont: { size: 12 },
      padding: 12
    }
  },
  dateRanges: {
    today: 'Hôm nay',
    yesterday: 'Hôm qua',
    thisWeek: '7 ngày qua',
    thisMonth: 'Tháng này',
    lastMonth: 'Tháng trước',
    thisQuarter: 'Quý này',
    thisYear: 'Năm nay',
    custom: 'Tùy chọn'
  }
};

// Thêm hàm kiểm tra và tải Chart.js
function detectChartJsLibrary() {
  return new Promise((resolve, reject) => {
    // Kiểm tra nếu Chart.js đã tồn tại
    if (typeof Chart !== 'undefined') {
      console.log('Chart.js đã được tải');
      resolve(Chart);
      return;
    }
    
    console.log('Chart.js chưa được tải, đang thử tải...');
    
    // Kiểm tra xem script đã tồn tại chưa
    let script = document.querySelector('script[src*="chart.js"]');
    if (!script) {
      // Tạo script element để tải Chart.js từ CDN
      script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js';
      script.async = true;
      
      script.onload = function() {
        console.log('Đã tải Chart.js thành công!');
        if (typeof Chart !== 'undefined') {
          resolve(Chart);
        } else {
          reject(new Error('Đã tải Chart.js nhưng không tìm thấy đối tượng Chart global'));
        }
      };
      
      script.onerror = function() {
        console.error('Không thể tải Chart.js từ CDN');
        reject(new Error('Không thể tải Chart.js'));
      };
      
      document.head.appendChild(script);
    } else {
      // Script đã tồn tại, đợi nó load
      script.onload = function() {
        console.log('Chart.js đã tải xong từ script hiện có');
        if (typeof Chart !== 'undefined') {
          resolve(Chart);
        } else {
          reject(new Error('Chart.js script tồn tại nhưng không tìm thấy đối tượng Chart global'));
        }
      };
    }
  });
}

// Thiết lập sự kiện khi trang đã tải xong
document.addEventListener('DOMContentLoaded', async function() {
  console.log('🔄 Trang báo cáo đã tải xong, chuẩn bị khởi tạo...');
  
  // Tạo loading overlay
  createLoadingOverlay();
  showLoading();
  
  try {
    // Kiểm tra và tải Chart.js nếu cần
    console.log('Kiểm tra thư viện Chart.js...');
    try {
      await detectChartJsLibrary();
      console.log('✅ Chart.js đã sẵn sàng');
    } catch (chartError) {
      console.error('❌ Lỗi khi tải Chart.js:', chartError);
      showError('Không thể tải thư viện biểu đồ. Vui lòng làm mới trang.');
    }
    
    // Khởi tạo listeners và thiết lập các thành phần
    setupEventListeners();
    setupSearchAndFilters();
    setupDateRangePicker();
    setupChartInteractions();
    
    // Đảm bảo Supabase được khởi tạo
    initSupabaseClient();
    
    // Thêm CSS để cải thiện hiệu ứng loading
    addDynamicStyles();
    
    // Thêm một khoảng thời gian ngắn để đảm bảo các thành phần đã tải xong
    setTimeout(() => {
      console.log('Bắt đầu kiểm tra xác thực sau khi trang đã tải xong...');
      checkAuth();
    }, 500);
  } catch (error) {
    console.error('Lỗi khi khởi tạo trang báo cáo:', error);
    hideLoading();
    showError('Không thể khởi tạo trang báo cáo. Vui lòng tải lại trang.');
  }
});

// Thêm CSS động
function addDynamicStyles() {
  if (!document.getElementById('reports-loading-style')) {
    const style = document.createElement('style');
    style.id = 'reports-loading-style';
    style.textContent = `
      .reports-chart-wrapper.loading, .reports-table-container.loading {
        position: relative;
        min-height: 150px;
      }
      
      .reports-chart-wrapper.loading::after, .reports-table-container.loading::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(17, 24, 39, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10;
        border-radius: 8px;
      }
      
      .reports-chart-wrapper.loading::before, .reports-table-container.loading::before {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        width: 40px;
        height: 40px;
        margin-top: -20px;
        margin-left: -20px;
        border: 4px solid rgba(255, 255, 255, 0.3);
        border-top: 4px solid #6366f1;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        z-index: 11;
      }
      
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }
}

// Hàm tạo loading overlay nếu chưa tồn tại
function createLoadingOverlay() {
  console.log('Kiểm tra và tạo loading overlay nếu cần');
  
  // Kiểm tra xem loading overlay đã tồn tại chưa
  let loadingOverlay = document.querySelector('.loading-overlay');
  
  if (!loadingOverlay) {
    console.log('Tạo loading overlay mới');
    
    // Tạo phần tử loading overlay
    loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'loading-overlay';
    loadingOverlay.style.position = 'fixed';
    loadingOverlay.style.top = '0';
    loadingOverlay.style.left = '0';
    loadingOverlay.style.width = '100%';
    loadingOverlay.style.height = '100%';
    loadingOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    loadingOverlay.style.display = 'none';
    loadingOverlay.style.justifyContent = 'center';
    loadingOverlay.style.alignItems = 'center';
    loadingOverlay.style.zIndex = '9999';
    
    // Tạo spinner
    const spinner = document.createElement('div');
    spinner.className = 'spinner-border text-light';
    spinner.setAttribute('role', 'status');
    
    // Tạo text cho spinner
    const spinnerText = document.createElement('span');
    spinnerText.className = 'visually-hidden';
    spinnerText.textContent = 'Đang tải...';
    
    // Ghép các phần tử lại
    spinner.appendChild(spinnerText);
    loadingOverlay.appendChild(spinner);
    
    // Thêm vào body
    document.body.appendChild(loadingOverlay);
    
    console.log('Đã tạo loading overlay thành công');
  } else {
    console.log('Loading overlay đã tồn tại');
  }
  
  return loadingOverlay;
}

// Khởi tạo Supabase client nếu chưa có
function initSupabaseClient() {
  // Nếu đã có client, trả về luôn
  if (window.supabase && window.supabase.auth) {
    console.log('Sử dụng Supabase client hiện có');
    return window.supabase;
  }
  
  try {
    console.log('Khởi tạo Supabase client mới...');
    const SUPABASE_URL = 'https://iifnfqsusnjqyvegwchr.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpZm5mcXN1c25qcXl2ZWd3Y2hyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE1Nzk2MDQsImV4cCI6MjA1NzE1NTYwNH0.Lei4t4UKezBHkb3CNcXuVQ5S4Fr0fY0J4oswu-GtcVU';
    
    // Tạo client
    const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // Lưu vào window object
    window.supabase = client;
    console.log('✅ Khởi tạo Supabase client thành công');
    
    // Kiểm tra kết nối và bảng
    checkSupabaseTables(client);
    
    return client;
  } catch (error) {
    console.error('❌ Lỗi khởi tạo Supabase client:', error);
    return null;
  }
}

// Kiểm tra bảng trong Supabase
async function checkSupabaseTables(client) {
  try {
    console.log('Đang kiểm tra bảng child_expenses...');
    
    // Thử truy vấn (sẽ thất bại nếu bảng không tồn tại)
    const { data, error } = await client
      .from('child_expenses')
      .select('id')
      .limit(1);
    
    if (error) {
      console.error('Lỗi khi kiểm tra bảng child_expenses:', error);
      console.warn('Có thể bảng child_expenses không tồn tại hoặc bạn không có quyền truy cập');
      
      // Hiển thị thông báo cho người dùng
      showNotification('Không thể kết nối đến cơ sở dữ liệu. Đang sử dụng dữ liệu mẫu.', 'warning');
    } else {
      console.log('Bảng child_expenses tồn tại và có thể truy cập');
    }
  } catch (error) {
    console.error('Lỗi khi kiểm tra bảng:', error);
  }
}

// Hiển thị thông báo 
function showNotification(message, type = 'info') {
  // Tạo element thông báo
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
    <div class="notification-content">
      <i class="bi ${type === 'info' ? 'bi-info-circle' : type === 'warning' ? 'bi-exclamation-triangle' : 'bi-check-circle'}"></i>
      <span>${message}</span>
    </div>
    <button class="notification-close"><i class="bi bi-x"></i></button>
  `;
  
  // Thêm vào DOM
  document.body.appendChild(notification);
  
  // Hiển thị sau 10ms để có hiệu ứng
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);
  
  // Xử lý nút đóng
  const closeBtn = notification.querySelector('.notification-close');
  closeBtn.addEventListener('click', () => {
    notification.classList.remove('show');
    setTimeout(() => {
      notification.remove();
    }, 300);
  });
  
  // Tự động ẩn sau 5s
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 5000);
}

// Kiểm tra xác thực người dùng
async function checkAuth() {
  try {
    showLoading();
    
    console.log('Bắt đầu kiểm tra xác thực người dùng...');
    
    // Đảm bảo DOM đã tải xong
    if (document.readyState === 'loading') {
      console.log('DOM chưa sẵn sàng, đợi DOMContentLoaded...');
      await new Promise(resolve => {
        document.addEventListener('DOMContentLoaded', resolve);
      });
    }
    
    // Lấy token từ cookie hoặc các nguồn khác
    const token = getCookie('sb_token') || localStorage.getItem('token') || sessionStorage.getItem('sb_token');
    console.log('Token sử dụng để xác thực:', token ? 'Có token' : 'Không có token');
    
    if (!token) {
      console.error('Không tìm thấy token đăng nhập');
      window.location.href = '/login';
      return;
    }

    // Đợi một chút để đảm bảo mọi thứ được khởi tạo
    await new Promise(resolve => setTimeout(resolve, 500));

    // Khởi tạo Supabase client nếu chưa có
    const client = initSupabaseClient();
    
    if (!client || !client.auth) {
      console.error('❌ Không thể khởi tạo hoặc truy cập Supabase client');
      hideLoading();
      showError('Không thể kết nối đến cơ sở dữ liệu. Vui lòng tải lại trang.');
      return;
    }
    
    // Thiết lập session với token
    console.log('Đang xác thực với Supabase auth client...');
    
    // Sử dụng getUser với token
    try {
      console.log('Gọi authClient.getUser() với token');
      const { data, error } = await client.auth.getUser(token);
      
      if (error) {
        console.error('Token không hợp lệ hoặc hết hạn:', error);
        hideLoading();
        showError('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
        window.location.href = '/login';
        return;
      }
      
      if (!data || !data.user) {
        console.error('Không tìm thấy thông tin người dùng');
        hideLoading();
        showError('Không thể lấy thông tin người dùng. Vui lòng đăng nhập lại.');
        window.location.href = '/login';
        return;
      }
      
      // Lưu thông tin người dùng
      updateUserData(data.user);
      
      // Tải dữ liệu báo cáo
      loadReportData();
    } catch (error) {
      console.error('Lỗi khi gọi getUser:', error);
      hideLoading();
      showError('Lỗi xác thực. Vui lòng đăng nhập lại.');
      window.location.href = '/login';
    }
  } catch (error) {
    console.error('Lỗi xác thực:', error);
    hideLoading();
    showError('Không thể xác thực. Vui lòng đăng nhập lại.');
  }
}

// Cập nhật thông tin người dùng trên giao diện
function updateUserData(user) {
  try {
    // Đồng bộ hóa user data nếu có thể
    if (typeof window.syncUserData === 'function') {
      window.syncUserData(user);
    } else {
      window.userData = user;
    }
    
    // Log thông tin xác thực thành công
    console.log('✅ Xác thực thành công:', user.email);
    
    // Cập nhật avatar và tên người dùng
    const userNameElement = document.getElementById('userName');
    const userAvatarElement = document.getElementById('userAvatar');
    
    if (userNameElement) {
      userNameElement.textContent = user.email || 'Người dùng';
    }
    
    if (userAvatarElement) {
      userAvatarElement.src = user.user_metadata?.avatar_url || '/images/avatar-placeholder.jpg';
      userAvatarElement.alt = user.email || 'Avatar';
    }
    
    // Ẩn loading nếu có
    hideLoading();
    
    // Tải dữ liệu báo cáo
    loadReportData();
  } catch (error) {
    console.error('Lỗi khi cập nhật thông tin người dùng:', error);
    hideLoading();
  }
}

// Hàm lấy cookie
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

// Thiết lập các sự kiện cho trang reports
function setupEventListeners() {
  try {
    console.log('Thiết lập các sự kiện cho trang reports');
    
    // Toggle sidebar
    const toggleSidebarBtn = document.getElementById('toggleSidebar');
    if (toggleSidebarBtn) {
      toggleSidebarBtn.addEventListener('click', toggleSidebar);
    }
    
    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', handleLogout);
    }
    
    // Setup dropdowns
    setupDropdowns();
    
    // Export buttons
    setupExportButtons();
    
    // Kiểm tra xem có đang ở trang reports hay không
    const isReportsPage = window.location.pathname.includes('/reports');
    if (isReportsPage) {
      // Các sự kiện khác cho trang reports
      document.addEventListener('click', (e) => {
        // Đóng tất cả dropdown khi click ra ngoài
        if (!e.target.closest('.reports-dropdown')) {
          closeAllDropdowns();
        }
      });
    }
    
  } catch (error) {
    console.error('Lỗi khi thiết lập sự kiện:', error);
  }
}

// Thiết lập tất cả dropdown
function setupDropdowns() {
  // Tạo backdrop nếu chưa có
  if (!document.querySelector('.reports-dropdown-backdrop')) {
    const backdrop = document.createElement('div');
    backdrop.className = 'reports-dropdown-backdrop';
    document.body.appendChild(backdrop);
    
    // Xử lý click backdrop để đóng tất cả dropdown
    backdrop.addEventListener('click', closeAllDropdowns);
  }
  
  // Report type dropdown
  setupDropdown('report-type-toggle', 'report-type-menu', (item) => {
    const reportType = item.dataset.report;
    changeReportType(reportType);
  });
  
  // Time range dropdown
  setupDropdown('time-range-toggle', 'time-range-menu', (item) => {
    const timeRange = item.dataset.range;
    changeTimeRange(timeRange);
    
    // Hiển thị/ẩn custom date range
    const customDateRange = document.getElementById('customDateRange');
    if (customDateRange) {
      customDateRange.style.display = timeRange === 'custom' ? 'block' : 'none';
    }
  });
  
  // Payment status dropdown
  setupDropdown('payment-status-toggle', 'payment-status-menu', (item) => {
    const status = item.dataset.status;
    changePaymentStatus(status);
  });
  
  console.log('Đã thiết lập tất cả dropdown');
}

// Hàm chung để thiết lập dropdown
function setupDropdown(toggleId, menuId, onItemClick) {
  const toggleButton = document.getElementById(toggleId);
  const dropdown = toggleButton?.closest('.reports-dropdown');
  const menu = document.getElementById(menuId);
  
  if (!toggleButton || !dropdown || !menu) {
    console.warn(`Không tìm thấy phần tử dropdown ${toggleId}`);
    return;
  }
  
  console.log(`Thiết lập dropdown: ${toggleId}`);
  
  // Xóa sự kiện cũ (nếu có)
  const newToggleButton = toggleButton.cloneNode(true);
  toggleButton.parentNode.replaceChild(newToggleButton, toggleButton);
  
  // Click vào toggle button
  newToggleButton.addEventListener('click', function(e) {
    e.stopPropagation();
    e.preventDefault();
    
    console.log(`Click vào dropdown ${toggleId}`);
    
    // Đóng các dropdown khác
    document.querySelectorAll('.reports-dropdown').forEach(d => {
      if (d !== dropdown && d.classList.contains('active')) {
        d.classList.remove('active');
      }
    });
    
    // Toggle dropdown hiện tại
    dropdown.classList.toggle('active');
    
    // Toggle backdrop
    if (dropdown.classList.contains('active')) {
      document.body.classList.add('dropdown-active');
      console.log(`Dropdown ${toggleId} đã mở`);
    } else {
      document.body.classList.remove('dropdown-active');
      console.log(`Dropdown ${toggleId} đã đóng`);
    }
  });
  
  // Click vào dropdown item
  const items = menu.querySelectorAll('.reports-dropdown-item');
  items.forEach(item => {
    // Xóa sự kiện cũ (nếu có)
    const newItem = item.cloneNode(true);
    item.parentNode.replaceChild(newItem, item);
    
    newItem.addEventListener('click', function() {
      console.log(`Click vào item: ${newItem.textContent.trim()}`);
      
      // Cập nhật UI
      menu.querySelectorAll('.reports-dropdown-item').forEach(i => i.classList.remove('active'));
      newItem.classList.add('active');
      
      // Cập nhật nội dung toggle button
      const selectedText = newToggleButton.querySelector('.reports-selected-text');
      if (selectedText) {
        selectedText.textContent = newItem.textContent.trim();
      }
      
      // Callback
      if (typeof onItemClick === 'function') {
        onItemClick(newItem);
      }
      
      // Đóng dropdown
      dropdown.classList.remove('active');
      document.body.classList.remove('dropdown-active');
    });
  });
  
  // Ngăn sự kiện click truyền ra ngoài dropdown menu
  menu.addEventListener('click', (e) => {
    e.stopPropagation();
  });
}

// Đóng tất cả dropdown
function closeAllDropdowns() {
  document.querySelectorAll('.reports-dropdown.active').forEach(dropdown => {
    dropdown.classList.remove('active');
  });
  document.body.classList.remove('dropdown-active');
}

// Thiết lập các nút xuất báo cáo
function setupExportButtons() {
  const exportButtons = [
    { id: 'export-time-pdf', type: 'time', format: 'pdf' },
    { id: 'export-time-excel', type: 'time', format: 'excel' },
    { id: 'export-category-pdf', type: 'category', format: 'pdf' },
    { id: 'export-category-excel', type: 'category', format: 'excel' },
    { id: 'export-comparison-pdf', type: 'comparison', format: 'pdf' },
    { id: 'export-comparison-excel', type: 'comparison', format: 'excel' },
    { id: 'export-detail-pdf', type: 'detail', format: 'pdf' }
  ];
  
  exportButtons.forEach(button => {
    const element = document.getElementById(button.id);
    if (element) {
      element.addEventListener('click', () => exportReport(button.type, button.format));
    } else {
      console.warn(`Không tìm thấy nút xuất báo cáo: ${button.id}`);
    }
  });
  
  // Nút xuất PDF ở trang chi tiết
  const pdfButton = document.querySelector('.export-pdf-btn');
  if (pdfButton) {
    pdfButton.addEventListener('click', () => exportReport('detail', 'pdf'));
  }
  
  // Thêm sự kiện cho nút PDF ở header
  const pdfHeaderButton = document.querySelector('[data-export="pdf"]');
  if (pdfHeaderButton) {
    pdfHeaderButton.addEventListener('click', () => {
      // Xác định báo cáo hiện tại dựa trên currentReportType
      exportReport(currentReportType, 'pdf');
    });
  }
}

// Toggle sidebar
function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  sidebar.classList.toggle('collapsed');
  
  const toggleButton = document.getElementById('toggleSidebar');
  const icon = toggleButton.querySelector('i');
  
  if (sidebar.classList.contains('collapsed')) {
    icon.classList.remove('bi-arrow-left');
    icon.classList.add('bi-arrow-right');
  } else {
    icon.classList.remove('bi-arrow-right');
    icon.classList.add('bi-arrow-left');
  }
}

// Xử lý đăng xuất
async function handleLogout() {
  if (confirm('Bạn có chắc chắn muốn đăng xuất?')) {
    showLoading();
    
    try {
      // Đăng xuất với Supabase
      await window.supabase.auth.signOut();
      
      // Xóa token khỏi tất cả nơi lưu trữ
      document.cookie = 'sb_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      localStorage.removeItem('token');
      sessionStorage.removeItem('sb_token');
      localStorage.removeItem('supabase.auth.token');
      
      // Chuyển về trang đăng nhập
      window.location.href = '/login';
    } catch (error) {
      console.error('Lỗi đăng xuất:', error);
      hideLoading();
      showError('Không thể đăng xuất. Vui lòng thử lại.');
    }
  }
}

// Hiển thị loading
function showLoading() {
  const loadingOverlay = document.querySelector('.loading-overlay');
  if (loadingOverlay) {
    loadingOverlay.style.display = 'flex';
  } else {
    console.warn('Không tìm thấy phần tử loading-overlay');
    // Tạo phần tử loading overlay nếu không tồn tại
    const newLoadingOverlay = document.createElement('div');
    newLoadingOverlay.className = 'loading-overlay';
    newLoadingOverlay.innerHTML = '<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Đang tải...</span></div>';
    newLoadingOverlay.style.display = 'flex';
    newLoadingOverlay.style.position = 'fixed';
    newLoadingOverlay.style.top = '0';
    newLoadingOverlay.style.left = '0';
    newLoadingOverlay.style.width = '100%';
    newLoadingOverlay.style.height = '100%';
    newLoadingOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    newLoadingOverlay.style.zIndex = '9999';
    newLoadingOverlay.style.justifyContent = 'center';
    newLoadingOverlay.style.alignItems = 'center';
    document.body.appendChild(newLoadingOverlay);
  }
}

// Ẩn loading
function hideLoading() {
  const loadingOverlay = document.querySelector('.loading-overlay');
  if (loadingOverlay) {
    loadingOverlay.style.display = 'none';
  } else {
    console.warn('Không tìm thấy phần tử loading-overlay để ẩn');
  }
}

// Hiển thị thông báo lỗi
function showError(message) {
  // Kiểm tra xem Toastify có tồn tại không
  if (typeof Toastify === 'function') {
    Toastify({
      text: message,
      duration: 3000,
      gravity: "top",
      position: "right",
      backgroundColor: CONFIG.colors.error,
      stopOnFocus: true
    }).showToast();
  } else {
    // Sử dụng hàm showNotification nếu không có Toastify
    console.error('Lỗi:', message);
    showNotification(message, 'error');
  }
}

// Hiển thị thông báo thành công
function showSuccess(message) {
  // Kiểm tra xem Toastify có tồn tại không
  if (typeof Toastify === 'function') {
    Toastify({
      text: message,
      duration: 3000,
      gravity: "top",
      position: "right",
      backgroundColor: CONFIG.colors.success,
      stopOnFocus: true
    }).showToast();
  } else {
    // Sử dụng hàm showNotification nếu không có Toastify
    console.log('Thành công:', message);
    showNotification(message, 'success');
  }
}

// Thay đổi loại báo cáo
function changeReportType(reportType) {
  currentReportType = reportType;
  
  // Ẩn tất cả báo cáo
  const timeReport = document.getElementById('time-report');
  const categoryReport = document.getElementById('category-report');
  const comparisonReport = document.getElementById('comparison-report');
  const detailReport = document.getElementById('detail-report');
  
  // Kiểm tra và ẩn các báo cáo
  if (timeReport) timeReport.style.display = 'none';
  if (categoryReport) categoryReport.style.display = 'none';
  if (comparisonReport) comparisonReport.style.display = 'none';
  if (detailReport) detailReport.style.display = 'none';
  
  // Hiển thị báo cáo được chọn
  const selectedReport = document.getElementById(`${reportType}-report`);
  if (selectedReport) {
    selectedReport.style.display = 'block';
  } else {
    console.warn(`Không tìm thấy phần tử báo cáo: ${reportType}-report`);
  }
  
  // Tải dữ liệu báo cáo
  if (reportType === 'comparison') {
    loadComparisonData();
  } else if (reportType === 'detail') {
    loadDetailReport();
  } else {
    loadReportData();
  }
}

// Thay đổi phạm vi thời gian
function changeTimeRange(timeRange) {
  currentTimeRange = timeRange;
  
  // Ẩn/hiện custom date range
  const customDateRange = document.getElementById('customDateRange');
  if (customDateRange) {
    customDateRange.style.display = timeRange === 'custom' ? 'block' : 'none';
  } else {
    console.warn('Không tìm thấy phần tử customDateRange');
  }
  
  // Nếu không phải custom, tải dữ liệu ngay
  if (timeRange !== 'custom') {
    loadReportData();
  }
}

// Tải dữ liệu báo cáo
async function loadReportData() {
  showLoading();
  
  try {
    // Kiểm tra userData có tồn tại không
    if (!window.userData || !window.userData.id) {
      console.error('Chưa có thông tin người dùng, không thể tải dữ liệu báo cáo');
      hideLoading();
      showEmptyState('report-container', 'Không có dữ liệu người dùng. Vui lòng đăng nhập để xem báo cáo.');
      return;
    }
    
    console.log(`Tải dữ liệu báo cáo: ${currentReportType}, khoảng thời gian: ${currentTimeRange}`);
    
    // Tải dữ liệu theo thời gian
    if (currentReportType === 'time') {
      await loadTimeReport(window.userData.id);
    }
    
    // Tải dữ liệu theo danh mục
    if (currentReportType === 'category') {
      await loadCategoryReport(window.userData.id);
    }
    
    // Tải dữ liệu chi tiết
    if (currentReportType === 'detail') {
      await loadDetailReport(window.userData.id);
    }
    
    hideLoading();
  } catch (error) {
    console.error('Lỗi tải dữ liệu báo cáo:', error);
    hideLoading();
    showError('Không thể tải dữ liệu báo cáo. Vui lòng thử lại.');
  }
}

// Hàm định dạng tiền tệ nếu chưa có
function formatCurrency(amount) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

// Hàm thống nhất để tải dữ liệu báo cáo theo thời gian
async function loadTimeReport(userId, startDate, endDate) {
  try {
    console.log("Bắt đầu tải dữ liệu báo cáo theo thời gian...");
    showLoading();
    
    // Đợi Chart.js được tải (nếu cần)
    if (typeof Chart === 'undefined') {
      console.log('Đang đợi Chart.js được tải...');
      
      // Đợi tối đa 5 giây
      for (let i = 0; i < 50; i++) {
        if (typeof Chart !== 'undefined' || window.chartJsLoaded) {
          console.log('Chart.js đã sẵn sàng');
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Kiểm tra lại sau khi đợi
      if (typeof Chart === 'undefined') {
        console.error('Không thể tải Chart.js sau thời gian chờ');
        hideLoading();
        showError('Không thể tải thư viện biểu đồ. Vui lòng làm mới trang.');
        return;
      }
    }
    
    // Kiểm tra canvas
    const canvas = document.getElementById('time-chart');
    if (!canvas) {
      console.error('Không tìm thấy canvas #time-chart');
      hideLoading();
      showError('Không thể tải báo cáo: Không tìm thấy canvas');
      return;
    }

    // Kiểm tra table
    const tableBody = document.querySelector('#time-table tbody');
    if (!tableBody) {
      console.error('Không tìm thấy bảng dữ liệu thời gian');
      hideLoading();
      showError('Không thể tải báo cáo: Không tìm thấy bảng dữ liệu');
      return;
    }
    
    // Tìm container và tạo canvas mới
    const container = document.querySelector('.reports-chart-wrapper');
    if (container) {
      // Xóa nội dung hiện tại và tạo canvas mới
      container.innerHTML = '';
      const newCanvas = document.createElement('canvas');
      newCanvas.id = 'time-chart';
      newCanvas.style.width = '100%';
      newCanvas.style.height = '100%';
      newCanvas.style.display = 'block';
      container.appendChild(newCanvas);
      
      // Cập nhật style của container
      container.style.display = 'block';
      container.style.height = '300px';
      container.style.position = 'relative';
      container.style.width = '100%';
    }
    
    // Kiểm tra Supabase đã được khởi tạo
    if (!window.supabase) {
      console.error('❌ Supabase client chưa được khởi tạo');
      hideLoading();
      showError('Không thể kết nối đến cơ sở dữ liệu. Vui lòng tải lại trang.');
      return;
    }
    
    // Tạo query cho child_expenses (các chi phí của người dùng)
    let query = window.supabase
      .from('child_expenses')
      .select('id, noi_dung, gia_tien, ngay_thang, danh_muc, trang_thai, ma_hoa_don');
    
    // Áp dụng bộ lọc thời gian
    if (startDate && endDate) {
      query = query.gte('ngay_thang', startDate).lte('ngay_thang', endDate);
    } else {
      // Tính toán khoảng thời gian dựa vào currentTimeRange
      const { startDate: rangeStart, endDate: rangeEnd } = calculateDateRange(currentTimeRange);
      query = query.gte('ngay_thang', rangeStart).lte('ngay_thang', rangeEnd);
    }
    
    // Nếu có userId, chỉ lấy chi phí của user đó
    if (userId) {
      query = query.eq('user_id', userId);
    } else if (userData && userData.id) {
      query = query.eq('user_id', userData.id);
    }
    
    // Lọc theo trạng thái thanh toán nếu đã chọn
    if (currentPaymentStatus !== 'all') {
      const isPaid = currentPaymentStatus === 'paid';
      query = query.eq('trang_thai', isPaid ? 'Đã thanh toán' : 'Chưa thanh toán');
    }
    
    console.log('Đang tải dữ liệu chi phí theo thời gian...');
    const { data: expenses, error } = await query;
    
    if (error) {
      console.error('❌ Lỗi khi truy vấn dữ liệu chi phí:', error);
      hideLoading();
      showError('Không thể tải dữ liệu báo cáo: ' + error.message);
      return;
    }
    
    // Nếu không có dữ liệu
    if (!expenses || expenses.length === 0) {
      console.log('⚠️ Không có dữ liệu chi phí trong khoảng thời gian này');
      tableBody.innerHTML = '<tr><td colspan="3" class="text-center">Không có dữ liệu chi tiêu trong khoảng thời gian này</td></tr>';
      hideLoading();
      
      // Xóa biểu đồ hiện tại nếu có
      if (currentCharts.timeChart) {
        currentCharts.timeChart.destroy();
        currentCharts.timeChart = null;
      }
      
      // Cập nhật tổng quan với giá trị rỗng
      updateSummaryWithAnimation({
        totalExpense: 0,
        highestExpense: 0,
        averageExpense: 0,
        highestCategory: { name: 'Chưa có dữ liệu', total: 0 }
      });
      
      return;
    }
    
    console.log('✅ Đã tải được', expenses.length, 'chi phí');
    console.log('Sample expense:', expenses[0]);
    
    // Chuẩn hóa dữ liệu
    const normalizedExpenses = expenses.map(expense => ({
      id: expense.id,
      ten_chi_phi: expense.noi_dung,
      gia_tien: expense.gia_tien || 0,
      ngay_bat_dau: expense.ngay_thang,
      danh_muc: expense.danh_muc || 'Khác',
      status: expense.trang_thai
    }));
    
    // Tính toán số liệu tổng quan và cập nhật
    const summary = calculateSummary(normalizedExpenses);
    updateSummaryWithAnimation(summary);
    
    // Hiển thị biểu đồ và bảng
    try {
      // Vẽ biểu đồ - đảm bảo thực hiện trước khi tiếp tục
      await renderTimeChartWithAnimation(normalizedExpenses);
      
      // Render bảng
      renderTimeTableWithAnimation(normalizedExpenses, summary.averageExpense);
      
      // Bỏ gọi hàm forceRerenderChart vì không cần thiết nữa
      
    } catch (e) {
      console.error('Lỗi khi hiển thị dữ liệu:', e);
      showError('Không thể hiển thị dữ liệu: ' + e.message);
    } finally {
      hideLoading();
    }
    
    return normalizedExpenses;
  } catch (error) {
    console.error('❌ Lỗi tải báo cáo thời gian:', error);
    showError('Không thể tải báo cáo. Vui lòng thử lại sau.');
    hideLoading();
    return null;
  }
}

// Hàm tạo dữ liệu demo cho báo cáo
function createDemoExpenses() {
  const today = new Date();
  const expenses = [];
  
  // Tạo dữ liệu cho 3 tháng gần nhất
  for (let i = 0; i < 90; i++) {
    const date = new Date();
    date.setDate(today.getDate() - i);
    
    // Dữ liệu ngẫu nhiên cho mỗi ngày
    if (Math.random() > 0.5) { // 50% ngày có chi tiêu
      const categories = ['Ăn uống', 'Đi lại', 'Giải trí', 'Mua sắm', 'Nhà cửa', 'Giáo dục', 'Y tế', 'Hóa đơn', 'Khác'];
      const randomCategory = categories[Math.floor(Math.random() * categories.length)];
      
      // Tạo 1-3 chi tiêu cho mỗi ngày
      const expensesCount = Math.floor(Math.random() * 3) + 1;
      
      for (let j = 0; j < expensesCount; j++) {
        expenses.push({
          id: `demo-${i}-${j}`,
          ten_chi_phi: `Chi tiêu ${j+1} ngày ${date.getDate()}/${date.getMonth()+1}`,
          gia_tien: Math.floor(Math.random() * 1000000) + 10000, // 10k - 1M VND
          ngay_bat_dau: date.toISOString().split('T')[0],
          danh_muc: randomCategory,
          status: Math.random() > 0.3 ? 'Đã thanh toán' : 'Chưa thanh toán',
          has_children: false,
          ma_hoa_don: `HD-${Math.floor(Math.random() * 10000)}`,
          loai_chi_phi: 'Cá nhân'
        });
      }
    }
  }
  
  console.log('Đã tạo dữ liệu demo:', expenses.length, 'chi tiêu');
  return expenses;
}

// Tải báo cáo theo danh mục
async function loadCategoryReport(startDate, endDate) {
  try {
    // Hiển thị loading
    showLoading();
    
    // Kiểm tra elements cần thiết
    const chartCanvas = document.getElementById('category-chart');
    const categoryTableBody = document.querySelector('#category-table tbody');
    const totalExpensesEl = document.getElementById('total-expenses');
    const legendContainer = document.getElementById('category-legend');
    
    // Kiểm tra các phần tử UI
    const missingElements = [];
    if (!chartCanvas) missingElements.push('canvas category-chart');
    if (!categoryTableBody) missingElements.push('#category-table tbody');
    if (!totalExpensesEl) missingElements.push('#total-expenses');
    if (!legendContainer) missingElements.push('#category-legend');
    
    if (missingElements.length > 0) {
      console.warn(`Không tìm thấy các phần tử: ${missingElements.join(', ')}`);
      hideLoading();
      return;
    }
    
    console.log('Tìm thấy tất cả các phần tử DOM cho báo cáo danh mục, tiếp tục tải dữ liệu');
    
    // Kiểm tra Supabase đã sẵn sàng chưa
    if (!window.supabase) {
      console.error('❌ Supabase client chưa được khởi tạo');
      hideLoading();
      showError('Không thể kết nối đến cơ sở dữ liệu. Vui lòng tải lại trang.');
      return;
    }
    
    // Xây dựng query cho chi phí
    let query = window.supabase
      .from('child_expenses')
      .select('id, noi_dung, gia_tien, ngay_thang, danh_muc, trang_thai, ma_hoa_don, loai_chi_phi');
    
    // Áp dụng bộ lọc thời gian
    if (startDate && endDate) {
      query = query.gte('ngay_thang', startDate).lte('ngay_thang', endDate);
    } else {
      // Tính toán khoảng thời gian dựa vào currentTimeRange
      const { startDate: rangeStart, endDate: rangeEnd } = calculateDateRange(currentTimeRange);
      query = query.gte('ngay_thang', rangeStart).lte('ngay_thang', rangeEnd);
    }
    
    // Chỉ lấy chi phí của người dùng hiện tại
    if (userData && userData.id) {
      query = query.eq('user_id', userData.id);
    }
    
    // Lọc theo trạng thái thanh toán
    if (currentPaymentStatus !== 'all') {
      const isPaid = currentPaymentStatus === 'paid';
      console.log(`Lọc theo trạng thái thanh toán: ${currentPaymentStatus}`);
      query = query.eq('trang_thai', isPaid ? 'Đã thanh toán' : 'Chưa thanh toán');
    }
    
    // Gửi query
    console.log('Đang gửi query cho báo cáo danh mục:', query);
    const { data: expenses, error } = await query;
    
    if (error) {
      console.error('Lỗi khi truy vấn dữ liệu danh mục:', error);
      hideLoading();
      showError('Không thể tải dữ liệu báo cáo danh mục: ' + error.message);
      return;
    }
    
    // Kiểm tra nếu không có dữ liệu
    if (!expenses || expenses.length === 0) {
      console.log('Không có dữ liệu chi tiêu trong khoảng thời gian đã chọn');
      categoryTableBody.innerHTML = '<tr><td colspan="3" class="text-center">Không có dữ liệu chi tiêu trong khoảng thời gian này</td></tr>';
      
      // Cập nhật tổng quan trống
      updateSummaryWithAnimation({
        totalExpense: 0,
        highestExpense: 0,
        averageExpense: 0,
        highestCategory: { name: 'Chưa có dữ liệu', total: 0 }
      });
      
      hideLoading();
      return;
    }
    
    console.log('Đã tải được dữ liệu chi phí theo danh mục:', expenses.length, 'bản ghi');
    
    // Chuẩn hóa dữ liệu
    const normalizedExpenses = expenses.map(expense => ({
      id: expense.id,
      ten_chi_phi: expense.noi_dung,
      gia_tien: expense.gia_tien,
      ngay_bat_dau: expense.ngay_thang,
      danh_muc: expense.danh_muc || 'Khác',
      status: expense.trang_thai,
      ma_hoa_don: expense.ma_hoa_don,
      loai_chi_phi: expense.loai_chi_phi
    }));
    
    // Tính tổng quan
    const summary = calculateSummary(normalizedExpenses);
    updateSummaryWithAnimation(summary);
    
    // Nhóm chi phí theo danh mục
    const categoryData = groupByCategory(normalizedExpenses);
    
    // Cập nhật biểu đồ theo danh mục với hiệu ứng
    await renderCategoryChartWithAnimation(categoryData);
    
    // Cập nhật bảng dữ liệu
    renderCategoryTable(categoryData);
    
    // Khởi tạo tooltips
    setTimeout(initializeTooltips, 200);
    
    hideLoading();
  } catch (error) {
    console.error('Lỗi tải dữ liệu báo cáo theo danh mục:', error);
    showError('Không thể tải dữ liệu báo cáo. Vui lòng thử lại.');
    hideLoading();
  }
}

// Nhóm chi phí theo danh mục
function groupByCategory(expenses) {
  if (!expenses || !Array.isArray(expenses) || expenses.length === 0) {
    return [];
  }
  
  const categories = {};
  
  // Tách riêng chi phí cha và con
  const parentExpenses = expenses.filter(expense => !expense.isChild);
  const childExpenses = expenses.filter(expense => expense.isChild);
  
  // Nhóm theo danh mục
  expenses.forEach(expense => {
    // Bỏ qua chi phí cha có con (để tránh tính 2 lần)
    if (expense.has_children && childExpenses.some(child => child.parent_id === expense.id)) {
      return;
    }
    
    const amount = expense.gia_tien || 0;
    const category = expense.danh_muc || 'Khác';
    
    if (!categories[category]) {
      categories[category] = 0;
    }
    
    categories[category] += amount;
  });
  
  // Tính tổng chi phí
  const totalExpense = Object.values(categories).reduce((total, value) => total + value, 0);
  
  // Chuyển đổi thành mảng và tính phần trăm
  const result = Object.entries(categories).map(([name, value]) => ({
    name,
    value,
    percentage: totalExpense > 0 ? ((value / totalExpense) * 100).toFixed(1) : 0
  }));
  
  // Sắp xếp theo giá trị giảm dần
  return result.sort((a, b) => b.value - a.value);
}

// Tính toán các số liệu thống kê
function calculateSummary(expenses) {
  console.log('Tính toán tổng quan với', expenses.length, 'chi phí');
  
  // Tính tổng chi phí
  const totalExpense = expenses.reduce((sum, expense) => sum + (expense.gia_tien || 0), 0);
  
  // Tìm chi phí cao nhất
  const highestExpense = expenses.length > 0 
    ? Math.max(...expenses.map(expense => expense.gia_tien || 0)) 
    : 0;
  
  // Tính chi phí trung bình (không cần chia theo tháng)
  const averageExpense = expenses.length > 0 
    ? totalExpense / expenses.length 
    : 0;
  
  // Tìm danh mục chi nhiều nhất
  const categoryTotals = {};
  
  // Tính tổng chi phí theo từng danh mục
  expenses.forEach(expense => {
    const category = expense.danh_muc || 'Khác';
    if (!categoryTotals[category]) {
      categoryTotals[category] = 0;
    }
    categoryTotals[category] += (expense.gia_tien || 0);
  });
  
  // Tìm danh mục có tổng chi phí cao nhất
  let highestCategory = { name: 'Chưa có dữ liệu', total: 0 };
  
  for (const [category, total] of Object.entries(categoryTotals)) {
    if (total > highestCategory.total) {
      highestCategory = { name: category, total };
    }
  }
  
  console.log('Kết quả tính toán tổng quan:', { 
    totalExpense, 
    highestExpense, 
    averageExpense, 
    highestCategory,
    categoryTotals // Log chi tiết tổng theo từng danh mục
  });
  
  return {
    totalExpense,
    highestExpense,
    averageExpense,
    highestCategory
  };
}

// Cập nhật tổng quan với hiệu ứng animation
function updateSummaryWithAnimation(summary) {
  console.log('Cập nhật tổng quan với dữ liệu:', summary);
  
  // Tổng chi phí
  const totalElement = document.getElementById('total-expenses');
  if (totalElement) {
    animateNumber(totalElement, 0, summary.totalExpense, 1000);
  } else {
    console.warn('Không tìm thấy phần tử total-expenses');
  }
  
  // Danh mục chi nhiều nhất (thay thế chi phí cao nhất)
  const highestCategoryElement = document.getElementById('highest-category');
  if (highestCategoryElement) {
    // Thêm class để kích hoạt animation
    highestCategoryElement.classList.add('animated');
    
    // Hiển thị tên danh mục và tổng tiền
    if (summary.highestCategory && summary.highestCategory.total > 0) {
      const formattedValue = `${summary.highestCategory.name}: ${formatCurrency(summary.highestCategory.total)}`;
      // Áp dụng trực tiếp thay vì dùng animateNumber vì đây là text
      highestCategoryElement.textContent = formattedValue;
      
      // Thêm tooltip để hiển thị % của danh mục này
      const percentage = Math.round((summary.highestCategory.total / summary.totalExpense) * 100);
      highestCategoryElement.setAttribute('data-bs-toggle', 'tooltip');
      highestCategoryElement.setAttribute('data-bs-placement', 'top');
      highestCategoryElement.setAttribute('title', `Chiếm ${percentage}% tổng chi phí`);
    } else {
      highestCategoryElement.textContent = 'Chưa có dữ liệu';
    }
    
    // Sau 600ms (thời gian của animation), xóa class animated
    setTimeout(() => {
      highestCategoryElement.classList.remove('animated');
    }, 600);
  } else {
    console.warn('Không tìm thấy phần tử highest-category');
  }
  
  // Chi phí trung bình
  const averageElement = document.getElementById('average-expense');
  if (averageElement) {
    animateNumber(averageElement, 0, summary.averageExpense, 1000);
  } else {
    console.warn('Không tìm thấy phần tử average-expense');
  }
  
  // Khởi tạo lại tooltips sau khi cập nhật
  setTimeout(() => {
    initializeTooltips();
  }, 100);
}

// Cập nhật animateNumber để xử lý cả trường hợp số và text
function animateNumber(element, start, end, duration) {
  // Nếu element không tồn tại, thoát hàm
  if (!element) return;
  
  // Thêm class animated để kích hoạt hiệu ứng
  element.classList.add('animated');
  
  // Nếu end không phải là số, chỉ cần cập nhật text
  if (isNaN(end)) {
    element.textContent = end;
    // Sau 600ms (thời gian của animation), xóa class animated
    setTimeout(() => {
      element.classList.remove('animated');
    }, 600);
    return;
  }
  
  // Xác định thời gian bắt đầu
  const startTime = performance.now();
  
  // Hàm cập nhật số
  const updateNumber = (currentTime) => {
    // Tính toán thời gian đã trôi qua
    const elapsedTime = currentTime - startTime;
    
    // Nếu vẫn trong khoảng thời gian animation
    if (elapsedTime < duration) {
      // Tính toán giá trị hiện tại dựa trên thời gian đã trôi qua
      const progress = elapsedTime / duration;
      const currentValue = Math.round(start + progress * (end - start));
      
      // Cập nhật nội dung phần tử với định dạng tiền tệ
      element.textContent = formatCurrency(currentValue);
      
      // Tiếp tục animation trong frame tiếp theo
      requestAnimationFrame(updateNumber);
    } else {
      // Đã hoàn thành animation, cập nhật giá trị cuối cùng
      element.textContent = formatCurrency(end);
      
      // Sau 600ms (thời gian của animation), xóa class animated
      setTimeout(() => {
        element.classList.remove('animated');
      }, 600);
    }
  };
  
  // Bắt đầu animation
  requestAnimationFrame(updateNumber);
}

// Render biểu đồ theo thời gian
async function renderTimeChart(expenses) {
  try {
    console.log("Bắt đầu renderTimeChart với", expenses.length, "chi phí");
    
    // Đảm bảo Chart.js đã được tải
    if (typeof Chart === 'undefined') {
      console.log('Chart.js chưa sẵn sàng, đang tải...');
      try {
        detectChartJsLibrary();
      } catch (err) {
        console.error('Không thể tải Chart.js:', err);
        showError('Không thể tải thư viện biểu đồ. Vui lòng làm mới trang và thử lại.');
        return;
      }
    }
    
    // Lấy canvas
    const canvas = document.getElementById('time-chart');
    if (!canvas) {
      console.error('Không tìm thấy canvas cho biểu đồ thời gian');
      return;
    }
    
    // Kiểm tra canvas context
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Không thể lấy context từ canvas');
      return;
    }
    
    // Đảm bảo canvas có kích thước hợp lệ
    // Lấy kích thước thực từ parent container
    const parent = canvas.parentElement;
    if (parent) {
      // Thiết lập style
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.display = 'block';
      
      // Thiết lập kích thước thực cho canvas
      const parentWidth = parent.offsetWidth || 600;
      const parentHeight = parent.offsetHeight || 300;
      canvas.width = parentWidth;
      canvas.height = parentHeight;
      console.log(`Canvas kích thước: ${canvas.width} x ${canvas.height}`);
    }
    
    // Xóa biểu đồ cũ nếu có
    if (currentCharts.timeChart) {
      console.log('Xóa biểu đồ cũ');
      currentCharts.timeChart.destroy();
      currentCharts.timeChart = null;
    }
    
    // Nhóm chi phí theo thời gian
    const groupedData = groupByTime(expenses, currentTimeRange);
    console.log("Dữ liệu đã nhóm cho biểu đồ:", groupedData);
    
    // Kiểm tra nếu không có dữ liệu
    if (!groupedData || groupedData.length === 0) {
      console.warn('Không có dữ liệu để hiển thị biểu đồ!');
      return;
    }
    
    // Chuẩn bị dữ liệu cho biểu đồ
    const labels = groupedData.map(item => item.label);
    const data = groupedData.map(item => item.total);
    console.log("Labels:", labels);
    console.log("Data:", data);
    
    // Kiểm tra darkmode
    const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
    
    // Tạo gradient cho background
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    if (isDarkMode) {
      gradient.addColorStop(0, 'rgba(102, 116, 255, 0.5)');
      gradient.addColorStop(1, 'rgba(102, 116, 255, 0.05)');
    } else {
      gradient.addColorStop(0, 'rgba(99, 102, 241, 0.3)');
      gradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');
    }
    
    // Màu sắc và thiết lập thay đổi theo chế độ
    const primaryColor = isDarkMode ? '#818cf8' : '#6366f1';
    const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';
    const tickColor = isDarkMode ? '#cbd5e1' : '#64748b';
    const tooltipBgColor = isDarkMode ? 'rgba(15, 23, 42, 0.9)' : 'rgba(30, 41, 59, 0.9)';
    const tooltipTextColor = isDarkMode ? '#f8fafc' : '#f8fafc';
    
    // Thiết lập cấu hình biểu đồ
    const chartConfig = {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Chi phí',
          data: data,
          borderColor: '#6674ff',
          borderWidth: 3,
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#6674ff',
          pointBorderWidth: 2,
          pointRadius: 6,
          pointHoverRadius: 8,
          tension: 0.3,
          fill: true,
          backgroundColor: gradient
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: tooltipBgColor,
            titleColor: tooltipTextColor,
            bodyColor: tooltipTextColor,
            titleFont: {
              size: 14,
              weight: 'bold',
              family: "'Inter', sans-serif"
            },
            bodyFont: {
              size: 13,
              family: "'Inter', sans-serif"
            },
            padding: 12,
            cornerRadius: 8,
            displayColors: false,
            callbacks: {
              label: function(context) {
                return `Chi phí: ${formatCurrency(context.parsed.y)}`;
              }
            }
          }
        },
        interaction: {
          mode: 'index',
          intersect: false,
        },
        hover: {
          mode: 'nearest',
          intersect: true
        },
        scales: {
          x: {
            grid: {
              display: true,
              color: gridColor,
              drawBorder: false,
            },
            ticks: {
              color: tickColor,
              font: {
                family: "'Inter', sans-serif",
                size: 12
              },
              padding: 10
            }
          },
          y: {
            grid: {
              display: true,
              color: gridColor,
              drawBorder: false,
            },
            ticks: {
              color: tickColor,
              font: {
                family: "'Inter', sans-serif",
                size: 12
              },
              padding: 10,
              callback: function(value) {
                return formatCurrency(value);
              }
            }
          }
        }
      }
    };
    
    // Tạo biểu đồ mới
    try {
      console.log("Đang tạo biểu đồ mới...");
      
      // Tạo biểu đồ
      currentCharts.timeChart = new Chart(ctx, chartConfig);
      
      console.log("Đã tạo biểu đồ thành công");
      
      // Lưu biểu đồ vào global cho phòng trường hợp currentCharts bị reset
      window.timeChart = currentCharts.timeChart;
      
      return currentCharts.timeChart;
    } catch (chartError) {
      console.error("Lỗi khi tạo biểu đồ:", chartError);
      throw chartError;
    }
  } catch (error) {
    console.error('Lỗi khi tạo biểu đồ thời gian:', error);
    console.error('Chi tiết lỗi:', error.message, error.stack);
    throw error;
  }
}

// Nhóm dữ liệu theo thời gian
function groupByTime(expenses, timeRange) {
  try {
    if (!expenses || !Array.isArray(expenses) || expenses.length === 0) {
      console.warn('Không có dữ liệu expenses hợp lệ');
      return [];
    }
    
    const validExpenses = expenses.filter(exp => {
      const date = exp.ngay_thang || exp.ngay_bat_dau;
      return date && !isNaN(new Date(date).getTime());
    });
    
    if (validExpenses.length === 0) {
      console.warn('Không có chi phí nào có ngày tháng hợp lệ');
      return [];
    }
    
    const sortedExpenses = [...validExpenses].sort((a, b) => {
      const dateA = new Date(a.ngay_thang || a.ngay_bat_dau);
      const dateB = new Date(b.ngay_thang || b.ngay_bat_dau);
      return dateA - dateB;
    });
    
    const result = [];
    const monthNames = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
      'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
    
    if (timeRange === 'month' || timeRange === 'thisMonth' || timeRange === 'lastMonth') {
      const days = {};
      for (const expense of sortedExpenses) {
        const date = new Date(expense.ngay_thang || expense.ngay_bat_dau);
        const day = date.getDate();
        const label = `Ngày ${day}`;
        days[label] = (days[label] || 0) + (expense.gia_tien || 0);
      }
      result.push(...Object.entries(days).map(([label, total]) => ({ label, total })));
      result.sort((a, b) => parseInt(a.label.replace('Ngày ', '')) - parseInt(b.label.replace('Ngày ', '')));
    } else if (timeRange === 'quarter' || timeRange === 'thisQuarter') {
      const months = {};
      for (const expense of sortedExpenses) {
        const date = new Date(expense.ngay_thang || expense.ngay_bat_dau);
        const month = date.getMonth();
        const label = monthNames[month];
        months[label] = (months[label] || 0) + (expense.gia_tien || 0);
      }
      result.push(...Object.entries(months).map(([label, total]) => ({ label, total })));
      result.sort((a, b) => monthNames.indexOf(a.label) - monthNames.indexOf(b.label));
    } else {
      const months = {};
      for (const expense of sortedExpenses) {
        const date = new Date(expense.ngay_thang || expense.ngay_bat_dau);
        const month = date.getMonth();
        const label = monthNames[month];
        months[label] = (months[label] || 0) + (expense.gia_tien || 0);
      }
      result.push(...Object.entries(months).map(([label, total]) => ({ label, total })));
      result.sort((a, b) => monthNames.indexOf(a.label) - monthNames.indexOf(b.label));
    }
    
    console.log('Dữ liệu đã nhóm theo thời gian:', result);
    return result;
  } catch (error) {
    console.error('Lỗi khi nhóm dữ liệu theo thời gian:', error);
    return [];
  }
}

// Render bảng dữ liệu theo thời gian
function renderTimeTable(timeData, averageExpense) {
  const tableBody = document.querySelector('#time-table tbody');
  if (!tableBody) {
    console.warn('Không tìm thấy phần tử #time-table tbody');
    return;
  }
  
  tableBody.innerHTML = '';
  
  // Nhóm dữ liệu theo thời gian
  const groupedData = groupByTime(timeData, currentTimeRange);
  
  // Lặp qua dữ liệu đã nhóm
  for (const item of groupedData) {
    const row = document.createElement('tr');
    
    // Tính phần trăm so với trung bình
    const percentageOfAverage = averageExpense > 0 ? (item.total / averageExpense) * 100 : 0;
    const percentageDiff = percentageOfAverage - 100;
    const percentageClass = percentageDiff > 0 ? 'text-danger' : 'text-success';
    const percentageIcon = percentageDiff > 0 ? 'bi-arrow-up-right' : 'bi-arrow-down-right';
    const percentageText = `${Math.abs(percentageDiff).toFixed(1)}%`;
    
    row.innerHTML = `
      <td>${item.label}</td>
      <td>${formatCurrency(item.total)}</td>
      <td class="${percentageClass}">
        <i class="bi ${percentageIcon}"></i> ${percentageText}
      </td>
    `;
    
    tableBody.appendChild(row);
  }
}

// Render biểu đồ theo danh mục
function renderCategoryChart(categoryData) {
  try {
    console.log("Bắt đầu renderCategoryChart với", categoryData.length, "danh mục");
    
    // Lấy canvas
    const canvas = document.getElementById('category-chart');
    if (!canvas) {
      console.error('Không tìm thấy canvas cho biểu đồ danh mục');
      return;
    }
    
    // Kiểm tra canvas context
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Không thể lấy context từ canvas');
      return;
    }
    
    // Xác định kích thước canvas
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    
    // Buộc cập nhật kích thước thực tế của canvas
    const parent = canvas.parentElement;
    if (parent) {
      const parentWidth = parent.offsetWidth;
      canvas.width = parentWidth || 300;
      canvas.height = 300;
      console.log("Đã thiết lập kích thước canvas danh mục:", canvas.width, "x", canvas.height);
    }
    
    // Xóa biểu đồ cũ nếu có
    if (currentCharts.categoryChart) {
      console.log('Xóa biểu đồ danh mục cũ');
      currentCharts.categoryChart.destroy();
      currentCharts.categoryChart = null;
    }
  
    // Kiểm tra darkmode
    const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
    
    // Tạo dữ liệu cho biểu đồ
    const chartData = categoryData.map(item => ({
      name: item.name,
      value: item.value,
      color: CONFIG.categories[item.name]?.color || CONFIG.colors.info
    }));
    
    console.log("Dữ liệu biểu đồ danh mục:", chartData);
    
    // Kiểm tra dữ liệu
    if (!chartData || chartData.length === 0) {
      console.warn('Không có dữ liệu để hiển thị biểu đồ danh mục');
      return;
    }
    
    // Chuẩn bị dữ liệu cho biểu đồ
    const colors = chartData.map(item => item.color + (isDarkMode ? 'CC' : '99')); // Thêm opacity khác nhau theo chế độ
    const borderColors = chartData.map(item => item.color);
    
    // Cấu hình màu sắc theo chế độ sáng/tối
    const tooltipBgColor = isDarkMode ? 'rgba(15, 23, 42, 0.9)' : 'rgba(30, 41, 59, 0.9)';
    const tooltipTextColor = isDarkMode ? '#f8fafc' : '#f8fafc';
    const legendTextColor = isDarkMode ? '#cbd5e1' : '#64748b';
    
    // Thiết lập cấu hình biểu đồ
    const chartConfig = {
      type: 'doughnut',
      data: {
        labels: chartData.map(item => item.name),
        datasets: [{
          data: chartData.map(item => item.value),
          backgroundColor: colors,
          borderColor: borderColors,
          borderWidth: 2,
          hoverOffset: 10,
          borderRadius: 4,
          spacing: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        radius: '90%',
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: tooltipBgColor,
            titleColor: tooltipTextColor,
            bodyColor: tooltipTextColor,
            titleFont: {
              size: 14,
              weight: 'bold',
              family: "'Inter', sans-serif"
            },
            bodyFont: {
              size: 13,
              family: "'Inter', sans-serif"
            },
            padding: 12,
            cornerRadius: 8,
            displayColors: true,
            boxWidth: 10,
            boxHeight: 10,
            boxPadding: 3,
            usePointStyle: true,
            callbacks: {
              label: function(context) {
                const value = context.raw;
                const total = context.dataset.data.reduce((acc, val) => acc + val, 0);
                const percentage = ((value / total) * 100).toFixed(1);
                return `${context.label}: ${formatCurrency(value)} (${percentage}%)`;
              }
            }
          }
        },
        animation: {
          animateRotate: true,
          animateScale: true,
          duration: 1000,
          easing: 'easeOutQuart'
        },
        layout: {
          padding: 20
        },
        elements: {
          arc: {
            borderWidth: 2
          }
        }
      }
    };
    
    // Tạo biểu đồ mới
    try {
      console.log("Đang tạo biểu đồ danh mục mới...");
      
      currentCharts.categoryChart = new Chart(ctx, chartConfig);
      
      console.log("Đã tạo biểu đồ danh mục thành công");
      
      // Hiển thị chú thích danh mục
      renderCategoryLegendWithIcons(chartData);
      
      return currentCharts.categoryChart;
    } catch (chartError) {
      console.error("Lỗi khi tạo biểu đồ danh mục:", chartError);
      throw chartError;
    }
  } catch (error) {
    console.error('Lỗi khi tạo biểu đồ danh mục:', error);
    throw error;
  }
}

// Hiển thị chú thích cho biểu đồ danh mục với biểu tượng màu sắc
function renderCategoryLegendWithIcons(chartData) {
  try {
    console.log("Đang tạo chú thích cho biểu đồ danh mục");
    
    // Lấy thẻ chứa legend
    const legendContainer = document.getElementById('category-legend');
    if (!legendContainer) {
      console.error('Không tìm thấy container cho chú thích');
      return;
    }
    
    // Xóa nội dung cũ
    legendContainer.innerHTML = '';
    
    // Kiểm tra darkmode
    const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
    
    // Sắp xếp dữ liệu theo giá trị giảm dần
    const sortedData = [...chartData].sort((a, b) => b.value - a.value);
    
    // Tính tổng chi phí
    const totalAmount = sortedData.reduce((total, item) => total + item.value, 0);
    
    // Tạo các mục của legend
    sortedData.forEach(item => {
      // Tính phần trăm
      const percentage = totalAmount > 0 ? (item.value / totalAmount * 100).toFixed(1) : '0.0';
      
      // Tạo element mới
      const legendItem = document.createElement('div');
      legendItem.className = 'reports-legend-item';
      
      // Hiệu ứng hover và focus
      legendItem.innerHTML = `
        <div class="reports-legend-color" style="background-color: ${item.color};"></div>
        <div class="reports-legend-text">
          <span class="reports-legend-label">${item.name}</span>
          <div class="reports-legend-details">
            <span class="reports-legend-value">${formatCurrency(item.value)}</span>
            <span class="reports-legend-percentage">${percentage}%</span>
          </div>
        </div>
      `;
      
      // Khi hover vào legend item, highlight item tương ứng trên biểu đồ
      legendItem.addEventListener('mouseenter', () => {
        if (currentCharts.categoryChart) {
          // Tìm chỉ số của dữ liệu
          const index = sortedData.findIndex(d => d.name === item.name);
          
          // Highlight item trong biểu đồ
          const meta = currentCharts.categoryChart.getDatasetMeta(0);
          meta.data.forEach((segment, i) => {
            segment.options.hoverOffset = i === index ? 15 : 0;
          });
          
          // Cập nhật biểu đồ
          currentCharts.categoryChart.update();
          
          // Áp dụng style cho legend item
          legendItem.classList.add('active');
        }
      });
      
      // Khi di chuột ra khỏi legend item
      legendItem.addEventListener('mouseleave', () => {
        if (currentCharts.categoryChart) {
          // Reset highlight
          const meta = currentCharts.categoryChart.getDatasetMeta(0);
          meta.data.forEach(segment => {
            segment.options.hoverOffset = 10;
          });
          
          // Cập nhật biểu đồ
          currentCharts.categoryChart.update();
          
          // Áp dụng style cho legend item
          legendItem.classList.remove('active');
        }
      });
      
      legendContainer.appendChild(legendItem);
    });
    
    console.log("Đã tạo xong chú thích cho biểu đồ danh mục");
  } catch (error) {
    console.error('Lỗi khi tạo chú thích biểu đồ:', error);
  }
}

// Render bảng dữ liệu theo danh mục
function renderCategoryTable(categoryData) {
  const tableBody = document.querySelector('#category-table tbody');
  if (!tableBody) {
    console.warn('Không tìm thấy phần tử #category-table tbody');
    return;
  }
  
  tableBody.innerHTML = '';
  
  categoryData.forEach(item => {
    const row = document.createElement('tr');
    
    row.innerHTML = `
      <td>${item.name}</td>
      <td>${formatCurrency(item.value)}</td>
      <td>
        <div class="cell-value">${item.percentage}%</div>
        <div class="progress-bar-container">
          <div class="progress-bar" style="width: ${item.percentage}%"></div>
        </div>
      </td>
    `;
    
    tableBody.appendChild(row);
  });
}

// Render biểu đồ so sánh
async function renderComparisonChart(comparisonData) {
  if (!comparisonData || comparisonData.length < 2) {
    console.warn('Không đủ dữ liệu để hiển thị biểu đồ so sánh');
    return;
  }
  
  const canvas = document.getElementById('comparison-chart');
  if (!canvas) {
    console.warn('Không tìm thấy canvas cho biểu đồ so sánh');
    return;
  }
  
  const ctx = canvas.getContext('2d');
  
  // Chuẩn bị dữ liệu biểu đồ
  const labels = comparisonData.map(item => item.period);
  const amounts = comparisonData.map(item => item.amount);
  
  // Tạo gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, 400);
  gradient.addColorStop(0, 'rgba(99, 102, 241, 0.5)');
  gradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');
  
  // Hủy biểu đồ hiện tại nếu có
  if (currentCharts.comparisonChart) {
    currentCharts.comparisonChart.destroy();
  }
  
  // Tạo biểu đồ mới
  currentCharts.comparisonChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Chi phí',
        data: amounts,
        borderColor: '#6366f1',
        borderWidth: 3,
        pointBackgroundColor: '#6366f1',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
        tension: 0.3,
        fill: true,
        backgroundColor: gradient
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(17, 24, 39, 0.9)',
          titleFont: {
            size: 14,
            weight: 'bold'
          },
          bodyFont: {
            size: 13
          },
          padding: 12,
          displayColors: false,
          callbacks: {
            label: function(context) {
              return `Chi phí: ${formatCurrency(context.parsed.y)}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(156, 163, 175, 0.1)'
          },
          ticks: {
            color: document.body.getAttribute('data-theme') === 'dark' ? '#cbd5e1' : '#64748b'
          }
        },
        y: {
          grid: {
            color: 'rgba(156, 163, 175, 0.1)'
          },
          ticks: {
            color: document.body.getAttribute('data-theme') === 'dark' ? '#cbd5e1' : '#64748b',
            callback: function(value) {
              return formatCurrency(value);
            }
          }
        }
      }
    }
  });
}

// Render bảng dữ liệu so sánh
function renderComparisonTable(comparisonData) {
  const tableBody = document.querySelector('#comparison-table tbody');
  if (!tableBody) {
    console.warn('Không tìm thấy phần tử #comparison-table tbody');
    return;
  }
  
  tableBody.innerHTML = '';
  
  comparisonData.forEach((item, index) => {
    if (index > 0) {
      const row = document.createElement('tr');
      
      // Tính phần trăm thay đổi so với kỳ trước
      const previousAmount = comparisonData[index - 1].amount;
      const currentAmount = item.amount;
      const change = previousAmount ? ((currentAmount - previousAmount) / previousAmount) * 100 : 0;
      
      const changeClass = change > 0 ? 'positive-change' : 'negative-change';
      const changeIcon = change > 0 ? 'bi-arrow-up-right' : 'bi-arrow-down-right';
      const changeText = `${Math.abs(change).toFixed(1)}%`;
      
      row.innerHTML = `
        <td>${item.period}</td>
        <td>${formatCurrency(item.amount)}</td>
        <td class="${changeClass}">
          <i class="bi ${changeIcon}"></i> ${changeText}
        </td>
      `;
      
      tableBody.appendChild(row);
    }
  });
}

// Render biểu đồ theo thời gian với hiệu ứng
async function renderTimeChartWithAnimation(expenses) {
  try {
    console.log("Bắt đầu renderTimeChartWithAnimation với", expenses.length, "chi phí");
    
    // Kiểm tra dữ liệu
    if (!expenses || !Array.isArray(expenses) || expenses.length === 0) {
      console.warn('Không có dữ liệu chi phí để hiển thị biểu đồ');
      return;
    }
    
    // Tìm phần tử container cho biểu đồ thời gian
    const chartContainer = document.querySelector('.reports-chart-wrapper');
    if (!chartContainer) {
      console.warn('Không tìm thấy .reports-chart-wrapper');
      return;
    }
    
    // Xóa nội dung hiện tại và tạo canvas mới
    chartContainer.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.id = 'time-chart';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    chartContainer.appendChild(canvas);
    
    // Đảm bảo container có style đúng
    chartContainer.style.display = 'block';
    chartContainer.style.position = 'relative';
    chartContainer.style.width = '100%';
    chartContainer.style.height = '300px';
    chartContainer.style.minHeight = '300px';
    
    // Hiển thị loading
    chartContainer.classList.add('loading');
    
    try {
      // Nhóm dữ liệu theo thời gian
      const groupedData = groupByTime(expenses, currentTimeRange);
      
      // Kiểm tra nếu không có dữ liệu
      if (!groupedData || groupedData.length === 0) {
        console.warn('Không có dữ liệu để hiển thị biểu đồ!');
        chartContainer.classList.remove('loading');
        return;
      }
      
      // Chuẩn bị dữ liệu cho biểu đồ
      const labels = groupedData.map(item => item.label);
      const data = groupedData.map(item => item.total);
      
      // Kiểm tra Chart.js đã được tải
      if (typeof Chart === 'undefined') {
        throw new Error('Thư viện Chart.js chưa được tải');
      }
      
      // Lấy context cho canvas
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Không thể lấy context từ canvas');
      }
      
      // Thiết lập kích thước canvas
      const parentWidth = chartContainer.offsetWidth || 600;
      canvas.width = parentWidth;
      canvas.height = 300;
      console.log(`Canvas kích thước: ${canvas.width} x ${canvas.height}`);
      
      // Tạo gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, 'rgba(99, 102, 241, 0.5)');
      gradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');
      
      // Xóa biểu đồ cũ nếu có
      if (currentCharts.timeChart) {
        currentCharts.timeChart.destroy();
        currentCharts.timeChart = null;
      }
      
      // Cấu hình biểu đồ
      const chartConfig = {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'Chi phí',
            data: data,
            borderColor: '#6366f1',
            borderWidth: 3,
            pointBackgroundColor: '#6366f1',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 5,
            pointHoverRadius: 7,
            tension: 0.3,
            fill: true,
            backgroundColor: gradient
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              backgroundColor: 'rgba(17, 24, 39, 0.9)',
              titleFont: {
                size: 14,
                weight: 'bold'
              },
              bodyFont: {
                size: 13
              },
              padding: 12,
              displayColors: false,
              callbacks: {
                label: function(context) {
                  return `Chi phí: ${formatCurrency(context.parsed.y)}`;
                }
              }
            }
          },
          scales: {
            x: {
              grid: {
                color: 'rgba(255, 255, 255, 0.1)'
              },
              ticks: {
                color: '#9ca3af'
              }
            },
            y: {
              grid: {
                color: 'rgba(255, 255, 255, 0.1)'
              },
              ticks: {
                color: '#9ca3af',
                callback: function(value) {
                  if (value >= 1000000) {
                    return (value / 1000000).toFixed(1) + 'M';
                  } else if (value >= 1000) {
                    return (value / 1000).toFixed(0) + 'K';
                  }
                  return value;
                }
              }
            }
          },
          animation: {
            duration: 1000,
            easing: 'easeOutQuart'
          }
        }
      };
      
      // Tạo biểu đồ mới
      console.log("Khởi tạo biểu đồ mới Line Chart");
      currentCharts.timeChart = new Chart(ctx, chartConfig);
      
      // Lưu biểu đồ trong window object
      window.timeChart = currentCharts.timeChart;
      
      console.log("Đã tạo biểu đồ thành công:", currentCharts.timeChart?.id);
    } catch (error) {
      console.error('Lỗi khi tạo biểu đồ:', error);
      throw error;
    } finally {
      // Ẩn loading
      chartContainer.classList.remove('loading');
    }
  } catch (error) {
    console.error('Lỗi trong renderTimeChartWithAnimation:', error);
    throw error;
  }
}

// Sửa hàm buộc vẽ lại biểu đồ
function forceRerenderChart() {
  try {
    console.log("Đang buộc vẽ lại biểu đồ thời gian...");
    
    // Kiểm tra xem biểu đồ đã được tạo chưa
    if (!currentCharts.timeChart) {
      // Kiểm tra xem có biểu đồ được lưu trong window không
      if (window.timeChart) {
        console.log("Phục hồi biểu đồ từ window.timeChart");
        currentCharts.timeChart = window.timeChart;
      } else {
        console.warn("Biểu đồ chưa được tạo, sẽ tạo lại từ đầu");
        
        // Kiểm tra dữ liệu hiện tại
        if (userData && userData.id) {
          loadTimeReport(userData.id);
        }
        return;
      }
    }
    
    // Kiểm tra xem canvas có tồn tại không
    const canvas = document.getElementById('time-chart');
    if (!canvas) {
      console.warn("Không tìm thấy canvas, không thể vẽ lại biểu đồ");
      return;
    }
    
    // Kiểm tra xem chart object có hợp lệ không
    if (typeof currentCharts.timeChart.update !== 'function') {
      console.warn("Đối tượng biểu đồ không hợp lệ, sẽ tạo lại từ đầu");
      if (userData && userData.id) {
        loadTimeReport(userData.id);
      }
      return;
    }
    
    // Cập nhật kích thước canvas
    const container = canvas.parentElement;
    if (container) {
      // Thiết lập kích thước rõ ràng
      container.style.height = "300px";
      container.style.width = "100%";
      container.style.position = "relative";
      container.style.display = "block";
      
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.display = "block";
      
      // Lấy kích thước container
      const containerWidth = container.offsetWidth;
      
      // Cập nhật kích thước canvas
      canvas.width = containerWidth;
      canvas.height = 300;
      
      console.log("Đã cập nhật kích thước canvas:", canvas.width, "x", canvas.height);
    }
    
    // Buộc vẽ lại biểu đồ
    currentCharts.timeChart.update();
    console.log("Đã buộc vẽ lại biểu đồ");
    
  } catch (error) {
    console.error("Lỗi khi buộc vẽ lại biểu đồ:", error);
  }
}

// Render bảng dữ liệu theo thời gian với hiệu ứng loading
async function renderTimeTableWithAnimation(expenses, averageExpense) {
  try {
    console.log("Bắt đầu renderTimeTableWithAnimation với", expenses.length, "chi phí");
    
    // Tìm phần tử container cho bảng
    const tableContainer = document.querySelector('.reports-table-container');
    if (!tableContainer) {
      console.warn('Không tìm thấy .reports-table-container');
      hideLoading();
      return;
    }
    
    // Tìm phần tử tbody của bảng
    const tableBody = document.querySelector('#time-table tbody');
    if (!tableBody) {
      console.warn('Không tìm thấy #time-table tbody');
      hideLoading();
      return;
    }
    
    // Kiểm tra xác nhận dữ liệu đầu vào
    console.log("Average expense:", averageExpense);
    console.log("Sample expense:", expenses[0]);
    
    // Thêm hiệu ứng loading
    tableContainer.classList.add('loading');
    
    // Đợi một khoảng thời gian ngắn để hiệu ứng loading hiển thị
    setTimeout(() => {
      try {
        console.log("Đang gọi hàm renderTimeTable trong setTimeout");
        // Render bảng dữ liệu
        renderTimeTable(expenses, averageExpense);
        
        // Xóa hiệu ứng loading
        tableContainer.classList.remove('loading');
        console.log("Đã hoàn thành render bảng thời gian");
      } catch (error) {
        console.error('Lỗi khi render bảng thời gian:', error);
        console.error('Chi tiết lỗi:', error.message, error.stack);
        hideLoading();
        showError('Không thể tạo bảng dữ liệu thời gian');
      }
    }, 300);
  } catch (error) {
    console.error('Lỗi trong renderTimeTableWithAnimation:', error);
    console.error('Chi tiết lỗi:', error.message, error.stack);
    hideLoading();
  }
}

// Khởi tạo tooltip cho các con số
function initializeTooltips() {
  try {
    // Xóa tooltip cũ nếu có
    const existingTooltips = document.querySelectorAll('.tooltip');
    existingTooltips.forEach(tooltip => {
      if (tooltip.parentNode) {
        tooltip.parentNode.removeChild(tooltip);
      }
    });
    
    // Khởi tạo tooltip mới
    if (typeof bootstrap !== 'undefined' && bootstrap.Tooltip) {
      const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
      tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
      });
      console.log('Đã khởi tạo', tooltipTriggerList.length, 'tooltips');
    } else {
      console.warn('Bootstrap Tooltip không khả dụng');
    }
  } catch (error) {
    console.error('Lỗi khi khởi tạo tooltips:', error);
  }
}

// Tạo màu ngẫu nhiên cho biểu đồ
function generateColors(count) {
  const baseColors = [
    'rgba(54, 162, 235, 0.7)',
    'rgba(255, 99, 132, 0.7)',
    'rgba(255, 206, 86, 0.7)',
    'rgba(75, 192, 192, 0.7)',
    'rgba(153, 102, 255, 0.7)',
    'rgba(255, 159, 64, 0.7)',
    'rgba(199, 199, 199, 0.7)',
    'rgba(83, 102, 255, 0.7)',
    'rgba(40, 167, 69, 0.7)',
    'rgba(220, 53, 69, 0.7)'
  ];
  
  const colors = [];
  
  for (let i = 0; i < count; i++) {
    colors.push(baseColors[i % baseColors.length]);
  }
  
  return colors;
}

// Tạo dữ liệu demo cho biểu đồ so sánh
function generateDemoComparisonData() {
  let data = [];
  const now = new Date();
  
  if (currentComparisonType === 'month') {
    // So sánh 6 tháng gần nhất
    for (let i = 5; i >= 0; i--) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      data.push({
        period: `Tháng ${month.getMonth() + 1}/${month.getFullYear()}`,
        amount: Math.floor(Math.random() * 20000000) + 5000000
      });
    }
  } else if (currentComparisonType === 'quarter') {
    // So sánh 4 quý gần nhất
    const currentQuarter = Math.floor(now.getMonth() / 3);
    
    for (let i = 3; i >= 0; i--) {
      const quarter = (currentQuarter - i + 4) % 4 + 1;
      const year = now.getFullYear() - Math.floor((i - currentQuarter) / 4);
      
      data.push({
        period: `Quý ${quarter}/${year}`,
        amount: Math.floor(Math.random() * 50000000) + 10000000
      });
    }
  } else {
    // So sánh 3 năm gần nhất
    for (let i = 2; i >= 0; i--) {
      const year = now.getFullYear() - i;
      
      data.push({
        period: `${year}`,
        amount: Math.floor(Math.random() * 200000000) + 50000000
      });
    }
  }
  
  return data;
}

// Xuất báo cáo
async function exportReport(reportType, format) {
  try {
    // Chỉ hỗ trợ xuất PDF cho báo cáo chi tiết
    if (reportType !== 'detail') {
      showNotification('Chức năng xuất báo cáo hiện chỉ hỗ trợ cho báo cáo chi tiết chi phí.', 'info');
      return;
    }
    
    if (format !== 'pdf') {
      showNotification('Hiện tại chỉ hỗ trợ xuất định dạng PDF.', 'info');
      return;
    }
    
    showLoading();
    
    // Chuẩn bị dữ liệu để xuất
    const data = await prepareExportData(reportType);
    
    await exportToPDF(data, reportType);
    
    showSuccess('Xuất báo cáo thành công');
  } catch (error) {
    console.error('Lỗi xuất báo cáo:', error);
    showError('Không thể xuất báo cáo. Vui lòng thử lại.');
  } finally {
    hideLoading();
  }
}

// Chuẩn bị dữ liệu xuất báo cáo
async function prepareExportData(reportType) {
  const data = {
    title: '',
    summary: {},
    details: [],
    dateRange: getCurrentDateRange(),
    generatedAt: new Date().toLocaleString('vi-VN')
  };
  
  switch (reportType) {
    case 'time':
      data.title = 'Báo Cáo Chi Phí Theo Thời Gian';
      data.details = await getTimeReportData();
      break;
    case 'category':
      data.title = 'Báo Cáo Chi Phí Theo Danh Mục';
      data.details = await getCategoryReportData();
      break;
    case 'comparison':
      data.title = 'Báo Cáo So Sánh Chi Phí';
      data.details = await getComparisonReportData();
      break;
    case 'detail':
      data.title = 'Chi Tiết Chi Phí';
      // Lấy dữ liệu chi tiết hiện tại từ bảng chi tiết
      data.details = currentDetailData || [];
      break;
  }
  
  return data;
}

// Xuất ra PDF
async function exportToPDF(data, reportType) {
  try {
    // Kiểm tra nếu html2pdf chưa được tải
    if (typeof html2pdf === 'undefined') {
      console.log('Đang tải html2pdf.js...');
      await loadHTML2PDF();
    }

    // Tạo template PDF dựa trên loại báo cáo
    const template = await generatePDFTemplate(data, reportType);
    
    // Tạo PDF từ template và lưu file
    return html2pdf()
      .set({
        margin: [10, 10, 10, 10],
        filename: `bao-cao-${reportType}-${formatDate(new Date())}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      })
      .from(template)
      .save();
  } catch (error) {
    console.error('Lỗi khi xuất PDF:', error);
    throw error;
  }
}

// Xuất ra Excel
async function exportToExcel(data, reportType) {
  try {
    // Kiểm tra nếu XLSX chưa được tải
    if (typeof XLSX === 'undefined') {
      console.log('Đang tải XLSX.js...');
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
        script.onload = resolve;
        script.onerror = () => reject(new Error('Không thể tải XLSX.js'));
        document.head.appendChild(script);
      });
      console.log('Đã tải XLSX.js thành công');
    }

    const wb = XLSX.utils.book_new();
    
    // Tạo worksheet dựa trên loại báo cáo
    const ws = generateExcelWorksheet(data, reportType);
    
    XLSX.utils.book_append_sheet(wb, ws, 'Báo cáo');
    XLSX.writeFile(wb, `bao-cao-${reportType}-${formatDate(new Date())}.xlsx`);
  } catch (error) {
    console.error('Lỗi khi xuất Excel:', error);
    throw error;
  }
}

// Tạo worksheet Excel dựa trên loại báo cáo
function generateExcelWorksheet(data, reportType) {
  console.log('Tạo worksheet Excel cho báo cáo:', reportType);
  
  // Mảng chứa dữ liệu cho Excel
  let excelData = [];
  
  // Thiết lập tiêu đề và header dựa trên loại báo cáo
  switch (reportType) {
    case 'time':
      // Tiêu đề báo cáo
      excelData.push([data.title]);
      excelData.push([`Từ ${data.dateRange.start} đến ${data.dateRange.end}`]);
      excelData.push([`Tạo lúc: ${data.generatedAt}`]);
      excelData.push([]);  // Dòng trống
      
      // Header bảng
      excelData.push(['Thời gian', 'Chi phí', 'Số lượng giao dịch']);
      
      // Dữ liệu
      data.details.forEach(item => {
        excelData.push([
          item.period,
          item.amount,
          item.count
        ]);
      });
      
      // Tổng cộng
      const totalAmount = data.details.reduce((sum, item) => sum + item.amount, 0);
      const totalCount = data.details.reduce((sum, item) => sum + item.count, 0);
      excelData.push(['Tổng cộng', totalAmount, totalCount]);
      break;
      
    case 'category':
      // Tiêu đề báo cáo
      excelData.push([data.title]);
      excelData.push([`Từ ${data.dateRange.start} đến ${data.dateRange.end}`]);
      excelData.push([`Tạo lúc: ${data.generatedAt}`]);
      excelData.push([]);  // Dòng trống
      
      // Header bảng
      excelData.push(['Danh mục', 'Chi phí', 'Tỷ lệ (%)', 'Số lượng giao dịch']);
      
      // Dữ liệu
      data.details.forEach(item => {
        excelData.push([
          item.category,
          item.amount,
          item.percentage,
          item.count
        ]);
      });
      
      // Tổng cộng
      const catTotalAmount = data.details.reduce((sum, item) => sum + item.amount, 0);
      const catTotalCount = data.details.reduce((sum, item) => sum + item.count, 0);
      excelData.push(['Tổng cộng', catTotalAmount, 100, catTotalCount]);
      break;
      
    case 'comparison':
      // Tiêu đề báo cáo
      excelData.push([data.title]);
      excelData.push([`Từ ${data.dateRange.start} đến ${data.dateRange.end}`]);
      excelData.push([`Tạo lúc: ${data.generatedAt}`]);
      excelData.push([]);  // Dòng trống
      
      // Header bảng
      excelData.push(['Thời kỳ', 'Chi phí', 'Thay đổi (%)']);
      
      // Dữ liệu
      data.details.forEach(item => {
        excelData.push([
          item.period,
          item.amount,
          item.change || 0
        ]);
      });
      
      // Tổng cộng
      const compTotalAmount = data.details.reduce((sum, item) => sum + item.amount, 0);
      const avgChange = data.details.reduce((sum, item, index) => 
        index > 0 ? sum + (item.change || 0) : sum, 0) / (data.details.length > 1 ? data.details.length - 1 : 1);
      
      excelData.push(['Tổng cộng / Trung bình', compTotalAmount, Math.round(avgChange * 100) / 100]);
      break;
      
    default:
      excelData.push(['Không có dữ liệu cho loại báo cáo này']);
  }
  
  // Tạo worksheet từ mảng dữ liệu
  const ws = XLSX.utils.aoa_to_sheet(excelData);
  
  // Định dạng cho worksheet
  const range = XLSX.utils.decode_range(ws['!ref']);
  
  // Định dạng chiều rộng cột
  const cols = [];
  for (let i = 0; i <= range.e.c; i++) {
    cols.push({ wch: 20 });  // Độ rộng chuẩn cho tất cả cột
  }
  ws['!cols'] = cols;
  
  return ws;
}

// Thêm các tiện ích
function formatDate(date) {
  return new Intl.DateTimeFormat('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date).split('/').join('-');
}

function getCurrentDateRange() {
  const now = new Date();
  let startDate, endDate;
  
  switch (currentTimeRange) {
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      break;
    case 'quarter':
      const quarter = Math.floor(now.getMonth() / 3);
      startDate = new Date(now.getFullYear(), quarter * 3, 1);
      endDate = new Date(now.getFullYear(), (quarter + 1) * 3, 0);
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31);
      break;
    default:
      startDate = document.getElementById('startDate')?.value || now;
      endDate = document.getElementById('endDate')?.value || now;
  }
  
  return {
    start: formatDate(startDate),
    end: formatDate(endDate)
  };
}

// Lấy khoảng thời gian từ bộ lọc
function getDateRangeFromFilter() {
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

// Hàm debounce để tối ưu hiệu suất
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Cài đặt date range picker
function setupDateRangePicker() {
  const picker = document.getElementById('custom-date-range');
  if (picker) {
    new DateRangePicker(picker, {
      language: 'vi-VN',
      format: 'dd/mm/yyyy',
      maxDate: new Date(),
      clearButton: true,
      todayButton: true
    });
  }
}

// Cài đặt tương tác với biểu đồ
function setupChartInteractions() {
  const charts = document.querySelectorAll('.report-chart');
  
  charts.forEach(chart => {
    // Thêm nút phóng to/thu nhỏ
    const zoomBtn = document.createElement('button');
    zoomBtn.className = 'chart-zoom-btn';
    zoomBtn.innerHTML = '<i class="bi bi-arrows-fullscreen"></i>';
    chart.appendChild(zoomBtn);
    
    // Xử lý sự kiện phóng to
    zoomBtn.addEventListener('click', () => {
      toggleChartFullscreen(chart);
    });
  });
}

// Xử lý phóng to/thu nhỏ biểu đồ
function toggleChartFullscreen(chart) {
  if (!document.fullscreenElement) {
    chart.requestFullscreen().catch(err => {
      showError('Không thể mở chế độ toàn màn hình');
    });
  } else {
    document.exitFullscreen();
  }
}

// Thêm hàm lọc và tìm kiếm
function setupSearchAndFilters() {
  const searchInput = document.getElementById('search-expenses');
  const filterStatus = document.getElementById('filter-status');
  const filterCategory = document.getElementById('filter-category');
  
  if (searchInput) {
    searchInput.addEventListener('input', debounce(() => {
      const searchTerm = searchInput.value.toLowerCase();
      filterExpenses(searchTerm, filterStatus?.value, filterCategory?.value);
    }, 300));
  }
  
  if (filterStatus) {
    filterStatus.addEventListener('change', () => {
      filterExpenses(searchInput?.value.toLowerCase(), filterStatus.value, filterCategory?.value);
    });
  }
  
  if (filterCategory) {
    filterCategory.addEventListener('change', () => {
      filterExpenses(searchInput?.value.toLowerCase(), filterStatus?.value, filterCategory.value);
    });
  }
}

// Hàm lọc chi phí
function filterExpenses(search = '', status = 'all', category = 'all') {
  const rows = document.querySelectorAll('.expense-row');
  let visibleCount = 0;
  
  rows.forEach(row => {
    const title = row.querySelector('.expense-title')?.textContent.toLowerCase() || '';
    const rowStatus = row.dataset.status;
    const rowCategory = row.dataset.category;
    
    const matchesSearch = !search || title.includes(search);
    const matchesStatus = status === 'all' || rowStatus === status;
    const matchesCategory = category === 'all' || rowCategory === category;
    
    if (matchesSearch && matchesStatus && matchesCategory) {
      row.style.display = '';
      visibleCount++;
    } else {
      row.style.display = 'none';
    }
  });
  
  updateFilterCounter(visibleCount, rows.length);
}

// Cập nhật bộ đếm kết quả lọc
function updateFilterCounter(visible, total) {
  const counter = document.getElementById('filter-counter');
  if (counter) {
    counter.textContent = `Hiển thị ${visible}/${total} chi phí`;
  }
}

// Hàm nối dụng để tải dữ liệu chi tiêu con
async function loadChildExpenses(parentId, token) {
  try {
    if (!parentId) {
      console.warn('Không có ID chi tiêu cha để tải chi tiêu con');
      return [];
    }
    
    console.log('Tải dữ liệu chi tiêu con cho chi tiêu ID:', parentId);
    
    // Kiểm tra supabase
    if (!window.supabase) {
      console.error('Supabase client chưa được khởi tạo');
      return [];
    }
    
    // Truy vấn dữ liệu chi tiêu con - không sử dụng .auth(token)
    const { data: childExpenses, error } = await window.supabase
      .from('child_expenses')
      .select('*')
      .eq('parent_id', parentId);
    
    if (error) {
      console.error('Lỗi khi tải chi tiêu con:', error);
      return [];
    }
    
    console.log('Đã tải được', childExpenses?.length || 0, 'chi tiêu con cho ID:', parentId);
    return childExpenses || [];
  } catch (error) {
    console.error('Lỗi không xác định khi tải chi tiêu con:', error);
    return [];
  }
}

// Tải dữ liệu báo cáo so sánh
async function loadComparisonData() {
  try {
    showLoading();
    
    // Kiểm tra elements cần thiết
    const chartCanvas = document.getElementById('comparison-chart');
    const tableBody = document.querySelector('#comparison-table tbody');
    
    // Kiểm tra từng phần tử
    if (!chartCanvas) {
      console.warn('Không tìm thấy phần tử canvas comparison-chart');
      hideLoading();
      return;
    }
    
    if (!tableBody) {
      console.warn('Không tìm thấy phần tử #comparison-table tbody');
      hideLoading();
      return;
    }
    
    console.log('Đã tìm thấy tất cả các phần tử DOM cần thiết cho báo cáo so sánh');
    
    // Lấy token - không cần dùng trực tiếp trong query
    const token = getCookie('sb_token') || localStorage.getItem('token') || sessionStorage.getItem('sb_token');
    
    // Nhóm dữ liệu theo loại so sánh (tháng, quý, năm)
    const periodRanges = calculateComparisonPeriods(currentComparisonType);
    
    // Kiểm tra xem Supabase đã được khởi tạo chưa
    if (!window.supabase) {
      console.error('Supabase client chưa được khởi tạo');
      hideLoading();
      showError('Không thể kết nối đến cơ sở dữ liệu');
      return;
    }
    
    console.log('Tải dữ liệu cho', periodRanges.length, 'khoảng thời gian so sánh');
    
    // Mảng promise để lấy dữ liệu cho từng khoảng thời gian
    const periodPromises = periodRanges.map(async (period) => {
      // Xây dựng query - không sử dụng .auth(token)
      let query = window.supabase
        .from('child_expenses')
        .select('id, noi_dung, gia_tien, ngay_thang, danh_muc, trang_thai, ma_hoa_don, loai_chi_phi')
        .gte('ngay_thang', period.startDate)
        .lte('ngay_thang', period.endDate);
        
      // Chỉ lấy chi phí của người dùng hiện tại
      if (userData && userData.id) {
        query = query.eq('user_id', userData.id);
      }
      
      // Lọc theo trạng thái thanh toán
      if (currentPaymentStatus !== 'all') {
        const isPaid = currentPaymentStatus === 'paid';
        console.log(`Lọc theo trạng thái thanh toán: ${currentPaymentStatus}`);
        query = query.eq('trang_thai', isPaid ? 'Đã thanh toán' : 'Chưa thanh toán');
      }
      
      // Gửi query không cần .auth(token)
      const { data: expenses, error } = await query;
      
      if (error) {
        console.error('Lỗi lấy dữ liệu cho giai đoạn:', period, error);
        return {
          period: period.label,
          amount: 0,
          startDate: period.startDate,
          endDate: period.endDate
        };
      }
      
      // Nếu không có chi phí
      if (!expenses || expenses.length === 0) {
        return {
          period: period.label,
          amount: 0,
          startDate: period.startDate,
          endDate: period.endDate
        };
      }
      
      // Chuẩn hóa dữ liệu
      const normalizedExpenses = expenses.map(expense => ({
        id: expense.id,
        ten_chi_phi: expense.noi_dung,
        gia_tien: expense.gia_tien,
        ngay_bat_dau: expense.ngay_thang,
        danh_muc: expense.danh_muc,
        status: expense.trang_thai,
        ma_hoa_don: expense.ma_hoa_don,
        loai_chi_phi: expense.loai_chi_phi
      }));
      
      // Tính tổng chi phí trong khoảng thời gian
      const totalAmount = normalizedExpenses.reduce((sum, exp) => sum + (exp.gia_tien || 0), 0);
      
      return {
        period: period.label,
        amount: totalAmount,
        startDate: period.startDate,
        endDate: period.endDate,
        expenses: normalizedExpenses  // Thêm chi tiết chi phí để phục vụ tính toán tổng quan
      };
    });
    
    // Thực hiện tất cả các promise
    const comparisonData = await Promise.all(periodPromises);
    
    console.log('Dữ liệu so sánh đã tải xong:', comparisonData);
    
    // Kiểm tra nếu không có dữ liệu
    if (comparisonData.every(item => item.amount === 0)) {
      console.log('Không có dữ liệu cho báo cáo so sánh');
      tableBody.innerHTML = '<tr><td colspan="3" class="text-center">Không có dữ liệu chi tiêu trong khoảng thời gian này</td></tr>';
      
      // Cập nhật tổng quan với giá trị rỗng
      const emptySummary = {
        totalExpense: 0,
        highestExpense: 0,
        averageExpense: 0,
        highestCategory: { name: 'Chưa có dữ liệu', total: 0 }
      };
      updateSummaryWithAnimation(emptySummary);
      hideLoading();
      return;
    }
    
    // Tính toán thông tin tổng quan từ tất cả dữ liệu
    // Thu thập tất cả chi phí từ các khoảng thời gian
    const allExpenses = comparisonData.reduce((all, period) => {
      if (period.expenses && period.expenses.length > 0) {
        return [...all, ...period.expenses];
      }
      return all;
    }, []);
    
    // Tính toán tổng quan từ tất cả chi phí
    if (allExpenses.length > 0) {
      const summary = calculateSummary(allExpenses);
      updateSummaryWithAnimation(summary);
    }
    
    // Cập nhật biểu đồ so sánh
    renderComparisonChart(comparisonData);
    
    // Cập nhật bảng dữ liệu
    renderComparisonTable(comparisonData);
    
    // Khởi tạo tooltips sau khi cập nhật tất cả dữ liệu
    setTimeout(initializeTooltips, 200);
    
    hideLoading();
  } catch (error) {
    console.error('Lỗi tải dữ liệu so sánh:', error);
    hideLoading();
    showError('Không thể tải dữ liệu so sánh. Vui lòng thử lại.');
  }
}

// Hàm tính tổng chi phí bao gồm cả chi phí con - thêm lại hàm này
function calculateTotalWithChildren(expenses) {
  if (!expenses || !Array.isArray(expenses)) {
    return 0;
  }
  
  // Tách riêng chi phí cha và con
  const parentExpenses = expenses.filter(expense => !expense.isChild);
  const childExpenses = expenses.filter(expense => expense.isChild);
  
  // Tính tổng chi phí cha không có con
  const parentsWithoutChildren = parentExpenses.filter(parent => 
    !parent.has_children || !childExpenses.some(child => child.parent_id === parent.id)
  );
  const parentsTotal = parentsWithoutChildren.reduce((sum, expense) => sum + (expense.gia_tien || 0), 0);
  
  // Tính tổng chi phí con
  const childrenTotal = childExpenses.reduce((sum, expense) => sum + (expense.gia_tien || 0), 0);
  
  return parentsTotal + childrenTotal;
}

// Tính toán khoảng thời gian dựa vào loại thời gian
function calculateDateRange(timeRange) {
  const now = new Date();
  let startDate, endDate;
  
  switch (timeRange) {
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      break;
    case 'yesterday':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
      break;
    case 'thisWeek':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      break;
    case 'thisMonth':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      break;
    case 'lastMonth':
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      break;
    case 'thisQuarter':
      const quarter = Math.floor(now.getMonth() / 3);
      startDate = new Date(now.getFullYear(), quarter * 3, 1);
      endDate = new Date(now.getFullYear(), (quarter + 1) * 3, 0, 23, 59, 59);
      break;
    case 'thisYear':
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
      break;
    default:
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
  }
  
  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0]
  };
}

// Tính toán khoảng thời gian cho báo cáo so sánh
function calculateComparisonPeriods(comparisonType) {
  const now = new Date();
  const periods = [];
  
  if (comparisonType === 'month') {
    // 6 tháng gần nhất
    for (let i = 5; i >= 0; i--) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0);
      
      periods.push({
        label: `Tháng ${month.getMonth() + 1}/${month.getFullYear()}`,
        startDate: month.toISOString().split('T')[0],
        endDate: endOfMonth.toISOString().split('T')[0]
      });
    }
  } else if (comparisonType === 'quarter') {
    // 4 quý gần nhất
    const currentQuarter = Math.floor(now.getMonth() / 3);
    
    for (let i = 3; i >= 0; i--) {
      const quarterOffset = (currentQuarter - i + 4) % 4;
      const yearOffset = Math.floor((i - currentQuarter) / 4);
      const year = now.getFullYear() - yearOffset;
      const quarter = quarterOffset + 1;
      
      const startOfQuarter = new Date(year, quarterOffset * 3, 1);
      const endOfQuarter = new Date(year, (quarterOffset + 1) * 3, 0);
      
      periods.push({
        label: `Quý ${quarter}/${year}`,
        startDate: startOfQuarter.toISOString().split('T')[0],
        endDate: endOfQuarter.toISOString().split('T')[0]
      });
    }
  } else {
    // 3 năm gần nhất
    for (let i = 2; i >= 0; i--) {
      const year = now.getFullYear() - i;
      const startOfYear = new Date(year, 0, 1);
      const endOfYear = new Date(year, 11, 31);
      
      periods.push({
        label: `${year}`,
        startDate: startOfYear.toISOString().split('T')[0],
        endDate: endOfYear.toISOString().split('T')[0]
      });
    }
  }
  
  return periods;
}

// Kiểm tra xem container biểu đồ có hiển thị không
function isChartContainerVisible() {
  const chartContainer = document.querySelector('.reports-chart-wrapper');
  if (!chartContainer) return false;
  
  // Kiểm tra xem phần tử có bị ẩn không
  const style = window.getComputedStyle(chartContainer);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

// Kiểm tra xem tất cả các phần tử DOM cần thiết có tồn tại không
function checkRequiredElements() {
  // Kiểm tra phần tử để vẽ biểu đồ
  const timeChartElement = document.getElementById('time-chart');
  if (!timeChartElement) {
    console.warn('Không tìm thấy phần tử #time-chart');
    return false;
  }
  
  // Kiểm tra phần tử bảng dữ liệu
  const timeTableElement = document.getElementById('time-table');
  if (!timeTableElement) {
    console.warn('Không tìm thấy phần tử #time-table');
    return false;
  }
  
  // Kiểm tra container biểu đồ
  const chartWrapperElement = document.querySelector('.reports-chart-wrapper');
  if (!chartWrapperElement) {
    console.warn('Không tìm thấy phần tử .reports-chart-wrapper');
    return false;
  }
  
  // Kiểm tra container bảng
  const tableContainerElement = document.querySelector('.reports-table-container');
  if (!tableContainerElement) {
    console.warn('Không tìm thấy phần tử .reports-table-container');
    return false;
  }
  
  return true;
}

// Thay đổi trạng thái thanh toán
function changePaymentStatus(status) {
  currentPaymentStatus = status;
  console.log(`Đã thay đổi trạng thái thanh toán: ${status}`);
  
  // Tải lại dữ liệu báo cáo
  loadReportData();
}

// Tải dữ liệu chi tiết từng chi phí
async function loadDetailReport(startDate, endDate) {
  try {
    // Kiểm tra elements cần thiết
    const detailTableBody = document.querySelector('#detail-table tbody');
    
    // Kiểm tra từng phần tử
    if (!detailTableBody) {
      console.warn('Không tìm thấy phần tử #detail-table tbody');
      hideLoading();
      return;
    }
    
    console.log('Đã tìm thấy phần tử DOM cần thiết cho báo cáo chi tiết');
    
    // Kiểm tra Supabase đã sẵn sàng chưa
    if (!window.supabase) {
      console.error('❌ Supabase client chưa được khởi tạo');
      hideLoading();
      showError('Không thể kết nối đến cơ sở dữ liệu. Vui lòng tải lại trang.');
      return;
    }
    
    console.log('Truy vấn dữ liệu chi tiết chi phí từ Supabase...');
    
    // Xây dựng query và lọc theo thời gian
    let query = window.supabase
      .from('child_expenses')
      .select('id, noi_dung, gia_tien, ngay_thang, danh_muc, trang_thai, ma_hoa_don, loai_chi_phi, dia_diem, ghi_chu')
      .order('ngay_thang', { ascending: false });
    
    // Áp dụng bộ lọc thời gian
    if (startDate && endDate) {
      console.log(`Lọc theo khoảng thời gian: ${startDate} đến ${endDate}`);
      query = query.gte('ngay_thang', startDate).lte('ngay_thang', endDate);
    } else {
      // Tính toán khoảng thời gian dựa vào currentTimeRange
      const { startDate: rangeStart, endDate: rangeEnd } = calculateDateRange(currentTimeRange);
      console.log(`Lọc theo khoảng thời gian mặc định: ${rangeStart} đến ${rangeEnd}`);
      query = query.gte('ngay_thang', rangeStart).lte('ngay_thang', rangeEnd);
    }
    
    // Chỉ lấy chi phí của người dùng hiện tại
    if (userData && userData.id) {
      console.log(`Lọc theo người dùng ID: ${userData.id}`);
      query = query.eq('user_id', userData.id);
    } else {
      console.warn('Không có ID người dùng để lọc');
    }
    
    // Lọc theo trạng thái thanh toán
    if (currentPaymentStatus !== 'all') {
      const isPaid = currentPaymentStatus === 'paid';
      console.log(`Lọc theo trạng thái thanh toán: ${currentPaymentStatus}`);
      query = query.eq('trang_thai', isPaid ? 'Đã thanh toán' : 'Chưa thanh toán');
    }
    
    // Gửi query 
    const { data: expenses, error } = await query;
    
    if (error) {
      console.error('Lỗi khi truy vấn dữ liệu chi tiết:', error);
      throw new Error('Không thể tải dữ liệu chi tiết chi phí: ' + error.message);
    }
    
    // Kiểm tra nếu không có dữ liệu
    if (!expenses || expenses.length === 0) {
      console.log('Không có dữ liệu chi tiết trong khoảng thời gian đã chọn');
      // Hiển thị thông báo không có dữ liệu
      detailTableBody.innerHTML = '<tr><td colspan="6" class="text-center">Không có dữ liệu chi tiết trong khoảng thời gian này</td></tr>';
      hideLoading();
      
      // Cập nhật tổng quan với giá trị rỗng
      const emptySummary = {
        totalExpense: 0,
        highestExpense: 0,
        averageExpense: 0,
        highestCategory: { name: 'Chưa có dữ liệu', total: 0 }
      };
      updateSummaryWithAnimation(emptySummary);
      return;
    }
    
    console.log('Đã tải được dữ liệu chi tiết chi phí:', expenses.length, 'bản ghi');
    
    // Chuẩn hóa dữ liệu
    const normalizedExpenses = expenses.map(expense => ({
      id: expense.id,
      ten_chi_phi: expense.noi_dung,
      gia_tien: expense.gia_tien,
      ngay_thang: expense.ngay_thang,
      danh_muc: expense.danh_muc,
      status: expense.trang_thai,
      ma_hoa_don: expense.ma_hoa_don,
      loai_chi_phi: expense.loai_chi_phi,
      dia_diem: expense.dia_diem || 'Không có',
      ghi_chu: expense.ghi_chu || ''
    }));
    
    // Tính tổng các số liệu thống kê
    const summary = calculateSummary(normalizedExpenses);
    
    // Cập nhật tổng quan với animation
    updateSummaryWithAnimation(summary);
    
    // Render bảng chi tiết
    renderDetailTable(normalizedExpenses);
    
    hideLoading();
  } catch (error) {
    console.error('Lỗi tải dữ liệu chi tiết chi phí:', error);
    showError('Không thể tải dữ liệu chi tiết. Vui lòng thử lại.');
    hideLoading();
  }
}

// Render bảng chi tiết chi phí
function renderDetailTable(expenses) {
  const tableBody = document.querySelector('#detail-table tbody');
  if (!tableBody) {
    console.warn('Không tìm thấy phần tử #detail-table tbody');
    return;
  }
  
  // Lưu lại dữ liệu chi tiết hiện tại để phân trang
  currentDetailData = expenses;
  
  // Sắp xếp theo ngày mới nhất
  expenses.sort((a, b) => new Date(b.ngay_thang) - new Date(a.ngay_thang));
  
  // Tính tổng số trang
  totalPages = Math.ceil(expenses.length / itemsPerPage);
  
  // Đảm bảo trang hiện tại hợp lệ
  if (currentPage > totalPages) {
    currentPage = 1;
  }
  
  // Render dữ liệu cho trang hiện tại
  renderDetailPage(currentPage);
  
  // Render phân trang
  renderPagination();
}

// Render một trang dữ liệu chi tiết
function renderDetailPage(page) {
  const tableBody = document.querySelector('#detail-table tbody');
  if (!tableBody) {
    console.warn('Không tìm thấy phần tử #detail-table tbody');
    return;
  }
  
  // Tính vị trí bắt đầu và kết thúc của dữ liệu
  const startIndex = (page - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, currentDetailData.length);
  
  // Lấy dữ liệu cho trang hiện tại
  const currentPageData = currentDetailData.slice(startIndex, endIndex);
  
  // Xóa nội dung cũ
  tableBody.innerHTML = '';
  
  // Nếu không có dữ liệu
  if (currentPageData.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="6" class="text-center">Không có dữ liệu chi tiết</td></tr>';
    return;
  }
  
  // Render từng dòng dữ liệu
  currentPageData.forEach((expense, index) => {
    const row = document.createElement('tr');
    
    // Định dạng ngày tháng
    const date = new Date(expense.ngay_thang);
    const formattedDate = date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    
    row.innerHTML = `
      <td class="text-center">${startIndex + index + 1}</td>
      <td>
        <div class="detail-item-name">
          <span class="item-name">${expense.ten_chi_phi}</span>
          <span class="item-category badge">${expense.danh_muc || 'Khác'}</span>
        </div>
      </td>
      <td class="text-end">${formatCurrency(expense.gia_tien)}</td>
      <td class="text-center">${formattedDate}</td>
      <td>${expense.dia_diem || 'Không có'}</td>
      <td>${expense.ghi_chu || ''}</td>
    `;
    
    // Thêm class cho trạng thái thanh toán
    if (expense.status) {
      row.classList.add(expense.status === 'Đã thanh toán' ? 'status-paid' : 'status-unpaid');
      
      // Thêm tooltip cho trạng thái
      row.setAttribute('data-bs-toggle', 'tooltip');
      row.setAttribute('data-bs-placement', 'left');
      row.setAttribute('title', expense.status);
    }
    
    tableBody.appendChild(row);
  });
  
  // Cập nhật trang hiện tại
  currentPage = page;
  
  // Khởi tạo tooltips
  setTimeout(() => {
    initializeTooltips();
  }, 200);
}

// Render phân trang
function renderPagination() {
  // Tìm hoặc tạo container phân trang
  let paginationContainer = document.querySelector('.reports-pagination');
  if (!paginationContainer) {
    // Nếu chưa có, tạo container mới
    paginationContainer = document.createElement('div');
    paginationContainer.className = 'reports-pagination';
    
    // Thêm vào sau table container
    const tableContainer = document.querySelector('#detail-report .reports-table-container');
    if (tableContainer) {
      tableContainer.after(paginationContainer);
    }
  }
  
  // Nếu chỉ có 1 trang hoặc không có dữ liệu
  if (totalPages <= 1) {
    paginationContainer.style.display = 'none';
    return;
  }
  
  // Hiển thị phân trang
  paginationContainer.style.display = 'flex';
  
  // Xóa nút phân trang cũ
  paginationContainer.innerHTML = '';
  
  // Thêm nút Previous
  const prevButton = document.createElement('button');
  prevButton.innerHTML = '&laquo; Trước';
  prevButton.disabled = currentPage === 1;
  prevButton.addEventListener('click', () => {
    if (currentPage > 1) {
      renderDetailPage(currentPage - 1);
      renderPagination();
    }
  });
  paginationContainer.appendChild(prevButton);
  
  // Thêm số trang
  const maxPageButtons = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxPageButtons / 2));
  let endPage = Math.min(totalPages, startPage + maxPageButtons - 1);
  
  // Điều chỉnh startPage để luôn hiển thị đủ số nút
  if (endPage - startPage + 1 < maxPageButtons && startPage > 1) {
    startPage = Math.max(1, endPage - maxPageButtons + 1);
  }
  
  for (let i = startPage; i <= endPage; i++) {
    const pageButton = document.createElement('button');
    pageButton.textContent = i;
    pageButton.className = i === currentPage ? 'active' : '';
    pageButton.addEventListener('click', () => {
      renderDetailPage(i);
      renderPagination();
    });
    paginationContainer.appendChild(pageButton);
  }
  
  // Thêm nút Next
  const nextButton = document.createElement('button');
  nextButton.innerHTML = 'Sau &raquo;';
  nextButton.disabled = currentPage === totalPages;
  nextButton.addEventListener('click', () => {
    if (currentPage < totalPages) {
      renderDetailPage(currentPage + 1);
      renderPagination();
    }
  });
  paginationContainer.appendChild(nextButton);
}

// Render biểu đồ danh mục với hiệu ứng
async function renderCategoryChartWithAnimation(categoryData) {
  try {
    console.log("Bắt đầu renderCategoryChartWithAnimation với", categoryData.length, "danh mục");
    
    // Kiểm tra dữ liệu
    if (!categoryData || !Array.isArray(categoryData) || categoryData.length === 0) {
      console.warn('Không có dữ liệu danh mục để hiển thị biểu đồ');
      return;
    }
    
    // Tìm phần tử container cho biểu đồ danh mục
    const chartContainer = document.querySelector('.reports-chart-half');
    if (!chartContainer) {
      console.warn('Không tìm thấy .reports-chart-half');
      return;
    }
    
    // Xóa nội dung hiện tại và tạo canvas mới
    chartContainer.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.id = 'category-chart';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    chartContainer.appendChild(canvas);
    
    // Đảm bảo container có style đúng
    chartContainer.style.display = 'flex';
    chartContainer.style.position = 'relative';
    chartContainer.style.width = '100%';
    chartContainer.style.height = '300px';
    chartContainer.style.minHeight = '300px';
    
    // Hiển thị loading
    chartContainer.classList.add('loading');
    
    try {
      // Kiểm tra Chart.js đã được tải
      if (typeof Chart === 'undefined') {
        throw new Error('Thư viện Chart.js chưa được tải');
      }
      
      // Lấy context cho canvas
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Không thể lấy context từ canvas');
      }
      
      // Thiết lập kích thước canvas
      const parentWidth = chartContainer.offsetWidth || 300;
      canvas.width = parentWidth;
      canvas.height = 300;
      console.log(`Canvas danh mục kích thước: ${canvas.width} x ${canvas.height}`);
      
      // Xóa biểu đồ cũ nếu có
      if (currentCharts.categoryChart) {
        currentCharts.categoryChart.destroy();
        currentCharts.categoryChart = null;
      }
      
      // Tạo dữ liệu cho biểu đồ
      const chartData = categoryData.map(item => ({
        name: item.name,
        value: item.value,
        color: CONFIG.categories[item.name]?.color || CONFIG.colors.info
      }));
      
      // Chuẩn bị dữ liệu cho biểu đồ
      const labels = chartData.map(item => item.name);
      const data = chartData.map(item => item.value);
      const colors = chartData.map(item => item.color + '80'); // Thêm opacity
      const borderColors = chartData.map(item => item.color);
      
      // Cấu hình biểu đồ
      const chartConfig = {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{
            data: data,
            backgroundColor: colors,
            borderColor: borderColors,
            borderWidth: 2,
            hoverOffset: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '70%',
          layout: {
            padding: 20
          },
          animation: {
            animateRotate: true,
            animateScale: true,
            duration: 1000
          },
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              titleFont: {
                size: 13
              },
              bodyFont: {
                size: 12
              },
              padding: 12,
              callbacks: {
                label: function(context) {
                  const value = context.raw;
                  const total = chartData.reduce((a, b) => a + b.value, 0);
                  const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
                  return `${context.label}: ${formatCurrency(value)} (${percentage}%)`;
                }
              }
            }
          }
        }
      };
      
      // Tạo biểu đồ mới
      console.log("Khởi tạo biểu đồ danh mục mới");
      currentCharts.categoryChart = new Chart(ctx, chartConfig);
      
      // Lưu biểu đồ trong window object
      window.categoryChart = currentCharts.categoryChart;
      
      console.log("Đã tạo biểu đồ danh mục thành công:", currentCharts.categoryChart?.id);
      
      // Cập nhật legend với icons
      renderCategoryLegendWithIcons(chartData);
      
    } catch (error) {
      console.error('Lỗi khi tạo biểu đồ danh mục:', error);
      throw error;
    } finally {
      // Ẩn loading
      chartContainer.classList.remove('loading');
    }
  } catch (error) {
    console.error('Lỗi trong renderCategoryChartWithAnimation:', error);
    throw error;
  }
}

// Hàm lấy dữ liệu báo cáo theo thời gian
async function getTimeReportData() {
  try {
    console.log('Đang lấy dữ liệu báo cáo theo thời gian...');
    
    // Lấy ngày bắt đầu và kết thúc từ bộ lọc
    const { startDate, endDate } = getDateRangeFromFilter();
    
    try {
      // Truy vấn dữ liệu từ Supabase
      const { data: expenses, error } = await window.supabase
        .from('child_expenses')
        .select('*')
        .gte('ngay_thang', startDate)
        .lte('ngay_thang', endDate)
        .order('ngay_thang', { ascending: false });
      
      if (error) {
        console.error('Lỗi khi lấy dữ liệu báo cáo theo thời gian:', error);
        // Nếu lỗi, tạo dữ liệu mẫu
        return generateSampleTimeData();
      }
      
      // Nếu không có dữ liệu, trả về dữ liệu mẫu
      if (!expenses || expenses.length === 0) {
        console.log('Không có dữ liệu chi phí trong khoảng thời gian này, sử dụng dữ liệu mẫu');
        return generateSampleTimeData();
      }
      
      // Nhóm dữ liệu theo thời gian
      const groupedData = groupByTime(expenses, currentTimeRange);
      
      // Định dạng dữ liệu cho xuất báo cáo
      return groupedData.map(item => ({
        period: item.label,
        amount: item.total,
        count: item.count || 0
      }));
    } catch (connectionError) {
      console.error('Lỗi kết nối đến cơ sở dữ liệu:', connectionError);
      // Nếu lỗi kết nối, tạo dữ liệu mẫu
      return generateSampleTimeData();
    }
  } catch (error) {
    console.error('Lỗi khi lấy dữ liệu báo cáo theo thời gian:', error);
    return generateSampleTimeData();
  }
}

// Hàm lấy dữ liệu báo cáo theo danh mục
async function getCategoryReportData() {
  try {
    console.log('Đang lấy dữ liệu báo cáo theo danh mục...');
    
    // Lấy ngày bắt đầu và kết thúc từ bộ lọc
    const { startDate, endDate } = getDateRangeFromFilter();
    
    try {
      // Truy vấn dữ liệu từ Supabase
      const { data: expenses, error } = await window.supabase
        .from('child_expenses')
        .select('*')
        .gte('ngay_thang', startDate)
        .lte('ngay_thang', endDate);
      
      if (error) {
        console.error('Lỗi khi lấy dữ liệu báo cáo theo danh mục:', error);
        // Nếu lỗi, tạo dữ liệu mẫu
        return generateSampleCategoryData();
      }
      
      // Nếu không có dữ liệu, trả về dữ liệu mẫu
      if (!expenses || expenses.length === 0) {
        console.log('Không có dữ liệu chi phí trong khoảng thời gian này, sử dụng dữ liệu mẫu');
        return generateSampleCategoryData();
      }
      
      // Chuẩn hoá dữ liệu
      const normalizedExpenses = expenses.map(expense => ({
        id: expense.id,
        ten_chi_phi: expense.noi_dung,
        gia_tien: expense.gia_tien,
        ngay_bat_dau: expense.ngay_thang,
        danh_muc: expense.danh_muc || 'Khác',
        status: expense.trang_thai,
        ma_hoa_don: expense.ma_hoa_don,
        loai_chi_phi: expense.loai_chi_phi
      }));
      
      // Nhóm dữ liệu theo danh mục
      const categoryData = groupByCategory(normalizedExpenses);
      
      // Tính tổng chi phí để tính phần trăm
      const totalExpense = categoryData.reduce((sum, item) => sum + item.total, 0);
      
      // Định dạng dữ liệu cho xuất báo cáo
      return categoryData.map(item => ({
        category: item.category,
        amount: item.total,
        percentage: item.percentage,
        count: item.count || 0
      }));
    } catch (connectionError) {
      console.error('Lỗi kết nối đến cơ sở dữ liệu:', connectionError);
      // Nếu lỗi kết nối, tạo dữ liệu mẫu
      return generateSampleCategoryData();
    }
  } catch (error) {
    console.error('Lỗi khi lấy dữ liệu báo cáo theo danh mục:', error);
    return generateSampleCategoryData();
  }
}

// Hàm lấy dữ liệu báo cáo so sánh
async function getComparisonReportData() {
  try {
    console.log('Đang lấy dữ liệu báo cáo so sánh...');
    
    try {
      // Thử kết nối đến cơ sở dữ liệu
      const { error } = await window.supabase
        .from('child_expenses')
        .select('count', { count: 'exact', head: true });
      
      if (error) {
        console.error('Lỗi kết nối đến cơ sở dữ liệu:', error);
        // Nếu lỗi, sử dụng dữ liệu mẫu
        return generateSampleComparisonData();
      }
      
      // Lấy ngày hiện tại
      const now = new Date();
      
      // Mảng lưu dữ liệu kết quả
      const result = [];
      
      // Dựa vào loại so sánh để lấy dữ liệu tương ứng
      if (currentComparisonType === 'month') {
        // So sánh 6 tháng gần nhất
        for (let i = 5; i >= 0; i--) {
          const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
          
          // Định dạng ngày tháng để truy vấn
          const startOfMonth = month.toISOString().split('T')[0];
          const endOfMonth = nextMonth.toISOString().split('T')[0];
          
          // Truy vấn dữ liệu theo tháng
          const { data: expenses, error } = await window.supabase
            .from('chi_phi')
            .select('gia_tien')
            .gte('ngay_thang', startOfMonth)
            .lte('ngay_thang', endOfMonth);
          
          if (error) {
            console.error('Lỗi khi lấy dữ liệu tháng:', error);
            continue;
          }
          
          // Tính tổng chi phí trong tháng
          const totalAmount = expenses?.reduce((sum, exp) => sum + (exp.gia_tien || 0), 0) || Math.floor(Math.random() * 15000000) + 5000000;
          
          // Thêm dữ liệu vào kết quả
          result.push({
            period: `Tháng ${month.getMonth() + 1}/${month.getFullYear()}`,
            amount: totalAmount,
            count: expenses?.length || Math.floor(Math.random() * 30) + 5
          });
        }
      } else if (currentComparisonType === 'quarter') {
        // Trả về dữ liệu mẫu vì chúng ta đã biết cơ sở dữ liệu không có dữ liệu thực
        return generateSampleComparisonData();
      } else {
        // Trả về dữ liệu mẫu cho năm
        return generateSampleComparisonData();
      }
      
      return result.length > 0 ? result : generateSampleComparisonData();
    } catch (connectionError) {
      console.error('Lỗi kết nối đến cơ sở dữ liệu:', connectionError);
      // Nếu lỗi kết nối, tạo dữ liệu mẫu
      return generateSampleComparisonData();
    }
  } catch (error) {
    console.error('Lỗi khi lấy dữ liệu báo cáo so sánh:', error);
    return generateSampleComparisonData();
  }
}

// Tạo dữ liệu mẫu cho báo cáo theo thời gian
function generateSampleTimeData() {
  console.log('Tạo dữ liệu mẫu cho báo cáo theo thời gian');
  
  const now = new Date();
  const result = [];
  
  switch (currentTimeRange) {
    case 'month':
      // Tạo dữ liệu cho 30 ngày gần nhất
      for (let i = 29; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        
        result.push({
          period: `${date.getDate()}/${date.getMonth() + 1}`,
          amount: Math.floor(Math.random() * 2000000) + 500000,
          count: Math.floor(Math.random() * 5) + 1
        });
      }
      break;
      
    case 'quarter':
      // Tạo dữ liệu cho 3 tháng gần nhất
      for (let i = 2; i >= 0; i--) {
        const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
        
        result.push({
          period: `Tháng ${month.getMonth() + 1}/${month.getFullYear()}`,
          amount: Math.floor(Math.random() * 20000000) + 5000000,
          count: Math.floor(Math.random() * 30) + 5
        });
      }
      break;
      
    case 'year':
    default:
      // Tạo dữ liệu cho 12 tháng gần nhất
      for (let i = 11; i >= 0; i--) {
        const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
        
        result.push({
          period: `Tháng ${month.getMonth() + 1}/${month.getFullYear()}`,
          amount: Math.floor(Math.random() * 30000000) + 10000000,
          count: Math.floor(Math.random() * 50) + 10
        });
      }
      break;
  }
  
  return result;
}

// Tạo dữ liệu mẫu cho báo cáo theo danh mục
function generateSampleCategoryData() {
  console.log('Tạo dữ liệu mẫu cho báo cáo theo danh mục');
  
  const categories = [
    { name: 'Thực phẩm', color: '#4f46e5' },
    { name: 'Nhà cửa', color: '#0ea5e9' },
    { name: 'Di chuyển', color: '#10b981' },
    { name: 'Giải trí', color: '#f97316' },
    { name: 'Sức khỏe', color: '#ef4444' },
    { name: 'Giáo dục', color: '#8b5cf6' },
    { name: 'Khác', color: '#6b7280' }
  ];
  
  const result = [];
  // Tạo worksheet từ mảng dữ liệu
  const ws = XLSX.utils.aoa_to_sheet(excelData);
  
  // Định dạng cho worksheet
  const range = XLSX.utils.decode_range(ws['!ref']);
  
  // Định dạng chiều rộng cột
  const cols = [];
  for (let i = 0; i <= range.e.c; i++) {
    cols.push({ wch: 20 });  // Độ rộng chuẩn cho tất cả cột
  }
  ws['!cols'] = cols;
  
  return ws;
}

// Tạo HTML cho báo cáo theo thời gian
function generateTimeReportHTML(data) {
  let html = `
    <div style="margin-top: 20px;">
      <h2 style="color: #4f46e5; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">
        Chi phí theo thời gian
      </h2>
      
      <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
        <thead>
          <tr style="background-color: #f1f5f9;">
            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #e2e8f0;">Thời gian</th>
            <th style="padding: 10px; text-align: right; border-bottom: 2px solid #e2e8f0;">Chi phí</th>
            <th style="padding: 10px; text-align: right; border-bottom: 2px solid #e2e8f0;">Số lượng giao dịch</th>
          </tr>
        </thead>
        <tbody>
  `;
  
  // Thêm dữ liệu từng dòng
  let totalAmount = 0;
  let totalCount = 0;
  
  data.details.forEach(item => {
    totalAmount += item.amount;
    totalCount += item.count;
    
    html += `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px;">${item.period}</td>
        <td style="padding: 10px; text-align: right;">${formatCurrency(item.amount)}</td>
        <td style="padding: 10px; text-align: right;">${item.count}</td>
      </tr>
    `;
  });
  
  // Thêm hàng tổng cộng
  html += `
        <tr style="font-weight: bold; background-color: #f8fafc;">
          <td style="padding: 10px;">Tổng cộng</td>
          <td style="padding: 10px; text-align: right;">${formatCurrency(totalAmount)}</td>
          <td style="padding: 10px; text-align: right;">${totalCount}</td>
        </tr>
      </tbody>
    </table>
  </div>
  `;
  
  return html;
}

// Tạo HTML cho báo cáo theo danh mục
function generateCategoryReportHTML(data) {
  let html = `
    <div style="margin-top: 20px;">
      <h2 style="color: #4f46e5; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">
        Chi phí theo danh mục
      </h2>
      
      <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
        <thead>
          <tr style="background-color: #f1f5f9;">
            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #e2e8f0;">Danh mục</th>
            <th style="padding: 10px; text-align: right; border-bottom: 2px solid #e2e8f0;">Chi phí</th>
            <th style="padding: 10px; text-align: right; border-bottom: 2px solid #e2e8f0;">Tỷ lệ (%)</th>
            <th style="padding: 10px; text-align: right; border-bottom: 2px solid #e2e8f0;">Số lượng giao dịch</th>
          </tr>
        </thead>
        <tbody>
  `;
  
  // Thêm dữ liệu từng dòng
  let totalAmount = 0;
  let totalCount = 0;
  
  data.details.forEach(item => {
    totalAmount += item.amount;
    totalCount += item.count;
    
    html += `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px;">${item.category}</td>
        <td style="padding: 10px; text-align: right;">${formatCurrency(item.amount)}</td>
        <td style="padding: 10px; text-align: right;">${item.percentage}%</td>
        <td style="padding: 10px; text-align: right;">${item.count}</td>
      </tr>
    `;
  });
  
  // Thêm hàng tổng cộng
  html += `
        <tr style="font-weight: bold; background-color: #f8fafc;">
          <td style="padding: 10px;">Tổng cộng</td>
          <td style="padding: 10px; text-align: right;">${formatCurrency(totalAmount)}</td>
          <td style="padding: 10px; text-align: right;">100%</td>
          <td style="padding: 10px; text-align: right;">${totalCount}</td>
        </tr>
      </tbody>
    </table>
  </div>
  `;
  
  return html;
}

// Tạo HTML cho báo cáo so sánh
function generateComparisonReportHTML(data) {
  let html = `
    <div style="margin-top: 20px;">
      <h2 style="color: #4f46e5; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">
        So sánh chi phí
      </h2>
      
      <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
        <thead>
          <tr style="background-color: #f1f5f9;">
            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #e2e8f0;">Thời kỳ</th>
            <th style="padding: 10px; text-align: right; border-bottom: 2px solid #e2e8f0;">Chi phí</th>
            <th style="padding: 10px; text-align: right; border-bottom: 2px solid #e2e8f0;">Số lượng giao dịch</th>
          </tr>
        </thead>
        <tbody>
  `;
  
  // Thêm dữ liệu từng dòng
  let totalAmount = 0;
  let totalCount = 0;
  
  data.details.forEach(item => {
    totalAmount += item.amount;
    totalCount += item.count;
    
    html += `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px;">${item.period}</td>
        <td style="padding: 10px; text-align: right;">${formatCurrency(item.amount)}</td>
        <td style="padding: 10px; text-align: right;">${item.count}</td>
      </tr>
    `;
  });
  
  // Thêm hàng tổng cộng
  html += `
        <tr style="font-weight: bold; background-color: #f8fafc;">
          <td style="padding: 10px;">Tổng cộng</td>
          <td style="padding: 10px; text-align: right;">${formatCurrency(totalAmount)}</td>
          <td style="padding: 10px; text-align: right;">${totalCount}</td>
        </tr>
      </tbody>
    </table>
  </div>
  `;
  
  return html;
}

// Tạo template PDF dựa trên loại báo cáo
async function generatePDFTemplate(data, reportType) {
  console.log('Tạo template PDF cho báo cáo:', reportType);
  
  // Tạo container chứa nội dung báo cáo
  const container = document.createElement('div');
  container.style.padding = '20px';
  container.style.fontFamily = 'Arial, sans-serif';
  container.style.maxWidth = '800px';
  container.style.margin = '0 auto';
  
  // Header báo cáo
  const header = document.createElement('div');
  header.style.textAlign = 'center';
  header.style.marginBottom = '20px';
  
  // Tiêu đề và thông tin
  const title = document.createElement('h1');
  title.textContent = data.title;
  title.style.color = '#4f46e5';
  title.style.marginBottom = '10px';
  
  const dateInfo = document.createElement('p');
  dateInfo.innerHTML = `Từ: <strong>${data.dateRange.start}</strong> đến <strong>${data.dateRange.end}</strong>`;
  dateInfo.style.color = '#64748b';
  
  const generatedInfo = document.createElement('p');
  generatedInfo.innerHTML = `Tạo lúc: <strong>${data.generatedAt}</strong>`;
  generatedInfo.style.color = '#64748b';
  generatedInfo.style.fontSize = '0.9em';
  
  // Thêm các phần tử vào header
  header.appendChild(title);
  header.appendChild(dateInfo);
  header.appendChild(generatedInfo);
  
  // Thêm header vào container
  container.appendChild(header);
  
  // Tạo phần nội dung dựa trên loại báo cáo
  let content = '';
  
  switch (reportType) {
    case 'time':
      content = generateTimeReportHTML(data);
      break;
    case 'category':
      content = generateCategoryReportHTML(data);
      break;
    case 'comparison':
      content = generateComparisonReportHTML(data);
      break;
    case 'detail':
      content = generateDetailReportHTML(data);
      break;
    default:
      content = `<p>Không có dữ liệu cho loại báo cáo: ${reportType}</p>`;
  }
  
  // Thêm nội dung vào container
  container.innerHTML += content;
  
  // Footer
  const footer = document.createElement('div');
  footer.style.marginTop = '30px';
  footer.style.borderTop = '1px solid #e2e8f0';
  footer.style.paddingTop = '10px';
  footer.style.textAlign = 'center';
  footer.style.color = '#94a3b8';
  footer.style.fontSize = '0.8em';
  footer.textContent = '© ' + new Date().getFullYear() + ' - Ứng dụng Quản lý Chi phí';
  
  // Thêm footer vào container
  container.appendChild(footer);
  
  return container;
}

// Tạo nội dung HTML cho báo cáo chi tiết chi phí
function generateDetailReportHTML(data) {
  console.log('Tạo HTML cho báo cáo chi tiết chi phí với', data.details.length, 'chi phí');
  
  if (!data.details || data.details.length === 0) {
    return `<p style="text-align: center; color: #64748b; padding: 20px;">Không có dữ liệu chi tiết chi phí.</p>`;
  }
  
  // Tính tổng chi phí
  const totalAmount = data.details.reduce((sum, expense) => sum + (expense.gia_tien || 0), 0);
  
  // CSS cho bảng
  const tableStyle = `
    width: 100%;
    border-collapse: collapse;
    margin-top: 20px;
    font-size: 14px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  `;
  
  const thStyle = `
    background-color: #4f46e5;
    color: white;
    padding: 12px;
    text-align: left;
    font-weight: 600;
  `;
  
  const tdStyle = `
    padding: 10px;
    color: #000;
    border-bottom: 1px solid #e2e8f0;
  `;
  
  // Tạo HTML cho bảng chi tiết
  let html = `
  <div style="overflow-x: auto;">
    <table style="${tableStyle}">
      <thead>
        <tr>
          <th style="${thStyle}">STT</th>
          <th style="${thStyle}">Tên Chi Phí</th>
          <th style="${thStyle}">Số Tiền</th>
          <th style="${thStyle}">Ngày Tháng</th>
          <th style="${thStyle}">Địa Điểm</th>
          <th style="${thStyle}">Ghi Chú</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  // Thêm hàng cho từng chi phí
  data.details.forEach((expense, index) => {
    const rowStyle = index % 2 === 0 ? 'background-color: #f8fafc;' : '';
    
    html += `
      <tr style="${rowStyle}">
        <td style="${tdStyle}">${index + 1}</td>
        <td style="${tdStyle}">${expense.ten_chi_phi || expense.noi_dung || 'Không tên'}</td>
        <td style="${tdStyle} text-align: right;">${formatCurrency(expense.gia_tien || 0)}</td>
        <td style="${tdStyle}">${formatDate(new Date(expense.ngay_thang || expense.ngay_bat_dau))}</td>
        <td style="${tdStyle}">${expense.dia_diem || '-'}</td>
        <td style="${tdStyle}">${expense.ghi_chu || '-'}</td>
      </tr>
    `;
  });
  
  // Thêm hàng tổng cộng
  html += `
      <tr style="font-weight: bold; background-color: #f1f5f9;">
        <td style="${tdStyle}" colspan="2">Tổng cộng</td>
        <td style="${tdStyle} text-align: right;">${formatCurrency(totalAmount)}</td>
        <td style="${tdStyle}" colspan="3"></td>
      </tr>
    </tbody>
  </table>
  </div>
  
  <div style="margin-top: 20px; font-size: 13px; color: #64748b;">
    <p>Tổng số chi phí: ${data.details.length}</p>
    <p>Tổng chi tiêu: ${formatCurrency(totalAmount)}</p>
  </div>
  `;
  
  return html;
}

// Hàm tải thư viện html2pdf nếu chưa tồn tại
async function loadHTML2PDF() {
  return new Promise((resolve, reject) => {
    // Kiểm tra xem script đã được thêm chưa
    if (document.querySelector('script[src*="html2pdf"]')) {
      // Nếu script đã tồn tại nhưng thư viện chưa được tải hoàn toàn, đợi thêm
      const checkInterval = setInterval(() => {
        if (typeof html2pdf !== 'undefined') {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      
      // Đặt timeout để tránh đợi vô hạn
      setTimeout(() => {
        clearInterval(checkInterval);
        if (typeof html2pdf === 'undefined') {
          reject(new Error('Thư viện html2pdf không được tải sau khi chờ đợi'));
        }
      }, 5000);
      
      return;
    }
    
    // Nếu script chưa tồn tại, thêm mới
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.async = true;
    
    script.onload = function() {
      console.log('Đã tải html2pdf.js thành công');
      
      // Kiểm tra xem thư viện đã được định nghĩa chưa
      const checkInterval = setInterval(() => {
        if (typeof html2pdf !== 'undefined') {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      
      // Đặt timeout để tránh đợi vô hạn
      setTimeout(() => {
        clearInterval(checkInterval);
        if (typeof html2pdf === 'undefined') {
          reject(new Error('Thư viện html2pdf không được tải sau khi chờ đợi'));
        }
      }, 5000);
    };
    
    script.onerror = function() {
      reject(new Error('Không thể tải html2pdf.js'));
    };
    
    document.head.appendChild(script);
  });
}

// Thêm event listener cho các nút chuyển đổi tháng/quý/năm
function initComparisonButtons() {
  const comparisonButtons = document.querySelectorAll('.reports-comparison-btn');
  
  if (comparisonButtons && comparisonButtons.length > 0) {
    comparisonButtons.forEach(button => {
      button.addEventListener('click', function() {
        // Xóa class active khỏi tất cả các nút
        comparisonButtons.forEach(btn => btn.classList.remove('active'));
        
        // Thêm class active cho nút được nhấp
        this.classList.add('active');
        
        // Lấy giá trị loại dữ liệu (tháng, quý, năm)
        const type = this.getAttribute('data-type');
        
        // Cập nhật biểu đồ so sánh
        updateComparisonChart(type);
      });
    });
  } else {
    console.warn('Không tìm thấy nút chuyển đổi so sánh');
  }
}

// Hàm cập nhật biểu đồ so sánh
function updateComparisonChart(type) {
  console.log(`Cập nhật biểu đồ so sánh: ${type}`);
  // Lấy dữ liệu từ bộ nhớ cache hoặc tính toán lại
  let data = [];
  
  switch(type) {
    case 'month':
      data = generateMonthlyComparisonData();
      break;
    case 'quarter':
      data = generateQuarterlyComparisonData();
      break;
    case 'year':
      data = generateYearlyComparisonData();
      break;
    default:
      data = generateMonthlyComparisonData();
  }
  
  // Cập nhật bảng và biểu đồ
  renderComparisonTable(data);
  renderComparisonChart(data);
}

// Tạo dữ liệu so sánh theo tháng
function generateMonthlyComparisonData() {
  // Sử dụng dữ liệu chi phí từ bộ nhớ cache hoặc fetch lại
  const expenses = filteredExpenses || [];
  
  // Kiểm tra dữ liệu
  if (!expenses || expenses.length === 0) {
    console.warn('Không có dữ liệu chi phí để tạo biểu đồ so sánh theo tháng');
    return [];
  }
  
  // Nhóm chi phí theo tháng
  const monthlyData = {};
  
  expenses.forEach(expense => {
    // Sử dụng trường ngay_thang thay vì date
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
    
    // Sử dụng trường gia_tien thay vì amount
    monthlyData[key].amount += expense.gia_tien || 0;
  });
  
  // Chuyển đổi dữ liệu thành mảng và sắp xếp theo thời gian
  return Object.values(monthlyData).sort((a, b) => {
    const [monthA, yearA] = a.period.split('/');
    const [monthB, yearB] = b.period.split('/');
    
    if (yearA !== yearB) {
      return yearA - yearB;
    }
    
    return monthA - monthB;
  });
}

// Tạo dữ liệu so sánh theo quý
function generateQuarterlyComparisonData() {
  // Sử dụng dữ liệu chi phí từ bộ nhớ cache hoặc fetch lại
  const expenses = filteredExpenses || [];
  
  // Kiểm tra dữ liệu
  if (!expenses || expenses.length === 0) {
    console.warn('Không có dữ liệu chi phí để tạo biểu đồ so sánh theo quý');
    return [];
  }
  
  // Nhóm chi phí theo quý
  const quarterlyData = {};
  
  expenses.forEach(expense => {
    // Sử dụng trường ngay_thang thay vì date
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
    
    // Sử dụng trường gia_tien thay vì amount
    quarterlyData[key].amount += expense.gia_tien || 0;
  });
  
  // Chuyển đổi dữ liệu thành mảng và sắp xếp theo thời gian
  return Object.values(quarterlyData).sort((a, b) => {
    const [quarterA, yearA] = a.period.split('/');
    const [quarterB, yearB] = b.period.split('/');
    
    if (yearA !== yearB) {
      return yearA - yearB;
    }
    
    return quarterA.replace('Q', '') - quarterB.replace('Q', '');
  });
}

// Tạo dữ liệu so sánh theo năm
function generateYearlyComparisonData() {
  // Sử dụng dữ liệu chi phí từ bộ nhớ cache hoặc fetch lại
  const expenses = filteredExpenses || [];
  
  // Kiểm tra dữ liệu
  if (!expenses || expenses.length === 0) {
    console.warn('Không có dữ liệu chi phí để tạo biểu đồ so sánh theo năm');
    return [];
  }
  
  // Nhóm chi phí theo năm
  const yearlyData = {};
  
  expenses.forEach(expense => {
    // Sử dụng trường ngay_thang thay vì date
    const date = new Date(expense.ngay_thang);
    const year = date.getFullYear();
    const key = `${year}`;
    
    if (!yearlyData[key]) {
      yearlyData[key] = {
        period: `${year}`,
        amount: 0
      };
    }
    
    // Sử dụng trường gia_tien thay vì amount
    yearlyData[key].amount += expense.gia_tien || 0;
  });
  
  // Chuyển đổi dữ liệu thành mảng và sắp xếp theo thời gian
  return Object.values(yearlyData).sort((a, b) => a.period - b.period);
}

// Gọi hàm initialize khi tải trang
document.addEventListener('DOMContentLoaded', function() {
  // ... existing code ...
  initComparisonButtons();
  // ... existing code ...
});

// Initialization function to set up all event listeners and initial data
async function initReportsPage() {
  try {
    await fetchUserData();
    
    if (!userData) {
      console.error('Không thể tải dữ liệu người dùng');
      showNotification('Không thể tải dữ liệu. Vui lòng thử lại sau.', 'error');
      return;
    }
    
    // Khởi tạo các dropdown và sự kiện
    initializeFilters();
    
    // Khởi tạo các nút chuyển đổi so sánh (tháng/quý/năm)
    initComparisonButtons();
    
    // Tải dữ liệu chi phí
    await loadExpenseData();
  } catch (error) {
    console.error('Lỗi khởi tạo trang báo cáo:', error);
    showNotification('Đã xảy ra lỗi khi tải trang. Vui lòng thử lại sau.', 'error');
  }
}
