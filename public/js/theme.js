/**
 * Chi Phi App - Hệ thống chuyển đổi chế độ sáng/tối
 * Version: 1.1
 */

// Khởi tạo ThemeManager khi document sẵn sàng
document.addEventListener('DOMContentLoaded', () => {
  if (window.ThemeManager) {
    console.log('ThemeManager đã tồn tại, không khởi tạo lại');
    return;
  }

  console.log('Khởi tạo hệ thống chuyển đổi chế độ sáng/tối');
  
  // Khởi tạo ThemeManager
  window.ThemeManager = {
    // Khởi tạo hệ thống
    init() {
      // Đợi DOM sẵn sàng
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this._initialize());
      } else {
        this._initialize();
      }
    },

    // Khởi tạo nội bộ
    _initialize() {
      console.log('Khởi tạo hệ thống chuyển đổi chế độ sáng/tối');
      
      // Kiểm tra chế độ đã lưu
      this._loadSavedTheme();
      
      // Thiết lập sự kiện
      this._setupEvents();
      
      // Đảm bảo các phần tử được cập nhật đúng
      this._updateAllElements();
    },

    // Tải chế độ đã lưu
    _loadSavedTheme() {
      // Kiểm tra chế độ đã lưu trong localStorage
      const savedTheme = localStorage.getItem('theme');
      console.log('Chế độ đã lưu:', savedTheme);
      
      // Nếu có chế độ đã lưu, áp dụng
      if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
        document.body.setAttribute('data-theme', savedTheme);
        console.log('Áp dụng chế độ đã lưu:', savedTheme);
      } else {
        // Kiểm tra chế độ hệ thống
        this._checkSystemTheme();
      }
    },

    // Kiểm tra chế độ hệ thống
    _checkSystemTheme() {
      // Kiểm tra xem người dùng có thiết lập chế độ tối trên hệ thống không
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.body.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
        console.log('Áp dụng chế độ tối theo hệ thống');
      } else {
        document.documentElement.setAttribute('data-theme', 'light');
        document.body.setAttribute('data-theme', 'light');
        localStorage.setItem('theme', 'light');
        console.log('Áp dụng chế độ sáng theo hệ thống');
      }
    },

    // Thiết lập sự kiện
    _setupEvents() {
      // Tìm nút chuyển đổi trong header
      const toggleBtn = document.getElementById('theme-toggle-btn');
      if (toggleBtn) {
        console.log('Đã tìm thấy nút chuyển đổi trong header');
        // Thêm sự kiện click
        toggleBtn.addEventListener('click', () => this._toggleTheme());
        
        // Thêm sự kiện keyboard
        toggleBtn.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this._toggleTheme();
          }
        });
      } else {
        console.log('Không tìm thấy nút chuyển đổi trong header');
      }
      
      // Tìm nút chuyển đổi trong trang settings (nếu có)
      const settingsToggle = document.getElementById('theme-toggle-settings');
      if (settingsToggle) {
        console.log('Đã tìm thấy nút chuyển đổi trong trang settings');
        // Thêm sự kiện click
        settingsToggle.addEventListener('click', () => this._toggleTheme());
        
        // Thêm sự kiện keyboard
        settingsToggle.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this._toggleTheme();
          }
        });
      }
      
      // Lắng nghe sự thay đổi chế độ hệ thống
      if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
          // Chỉ tự động thay đổi nếu người dùng chưa thiết lập thủ công
          if (!localStorage.getItem('theme')) {
            const newTheme = e.matches ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', newTheme);
            document.body.setAttribute('data-theme', newTheme);
            console.log('Tự động chuyển đổi theo hệ thống sang chế độ:', newTheme);
            
            // Cập nhật tất cả các phần tử
            this._updateAllElements();
          }
        });
      }
    },

    // Cập nhật tất cả các phần tử
    _updateAllElements() {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
      console.log('Cập nhật tất cả các phần tử theo chế độ:', currentTheme);
      
      // Đặt thuộc tính data-theme cho document và body
      document.documentElement.setAttribute('data-theme', currentTheme);
      document.body.setAttribute('data-theme', currentTheme);
      
      // Cập nhật các CSS variables
      if (currentTheme === 'dark') {
        document.documentElement.style.setProperty('--primary-color', '#818cf8');
        document.documentElement.style.setProperty('--primary-color-dark', '#6366f1');
        document.documentElement.style.setProperty('--primary-color-rgb', '129, 140, 248');
        document.documentElement.style.setProperty('--text-primary', '#f9fafb');
        document.documentElement.style.setProperty('--text-secondary', '#e5e7eb');
        document.documentElement.style.setProperty('--border-color', '#374151');
        document.documentElement.style.setProperty('--surface-1', '#1f2937');
        document.documentElement.style.setProperty('--surface-2', '#111827');
        document.documentElement.style.setProperty('--surface-3', '#0f172a');
        document.documentElement.style.setProperty('--danger-color', '#f87171');
        document.documentElement.style.setProperty('--danger-color-dark', '#ef4444');
        document.documentElement.style.setProperty('--success-color', '#34d399');
        document.documentElement.style.setProperty('--warning-color', '#fbbf24');
        document.documentElement.style.setProperty('--info-color', '#60a5fa');
      } else {
        document.documentElement.style.setProperty('--primary-color', '#6366f1');
        document.documentElement.style.setProperty('--primary-color-dark', '#4f46e5');
        document.documentElement.style.setProperty('--primary-color-rgb', '99, 102, 241');
        document.documentElement.style.setProperty('--text-primary', '#111827');
        document.documentElement.style.setProperty('--text-secondary', '#4b5563');
        document.documentElement.style.setProperty('--border-color', '#e5e7eb');
        document.documentElement.style.setProperty('--surface-1', '#ffffff');
        document.documentElement.style.setProperty('--surface-2', '#f9fafb');
        document.documentElement.style.setProperty('--surface-3', '#f3f4f6');
        document.documentElement.style.setProperty('--danger-color', '#ef4444');
        document.documentElement.style.setProperty('--danger-color-dark', '#dc2626');
        document.documentElement.style.setProperty('--success-color', '#10b981');
        document.documentElement.style.setProperty('--warning-color', '#f59e0b');
        document.documentElement.style.setProperty('--info-color', '#3b82f6');
      }
      
      // Cập nhật các phần tử chính
      document.querySelectorAll('.app-header, .sidebar, .main-content, .card, .chart-container, .stat-card, .expense-card, .recurring-expense-item').forEach(element => {
        element.setAttribute('data-theme', currentTheme);
      });
      
      // Cập nhật các phần tử trong bảng lọc
      document.querySelectorAll('#dashboard-filter-section, .filter-section, .filter-item, .form-select, .form-control, .dropdown-toggle, .dropdown-menu, .dropdown-item').forEach(element => {
        element.setAttribute('data-theme', currentTheme);
      });
      
      // Cập nhật các phần tử trong biểu đồ
      document.querySelectorAll('#chart-time, #chart-category, .toggle-btn, .chart-header, .chart-body, .chart-legend, .label-text').forEach(element => {
        element.setAttribute('data-theme', currentTheme);
      });
      
      // Cập nhật các phần tử trong header
      document.querySelectorAll('.header-icon, .header-actions, .app-title').forEach(element => {
        element.setAttribute('data-theme', currentTheme);
      });
      
      // Cập nhật các phần tử trong sidebar
      document.querySelectorAll('.sidebar-nav, .sidebar-nav a, .sidebar-brand, .user-info, .logout-button').forEach(element => {
        element.setAttribute('data-theme', currentTheme);
      });
      
      // Cập nhật các phần tử trong settings
      document.querySelectorAll('.settings-container, .settings-nav, .settings-content, .settings-section, .form-group, .preference-item').forEach(element => {
        element.setAttribute('data-theme', currentTheme);
      });
      
      // Cập nhật các phần tử trong bảng lọc
      document.querySelectorAll('.filter-btn, .reset-btn, .custom-date-area, .input-group-text').forEach(element => {
        element.setAttribute('data-theme', currentTheme);
      });
      
      // Cập nhật các phần tử trong bảng lọc
      document.querySelectorAll('.filter-label, .dashboard-filter-label, .dashboard-content-header h1, .dashboard-content-header p').forEach(element => {
        element.setAttribute('data-theme', currentTheme);
      });
      
      // Cập nhật các phần tử trong bảng lọc
      document.querySelectorAll('.filter-item label, .filter-item select, .filter-item input, .filter-item button').forEach(element => {
        element.setAttribute('data-theme', currentTheme);
      });
      
      // Cập nhật các phần tử trong bảng lọc
      document.querySelectorAll('.filter-item .input-group-text, .filter-item .input-group-text i').forEach(element => {
        element.setAttribute('data-theme', currentTheme);
      });
      
      // Cập nhật các phần tử trong bảng lọc
      document.querySelectorAll('.btn-primary, .btn-outline-primary, .btn-secondary, .btn-outline-secondary').forEach(element => {
        element.setAttribute('data-theme', currentTheme);
      });
      
      // Cập nhật các phần tử trong bảng lọc
      document.querySelectorAll('.section-header h3, .section-header a, .view-all, .section-header-button').forEach(element => {
        element.setAttribute('data-theme', currentTheme);
      });
      
      // Cập nhật các phần tử trong bảng lọc
      document.querySelectorAll('.stat-value, .stat-header h3, .expense-title, .expense-amount, .expense-meta').forEach(element => {
        element.setAttribute('data-theme', currentTheme);
      });
      
      // Cập nhật các phần tử trong bảng lọc
      document.querySelectorAll('.stat-change, .stat-period, .stat-amount').forEach(element => {
        element.setAttribute('data-theme', currentTheme);
      });
      
      // Cập nhật các phần tử trong bảng lọc
      document.querySelectorAll('.stat-icon, .stat-icon i').forEach(element => {
        element.setAttribute('data-theme', currentTheme);
      });
      
      // Cập nhật các phần tử trong bảng lọc
      document.querySelectorAll('.expense-icon, .expense-icon i').forEach(element => {
        element.setAttribute('data-theme', currentTheme);
      });
      
      // Cập nhật các phần tử trong bảng lọc
      document.querySelectorAll('.recurring-expense-icon, .recurring-expense-icon i').forEach(element => {
        element.setAttribute('data-theme', currentTheme);
      });
      
      // Cập nhật các phần tử trong bảng lọc
      document.querySelectorAll('.recurring-expense-title, .recurring-expense-meta, .recurring-expense-amount, .recurring-expense-due').forEach(element => {
        element.setAttribute('data-theme', currentTheme);
      });
      
      // Cập nhật các phần tử trong bảng lọc
      document.querySelectorAll('.due-label, .due-date').forEach(element => {
        element.setAttribute('data-theme', currentTheme);
      });
      
      // Cập nhật các phần tử trong trang expenses
      document.querySelectorAll('.expenses-container, .filter-section, .expenses-grid, .expense-card, .modal-content, .expense-detail-container, .child-expenses-list, .child-expense-item, .add-child-form, #add-expense-btn').forEach(element => {
        element.setAttribute('data-theme', currentTheme);
      });
      
      // Cập nhật tất cả các phần tử có thuộc tính data-theme
      document.querySelectorAll('[data-theme]').forEach(element => {
        element.setAttribute('data-theme', currentTheme);
      });
    },

    // Chuyển đổi chế độ
    _toggleTheme() {
      console.log('Chuyển đổi chế độ');
      
      // Lấy chế độ hiện tại
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
      console.log('Chế độ hiện tại:', currentTheme);
      
      // Chuyển đổi chế độ
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      console.log('Chuyển sang chế độ:', newTheme);
      
      // Áp dụng chế độ mới cho cả html và body
      document.documentElement.setAttribute('data-theme', newTheme);
      document.body.setAttribute('data-theme', newTheme);
      
      // Thêm class transition để có hiệu ứng mượt mà
      document.body.classList.add('theme-transition');
      
      // Lưu chế độ vào localStorage
      localStorage.setItem('theme', newTheme);
      
      // Cập nhật tất cả các phần tử
      this._updateAllElements();
      
      // Thông báo cho người dùng
      this._notifyThemeChange(newTheme);
      
      // Xóa class transition sau khi hoàn thành
      setTimeout(() => {
        document.body.classList.remove('theme-transition');
      }, 300);
    },

    // Thông báo thay đổi chế độ
    _notifyThemeChange(theme) {
      // Tạo thông báo
      const notification = document.createElement('div');
      notification.style.position = 'fixed';
      notification.style.bottom = '20px';
      notification.style.right = '20px';
      notification.style.padding = '10px 15px';
      notification.style.borderRadius = '4px';
      notification.style.backgroundColor = theme === 'dark' ? '#4a5568' : '#e2e8f0';
      notification.style.color = theme === 'dark' ? '#e2e8f0' : '#2d3748';
      notification.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.2)';
      notification.style.zIndex = '9999';
      notification.style.transition = 'opacity 0.3s ease';
      notification.style.fontSize = '14px';
      
      // Thêm biểu tượng
      const icon = theme === 'dark' ? 'moon-fill' : 'sun-fill';
      notification.innerHTML = `<i class="bi bi-${icon}" style="margin-right: 8px;"></i>Đã chuyển sang chế độ ${theme === 'dark' ? 'tối' : 'sáng'}`;
      
      // Thêm vào body
      document.body.appendChild(notification);
      
      // Xóa thông báo sau 2 giây
      setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
          document.body.removeChild(notification);
        }, 300);
      }, 2000);
    },

    // Cập nhật phương thức _setTheme để sử dụng _updateAllElements
    _setTheme(theme) {
      console.log('Đang thiết lập theme:', theme);
      
      // Lưu theme vào localStorage
      localStorage.setItem('theme', theme);
      
      // Cập nhật thuộc tính data-theme cho document
      document.documentElement.setAttribute('data-theme', theme);
      document.body.setAttribute('data-theme', theme);
      
      // Cập nhật tất cả các phần tử
      this._updateAllElements();
      
      // Cập nhật trạng thái nút toggle
      this._updateToggleState(theme);
      
      console.log('Đã thiết lập theme thành công:', theme);
    },

    // Cập nhật trạng thái nút toggle
    _updateToggleState(theme) {
      console.log('Cập nhật trạng thái nút toggle theo chế độ:', theme);
      
      // Cập nhật nút toggle trong header
      const toggleBtn = document.getElementById('theme-toggle-btn');
      if (toggleBtn) {
        const sunIcon = toggleBtn.querySelector('.sun-icon');
        const moonIcon = toggleBtn.querySelector('.moon-icon');
        
        if (sunIcon && moonIcon) {
          if (theme === 'dark') {
            sunIcon.style.opacity = '1';
            moonIcon.style.opacity = '0';
          } else {
            sunIcon.style.opacity = '0';
            moonIcon.style.opacity = '1';
          }
        }
      }
      
      // Cập nhật nút toggle trong trang settings
      const settingsToggle = document.getElementById('theme-toggle-settings');
      if (settingsToggle) {
        if (theme === 'dark') {
          settingsToggle.checked = true;
        } else {
          settingsToggle.checked = false;
        }
      }
    }
  };

  // Khởi tạo hệ thống chuyển đổi chế độ
  window.ThemeManager.init();
}); 