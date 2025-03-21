document.addEventListener('DOMContentLoaded', function() {
  // Khởi tạo Supabase client
  const SUPABASE_URL = 'https://iifnfqsusnjqyvegwchr.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpZm5mcXN1c25qcXl2ZWd3Y2hyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE1Nzk2MDQsImV4cCI6MjA1NzE1NTYwNH0.Lei4t4UKezBHkb3CNcXuVQ5S4Fr0fY0J4oswu-GtcVU';
  
  // Khởi tạo client nếu đã tải thư viện
  let supabaseClient = null;
  if (typeof supabase !== 'undefined') {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('✅ Supabase client đã được khởi tạo');
  } else {
    console.error('❌ Chưa tải thư viện Supabase');
  }
  
  // Hàm lưu token vào cookie
  function setCookie(name, value, days = 7) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = name + '=' + encodeURIComponent(value) + '; expires=' + expires + '; path=/';
  }
  
  // Xử lý form đăng nhập
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      // Lấy email và password
      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;
      
      // Hiển thị loading
      const loginButton = document.getElementById('login-button');
      const errorElement = document.getElementById('login-error');
      
      if (loginButton) {
        loginButton.textContent = 'Đang đăng nhập...';
        loginButton.disabled = true;
      }
      
      if (errorElement) {
        errorElement.style.display = 'none';
      }
      
      try {
        console.log('Đang gửi request đăng nhập...');
        
        // Gọi API đăng nhập
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Đăng nhập thất bại');
        }
        
        console.log('Đăng nhập thành công!');
        
        // Lưu token vào tất cả các vị trí để đảm bảo xác thực
        if (data.token) {
          // Lưu token vào localStorage
          localStorage.setItem('token', data.token);
          localStorage.setItem('sb-token', data.token);
          
          // Lưu token vào sessionStorage
          sessionStorage.setItem('sb_token', data.token);
          
          // Lưu token vào cookie (7 ngày)
          setCookie('sb_token', data.token, 7);
          
          console.log('Token đã được lưu vào localStorage, sessionStorage và cookie');
        }
        
        // Lưu thông tin người dùng vào localStorage
        localStorage.setItem('userEmail', data.user.email);
        localStorage.setItem('userName', data.user.user_metadata?.full_name || data.user.email.split('@')[0]);
        localStorage.setItem('isLoggedIn', 'true');
        
        // Xóa bộ nhớ kiểm tra đăng nhập để buộc kiểm tra lại
        sessionStorage.removeItem('last_login_check');
        
        // Thêm một delay nhỏ để đảm bảo localStorage đã được cập nhật
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Chuyển về trang dashboard
        console.log('Chuyển hướng đến dashboard sau khi đăng nhập');
        window.location.replace('/dashboard');
      } catch (error) {
        console.error('Lỗi đăng nhập:', error);
        
        // Hiển thị lỗi
        if (errorElement) {
          errorElement.textContent = error.message;
          errorElement.style.display = 'block';
        }
        
        // Khôi phục nút đăng nhập
        if (loginButton) {
          loginButton.textContent = 'Đăng nhập';
          loginButton.disabled = false;
        }
      }
    });
  }
  
  // Xử lý form đăng ký
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    const registerButton = document.getElementById('register-button');
    
    if (registerButton) {
      registerButton.addEventListener('click', async function() {
        // Lấy thông tin đăng ký
        const name = document.getElementById('register-name').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const confirmPassword = document.getElementById('register-confirm-password').value;
        
        // Kiểm tra mật khẩu khớp nhau
        if (password !== confirmPassword) {
          const errorElement = document.getElementById('register-error');
          if (errorElement) {
            errorElement.textContent = 'Mật khẩu xác nhận không khớp';
            errorElement.style.display = 'block';
          }
          return;
        }
        
        // Hiển thị loading
        registerButton.textContent = 'Đang đăng ký...';
        registerButton.disabled = true;
        
        try {
          // Đăng ký với Supabase
          const { data, error } = await supabaseClient.auth.signUp({
            email,
            password,
            options: {
              data: {
                full_name: name
              }
            }
          });
          
          if (error) throw error;
          
          // Hiển thị thông báo thành công
          alert('Đăng ký thành công! Vui lòng kiểm tra email để xác nhận tài khoản.');
          
          // Chuyển về tab đăng nhập
          const loginTab = document.querySelector('.auth-tab[data-tab="login"]');
          if (loginTab) loginTab.click();
        } catch (error) {
          console.error('Lỗi đăng ký:', error);
          
          // Hiển thị lỗi
          const errorElement = document.getElementById('register-error');
          if (errorElement) {
            errorElement.textContent = error.message;
            errorElement.style.display = 'block';
          }
        } finally {
          // Khôi phục nút đăng ký
          registerButton.textContent = 'Đăng ký';
          registerButton.disabled = false;
        }
      });
    }
  }
});
