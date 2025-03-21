// public/js/main.js

// Biến toàn cục
let isLoggedIn = false;
let supabaseClient = null;

// Khởi tạo khi tải trang
document.addEventListener('DOMContentLoaded', async function() {
  console.log('Khởi tạo trang...');
  
  // Khởi tạo Supabase client
  await initSupabaseClient();
  
  // Kiểm tra đăng nhập
  await checkLoginStatus();
  
  // Nếu đang ở trang dashboard, tải dashboard
  if (window.location.pathname.includes('/dashboard')) {
    loadDashboardData();
  }
  
  // Nếu đang ở trang chi phí, tải chi phí
  if (window.location.pathname.includes('/expenses')) {
    loadExpenses();
  }
  
  // Xử lý form đăng nhập
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }
  
  // Xử lý form thêm chi phí
  const addExpenseForm = document.getElementById('add-expense-form');
  if (addExpenseForm) {
    addExpenseForm.addEventListener('submit', handleAddExpense);
  }
});

// Khởi tạo Supabase client
async function initSupabaseClient() {
  try {
    // Lấy cấu hình Supabase từ server
    const response = await fetch('/api/supabase-config');
    if (!response.ok) {
      throw new Error('Không thể lấy cấu hình Supabase');
    }
    
    const { supabaseUrl, supabaseKey } = await response.json();
    
    // Lưu cấu hình vào window để các tệp khác có thể sử dụng
    window.SUPABASE_URL = supabaseUrl;
    window.SUPABASE_KEY = supabaseKey;
    
    // Khởi tạo client nếu đã tải thư viện
    if (typeof supabase !== 'undefined') {
      supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);
      window.supabase = supabaseClient; // Lưu client vào window
      console.log('✅ Supabase client đã được khởi tạo');
    } else {
      console.error('❌ Chưa tải thư viện Supabase');
    }
  } catch (error) {
    console.error('Lỗi khởi tạo Supabase client:', error);
  }
}

// Kiểm tra trạng thái đăng nhập
async function checkLoginStatus() {
  try {
    // Kiểm tra token từ localStorage
    const token = localStorage.getItem('sb-token');
    
    if (!token) {
      console.log('❌ Không có token, chưa đăng nhập');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
      return false;
    }
    
    // Kiểm tra token bằng API
    const response = await fetch('/api/check-auth', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      console.log('❌ Token không hợp lệ');
      localStorage.removeItem('sb-token');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
      return false;
    }
    
    console.log('✅ Đã đăng nhập');
    isLoggedIn = true;
    return true;
  } catch (error) {
    console.error('Lỗi kiểm tra đăng nhập:', error);
    return false;
  }
}

// Xử lý đăng nhập
async function handleLogin(event) {
  event.preventDefault();
  
  try {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Đăng nhập thất bại');
    }
    
    // Lưu token vào localStorage
    localStorage.setItem('sb-token', data.session.access_token);
    
    // Chuyển về trang dashboard
    window.location.href = '/dashboard';
  } catch (error) {
    console.error('Lỗi đăng nhập:', error);
    alert('Đăng nhập thất bại: ' + error.message);
  }
}

// Tải dữ liệu dashboard
async function loadDashboardData() {
  try {
    // Hiển thị loading
    showLoading();
    
    // Tải dữ liệu thống kê
    const response = await fetch('/api/statistics/summary', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('sb-token')}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Không thể tải dữ liệu thống kê');
    }
    
    const data = await response.json();
    
    // Cập nhật biểu đồ
    if (window.renderTimeChart && data.monthlyExpenses) {
      window.renderTimeChart(data.monthlyExpenses);
    }
    
    if (window.renderCategoryChart && data.categoryExpenses) {
      window.renderCategoryChart(data.categoryExpenses);
    }
    
    // Tải giao dịch gần đây
    await loadRecentTransactions();
    
    // Ẩn loading
    hideLoading();
  } catch (error) {
    console.error('Lỗi tải dashboard:', error);
    hideLoading();
  }
}

// Tải giao dịch gần đây
async function loadRecentTransactions() {
  try {
    const response = await fetch('/api/expenses?limit=5', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('sb-token')}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Không thể tải giao dịch gần đây');
    }
    
    const data = await response.json();
    
    // Hiển thị giao dịch
    const container = document.getElementById('expenses-list');
    if (!container) return;
    
    if (!data.expenses || data.expenses.length === 0) {
      container.innerHTML = '<div class="empty-state"><i class="bi bi-inbox"></i><p>Chưa có giao dịch nào</p></div>';
      return;
    }
    
    let html = '';
    data.expenses.forEach(expense => {
      const date = new Date(expense.ngay_bat_dau);
      html += `
        <div class="transaction-item" data-id="${expense.id}">
          <div class="transaction-details">
            <h4>${expense.ten_chi_phi || 'Chi phí không tên'}</h4>
            <div class="transaction-meta">
              <span class="transaction-date">${date.toLocaleDateString('vi-VN')}</span>
              <span class="transaction-category">${expense.danh_muc || 'Không phân loại'}</span>
            </div>
          </div>
          <div class="transaction-amount">${formatCurrency(expense.gia_tien)} đ</div>
        </div>
      `;
    });
    
    container.innerHTML = html;
  } catch (error) {
    console.error('Lỗi tải giao dịch:', error);
  }
}

// Định dạng tiền tệ
function formatCurrency(amount) {
  return new Intl.NumberFormat('vi-VN').format(amount || 0);
}

// Hiển thị loading
function showLoading() {
  const loadingOverlay = document.getElementById('loading-overlay');
  if (loadingOverlay) {
    loadingOverlay.style.display = 'flex';
  }
}

// Ẩn loading
function hideLoading() {
  const loadingOverlay = document.getElementById('loading-overlay');
  if (loadingOverlay) {
    loadingOverlay.style.display = 'none';
  }
}