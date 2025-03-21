// Flag để ngăn gọi loadDashboardData nhiều lần đồng thời
let isLoadingDashboard = false;

function debugDashboardElements() {
  console.log('=== DEBUG DASHBOARD ELEMENTS ===');
  
  const filterSection = document.getElementById('dashboard-filter-section');
  console.log('Filter Section:', filterSection ? 'Tìm thấy' : 'Không tìm thấy');
  
  const filterControls = document.getElementById('filter-controls-container');
  console.log('Filter Controls:', filterControls ? 'Tìm thấy' : 'Không tìm thấy');
  
  const statusFilter = document.getElementById('status-filter');
  console.log('Status Filter:', statusFilter ? 'Tìm thấy' : 'Không tìm thấy');
  
  const categoryFilter = document.getElementById('category-filter');
  console.log('Category Filter:', categoryFilter ? 'Tìm thấy' : 'Không tìm thấy');
  
  const quickDateButtons = document.querySelectorAll('.quick-date-btn');
  console.log('Quick Date Buttons:', quickDateButtons.length);
  
  const dateFrom = document.getElementById('date-from');
  console.log('Date From:', dateFrom ? 'Tìm thấy' : 'Không tìm thấy');
  
  const dateTo = document.getElementById('date-to');
  console.log('Date To:', dateTo ? 'Tìm thấy' : 'Không tìm thấy');
  
  const resetButton = document.getElementById('reset-filter');
  console.log('Reset Button:', resetButton ? 'Tìm thấy' : 'Không tìm thấy');
  
  console.log('=== END DEBUG ===');
}

async function loadDashboardData(isQuickFilter) {
  // Nếu đang tải dữ liệu, bỏ qua lệnh gọi mới
  if (isLoadingDashboard) {
    console.log('=== ĐANG TẢI DỮ LIỆU DASHBOARD, BỎ QUA LỆNh GỌI MỚI ===');
    return;
  }
  
  console.log('=== ĐANG TẢI DỮ LIỆU DASHBOARD ===');
  
  // Đặt flag để tránh gọi nhiều lần
  isLoadingDashboard = true;
  
  try {
    showLoading(true);
    
    // Reset biểu đồ cũ trước khi tải dữ liệu mới
    console.log('Reset biểu đồ trước khi tải dữ liệu mới');
    ensureChartReset();
    
    const filters = getCurrentFilters();
    
    // Nếu đang sử dụng bộ lọc nhanh, đảm bảo không có startDate và endDate
    if (isQuickFilter === true) {
      delete filters.startDate;
      delete filters.endDate;
      console.log('Đang sử dụng bộ lọc nhanh, đã xóa startDate và endDate');
    }
    
    // Kiểm tra và log thông tin về period
    if (filters.period) {
      console.log(`Đang lọc theo period: ${filters.period}`);
    } else {
      console.log('Không có period được chỉ định, sử dụng startDate và endDate');
    }
    
    if (filters.startDate && filters.endDate) {
      const startDate = new Date(filters.startDate);
      const endDate = new Date(filters.endDate);
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        showToast('Ngày tháng không hợp lệ, sử dụng ngày mặc định', 'warning');
        resetFilters();
        return;
      }
      
      if (startDate > endDate) {
        showToast('Ngày bắt đầu không thể lớn hơn ngày kết thúc', 'warning');
        const temp = filters.startDate;
        filters.startDate = filters.endDate;
        filters.endDate = temp;
        
        const dateFrom = document.getElementById('date-from');
        const dateTo = document.getElementById('date-to');
        if (dateFrom) dateFrom.value = filters.startDate;
        if (dateTo) dateTo.value = filters.endDate;
      }
    }
    
    console.log('Đang tải dữ liệu dashboard với bộ lọc:', filters);
    
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value);
    });
    const [
      summaryResponse, 
      timelineResponse, 
      categoriesResponse,
      recentResponse,
      recurringResponse
    ] = await Promise.allSettled([
      fetch(`/api/dashboard/summary?${params}`),
      fetch(`/api/dashboard/timeline?${params}`),
      fetch(`/api/dashboard/categories?${params}`),
      fetch(`/api/dashboard/recent?${params}`),
      fetch(`/api/dashboard/recurring?${params}`)
    ]);
    
    if (summaryResponse.status === 'fulfilled') {
      if (summaryResponse.value.ok) {
        const summaryData = await summaryResponse.value.json();
        console.log('Dữ liệu tổng quan:', summaryData);
        
        // Lưu lại thông tin tổng chi phí để sử dụng sau này
        window.currentMonthTotal = summaryData.currentMonthTotal || 0;
        
        renderSummaryCards(summaryData);
      } else {
        const errorData = await summaryResponse.value.json().catch(() => ({ error: 'Lỗi không xác định' }));
        console.error('Lỗi khi tải dữ liệu tổng quan:', errorData);
        showErrorMessage('summary-cards', `Không thể tải dữ liệu tổng quan: ${errorData.message || errorData.error || 'Lỗi không xác định'}`);
      }
    } else {
      console.error('Lỗi khi tải dữ liệu tổng quan:', summaryResponse.reason);
      showErrorMessage('summary-cards', 'Không thể tải dữ liệu tổng quan');
    }
    
    if (timelineResponse.status === 'fulfilled') {
      if (timelineResponse.value.ok) {
        const timelineData = await timelineResponse.value.json();
        console.log('Dữ liệu timeline nhận được:', timelineData);
        
        // Kiểm tra kỹ hơn dữ liệu timeline
        let hasValidData = false;
        let expenses = [];
        
        if (Array.isArray(timelineData)) {
          expenses = timelineData.filter(exp => (exp.amount || exp.gia_tien || 0) > 0);
          hasValidData = expenses.length > 0;
        } else if (timelineData.expenses && Array.isArray(timelineData.expenses)) {
          expenses = timelineData.expenses.filter(exp => (exp.amount || exp.gia_tien || 0) > 0);
          hasValidData = expenses.length > 0;
        }
        
        console.log('Timeline data sau khi lọc:', { hasValidData, count: expenses.length, expenses });
        
        if (!hasValidData) {
          console.log('Không có dữ liệu timeline hợp lệ trong khoảng thời gian này, hiển thị biểu đồ thời gian trống');
          showEmptyState('timeline-chart-container', 'Không có chi phí trong khoảng thời gian đã chọn');
        } else {
          // Nếu có chi phí, hiển thị biểu đồ thời gian
          console.log('Có dữ liệu timeline hợp lệ, hiển thị biểu đồ thời gian');
          renderTimelineChart(expenses);
        }
      } else {
        const errorData = await timelineResponse.value.json().catch(() => ({ error: 'Lỗi không xác định' }));
        console.error('Lỗi khi tải dữ liệu timeline:', errorData);
        showErrorMessage('timeline-chart-container', `Không thể tải dữ liệu biểu đồ thời gian: ${errorData.message || errorData.error || 'Lỗi không xác định'}`);
      }
    } else {
      console.error('Lỗi khi tải dữ liệu timeline:', timelineResponse.reason);
      showErrorMessage('timeline-chart-container', 'Không thể tải dữ liệu biểu đồ thời gian');
    }
    
    if (categoriesResponse.status === 'fulfilled') {
      if (categoriesResponse.value.ok) {
        const categoriesData = await categoriesResponse.value.json();
        console.log('Dữ liệu danh mục nhận được:', categoriesData);
        
        // Kiểm tra kỹ hơn dữ liệu danh mục
        let hasValidData = false;
        let categories = [];
        
        if (Array.isArray(categoriesData)) {
          categories = categoriesData.filter(cat => (cat.value || 0) > 0);
          hasValidData = categories.length > 0;
        } else if (categoriesData.categories && Array.isArray(categoriesData.categories)) {
          categories = categoriesData.categories.filter(cat => (cat.value || cat.amount || 0) > 0);
          hasValidData = categories.length > 0;
        }
        
        console.log('Categories data sau khi lọc:', { hasValidData, count: categories.length, categories });
        
        if (!hasValidData) {
          console.log('Không có dữ liệu danh mục hợp lệ trong khoảng thời gian này, hiển thị biểu đồ danh mục trống');
          showEmptyState('categories-chart-container', 'Không có chi phí trong khoảng thời gian đã chọn');
        } else {
          // Nếu có chi phí, hiển thị biểu đồ danh mục
          console.log('Có dữ liệu danh mục hợp lệ, hiển thị biểu đồ danh mục');
          renderCategoriesChart(categories);
        }
      } else {
        const errorData = await categoriesResponse.value.json().catch(() => ({ error: 'Lỗi không xác định' }));
        console.error('Lỗi khi tải dữ liệu danh mục:', errorData);
        showErrorMessage('categories-chart-container', `Không thể tải dữ liệu biểu đồ danh mục: ${errorData.message || errorData.error || 'Lỗi không xác định'}`);
      }
    } else {
      console.error('Lỗi khi tải dữ liệu danh mục:', categoriesResponse.reason);
      showErrorMessage('categories-chart-container', 'Không thể tải dữ liệu biểu đồ danh mục');
    }
    
    if (recentResponse.status === 'fulfilled') {
      if (recentResponse.value.ok) {
        const recentData = await recentResponse.value.json();
        console.log('Dữ liệu chi phí gần đây:', recentData);
        renderRecentExpenses(recentData.expenses || []);
      } else {
        const errorData = await recentResponse.value.json().catch(() => ({ error: 'Lỗi không xác định' }));
        console.error('Lỗi khi tải dữ liệu chi phí gần đây:', errorData);
        showErrorMessage('recent-expenses-grid', `Không thể tải dữ liệu chi phí gần đây: ${errorData.message || errorData.error || 'Lỗi không xác định'}`);
      }
    } else {
      console.error('Lỗi khi tải dữ liệu chi phí gần đây:', recentResponse.reason);
      showErrorMessage('recent-expenses-grid', 'Không thể tải dữ liệu chi phí gần đây');
    }
    
    if (recurringResponse.status === 'fulfilled') {
      if (recurringResponse.value.ok) {
        const recurringData = await recurringResponse.value.json();
        console.log('Dữ liệu chi phí định kỳ:', recurringData);
        renderRecurringExpenses(recurringData.expenses || []);
      } else {
        const errorData = await recurringResponse.value.json().catch(() => ({ error: 'Lỗi không xác định' }));
        console.error('Lỗi khi tải dữ liệu chi phí định kỳ:', errorData);
        showErrorMessage('upcoming-recurring-expenses', `Không thể tải dữ liệu chi phí định kỳ: ${errorData.message || errorData.error || 'Lỗi không xác định'}`);
      }
    } else {
      console.error('Lỗi khi tải dữ liệu chi phí định kỳ:', recurringResponse.reason);
      showErrorMessage('upcoming-recurring-expenses', 'Không thể tải dữ liệu chi phí định kỳ');
    }
  } catch (error) {
    console.error('Lỗi khi tải dữ liệu dashboard:', error);
    showToast('Đã xảy ra lỗi khi tải dữ liệu dashboard', 'error');
  } finally {
    showLoading(false);
    // Đặt lại flag sau khi hoàn thành
    isLoadingDashboard = false;
  }
}

function showErrorMessage(containerId, message) {
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = `
      <div class="alert alert-danger text-center w-100 my-3">
        <i class="bi bi-exclamation-triangle me-2"></i>
        ${message}
      </div>
    `;
  }
}

function showEmptyState(containerId, message) {
  const container = document.getElementById(containerId);
  if (container) {
    // Lưu lại canvas trước khi xóa nội dung
    let timelineCanvas = null;
    let categoryCanvas = null;
    
    if (containerId === 'timeline-chart-container') {
      timelineCanvas = document.getElementById('expenses-timeline');
    } else if (containerId === 'categories-chart-container') {
      categoryCanvas = document.getElementById('category-distribution');
    }
    
    // Hiển thị trạng thái trống
    container.innerHTML = `
      <div class="empty-state text-center w-100 my-3">
        <i class="bi bi-inbox text-muted fs-1 mb-2"></i>
        <p class="text-muted">${message}</p>
      </div>
    `;
    
    // Reset biểu đồ tương ứng khi hiển thị trạng thái trống
    if (containerId === 'timeline-chart-container') {
      console.log('Xóa biểu đồ thời gian cũ trong showEmptyState');
      if (window.timelineChart instanceof Chart) {
        window.timelineChart.destroy();
        window.timelineChart = null;
      }
      
      // Tạo lại canvas cho biểu đồ thời gian
      if (timelineCanvas) {
        const newCanvas = document.createElement('canvas');
        newCanvas.id = 'expenses-timeline';
        if (timelineCanvas.width) newCanvas.width = timelineCanvas.width;
        if (timelineCanvas.height) newCanvas.height = timelineCanvas.height;
        if (timelineCanvas.className) newCanvas.className = timelineCanvas.className;
        container.appendChild(newCanvas);
      }
    }
    
    if (containerId === 'categories-chart-container') {
      console.log('Xóa biểu đồ danh mục cũ trong showEmptyState');
      if (window.categoryChart instanceof Chart) {
        window.categoryChart.destroy();
        window.categoryChart = null;
      }
      
      // Tạo lại canvas cho biểu đồ danh mục
      if (categoryCanvas) {
        const newCanvas = document.createElement('canvas');
        newCanvas.id = 'category-distribution';
        if (categoryCanvas.width) newCanvas.width = categoryCanvas.width;
        if (categoryCanvas.height) newCanvas.height = categoryCanvas.height;
        if (categoryCanvas.className) newCanvas.className = categoryCanvas.className;
        container.appendChild(newCanvas);
      }
    }
  }
}

// Sửa hàm getCurrentFilters để xử lý đúng các trường hợp
function getCurrentFilters() {
  const filters = {};
  
  // Kiểm tra xem có đang sử dụng period không
  const activePeriodBtn = document.querySelector('.quick-date-btn.active');
  
  if (activePeriodBtn) {
    // Ưu tiên sử dụng period từ nút active
    filters.period = activePeriodBtn.dataset.period;
    console.log(`Đang sử dụng period từ nút active: ${filters.period}`);
    
    // Khi có period từ nút active, không dùng startDate và endDate
    console.log('Có period từ nút active, không sử dụng startDate và endDate');
    
    // Trả về ngay, không thêm startDate và endDate
    
    // Thêm các bộ lọc khác
    addFiltersFromDropdowns(filters);
    
    return filters;
  }
  
  // Nếu không có nút active, thử lấy từ localStorage
  const savedPeriod = localStorage.getItem('dashboard_period');
  if (savedPeriod) {
    filters.period = savedPeriod;
    console.log(`Đang sử dụng period từ localStorage: ${filters.period}`);
    
    // Khi có period từ localStorage, cũng không dùng startDate và endDate
    console.log('Có period từ localStorage, không sử dụng startDate và endDate');
    
    // Thêm các bộ lọc khác
    addFiltersFromDropdowns(filters);
    
    return filters;
  }
  
  // Nếu không có period, sử dụng startDate và endDate
  const dateFrom = document.getElementById('date-from');
  const dateTo = document.getElementById('date-to');
  
  if (dateFrom && dateFrom.value) {
    filters.startDate = dateFrom.value;
  } else {
    const savedStartDate = localStorage.getItem('dashboard_start_date');
    if (savedStartDate) filters.startDate = savedStartDate;
  }
  
  if (dateTo && dateTo.value) {
    filters.endDate = dateTo.value;
  } else {
    const savedEndDate = localStorage.getItem('dashboard_end_date');
    if (savedEndDate) filters.endDate = savedEndDate;
  }
  
  // Thêm các bộ lọc khác
  addFiltersFromDropdowns(filters);
  
  console.log('Bộ lọc hiện tại:', filters);
  return filters;
}

// Hàm trợ giúp để thêm các bộ lọc từ dropdown
function addFiltersFromDropdowns(filters) {
  // Thêm các bộ lọc khác (status, category)
  const statusFilter = document.getElementById('status-filter');
  if (statusFilter && statusFilter.value && statusFilter.value !== 'all') {
    filters.status = statusFilter.value;
  }
  
  const categoryFilter = document.getElementById('category-filter');
  if (categoryFilter && categoryFilter.value && categoryFilter.value !== 'all') {
    filters.category = categoryFilter.value;
  }
}

// Hàm xử lý bộ lọc nhanh (today, week, month, year)
function setQuickDateFilter(period) {
  const today = new Date();
  
  // Xóa lớp active khỏi tất cả các nút
  document.querySelectorAll('.quick-date-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Đánh dấu nút được chọn là active
  try {
    document.querySelector(`[data-period="${period}"]`).classList.add('active');
  } catch (error) {
    console.error(`Không tìm thấy nút với data-period="${period}"`, error);
  }
  
  // Xóa giá trị ngày tùy chỉnh
  const dateFrom = document.getElementById('date-from');
  const dateTo = document.getElementById('date-to');
  if (dateFrom) dateFrom.value = "";
  if (dateTo) dateTo.value = "";
  
  // Lưu period vào localStorage
  localStorage.setItem('dashboard_period', period);
  
  // Xóa các giá trị startDate và endDate trong localStorage
  localStorage.removeItem('dashboard_start_date');
  localStorage.removeItem('dashboard_end_date');
  
  // Lưu vào biến toàn cục nếu có
  window.currentPeriod = period;
  if (window.dashboardFilter) {
    window.dashboardFilter.period = period;
    delete window.dashboardFilter.startDate;
    delete window.dashboardFilter.endDate;
  }
  
  // Tải dữ liệu dashboard chỉ với period
  loadDashboardData(true);
}

// Hàm xử lý bộ lọc theo ngày cụ thể
function setCustomDateFilter(startDate, endDate) {
  // Xóa lớp active khỏi tất cả các nút lọc nhanh
  document.querySelectorAll('.quick-date-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Thiết lập giá trị cho các trường ngày
  const dateFrom = document.getElementById('date-from');
  const dateTo = document.getElementById('date-to');
  
  if (dateFrom) dateFrom.value = formatDateForInput(startDate);
  if (dateTo) dateTo.value = formatDateForInput(endDate);
  
  // Xóa period từ localStorage
  localStorage.removeItem('dashboard_period');
  
  // Lưu startDate và endDate vào localStorage
  localStorage.setItem('dashboard_start_date', formatDateForInput(startDate));
  localStorage.setItem('dashboard_end_date', formatDateForInput(endDate));
  
  // Lưu vào biến toàn cục nếu có
  if (window.dashboardFilter) {
    delete window.dashboardFilter.period;
    window.dashboardFilter.startDate = formatDateForInput(startDate);
    window.dashboardFilter.endDate = formatDateForInput(endDate);
  }
  
  // Tải dữ liệu dashboard với startDate và endDate
  loadDashboardData(false);
}

function formatDateForInput(date) {
  return date.toISOString().split('T')[0];
}

function showLoading(isLoading) {
  const loadingOverlay = document.getElementById('loading-overlay');
  if (loadingOverlay) {
    loadingOverlay.style.display = isLoading ? 'flex' : 'none';
  }
}
// hiển thị toast
function showToast(message, type = 'info') {
  console.log(`Toast: ${message} (${type})`);
  
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.className = 'position-fixed bottom-0 end-0 p-3';
    toastContainer.style.zIndex = '5';
    document.body.appendChild(toastContainer);
  }
  
  // Tạo toast
  const toast = document.createElement('div');
  toast.className = `toast align-items-center text-white bg-${type}`;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'assertive');
  toast.setAttribute('aria-atomic', 'true');
  
  toast.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">
        ${message}
      </div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
    </div>
  `;
  
  toastContainer.appendChild(toast);
  
  // Hiển thị toast
  try {
    // Thử sử dụng Bootstrap nếu có
    if (typeof bootstrap !== 'undefined') {
      const bsToast = new bootstrap.Toast(toast, { delay: 3000 });
      bsToast.show();
    } else {
      // Fallback nếu không có Bootstrap
      toast.style.display = 'block';
      toast.style.opacity = '1';
      
      // Tự động ẩn sau 3 giây
      setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
          toast.remove();
        }, 300);
      }, 3000);
      
      // Xử lý nút đóng
      const closeBtn = toast.querySelector('.btn-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          toast.style.opacity = '0';
          setTimeout(() => {
            toast.remove();
          }, 300);
        });
      }
    }
  } catch (error) {
    console.error('Lỗi khi hiển thị toast:', error);
    // Fallback đơn giản
    alert(message);
  }
  
  // Xóa toast sau khi ẩn
  toast.addEventListener('hidden.bs.toast', () => {
    toast.remove();
  });
}

// Khởi tạo dashboard
function initDashboard() {
  console.log('Đang khởi tạo dashboard...');
  
  // Debug DOM elements
  debugDashboardElements();
  
  // Xóa các dữ liệu cũ từ localStorage có thể gây xung đột
  localStorage.removeItem('dashboard_start_date');
  localStorage.removeItem('dashboard_end_date');
  
  // Thiết lập period mặc định là "month"
  localStorage.setItem('dashboard_period', 'month');
  
  // Thiết lập ngày mặc định (tháng hiện tại)
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  
  const dateFrom = document.getElementById('date-from');
  const dateTo = document.getElementById('date-to');
  
  if (dateFrom) {
    console.log('Tìm thấy trường date-from');
    dateFrom.value = ''; // Xóa giá trị mặc định
  } else {
    console.error('Không tìm thấy trường date-from');
  }
  
  if (dateTo) {
    console.log('Tìm thấy trường date-to');
    dateTo.value = ''; // Xóa giá trị mặc định
  } else {
    console.error('Không tìm thấy trường date-to');
  }
  
  // Đánh dấu nút "Tháng này" là active mặc định và cập nhật dropdown
  const monthBtn = document.getElementById('month-btn');
  const timeFilterDropdown = document.getElementById('time-filter-dropdown');
  if (monthBtn) {
    console.log('Tìm thấy nút tháng này');
    // Xóa lớp active khỏi tất cả các nút
    document.querySelectorAll('.quick-date-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    
    // Thêm lớp active cho nút tháng này
    monthBtn.classList.add('active');
    
    if (timeFilterDropdown) {
      const icon = monthBtn.querySelector('i')?.className || 'bi bi-calendar-month';
      timeFilterDropdown.innerHTML = `<span><i class="${icon}"></i> Tháng này</span><i class="bi bi-chevron-down"></i>`;
    }
  } else {
    console.error('Không tìm thấy nút tháng này');
  }
  
  // Thiết lập sự kiện cho các nút lọc nhanh
  document.getElementById('today-btn')?.addEventListener('click', handleQuickDateClick);
  document.getElementById('week-btn')?.addEventListener('click', handleQuickDateClick);
  document.getElementById('month-btn')?.addEventListener('click', handleQuickDateClick);
  document.getElementById('year-btn')?.addEventListener('click', handleQuickDateClick);
  
  // Thiết lập sự kiện cho nút tùy chỉnh
  document.getElementById('custom-date-btn')?.addEventListener('click', handleCustomDateClick);
  document.getElementById('apply-custom-date')?.addEventListener('click', handleApplyCustomDate);
  
  // Thiết lập sự kiện cho bộ lọc trạng thái
  const statusFilter = document.getElementById('status-filter');
  if (statusFilter) {
    console.log('Tìm thấy bộ lọc trạng thái');
    statusFilter.addEventListener('change', handleFilterChange);
  } else {
    console.error('Không tìm thấy bộ lọc trạng thái');
  }
  
  // Thiết lập sự kiện cho bộ lọc danh mục
  const categoryFilter = document.getElementById('category-filter');
  if (categoryFilter) {
    console.log('Tìm thấy bộ lọc danh mục');
    categoryFilter.addEventListener('change', handleFilterChange);
  } else {
    console.error('Không tìm thấy bộ lọc danh mục');
  }
  
  // Thiết lập sự kiện cho nút đặt lại bộ lọc
  const resetFilterBtn = document.getElementById('reset-filter');
  if (resetFilterBtn) {
    console.log('Tìm thấy nút đặt lại bộ lọc');
    resetFilterBtn.addEventListener('click', handleResetClick);
  } else {
    console.error('Không tìm thấy nút đặt lại bộ lọc');
  }
  
  console.log('Hoàn tất khởi tạo dashboard, tải dữ liệu ban đầu...');
  // Tải dữ liệu ban đầu
  loadDashboardData();
}

// Đảm bảo biểu đồ được khởi tạo lại đúng cách
function ensureChartReset() {
  console.log('Đảm bảo biểu đồ được khởi tạo lại đúng cách');
  
  // Xóa biểu đồ cũ
  resetCharts();
  
  // Đảm bảo canvas tồn tại
  ensureCanvasExists('timeline-chart-container', 'expenses-timeline');
  ensureCanvasExists('categories-chart-container', 'category-distribution');
}

// Đảm bảo canvas tồn tại
function ensureCanvasExists(containerId, canvasId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  let canvas = document.getElementById(canvasId);
  if (!canvas) {
    console.log(`Tạo mới canvas ${canvasId}`);
    canvas = document.createElement('canvas');
    canvas.id = canvasId;
    container.appendChild(canvas);
  }
}

// Xử lý sự kiện khi nhấn nút lọc nhanh
function handleQuickDateClick(e) {
  e.preventDefault();
  
  // Kiểm tra nếu nút đã active, không làm gì cả
  if (this.classList.contains('active')) {
    console.log('Nút đã active, bỏ qua');
    return;
  }
  
  console.log('Nút lọc nhanh được nhấn:', this.dataset.period);
  
  // Đảm bảo biểu đồ được khởi tạo lại đúng cách
  ensureChartReset();
  
  // Ẩn khu vực tùy chỉnh thời gian
  const customDateContainer = document.getElementById('custom-date-container');
  if (customDateContainer) {
    customDateContainer.style.display = 'none';
  }
  
  // Xóa giá trị date input khi sử dụng bộ lọc nhanh
  const dateFrom = document.getElementById('date-from');
  const dateTo = document.getElementById('date-to');
  if (dateFrom) dateFrom.value = '';
  if (dateTo) dateTo.value = '';
  
  // Xóa dữ liệu từ localStorage
  localStorage.removeItem('dashboard_start_date');
  localStorage.removeItem('dashboard_end_date');
  
  // Đánh dấu nút được chọn là active
  document.querySelectorAll('.quick-date-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  this.classList.add('active');
  
  // Lưu period hiện tại
  localStorage.setItem('dashboard_period', this.dataset.period);
  
  // Lưu vào biến toàn cục nếu có
  window.currentPeriod = this.dataset.period;
  if (window.dashboardFilter) {
    window.dashboardFilter.period = this.dataset.period;
    delete window.dashboardFilter.startDate;
    delete window.dashboardFilter.endDate;
  }
  
  // Cập nhật text của dropdown sau khi set active
  const timeFilterDropdown = document.getElementById('time-filter-dropdown');
  if (timeFilterDropdown) {
    const icon = this.querySelector('i')?.className || '';
    timeFilterDropdown.innerHTML = `<span><i class="${icon}"></i> ${this.textContent.trim()}</span><i class="bi bi-chevron-down"></i>`;
  }
  
  // Tải dữ liệu với chỉ period, không có startDate và endDate
  loadDashboardData(true);
}

// Xử lý sự kiện khi nhấn nút tùy chỉnh
function handleCustomDateClick(e) {
  e.preventDefault();
  console.log('Nút tùy chỉnh được nhấn');
  
  // Hiển thị khu vực tùy chỉnh thời gian
  const customDateContainer = document.getElementById('custom-date-container');
  if (customDateContainer) {
    customDateContainer.style.display = 'flex';
  }
  
  // Xóa active class từ tất cả các nút lọc nhanh
  document.querySelectorAll('.quick-date-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Cập nhật text của dropdown
  const timeFilterDropdown = document.getElementById('time-filter-dropdown');
  if (timeFilterDropdown) {
    timeFilterDropdown.textContent = 'Tùy chỉnh';
  }
  
  // Xóa period từ localStorage
  localStorage.removeItem('dashboard_period');
}

// Hàm xử lý khi nhấn nút áp dụng tùy chỉnh
function handleApplyCustomDate(e) {
  if (e) e.preventDefault();
  console.log('Nút áp dụng tùy chỉnh được nhấn');
  
  const dateFrom = document.getElementById('date-from');
  const dateTo = document.getElementById('date-to');
  
  if (!dateFrom || !dateFrom.value || !dateTo || !dateTo.value) {
    showToast('Vui lòng chọn ngày bắt đầu và ngày kết thúc', 'warning');
    return;
  }
  
  const startDate = new Date(dateFrom.value);
  const endDate = new Date(dateTo.value);
  
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    showToast('Ngày không hợp lệ', 'warning');
    return;
  }
  
  if (startDate > endDate) {
    showToast('Ngày bắt đầu không thể sau ngày kết thúc', 'warning');
    return;
  }
  
  // Đảm bảo biểu đồ được khởi tạo lại đúng cách
  ensureChartReset();
  
  // Sử dụng hàm lọc tùy chỉnh
  setCustomDateFilter(startDate, endDate);
}

// Xử lý sự kiện khi thay đổi bộ lọc dropdown
function handleFilterChange(e) {
  console.log('Bộ lọc thay đổi:', this.id, this.value);
  
  // Đảm bảo biểu đồ được khởi tạo lại đúng cách
  ensureChartReset();
  
  loadDashboardData();
}

// Xử lý sự kiện khi nhấn nút đặt lại
function handleResetClick(e) {
  e.preventDefault();
  console.log('Đặt lại bộ lọc');
  
  // Đảm bảo biểu đồ được khởi tạo lại đúng cách
  ensureChartReset();
  
  resetFilters();
}

// Đặt lại tất cả các bộ lọc về mặc định
function resetFilters() {
  // Đặt lại bộ lọc trạng thái và danh mục
  const statusFilter = document.getElementById('status-filter');
  const categoryFilter = document.getElementById('category-filter');
  
  if (statusFilter) statusFilter.value = 'all';
  if (categoryFilter) categoryFilter.value = 'all';
  
  // Đặt lại bộ lọc thời gian về tháng hiện tại
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  
  const dateFrom = document.getElementById('date-from');
  const dateTo = document.getElementById('date-to');
  
  if (dateFrom) dateFrom.value = formatDateForInput(firstDayOfMonth);
  if (dateTo) dateTo.value = formatDateForInput(today);
  
  // Xóa active class từ tất cả các nút lọc nhanh
  document.querySelectorAll('.quick-date-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Đánh dấu nút "Tháng này" là active
  const monthBtn = document.querySelector('[data-period="month"]');
  if (monthBtn) monthBtn.classList.add('active');
  
  // Cập nhật text của dropdown
  const timeFilterDropdown = document.getElementById('time-filter-dropdown');
  if (timeFilterDropdown) {
    timeFilterDropdown.textContent = 'Tháng này';
  }
  
  // Ẩn khu vực tùy chỉnh thời gian
  const customDateContainer = document.getElementById('custom-date-container');
  if (customDateContainer) {
    customDateContainer.style.display = 'none';
  }
  
  // Tải lại dữ liệu dashboard
  loadDashboardData();
}

// Hiển thị thẻ tổng quan
function renderSummaryCards(data) {
  console.log('Đang hiển thị thẻ tổng quan:', data);
  
  // Hiển thị tổng chi phí tháng này
  const totalMonthElement = document.getElementById('total-month-expenses');
  if (totalMonthElement) {
    totalMonthElement.textContent = formatCurrency(data.currentMonthTotal || 0);
  }
  
  // Hiển thị phần trăm thay đổi
  const changeElement = document.getElementById('month-expenses-change');
  if (changeElement) {
    const percentChange = data.percentChange || 0;
    const isIncrease = percentChange >= 0;
    
    changeElement.innerHTML = `
      <i class="bi bi-arrow-${isIncrease ? 'up' : 'down'}"></i>
      ${Math.abs(percentChange)}%
    `;
    
    changeElement.className = `stat-change ${isIncrease ? 'increase' : 'decrease'}`;
  }
  
  // Hiển thị chi phí trung bình/ngày
  const avgDailyElement = document.getElementById('average-daily-expense');
  if (avgDailyElement) {
    avgDailyElement.textContent = formatCurrency(data.averageDaily || 0);
  }
  
  // Hiển thị danh mục chi nhiều nhất
  const topCategoryElement = document.getElementById('top-category');
  const topCategoryAmountElement = document.getElementById('top-category-amount');
  
  if (data.topCategory) {
    if (topCategoryElement) {
      topCategoryElement.textContent = data.topCategory.name || '-';
    }
    
    if (topCategoryAmountElement) {
      topCategoryAmountElement.textContent = formatCurrency(data.topCategory.amount || 0);
    }
  } else {
    if (topCategoryElement) topCategoryElement.textContent = '-';
    if (topCategoryAmountElement) topCategoryAmountElement.textContent = '0 đ';
  }
}

// Hiển thị chi phí gần đây
function renderRecentExpenses(expenses) {
  console.log('Đang hiển thị chi phí gần đây:', expenses);
  
  const container = document.getElementById('recent-expenses-grid');
  if (!container) return;
  
  // Xóa nội dung hiện tại
  container.innerHTML = '';
  
  // Kiểm tra nếu không có chi phí
  if (!expenses || expenses.length === 0) {
    showEmptyState('recent-expenses-grid', 'Không có chi phí gần đây');
    return;
  }
  
  // Lấy template
  const template = document.getElementById('expense-card-template');
  if (!template) return;
  
  // Hiển thị tối đa 6 chi phí gần đây
  const recentExpenses = expenses.slice(0, 3);
  
  // Tạo các thẻ chi phí
  recentExpenses.forEach(expense => {
    const clone = template.content.cloneNode(true);
    
    // Thiết lập icon
    const iconElement = clone.querySelector('.expense-icon i');
    if (iconElement) {
      iconElement.className = `bi ${expense.category_icon || 'bi-receipt'}`;
    }
    
    // Thiết lập tiêu đề
    const titleElement = clone.querySelector('.expense-title');
    if (titleElement) {
      titleElement.textContent = expense.noi_dung || expense.title || 'Chi phí không tên';
    }
    
    // Thiết lập danh mục
    const categoryElement = clone.querySelector('.expense-category');
    if (categoryElement) {
      categoryElement.textContent = expense.danh_muc || expense.category_name || 'Không có danh mục';
    }
    
    // Thiết lập ngày
    const dateElement = clone.querySelector('.expense-date');
    if (dateElement) {
      let dateStr = 'Không có ngày';
      try {
        if (expense.ngay_thang || expense.date) {
          const expenseDate = new Date(expense.ngay_thang || expense.date);
          if (!isNaN(expenseDate.getTime())) {
            dateStr = expenseDate.toLocaleDateString('vi-VN');
          }
        }
      } catch (error) {
        console.error('Lỗi khi định dạng ngày:', error);
      }
      dateElement.textContent = dateStr;
    }
    
    // Thiết lập số tiền
    const amountElement = clone.querySelector('.expense-amount');
    if (amountElement) {
      amountElement.textContent = formatCurrency(expense.gia_tien || expense.amount || 0);
      
      // Thêm class dựa trên trạng thái
      if (expense.trang_thai === 'Chưa thanh toán' || expense.status === 'unpaid') {
        amountElement.classList.add('unpaid');
      }
    }
    
    // Thêm vào container
    container.appendChild(clone);
  });
}

// Hiển thị chi phí định kỳ
function renderRecurringExpenses(expenses) {
  console.log('Đang hiển thị chi phí định kỳ:', expenses);
  
  const container = document.getElementById('upcoming-recurring-expenses');
  if (!container) return;
  
  // Xóa nội dung hiện tại
  container.innerHTML = '';
  
  // Kiểm tra nếu không có chi phí
  if (!expenses || expenses.length === 0) {
    showEmptyState('upcoming-recurring-expenses', 'Không có chi phí định kỳ sắp đến hạn');
    return;
  }
  
  // Lấy template
  const template = document.getElementById('recurring-expense-template');
  if (!template) return;
  
  // Hiển thị tối đa 4 chi phí định kỳ
  const upcomingExpenses = expenses.slice(0, 4);
  
  // Tạo các thẻ chi phí
  upcomingExpenses.forEach(expense => {
    const clone = template.content.cloneNode(true);
    
    // Thiết lập icon
    const iconElement = clone.querySelector('.recurring-expense-icon i');
    if (iconElement) {
      iconElement.className = `bi ${expense.category_icon || 'bi-arrow-repeat'}`;
    }
    
    // Thiết lập tiêu đề
    const titleElement = clone.querySelector('.recurring-expense-title');
    if (titleElement) {
      titleElement.textContent = expense.noi_dung || expense.title || 'Chi phí không tên';
    }
    
    // Thiết lập danh mục
    const categoryElement = clone.querySelector('.recurring-expense-category');
    if (categoryElement) {
      categoryElement.textContent = expense.danh_muc || expense.category_name || 'Không có danh mục';
    }
    
    // Thiết lập tần suất
    const frequencyElement = clone.querySelector('.recurring-expense-frequency');
    if (frequencyElement) {
      frequencyElement.textContent = expense.frequency || 'Hàng tháng';
    }
    
    // Thiết lập số tiền
    const amountElement = clone.querySelector('.recurring-expense-amount');
    if (amountElement) {
      amountElement.textContent = formatCurrency(expense.gia_tien || expense.amount || 0);
    }
    
    // Thiết lập ngày đến hạn
    const dueDateElement = clone.querySelector('.due-date');
    if (dueDateElement) {
      let dateStr = 'Không có ngày';
      let dueDate = null;
      
      try {
        if (expense.ngay_thang || expense.next_date) {
          dueDate = new Date(expense.ngay_thang || expense.next_date);
          if (!isNaN(dueDate.getTime())) {
            dateStr = dueDate.toLocaleDateString('vi-VN');
          }
        }
      } catch (error) {
        console.error('Lỗi khi định dạng ngày đến hạn:', error);
      }
      
      dueDateElement.textContent = dateStr;
      
      // Thêm class nếu sắp đến hạn (trong vòng 3 ngày)
      if (dueDate) {
        const today = new Date();
        const diffTime = dueDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays <= 3 && diffDays >= 0) {
          dueDateElement.classList.add('due-soon');
        }
      }
    }
    
    // Thêm vào container
    container.appendChild(clone);
  });
}

// Hiển thị biểu đồ thời gian
function renderTimelineChart(data) {
  console.log('Đang hiển thị biểu đồ thời gian:', data);
  
  // Chuẩn bị dữ liệu
  let expenses = data;
  let total = 0;
  
  try {
    // Tính tổng chi phí
    total = expenses.reduce((sum, exp) => sum + (exp.amount || exp.gia_tien || 0), 0);
    
    // Đảm bảo có dữ liệu để hiển thị
    if (expenses.length === 0 || total === 0) {
      console.log('Không có dữ liệu thời gian hợp lệ để hiển thị biểu đồ');
      showEmptyState('timeline-chart-container', 'Không có chi phí trong khoảng thời gian đã chọn');
      return;
    }
    
    console.log('Dữ liệu thời gian đã lọc:', expenses, 'Tổng:', total);
  } catch (error) {
    console.error('Lỗi khi xử lý dữ liệu thời gian:', error);
    showErrorMessage('timeline-chart-container', 'Lỗi khi xử lý dữ liệu thời gian');
    return;
  }
  
  // Kiểm tra xem ChartSystem có tồn tại không (từ charts.js)
  if (typeof ChartSystem !== 'undefined' && ChartSystem.renderTimeChart) {
    // Sử dụng hàm từ ChartSystem
    try {
      ChartSystem.renderTimeChart(expenses);
    } catch (error) {
      console.error('Lỗi khi hiển thị biểu đồ thời gian với ChartSystem:', error);
      showErrorMessage('timeline-chart-container', 'Không thể hiển thị biểu đồ thời gian');
    }
    return;
  }
  
  // Fallback nếu ChartSystem không tồn tại
  const canvas = document.getElementById('expenses-timeline');
  if (!canvas) {
    console.error('Không tìm thấy canvas cho biểu đồ thời gian');
    return;
  }
  
  // Kiểm tra xem Chart.js có tồn tại không
  if (typeof Chart === 'undefined') {
    console.error('Chart.js chưa được tải');
    showErrorMessage('timeline-chart-container', 'Không thể tải thư viện biểu đồ');
    return;
  }
  
  const labels = expenses.map(item => {
    try {
      const date = new Date(item.date || item.ngay_thang);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
      }
      return 'Không có ngày';
    } catch (error) {
      console.error('Lỗi khi định dạng ngày cho biểu đồ:', error);
      return 'Lỗi ngày';
    }
  });
  
  const values = expenses.map(item => item.amount || item.gia_tien || 0);
  
  // Tạo biểu đồ
  const ctx = canvas.getContext('2d');
  
  // Xóa biểu đồ cũ nếu có
  if (window.timelineChart instanceof Chart) {
    window.timelineChart.destroy();
  }
  
  // Tạo biểu đồ mới
  window.timelineChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Chi phí theo ngày',
        data: values,
        backgroundColor: 'rgba(90, 103, 216, 0.5)',
        borderColor: '#5a67d8',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return formatCurrency(value);
            }
          }
        }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: function(context) {
              return formatCurrency(context.raw);
            }
          }
        }
      }
    }
  });
}

// Hiển thị biểu đồ danh mục
function renderCategoriesChart(data) {
  console.log('Đang hiển thị biểu đồ danh mục:', data);
  
  // Chuẩn bị dữ liệu
  let categories = data;
  let total = 0;
  
  try {
    // Tính tổng giá trị
    total = categories.reduce((sum, cat) => sum + (cat.value || cat.amount || 0), 0);
    
    // Đảm bảo có dữ liệu để hiển thị
    if (categories.length === 0 || total === 0) {
      console.log('Không có dữ liệu danh mục hợp lệ để hiển thị biểu đồ');
      showEmptyState('categories-chart-container', 'Không có chi phí trong khoảng thời gian đã chọn');
      return;
    }
    
    console.log('Dữ liệu danh mục đã lọc:', categories, 'Tổng:', total);
  } catch (error) {
    console.error('Lỗi khi xử lý dữ liệu danh mục:', error);
    showErrorMessage('categories-chart-container', 'Lỗi khi xử lý dữ liệu danh mục');
    return;
  }
  
  // Kiểm tra xem ChartSystem có tồn tại không (từ charts.js)
  if (typeof ChartSystem !== 'undefined' && ChartSystem.renderCategoryChart) {
    // Sử dụng hàm từ ChartSystem
    try {
      // Chuẩn bị dữ liệu cho ChartSystem
      const chartCategories = categories.map(item => ({
        name: item.name,
        value: item.value || item.amount || 0
      }));
      
      ChartSystem.renderCategoryChart(chartCategories);
    } catch (error) {
      console.error('Lỗi khi hiển thị biểu đồ danh mục với ChartSystem:', error);
      showErrorMessage('categories-chart-container', 'Không thể hiển thị biểu đồ danh mục');
    }
    return;
  }
  
  // Fallback nếu ChartSystem không tồn tại
  const canvas = document.getElementById('category-distribution');
  if (!canvas) {
    console.error('Không tìm thấy canvas cho biểu đồ danh mục');
    return;
  }
  
  // Kiểm tra xem Chart.js có tồn tại không
  if (typeof Chart === 'undefined') {
    console.error('Chart.js chưa được tải');
    showErrorMessage('categories-chart-container', 'Không thể tải thư viện biểu đồ');
    return;
  }
  
  const labels = categories.map(item => item.name || 'Không có tên');
  const values = categories.map(item => item.value || item.amount || 0);
  
  // Tạo màu ngẫu nhiên cho các danh mục
  const backgroundColors = [
    '#5a67d8', '#4c51bf', '#6b46c1', '#805ad5', '#9f7aea', '#b794f4',
    '#38b2ac', '#4fd1c5', '#81e6d9', '#3182ce', '#63b3ed', '#90cdf4'
  ];
  
  // Tạo biểu đồ
  const ctx = canvas.getContext('2d');
  
  // Xóa biểu đồ cũ nếu có
  if (window.categoryChart instanceof Chart) {
    window.categoryChart.destroy();
  }
  
  // Tạo biểu đồ mới
  window.categoryChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: labels,
      datasets: [{
        data: values,
        backgroundColor: backgroundColors.slice(0, categories.length),
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            boxWidth: 15,
            padding: 15
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const label = context.label || '';
              const value = context.raw;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
              return `${label}: ${formatCurrency(value)} (${percentage}%)`;
            }
          }
        }
      }
    }
  });
  
  // Tạo legend tùy chỉnh nếu cần
  const legendContainer = document.getElementById('category-legend');
  if (legendContainer) {
    legendContainer.innerHTML = '';
    
    categories.forEach((category, index) => {
      const color = backgroundColors[index % backgroundColors.length];
      const value = category.value || category.amount || 0;
      const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
      
      const legendItem = document.createElement('div');
      legendItem.className = 'legend-item';
      legendItem.innerHTML = `
        <div class="legend-color" style="background-color: ${color}"></div>
        <div class="legend-label">${category.name || 'Không có tên'}</div>
        <div class="legend-value">${formatCurrency(value)}</div>
        <div class="legend-percentage">${percentage}%</div>
      `;
      
      legendContainer.appendChild(legendItem);
    });
  }
}

// Format số tiền thành chuỗi tiền tệ
function formatCurrency(amount) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0
  }).format(amount).replace('₫', 'đ');
}

document.addEventListener('DOMContentLoaded', () => {
  initDashboard();
});