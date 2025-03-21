/**
 * Settings Page JavaScript
 * Xử lý tương tác người dùng với trang cài đặt
 */

// Biến global 
let userProfile = null;

// Khởi tạo khi trang được tải
document.addEventListener('DOMContentLoaded', () => {
  // Khởi tạo các tab
  initTabs();
  
  // Khởi tạo các dropdown
  initDropdowns();
  
  // Khởi tạo chế độ sáng/tối
  initThemeToggle();
  
  // Thiết lập listeners
  setupEventListeners();
  
  // Kiểm tra xác thực
  checkAuth();
  
  // Đảm bảo nút đăng xuất được thiết lập đúng
  const logoutButton = document.getElementById('logoutButton');
  if (logoutButton) {
    logoutButton.addEventListener('click', handleLogout);
  }
});

/**
 * Khởi tạo các tab trong trang cài đặt
 */
function initTabs() {
  const tabButtons = document.querySelectorAll('.settings-nav-item');
  const tabContents = document.querySelectorAll('.settings-tab');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Xóa trạng thái active của tất cả các tab
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      // Thêm trạng thái active cho tab được chọn
      button.classList.add('active');
      const tabId = button.getAttribute('data-tab');
      document.getElementById(`${tabId}-tab`).classList.add('active');
    });
  });
}

/**
 * Khởi tạo các dropdown trong trang cài đặt
 */
function initDropdowns() {
  const dropdowns = document.querySelectorAll('.dropdown');
  
  dropdowns.forEach(dropdown => {
    const toggle = dropdown.querySelector('.dropdown-toggle');
    const menu = dropdown.querySelector('.dropdown-menu');
    const items = dropdown.querySelectorAll('.dropdown-item');
    const selectedText = dropdown.querySelector('.selected-text');
    
    if (!toggle || !menu || !items.length || !selectedText) return;
    
    // Xử lý sự kiện click vào toggle
    toggle.addEventListener('click', () => {
      dropdown.classList.toggle('active');
    });
    
    // Xử lý sự kiện click vào item
    items.forEach(item => {
      item.addEventListener('click', () => {
        // Cập nhật text hiển thị
        selectedText.textContent = item.textContent;
        
        // Cập nhật trạng thái active
        items.forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        
        // Đóng dropdown
        dropdown.classList.remove('active');
      });
    });
    
    // Đóng dropdown khi click ra ngoài
    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target)) {
        dropdown.classList.remove('active');
      }
    });
  });
}

/**
 * Khởi tạo chức năng chuyển đổi chế độ sáng/tối
 */
function initThemeToggle() {
  const themeToggle = document.getElementById('theme-toggle-settings');
  if (!themeToggle) return;
  
  // Cập nhật trạng thái ban đầu dựa trên theme hiện tại
  const currentTheme = document.documentElement.getAttribute('data-theme') || localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', currentTheme);
  
  // Thêm sự kiện click
  themeToggle.addEventListener('click', () => {
    // Lấy chế độ hiện tại
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    
    // Chuyển đổi chế độ
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    // Áp dụng chế độ mới
    document.documentElement.setAttribute('data-theme', newTheme);
    
    // Thêm class transition để có hiệu ứng mượt mà
    document.body.classList.add('theme-transition');
    
    // Lưu chế độ vào localStorage
    localStorage.setItem('theme', newTheme);
    
    // Xóa class transition sau khi hoàn thành
    setTimeout(() => {
      document.body.classList.remove('theme-transition');
    }, 300);
    
    // Hiển thị thông báo
    showNotification(`Đã chuyển sang chế độ ${newTheme === 'dark' ? 'tối' : 'sáng'}`, 'success');
  });
  
  // Thêm sự kiện keyboard
  themeToggle.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      themeToggle.click();
    }
  });
}

// Kiểm tra xác thực người dùng
async function checkAuth() {
  try {
    showLoading();
    
    console.log('Bắt đầu kiểm tra xác thực người dùng...');
    
    // Lấy token từ nhiều nguồn
    const token = getCookie('sb_token') || localStorage.getItem('token') || sessionStorage.getItem('sb_token');
    console.log('Token sử dụng để xác thực:', token ? 'Có token' : 'Không có token');
    
    if (!token) {
      console.log('❌ Không tìm thấy token đăng nhập');
      
      // Cho phép tiếp tục trong môi trường phát triển
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.warn('Không có token: Chế độ phát triển được kích hoạt');
        
        // Hiển thị thông báo chế độ phát triển nếu chưa có
        if (!document.querySelector('.dev-mode-alert')) {
          const devModeAlert = document.createElement('div');
          devModeAlert.className = 'alert alert-warning text-center dev-mode-alert';
          devModeAlert.innerHTML = '<i class="bi bi-tools"></i> <strong>Chế độ phát triển</strong> - Đang sử dụng dữ liệu mẫu';
          
          const mainContent = document.querySelector('.main-content');
          if (mainContent) {
            mainContent.insertBefore(devModeAlert, mainContent.firstChild);
          }
        }
        
        await loadUserProfile();
        hideLoading();
        return;
      }
      
      // Chuyển về trang đăng nhập nếu không phải môi trường phát triển
      window.location.href = '/login';
      return;
    }

    // Khởi tạo Supabase client nếu chưa có
    if (typeof window.waitForSupabase === 'function') {
      await window.waitForSupabase();
    } else {
      // Nếu không có hàm chờ, đợi một chút để đảm bảo client được khởi tạo
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Sử dụng biến supabase từ global scope (đã được khởi tạo trong app.js)
    if (typeof supabase !== 'undefined' && supabase) {
      try {
        // Kiểm tra phiên đăng nhập
        const authResponse = await supabase.auth.getUser(token);
        const user = authResponse?.data?.user;
        
        if (!user) {
          console.warn('❌ Không có người dùng đăng nhập');
          
          // Chuyển về chế độ phát triển hoặc trang đăng nhập
          if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.warn('Không có user: Chế độ phát triển được kích hoạt');
            await loadUserProfile();
            hideLoading();
            return;
          }
          
          window.location.href = '/login';
          return;
        }
        
        console.log('✅ Xác thực thành công:', user.email);
        
        // Đồng bộ hóa token giữa các nguồn lưu trữ
        setCookie('sb_token', token);
        sessionStorage.setItem('sb_token', token);
        localStorage.setItem('token', token);
        
        // Sử dụng đồng bộ hóa user data
        if (typeof window.syncUserData === 'function') {
          window.syncUserData(user);
        } else {
          // Fallback nếu không có hàm đồng bộ
          window.userData = user;
        }
        
        // Cập nhật tên hiển thị
        const displayName = user.user_metadata?.full_name || user.email.split('@')[0];
        const userNameElement = document.getElementById('userName');
        if (userNameElement) {
          userNameElement.textContent = displayName;
        }
        
        // Tải thông tin profile
        await loadUserProfile();
        hideLoading();
        
      } catch (authError) {
        console.error('Lỗi khi gọi Supabase Auth:', authError);
        
        // Cho phép tiếp tục trong môi trường phát triển
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          console.warn('Lỗi xác thực: Chế độ phát triển được kích hoạt');
          await loadUserProfile();
          hideLoading();
        } else {
          hideLoading();
          showNotification('Lỗi xác thực. Vui lòng đăng nhập lại.', 'error');
          setTimeout(() => {
            window.location.href = '/login';
          }, 2000);
        }
      }
    } else {
      console.warn('supabase chưa được khởi tạo trong global scope, chế độ phát triển được kích hoạt');
      
      // Tải thông tin profile mẫu (môi trường phát triển)
      await loadUserProfile();
      hideLoading();
    }
  } catch (error) {
    console.error('Lỗi xác thực:', error);
    hideLoading();
    
    // Cho phép tiếp tục trong môi trường phát triển
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      showNotification('Đang chạy ở chế độ phát triển (không có xác thực)', 'warning');
    } else {
      showNotification('Không thể xác thực. Vui lòng đăng nhập lại.', 'error');
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
    }
  }
}

// Hàm lưu cookie
function setCookie(name, value, days = 7) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${value}; expires=${expires}; path=/`;
  console.log(`Cookie ${name} đã được đặt, hết hạn: ${expires}`);
}

// Hàm đọc cookie
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop().split(';').shift();
  }
  return null;
}

// Tải thông tin profile người dùng
async function loadUserProfile() {
  try {
    // Kiểm tra xem có kết nối API không, nếu không thì tạo dữ liệu mẫu
    if (typeof supabase === 'undefined' || !window.userData) {
      console.warn('Không có kết nối hoặc dữ liệu người dùng, sử dụng dữ liệu mẫu');
      // Tạo dữ liệu mẫu cho môi trường phát triển
      userProfile = {
        id: 'mau-uuid-123456789',
        full_name: 'Người dùng Mẫu',
        avatar_url: 'https://ui-avatars.com/api/?name=Người+dùng+Mẫu&background=random',
        phone_number: '0123456789',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        email: 'dev@example.com'
      };
      
      // Điền thông tin vào form
      populateProfileForm(userProfile);
      
      // Tải các cài đặt từ localStorage
      loadUserPreferences();
      
      return;
    }
    
    // Nếu có supabase, thử lấy dữ liệu profile từ database
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', window.userData.id)
        .single();
        
      if (error) {
        console.error('Lỗi khi truy vấn profile từ database:', error);
        throw error;
      }
      
      if (profile) {
        userProfile = profile;
      } else {
        // Nếu không tìm thấy profile, tạo mới từ dữ liệu người dùng
        userProfile = {
          id: window.userData.id,
          full_name: window.userData.user_metadata?.full_name || '',
          avatar_url: window.userData.user_metadata?.avatar_url || '',
          phone_number: window.userData.user_metadata?.phone_number || '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          email: window.userData.email
        };
        
        // Lưu profile mới vào database
        const { error: insertError } = await supabase
          .from('profiles')
          .insert([userProfile]);
          
        if (insertError) {
          console.error('Lỗi khi tạo profile mới:', insertError);
        }
      }
    } catch (dbError) {
      console.error('Lỗi khi truy cập database:', dbError);
      
      // Fallback sang API nếu truy cập database thất bại
      const response = await fetch('/api/user/profile');
      
      if (!response.ok) {
        throw new Error('Không thể tải thông tin người dùng');
      }
      
      const data = await response.json();
      userProfile = data.profile;
    }
    
    // Điền thông tin vào form
    populateProfileForm(userProfile);
    
    // Tải các cài đặt từ localStorage
    loadUserPreferences();
  } catch (error) {
    console.error('Lỗi tải thông tin người dùng:', error);
    showNotification('Không thể tải thông tin người dùng. Vui lòng tải lại trang.', 'error');
  }
}

// Điền thông tin vào form profile
function populateProfileForm(profile) {
  const fullNameInput = document.getElementById('full_name');
  const emailInput = document.getElementById('email');
  const phoneInput = document.getElementById('phone');
  const bioInput = document.getElementById('bio');
  const avatarPreview = document.getElementById('avatar-preview');
  
  // Sử dụng dữ liệu từ profile
  if (fullNameInput) fullNameInput.value = profile?.full_name || '';
  if (emailInput) emailInput.value = profile?.email || '';
  if (phoneInput) phoneInput.value = profile?.phone_number || '';
  
  // Bio không có trong schema, nhưng vẫn giữ lại để tương thích
  if (bioInput) bioInput.value = profile?.bio || '';
  
  // Cập nhật preview ảnh đại diện nếu có
  if (avatarPreview && profile?.avatar_url) {
    avatarPreview.src = profile.avatar_url;
    avatarPreview.style.display = 'block';
  }
  
  // Cập nhật tên hiển thị trên header
  const userNameElement = document.getElementById('userName');
  if (userNameElement) {
    userNameElement.textContent = profile?.full_name || profile?.email?.split('@')[0] || 'Người dùng';
  }
}

// Tải các tùy chỉnh người dùng từ localStorage
function loadUserPreferences() {
  // Collapsed sidebar
  const collapsedSidebar = document.getElementById('collapsed_sidebar');
  if (collapsedSidebar) {
    collapsedSidebar.checked = localStorage.getItem('sidebarCollapsed') === 'true';
  }
  
  // Notifications
  const emailRecurring = document.getElementById('email_recurring');
  const emailMonthly = document.getElementById('email_monthly');
  const emailAlerts = document.getElementById('email_alerts');
  const appNotifications = document.getElementById('app_notifications');
  
  if (emailRecurring) emailRecurring.checked = localStorage.getItem('emailRecurring') !== 'false';
  if (emailMonthly) emailMonthly.checked = localStorage.getItem('emailMonthly') !== 'false';
  if (emailAlerts) emailAlerts.checked = localStorage.getItem('emailAlerts') === 'true';
  if (appNotifications) appNotifications.checked = localStorage.getItem('appNotifications') !== 'false';
}

// Thiết lập các sự kiện
function setupEventListeners() {
  // Profile form
  const profileForm = document.getElementById('profile-form');
  if (profileForm) {
    profileForm.addEventListener('submit', handleProfileUpdate);
  }
  
  // Cancel profile update
  const cancelProfileBtn = document.querySelector('.cancel-btn');
  if (cancelProfileBtn) {
    cancelProfileBtn.addEventListener('click', () => {
      populateProfileForm(userProfile);
    });
  }
  
  // Change password form
  const passwordForm = document.getElementById('change-password-form');
  if (passwordForm) {
    passwordForm.addEventListener('submit', handlePasswordChange);
  }
  
  // Save preferences
  const savePrefsBtn = document.getElementById('save-preferences');
  if (savePrefsBtn) {
    savePrefsBtn.addEventListener('click', savePreferences);
  }
  
  // Save notifications
  const saveNotificationsBtn = document.getElementById('save-notifications');
  if (saveNotificationsBtn) {
    saveNotificationsBtn.addEventListener('click', saveNotifications);
  }
  
  // Export data buttons
  const exportButtons = document.querySelectorAll('.export-btn');
  exportButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const format = btn.textContent.trim().includes('CSV') ? 'csv' : 'excel';
      exportData(format);
    });
  });
  
  // Import file
  const importFileInput = document.getElementById('import-file');
  if (importFileInput) {
    importFileInput.addEventListener('change', handleFileImport);
  }
  
  // Delete account button
  const deleteAccountBtn = document.getElementById('delete-account-btn');
  if (deleteAccountBtn) {
    deleteAccountBtn.addEventListener('click', handleDeleteAccount);
  }
  
  // Clear data button
  const clearDataBtn = document.getElementById('clear-data-btn');
  if (clearDataBtn) {
    clearDataBtn.addEventListener('click', handleClearData);
  }
  
  // Thêm hiệu ứng cho các phần tử
  addAnimationEffects();
}

// Thêm hiệu ứng animation cho các phần tử
function addAnimationEffects() {
  // Hiệu ứng hover cho các section
  const sections = document.querySelectorAll('.settings-section');
  sections.forEach(section => {
    section.addEventListener('mouseenter', () => {
      section.style.transform = 'translateY(-2px)';
    });
    
    section.addEventListener('mouseleave', () => {
      section.style.transform = 'translateY(0)';
    });
  });
  
  // Hiệu ứng cho buttons
  const buttons = document.querySelectorAll('.save-btn, .cancel-btn, .danger-btn, .export-btn, .btn-setup-2fa');
  buttons.forEach(button => {
    button.addEventListener('mouseenter', () => {
      button.style.transform = 'translateY(-2px)';
    });
    
    button.addEventListener('mouseleave', () => {
      button.style.transform = 'translateY(0)';
    });
  });
}

// Xử lý cập nhật thông tin profile
async function handleProfileUpdate(event) {
  event.preventDefault();
  showLoading();
  
  try {
    const fullName = document.getElementById('full_name').value;
    const email = document.getElementById('email').value;
    const phone = document.getElementById('phone').value;
    const bio = document.getElementById('bio').value;
    const avatarUrlInput = document.getElementById('avatar_url');
    
    // Dữ liệu profile theo cấu trúc database
    const profileData = {
      full_name: fullName,
      phone_number: phone,
      updated_at: new Date().toISOString()
    };
    
    // Thêm avatar_url nếu có
    if (avatarUrlInput && avatarUrlInput.value) {
      profileData.avatar_url = avatarUrlInput.value;
    }
    
    // Lưu bio vào metadata nếu có
    if (bio) {
      profileData.metadata = {
        bio: bio
      };
    }
    
    // Kiểm tra môi trường phát triển
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      if (typeof supabase === 'undefined') {
        // Giả lập cập nhật profile trong môi trường phát triển
        console.log('Môi trường phát triển: Cập nhật profile', profileData);
        userProfile = {...userProfile, ...profileData, email};
        
        // Cập nhật tên hiển thị trên header
        const userNameElement = document.getElementById('userName');
        if (userNameElement) {
          userNameElement.textContent = fullName || email.split('@')[0];
        }
        
        setTimeout(() => {
          hideLoading();
          showNotification('Cập nhật thông tin thành công (chế độ phát triển)', 'success');
        }, 500);
        return;
      }
      
      // Nếu có kết nối Supabase, thử cập nhật trực tiếp
      try {
        const { error } = await supabase
          .from('profiles')
          .update(profileData)
          .eq('id', userProfile.id);
          
        if (error) throw error;
        
        // Cập nhật userProfile local
        userProfile = {...userProfile, ...profileData, email};
        
        // Cập nhật tên hiển thị
        const userNameElement = document.getElementById('userName');
        if (userNameElement) {
          userNameElement.textContent = fullName || email.split('@')[0];
        }
        
        hideLoading();
        showNotification('Cập nhật thông tin thành công', 'success');
        return;
      } catch (dbError) {
        console.error('Lỗi khi cập nhật profile trong database:', dbError);
        // Tiếp tục với API fallback
      }
    }
    
    // Fallback hoặc môi trường sản xuất: dùng API
    const response = await fetch('/api/user/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(profileData)
    });
    
    if (!response.ok) {
      throw new Error('Không thể cập nhật thông tin người dùng');
    }
    
    const data = await response.json();
    userProfile = data.profile;
    
    // Cập nhật tên hiển thị trên header
    const userNameElement = document.getElementById('userName');
    if (userNameElement) {
      userNameElement.textContent = fullName || email.split('@')[0];
    }
    
    hideLoading();
    showNotification('Cập nhật thông tin thành công', 'success');
  } catch (error) {
    console.error('Lỗi cập nhật thông tin:', error);
    hideLoading();
    showNotification('Không thể cập nhật thông tin. Vui lòng thử lại.', 'error');
  }
}

// Xử lý đổi mật khẩu
async function handlePasswordChange(event) {
  event.preventDefault();
  
  const currentPassword = document.getElementById('current_password').value;
  const newPassword = document.getElementById('new_password').value;
  const confirmPassword = document.getElementById('confirm_password').value;
  
  // Kiểm tra mật khẩu mới và xác nhận mật khẩu
  if (newPassword !== confirmPassword) {
    showNotification('Mật khẩu mới và xác nhận mật khẩu không khớp', 'error');
    return;
  }
  
  // Kiểm tra độ dài mật khẩu
  if (newPassword.length < 6) {
    showNotification('Mật khẩu mới phải có ít nhất 6 ký tự', 'error');
    return;
  }
  
  showLoading();
  
  try {
    // Kiểm tra môi trường phát triển
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      if (typeof supabase === 'undefined') {
        // Giả lập cập nhật mật khẩu trong môi trường phát triển
        console.log('Môi trường phát triển: Đổi mật khẩu');
        
        // Xóa form
        document.getElementById('current_password').value = '';
        document.getElementById('new_password').value = '';
        document.getElementById('confirm_password').value = '';
        
        setTimeout(() => {
          hideLoading();
          showNotification('Đổi mật khẩu thành công (chế độ phát triển)', 'success');
        }, 500);
        return;
      }
    }
    
    // Không cần kiểm tra mật khẩu hiện tại khi dùng Supabase Auth
    const response = await fetch('/api/user/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ new_password: newPassword })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Không thể đổi mật khẩu');
    }
    
    // Xóa form
    document.getElementById('current_password').value = '';
    document.getElementById('new_password').value = '';
    document.getElementById('confirm_password').value = '';
    
    hideLoading();
    showNotification('Đổi mật khẩu thành công', 'success');
  } catch (error) {
    console.error('Lỗi đổi mật khẩu:', error);
    hideLoading();
    showNotification('Không thể đổi mật khẩu. Vui lòng thử lại.', 'error');
  }
}

// Lưu tùy chỉnh
function savePreferences() {
  // Collapsed sidebar
  const collapsedSidebar = document.getElementById('collapsed_sidebar');
  if (collapsedSidebar) {
    localStorage.setItem('sidebarCollapsed', collapsedSidebar.checked);
  }
  
  // Date format
  const dateFormatDropdown = document.querySelector('.date-format-dropdown');
  if (dateFormatDropdown) {
    const selectedFormat = dateFormatDropdown.querySelector('.dropdown-item.active').getAttribute('data-format');
    localStorage.setItem('dateFormat', selectedFormat);
  }
  
  // Items per page
  const itemsPerPageDropdown = document.querySelector('.items-per-page-dropdown');
  if (itemsPerPageDropdown) {
    const selectedCount = itemsPerPageDropdown.querySelector('.dropdown-item.active').getAttribute('data-count');
    localStorage.setItem('itemsPerPage', selectedCount);
  }
  
  showNotification('Đã lưu tùy chỉnh', 'success');
}

// Lưu cài đặt thông báo
function saveNotifications() {
  const emailRecurring = document.getElementById('email_recurring');
  const emailMonthly = document.getElementById('email_monthly');
  const emailAlerts = document.getElementById('email_alerts');
  const appNotifications = document.getElementById('app_notifications');
  
  if (emailRecurring) localStorage.setItem('emailRecurring', emailRecurring.checked);
  if (emailMonthly) localStorage.setItem('emailMonthly', emailMonthly.checked);
  if (emailAlerts) localStorage.setItem('emailAlerts', emailAlerts.checked);
  if (appNotifications) localStorage.setItem('appNotifications', appNotifications.checked);
  
  showNotification('Đã lưu cài đặt thông báo', 'success');
}

// Xuất dữ liệu
function exportData(format) {
  showLoading();
  
  // Giả lập xuất dữ liệu
  setTimeout(() => {
    hideLoading();
    showNotification(`Đã xuất dữ liệu dưới dạng ${format.toUpperCase()}`, 'success');
  }, 1500);
}

// Xử lý nhập file
function handleFileImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const fileType = file.name.split('.').pop().toLowerCase();
  if (fileType !== 'csv' && fileType !== 'xlsx') {
    showNotification('Chỉ hỗ trợ file CSV hoặc Excel', 'error');
    return;
  }
  
  showLoading();
  
  // Giả lập nhập dữ liệu
  setTimeout(() => {
    hideLoading();
    showNotification(`Đã nhập dữ liệu từ file ${file.name}`, 'success');
    // Xóa file đã chọn để có thể chọn lại cùng file đó
    event.target.value = '';
  }, 2000);
}

// Xử lý xóa tài khoản
function handleDeleteAccount() {
  if (confirm('Bạn có chắc chắn muốn xóa tài khoản này? Hành động này không thể hoàn tác.')) {
    showLoading();
    
    // Giả lập API call
    setTimeout(() => {
      hideLoading();
      showNotification('Tài khoản đã được xóa', 'success');
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
    }, 1500);
  }
}

// Xử lý xóa dữ liệu
function handleClearData() {
  if (confirm('Bạn có chắc chắn muốn xóa tất cả dữ liệu? Hành động này không thể hoàn tác.')) {
    showLoading();
    
    // Giả lập API call
    setTimeout(() => {
      hideLoading();
      showNotification('Dữ liệu đã được xóa', 'success');
    }, 1500);
  }
}

// Hiển thị loading
function showLoading() {
  // Tạo hoặc hiển thị loading spinner
  let loadingOverlay = document.querySelector('.loading-overlay');
  if (!loadingOverlay) {
    loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'loading-overlay';
    loadingOverlay.innerHTML = '<div class="spinner"></div>';
    document.body.appendChild(loadingOverlay);
  } else {
    loadingOverlay.style.display = 'flex';
  }
}

// Ẩn loading
function hideLoading() {
  const loadingOverlay = document.querySelector('.loading-overlay');
  if (loadingOverlay) {
    loadingOverlay.style.display = 'none';
  }
}

// Hiển thị thông báo
function showNotification(message, type = 'info') {
  const notificationContainer = document.querySelector('.notification-container') || createNotificationContainer();
  
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  
  let icon = '';
  switch (type) {
    case 'success':
      icon = '<i class="bi bi-check-circle-fill"></i>';
      break;
    case 'error':
      icon = '<i class="bi bi-x-circle-fill"></i>';
      break;
    case 'warning':
      icon = '<i class="bi bi-exclamation-triangle-fill"></i>';
      break;
    default:
      icon = '<i class="bi bi-info-circle-fill"></i>';
  }
  
  notification.innerHTML = `
    <div class="notification-icon">${icon}</div>
    <div class="notification-content">${message}</div>
    <button class="notification-close"><i class="bi bi-x"></i></button>
  `;
  
  // Thêm sự kiện đóng thông báo
  const closeBtn = notification.querySelector('.notification-close');
  closeBtn.addEventListener('click', () => {
    notification.classList.add('notification-hiding');
    setTimeout(() => {
      notification.remove();
      if (notificationContainer.children.length === 0) {
        notificationContainer.remove();
      }
    }, 300);
  });
  
  notificationContainer.appendChild(notification);
  
  // Hiệu ứng hiện thông báo
  setTimeout(() => {
    notification.classList.add('notification-show');
  }, 10);
  
  // Tự động đóng thông báo sau 5 giây
  setTimeout(() => {
    if (notification.parentElement) {
      notification.classList.add('notification-hiding');
      setTimeout(() => {
        if (notification.parentElement) {
          notification.remove();
          if (notificationContainer.children.length === 0) {
            notificationContainer.remove();
          }
        }
      }, 300);
    }
  }, 5000);
}

// Tạo container chứa thông báo
function createNotificationContainer() {
  const container = document.createElement('div');
  container.className = 'notification-container';
  document.body.appendChild(container);
  return container;
}

// Thêm hàm xử lý đăng xuất đồng bộ từ nhiều vị trí trên ứng dụng
function handleLogout() {
  console.log("Đang đăng xuất...");
  
  // Xóa thông tin đăng nhập từ localStorage
  localStorage.removeItem('supabase.auth.token');
  localStorage.removeItem('userProfile');
  localStorage.removeItem('supabase.auth.refreshToken');
  
  // Xóa cookies nếu có
  document.cookie = 'authToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  document.cookie = 'refreshToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  
  // Xóa sessionStorage 
  sessionStorage.removeItem('supabase.auth.token');
  
  // Thông báo đăng xuất thành công
  showNotification("Đăng xuất thành công", "success");
  
  // Chuyển hướng về trang đăng nhập sau 1 giây
  setTimeout(() => {
    window.location.href = '/login';
  }, 1000);
} 