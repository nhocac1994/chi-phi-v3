/**
 * Xử lý chức năng đăng xuất
 */
document.addEventListener('DOMContentLoaded', function() {
  // Tìm nút đăng xuất
  const logoutButton = document.getElementById('logout-button');
  
  if (logoutButton) {
    // Thêm sự kiện click
    logoutButton.addEventListener('click', function(e) {
      e.preventDefault();
      
      // Hiển thị hộp thoại xác nhận
      const confirmLogout = confirm('Bạn có chắc chắn muốn đăng xuất không?');
      
      if (confirmLogout) {
        // Hiển thị hiệu ứng đang xử lý
        showLogoutInProgress();
        
        // Đợi một chút để hiệu ứng được hiển thị
        setTimeout(function() {
          // Xóa tất cả thông tin đăng nhập khỏi localStorage
          localStorage.removeItem('sb-token');
          localStorage.removeItem('isLoggedIn');
          localStorage.removeItem('userEmail');
          localStorage.removeItem('userName');
          
          // Thử đăng xuất khỏi Supabase nếu client đã được khởi tạo
          if (window.supabaseClient) {
            window.supabaseClient.auth.signOut()
              .then(() => {
                redirectToLogin();
              })
              .catch(() => {
                // Nếu có lỗi vẫn chuyển hướng đến trang đăng nhập
                redirectToLogin();
              });
          } else {
            // Nếu không có client thì chỉ chuyển hướng
            redirectToLogin();
          }
        }, 500);
      }
    });
  }
});

/**
 * Hiển thị hiệu ứng đang xử lý đăng xuất
 */
function showLogoutInProgress() {
  // Tạo overlay hiệu ứng
  const overlay = document.createElement('div');
  overlay.className = 'logout-overlay';
  overlay.innerHTML = `
    <div class="logout-message">
      <div class="logout-spinner"></div>
      <p>Đang đăng xuất...</p>
    </div>
  `;
  
  // Thêm style cho overlay
  const style = document.createElement('style');
  style.textContent = `
    .logout-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.7);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 9999;
    }
    
    .logout-message {
      background: white;
      padding: 20px 40px;
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      align-items: center;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
    
    .logout-spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #f3f3f3;
      border-top: 4px solid #5a67d8;
      border-radius: 50%;
      margin-bottom: 15px;
      animation: logout-spin 1s linear infinite;
    }
    
    @keyframes logout-spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  
  // Thêm vào DOM
  document.body.appendChild(style);
  document.body.appendChild(overlay);
}

/**
 * Chuyển hướng người dùng đến trang đăng nhập
 */
function redirectToLogin() {
  window.location.href = '/login';
} 