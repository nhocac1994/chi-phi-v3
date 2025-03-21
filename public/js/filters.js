/**
 * Xử lý tương tác với bộ lọc
 */

// Biến lưu trữ trạng thái bộ lọc
let activeFilters = {
  search: '',
  status: 'all',
  category: 'all'
};

// Khởi tạo khi trang được tải
document.addEventListener('DOMContentLoaded', () => {
  setupFilterListeners();
  updateActiveFilterTags();
});

// Thiết lập các sự kiện cho bộ lọc
function setupFilterListeners() {
  // Tìm kiếm
  const searchInput = document.getElementById('search-expenses');
  if (searchInput) {
    searchInput.addEventListener('input', debounce(() => {
      activeFilters.search = searchInput.value.toLowerCase();
      applyFilters();
      updateActiveFilterTags();
    }, 300));
  }

  // Lọc theo trạng thái
  const statusFilter = document.getElementById('filter-status');
  if (statusFilter) {
    statusFilter.addEventListener('change', () => {
      activeFilters.status = statusFilter.value;
      applyFilters();
      updateActiveFilterTags();
    });
  }

  // Lọc theo danh mục
  const categoryFilter = document.getElementById('filter-category');
  if (categoryFilter) {
    categoryFilter.addEventListener('change', () => {
      activeFilters.category = categoryFilter.value;
      applyFilters();
      updateActiveFilterTags();
    });
  }

  // Xóa bộ lọc
  const clearFiltersBtn = document.getElementById('clear-filters');
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', clearAllFilters);
  }
}

// Áp dụng bộ lọc
function applyFilters() {
  const rows = document.querySelectorAll('.expense-row');
  let visibleCount = 0;

  rows.forEach(row => {
    const title = row.querySelector('.expense-title')?.textContent.toLowerCase() || '';
    const status = row.dataset.status;
    const category = row.dataset.category;

    const matchesSearch = !activeFilters.search || title.includes(activeFilters.search);
    const matchesStatus = activeFilters.status === 'all' || status === activeFilters.status;
    const matchesCategory = activeFilters.category === 'all' || category === activeFilters.category;

    if (matchesSearch && matchesStatus && matchesCategory) {
      row.style.display = '';
      visibleCount++;
    } else {
      row.style.display = 'none';
    }
  });

  updateFilterCounter(visibleCount, rows.length);
}

// Cập nhật số lượng kết quả lọc
function updateFilterCounter(visible, total) {
  const counter = document.getElementById('filter-counter');
  if (counter) {
    counter.textContent = `Hiển thị ${visible}/${total} chi phí`;
  }
}

// Cập nhật tags hiển thị bộ lọc đang áp dụng
function updateActiveFilterTags() {
  const container = document.getElementById('active-filters');
  if (!container) return;

  container.innerHTML = '';
  
  // Thêm tag tìm kiếm
  if (activeFilters.search) {
    addFilterTag(container, 'Tìm kiếm', activeFilters.search, () => {
      document.getElementById('search-expenses').value = '';
      activeFilters.search = '';
      applyFilters();
      updateActiveFilterTags();
    });
  }

  // Thêm tag trạng thái
  if (activeFilters.status !== 'all') {
    const statusText = document.querySelector(`#filter-status option[value="${activeFilters.status}"]`)?.textContent;
    addFilterTag(container, 'Trạng thái', statusText, () => {
      document.getElementById('filter-status').value = 'all';
      activeFilters.status = 'all';
      applyFilters();
      updateActiveFilterTags();
    });
  }

  // Thêm tag danh mục
  if (activeFilters.category !== 'all') {
    const categoryText = document.querySelector(`#filter-category option[value="${activeFilters.category}"]`)?.textContent;
    addFilterTag(container, 'Danh mục', categoryText, () => {
      document.getElementById('filter-category').value = 'all';
      activeFilters.category = 'all';
      applyFilters();
      updateActiveFilterTags();
    });
  }
}

// Thêm tag filter
function addFilterTag(container, type, value, onRemove) {
  const tag = document.createElement('div');
  tag.className = 'filter-tag';
  tag.innerHTML = `
    <span>${type}: ${value}</span>
    <i class="bi bi-x"></i>
  `;
  
  tag.querySelector('i').addEventListener('click', onRemove);
  container.appendChild(tag);
}

// Xóa tất cả bộ lọc
function clearAllFilters() {
  // Reset các giá trị input
  document.getElementById('search-expenses').value = '';
  document.getElementById('filter-status').value = 'all';
  document.getElementById('filter-category').value = 'all';

  // Reset trạng thái bộ lọc
  activeFilters = {
    search: '',
    status: 'all',
    category: 'all'
  };

  // Cập nhật UI
  applyFilters();
  updateActiveFilterTags();

  // Hiển thị thông báo
  showSuccess('Đã xóa tất cả bộ lọc');
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

// Hiển thị thông báo thành công
function showSuccess(message) {
  Toastify({
    text: message,
    duration: 3000,
    gravity: "top",
    position: "right",
    backgroundColor: CONFIG.colors.success,
    stopOnFocus: true
  }).showToast();
} 