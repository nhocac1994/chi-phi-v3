// Khởi tạo các biến
const dropdowns = document.querySelectorAll('.reports-dropdown');
const customDateRange = document.getElementById('customDateRange');
const startDateInput = document.getElementById('startDate');
const endDateInput = document.getElementById('endDate');
const applyDateBtn = document.getElementById('applyDateBtn');

// Hàm xử lý đóng mở dropdown
function toggleDropdown(dropdown) {
  // Đóng tất cả các dropdown khác
  dropdowns.forEach(d => {
    if (d !== dropdown) {
      d.classList.remove('active');
    }
  });
  
  // Toggle dropdown hiện tại
  dropdown.classList.toggle('active');
}

// Hàm xử lý chọn item trong dropdown
function selectDropdownItem(dropdown, item) {
  const toggle = dropdown.querySelector('.reports-dropdown-toggle .reports-selected-text');
  const items = dropdown.querySelectorAll('.reports-dropdown-item');
  
  // Cập nhật text và trạng thái active
  toggle.textContent = item.textContent;
  items.forEach(i => i.classList.remove('active'));
  item.classList.add('active');
  
  // Đóng dropdown
  dropdown.classList.remove('active');
  
  // Xử lý logic đặc biệt cho từng loại dropdown
  if (dropdown.querySelector('#time-range-menu')) {
    handleTimeRangeChange(item.dataset.range);
  } else if (dropdown.querySelector('#report-type-menu')) {
    handleReportTypeChange(item.dataset.report);
  }
}

// Xử lý thay đổi loại báo cáo
function handleReportTypeChange(reportType) {
  const reports = {
    time: document.getElementById('time-report'),
    category: document.getElementById('category-report'),
    comparison: document.getElementById('comparison-report')
  };
  
  // Ẩn tất cả các báo cáo
  Object.values(reports).forEach(report => {
    if (report) report.style.display = 'none';
  });
  
  // Hiển thị báo cáo được chọn
  if (reports[reportType]) {
    reports[reportType].style.display = 'block';
    // Cập nhật dữ liệu cho báo cáo tương ứng
    updateReportData(reportType);
  }
}

// Xử lý thay đổi khoảng thời gian
function handleTimeRangeChange(range) {
  // Ẩn/hiện phần tùy chọn ngày
  customDateRange.style.display = range === 'custom' ? 'block' : 'none';
  
  if (range !== 'custom') {
    // Tự động cập nhật dữ liệu với range mới
    updateReportData(getCurrentReportType(), range);
  }
}

// Lấy loại báo cáo hiện tại
function getCurrentReportType() {
  const activeItem = document.querySelector('#report-type-menu .reports-dropdown-item.active');
  return activeItem ? activeItem.dataset.report : 'time';
}

// Khởi tạo các event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Xử lý click vào dropdown toggle
  dropdowns.forEach(dropdown => {
    const toggle = dropdown.querySelector('.reports-dropdown-toggle');
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleDropdown(dropdown);
    });
    
    // Xử lý click vào dropdown items
    const items = dropdown.querySelectorAll('.reports-dropdown-item');
    items.forEach(item => {
      item.addEventListener('click', () => selectDropdownItem(dropdown, item));
    });
  });
  
  // Đóng dropdown khi click ra ngoài
  document.addEventListener('click', () => {
    dropdowns.forEach(dropdown => dropdown.classList.remove('active'));
  });
  
  // Xử lý nút áp dụng ngày tùy chọn
  applyDateBtn.addEventListener('click', () => {
    const startDate = startDateInput.value;
    const endDate = endDateInput.value;
    
    if (startDate && endDate) {
      if (new Date(startDate) > new Date(endDate)) {
        alert('Ngày bắt đầu phải nhỏ hơn ngày kết thúc');
        return;
      }
      
      // Cập nhật dữ liệu với khoảng thời gian tùy chọn
      updateReportData(getCurrentReportType(), 'custom', {
        startDate,
        endDate
      });
    } else {
      alert('Vui lòng chọn đầy đủ ngày bắt đầu và kết thúc');
    }
  });
  
  // Thiết lập giá trị mặc định cho input date
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  
  startDateInput.value = firstDayOfMonth.toISOString().split('T')[0];
  endDateInput.value = today.toISOString().split('T')[0];
});

// Hàm cập nhật dữ liệu báo cáo
function updateReportData(reportType, timeRange, customDates) {
  console.log('Updating report data:', { reportType, timeRange, customDates });

  // Lưu các giá trị vào biến toàn cục nếu được cung cấp
  if (reportType && typeof window.currentReportType !== 'undefined') {
    window.currentReportType = reportType;
  }
  
  if (timeRange && typeof window.currentTimeRange !== 'undefined') {
    window.currentTimeRange = timeRange;
  }
  
  // Gọi hàm loadReportData từ reports.js nếu có
  if (typeof window.loadReportData === 'function') {
    // Nếu là custom date range, truyền startDate và endDate
    if (customDates && customDates.startDate && customDates.endDate) {
      window.loadReportData(customDates.startDate, customDates.endDate);
    } else {
      window.loadReportData();
    }
  } else {
    console.warn('Hàm loadReportData không tồn tại trong window. Đảm bảo reports.js đã được tải');
  }
} 