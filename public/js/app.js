// public/js/app.js

// Khởi tạo global object AppUtils để chia sẻ tiện ích giữa các file
window.AppUtils = window.AppUtils || {};

// Hàm lấy token từ các nguồn lưu trữ
window.AppUtils.getToken = function() {
  return getCookie('sb_token') || 
         localStorage.getItem('token') || 
         localStorage.getItem('auth.token') || 
         sessionStorage.getItem('sb_token');
};

// Hàm lấy cookie 
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

// Công khai hàm getCookie qua AppUtils
window.AppUtils.getCookie = getCookie;

// Hàm lưu token vào tất cả nguồn lưu trữ
window.AppUtils.saveToken = function(token) {
  if (!token) return;
  
  // Lưu vào cookie
  const expires = new Date(Date.now() + 7 * 864e5).toUTCString();
  document.cookie = `sb_token=${token}; expires=${expires}; path=/`;
  
  // Lưu vào localStorage
  localStorage.setItem('token', token);
  localStorage.setItem('isLoggedIn', 'true');
  
  // Lưu vào sessionStorage
  sessionStorage.setItem('sb_token', token);
  
  console.log('Token đã được lưu vào tất cả nguồn lưu trữ');
};

// Biến toàn cục
let isLoggedIn = false;
let supabaseClient = null;
let wsReconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_INTERVAL = 5000;
const HEARTBEAT_INTERVAL = 30000;
let wsHeartbeatTimer = null;
let wsReconnectTimer = null;
let wsLastPongTime = Date.now(); // Thời gian nhận pong cuối cùng

// Biến global để theo dõi việc khởi tạo Supabase
window._supabaseInitialized = false;

class App {
  constructor() {
    this.ws = null;
    this.wsStatus = 'disconnected';
    this.forceClosed = false; // Biến để theo dõi việc đóng có chủ ý
    // Chỉ khởi tạo WebSocket nếu đã đăng nhập
    if (localStorage.getItem('sb-token')) {
      this.initWebSocket();
    }
    this.initEventListeners();
  }

  initWebSocket() {
    try {
      // Xóa các timer cũ nếu có
      this.clearTimers();
      
      // Đóng kết nối cũ nếu còn
      if (this.ws) {
        this.forceClosed = true; // Đánh dấu đóng có chủ ý
        this.ws.onclose = null; // Tránh gọi lại handleWebSocketClose khi đóng có chủ ý
        this.ws.close();
        this.ws = null;
      }

      // Reset biến theo dõi đóng có chủ ý
      this.forceClosed = false;

      // Cập nhật trạng thái
      this.wsStatus = 'connecting';
      
      // Tạo URL WebSocket với token xác thực
      const token = localStorage.getItem('sb-token');
      if (!token) {
        console.log('Không có token, không thể kết nối WebSocket');
        return;
      }
      
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`;
      
      console.log('Đang kết nối WebSocket đến:', wsUrl.split('?')[0]);
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('✅ WebSocket đã kết nối');
        this.wsStatus = 'connected';
        wsReconnectAttempts = 0;
        wsLastPongTime = Date.now(); // Reset thời gian pong
        
        // Bắt đầu gửi heartbeat để duy trì kết nối
        this.startHeartbeat();
        
        // Thông báo cho người dùng nếu đang kết nối lại
        if (wsReconnectAttempts > 0) {
          showToast('Kết nối đã được khôi phục', 'success');
        }
      };
      
      this.ws.onmessage = (event) => {
        try {
          // Kiểm tra nếu là heartbeat
          if (event.data === 'pong') {
            console.log('Nhận heartbeat từ server');
            wsLastPongTime = Date.now(); // Cập nhật thời gian pong
            return;
          }
          
          const data = JSON.parse(event.data);
          this.handleWebSocketMessage(data);
        } catch (error) {
          console.error('Lỗi xử lý message WebSocket:', error);
        }
      };
      
      this.ws.onclose = (event) => {
        this.wsStatus = 'disconnected';
        console.log(`WebSocket đã ngắt kết nối. Mã: ${event.code}, Lý do: ${event.reason || 'Không có lý do'}`);
        
        // Dừng heartbeat
        this.clearTimers();
        
        // Nếu đóng có chủ ý, không thử kết nối lại
        if (this.forceClosed) {
          console.log('WebSocket đóng có chủ ý, không thử kết nối lại');
          return;
        }
        
        // Chỉ thử kết nối lại nếu người dùng đã đăng nhập
        if (localStorage.getItem('sb-token')) {
          this.handleWebSocketClose(event);
        }
      };
      
      this.ws.onerror = (error) => {
        console.error('Lỗi WebSocket:', error);
        this.wsStatus = 'error';
        
        // Hiển thị thông báo lỗi nếu không phải lần đầu kết nối
        if (wsReconnectAttempts > 0) {
          showToast('Kết nối bị gián đoạn, đang thử kết nối lại...', 'warning');
        }
      };
    } catch (error) {
      console.error('Lỗi khởi tạo WebSocket:', error);
      this.wsStatus = 'error';
      
      // Thử kết nối lại sau lỗi khởi tạo
      this.handleWebSocketClose();
    }
  }
  
  // Xóa tất cả các timer
  clearTimers() {
    if (wsHeartbeatTimer) {
      clearInterval(wsHeartbeatTimer);
      wsHeartbeatTimer = null;
    }
    
    if (wsReconnectTimer) {
      clearTimeout(wsReconnectTimer);
      wsReconnectTimer = null;
    }
  }
  
  // Gửi heartbeat để duy trì kết nối
  startHeartbeat() {
    if (wsHeartbeatTimer) {
      clearInterval(wsHeartbeatTimer);
    }
    
    wsHeartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          // Kiểm tra xem đã nhận được pong từ lần ping trước chưa
          const now = Date.now();
          const timeSinceLastPong = now - wsLastPongTime;
          
          // Nếu không nhận được pong trong 2 lần heartbeat interval, kết nối lại
          if (timeSinceLastPong > HEARTBEAT_INTERVAL * 2) {
            console.log(`Không nhận được pong trong ${timeSinceLastPong}ms, kết nối lại...`);
            this.initWebSocket();
            return;
          }
          
          console.log('Gửi ping đến server');
          this.ws.send(JSON.stringify({ type: 'ping', timestamp: now }));
        } catch (error) {
          console.error('Lỗi khi gửi heartbeat:', error);
          // Nếu gửi heartbeat lỗi, thử kết nối lại
          this.initWebSocket();
        }
      } else if (this.ws) {
        // WebSocket không ở trạng thái mở, thử kết nối lại
        console.log(`WebSocket ở trạng thái ${this.ws.readyState}, thử kết nối lại`);
        this.initWebSocket();
      } else {
        // Không có WebSocket, thử kết nối
        console.log('Không có WebSocket, thử kết nối');
        this.initWebSocket();
      }
    }, HEARTBEAT_INTERVAL);
  }

  handleWebSocketMessage(data) {
    // Xử lý các event realtime
    switch (data.type) {
      case 'expense_added':
        this.updateExpensesList(data.expense);
        break;
      case 'expense_updated':
        this.updateExpenseItem(data.expense);
        break;
      case 'expense_deleted':
        this.removeExpenseItem(data.expenseId);
        break;
      case 'auth_error':
        // Xử lý lỗi xác thực
        console.error('Lỗi xác thực WebSocket:', data.message);
        showToast('Phiên làm việc hết hạn, vui lòng đăng nhập lại', 'danger');
        setTimeout(() => handleLogout(), 3000);
        break;
      case 'pong':
        // Xử lý pong từ server
        console.log('Nhận pong từ server');
        wsLastPongTime = Date.now();
        break;
    }
  }

  handleWebSocketClose(event) {
    // Tăng số lần thử kết nối lại
    wsReconnectAttempts++;
    
    // Tính toán thời gian chờ với backoff
    const delay = Math.min(RECONNECT_INTERVAL * Math.pow(1.5, wsReconnectAttempts - 1), 60000);
    
    console.log(`WebSocket ngắt kết nối. Thử kết nối lại lần ${wsReconnectAttempts} sau ${delay/1000} giây...`);
    
    // Hiển thị thông báo nếu đã thử nhiều lần
    if (wsReconnectAttempts > 3) {
      showToast(`Kết nối bị gián đoạn. Đang thử kết nối lại (${wsReconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`, 'warning');
    }
    
    // Xóa timer cũ nếu có
    if (wsReconnectTimer) {
      clearTimeout(wsReconnectTimer);
    }
    
    // Thử kết nối lại sau một khoảng thời gian
    if (wsReconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      wsReconnectTimer = setTimeout(() => {
        // Kiểm tra lại token trước khi kết nối lại
        const token = localStorage.getItem('sb-token');
        if (token) {
          this.initWebSocket();
        } else {
          console.log('Không có token, không thử kết nối lại WebSocket');
        }
      }, delay);
    } else {
      console.log('Đã vượt quá số lần thử kết nối lại WebSocket');
      showToast('Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng và làm mới trang.', 'danger');
      
      // Thêm nút làm mới trang
      const refreshButton = document.createElement('button');
      refreshButton.className = 'btn btn-primary mt-3';
      refreshButton.textContent = 'Làm mới trang';
      refreshButton.onclick = () => window.location.reload();
      
      const mainContent = document.querySelector('.main-content');
      if (mainContent) {
        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert alert-warning text-center';
        alertDiv.innerHTML = '<strong>Mất kết nối đến máy chủ</strong><p>Vui lòng kiểm tra kết nối mạng của bạn</p>';
        alertDiv.appendChild(refreshButton);
        
        mainContent.prepend(alertDiv);
      }
    }
  }

  initEventListeners() {
    // Xử lý các sự kiện UI
  }

  async updateExpensesList(newExpense) {
    // Cập nhật UI khi có chi phí mới
    if (window.location.pathname.includes('/dashboard')) {
      await loadDashboardData();
    } else if (window.location.pathname.includes('/expenses')) {
      await loadExpenses();
    }
  }

  updateExpenseItem(updatedExpense) {
    // Cập nhật UI khi chi phí được cập nhật
    if (window.location.pathname.includes('/dashboard')) {
      loadDashboardData();
    } else if (window.location.pathname.includes('/expenses')) {
      const expenseElement = document.querySelector(`[data-expense-id="${updatedExpense.id}"]`);
      if (expenseElement) {
        // Cập nhật thông tin chi phí trong DOM
        updateExpenseItemUI(expenseElement, updatedExpense);
      }
    }
  }

  removeExpenseItem(expenseId) {
    // Xóa chi phí khỏi UI
    if (window.location.pathname.includes('/dashboard')) {
      loadDashboardData();
    } else if (window.location.pathname.includes('/expenses')) {
      const expenseElement = document.querySelector(`[data-expense-id="${expenseId}"]`);
      if (expenseElement) {
        expenseElement.remove();
      }
    }
  }
}

// Khởi tạo khi tải trang
document.addEventListener('DOMContentLoaded', async function() {
  console.log('Khởi tạo trang... Path:', window.location.pathname);
  
  // Khởi tạo các biến trạng thái
  window._loadingDashboard = false;
  window._loadingExpenses = false;
  window._redirecting = false;
  window._checkingLogin = false;
  window._loginChecked = false;
  
  // Reset isLoggedIn dựa trên localStorage
  isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
  console.log('Trạng thái đăng nhập ban đầu từ localStorage:', isLoggedIn);
  
  // Khởi tạo Supabase client
  initSupabaseClient();
  
  try {
    // Xóa bộ nhớ session nếu bị reload trang
    const pageLoadCount = sessionStorage.getItem('page_load_count') || '0';
    const newCount = parseInt(pageLoadCount) + 1;
    sessionStorage.setItem('page_load_count', newCount.toString());
    
    if (newCount > 3 && !isLoggedIn) {
      console.log('Phát hiện reload trang nhiều lần. Xóa dữ liệu session để tránh vòng lặp.');
      sessionStorage.clear();
      localStorage.removeItem('isLoggedIn');
      window._redirecting = false;
    }
    
    // Xóa bộ nhớ session cũ nếu đang ở trang login
    if (window.location.pathname.includes('/login')) {
      sessionStorage.removeItem('last_login_check');
      console.log('Đã xóa bộ nhớ kiểm tra đăng nhập cũ tại trang login');
    }
    
    // Kiểm tra đăng nhập chỉ khi:
    // 1. Chưa kiểm tra trong session này
    // 2. Đang ở trang dashboard hoặc trang cần xác thực
    // 3. Đã quá thời gian kiểm tra gần đây
    const lastCheck = sessionStorage.getItem('last_login_check');
    const now = Date.now();
    const currentPath = window.location.pathname;
    const needsAuth = !currentPath.includes('/login') && currentPath !== '/';
    const checkExpired = !lastCheck || (now - parseInt(lastCheck)) > 30000; // 30 giây
    
    if (needsAuth || checkExpired || currentPath.includes('/dashboard')) {
      console.log('Kiểm tra đăng nhập...');
      isLoggedIn = await checkLoginStatus();
      sessionStorage.setItem('last_login_check', now.toString());
      window._loginChecked = true;
    } else {
      console.log('Bỏ qua kiểm tra đăng nhập, sử dụng trạng thái từ localStorage:', isLoggedIn);
    }
    
    // Cập nhật lại localStorage
    localStorage.setItem('isLoggedIn', isLoggedIn ? 'true' : 'false');
    
    // Nếu đã đăng nhập thì mới khởi tạo app, nếu ở trang login thì cũng khởi tạo
    if (isLoggedIn || window.location.pathname.includes('/login')) {
      if (!window.app) {
        console.log('Khởi tạo App...');
        window.app = new App();
      } else {
        console.log('App đã được khởi tạo trước đó');
      }
    }
    
    // Chỉ tải dữ liệu dashboard hoặc expenses nếu đã đăng nhập và đang ở trang tương ứng
    if (isLoggedIn) {
      // Tải dữ liệu dashboard nếu đang ở trang dashboard
      if (window.location.pathname.includes('/dashboard') && !window._loadingDashboard) {
        window._loadingDashboard = true;
        console.log('Đang tải dữ liệu dashboard...');
        await loadDashboardData();
        window._loadingDashboard = false;
      }
      
      // Tải dữ liệu expenses nếu đang ở trang expenses
      if (window.location.pathname.includes('/expenses') && !window._loadingExpenses) {
        window._loadingExpenses = true;
        console.log('Đang tải dữ liệu chi phí...');
        await loadExpenses();
        window._loadingExpenses = false;
      }
    }
  } catch (error) {
    console.error('Lỗi trong DOMContentLoaded:', error);
  } finally {
    // Đảm bảo reset các flag khi hoàn tất khởi tạo
    setTimeout(() => {
      window._checkingLogin = false;
      window._redirecting = false;
    }, 1000);
  }
  
  // Xử lý đăng xuất
  const logoutButton = document.getElementById('logout-button');
  if (logoutButton) {
    logoutButton.addEventListener('click', function(e) {
      e.preventDefault(); // Ngăn chặn hành vi mặc định của link
      handleLogout();
    });
  }
});

// Khởi tạo Supabase client
function initSupabaseClient() {
  if (window._supabaseInitialized && window.supabase && window.supabase.auth) {
    console.log('Supabase client đã được khởi tạo trước đó, sử dụng lại');
    return window.supabase;
  }

  console.log('Đang khởi tạo Supabase client...');
  
  // Kiểm tra xem supabase đã tồn tại trong window.supabase chưa
  if (window.supabase) {
    console.log('Phát hiện window.supabase đã tồn tại, kiểm tra tính hợp lệ...');
    
    // Kiểm tra xem supabase client có đầy đủ các phương thức cần thiết không
    if (window.supabase.auth && typeof window.supabase.auth.getSession === 'function') {
      console.log('window.supabase hợp lệ, sử dụng instance hiện có');
      window._supabaseInitialized = true;
      return window.supabase;
    } else {
      console.log('window.supabase không hợp lệ, cần khởi tạo lại');
    }
  }
  
  // Kiểm tra xem thư viện Supabase đã được tải chưa
  if (typeof supabase !== 'undefined' || window.supabase || window.supabaseClient) {
    console.log('Thư viện Supabase khả dụng, tạo client mới');
  } else {
    console.error('Thư viện Supabase không khả dụng, vui lòng tải thư viện trước');
    return null;
  }
  
  try {
    // Tạo client mới với URL và API key từ biến môi trường hoặc cấu hình
    const supabaseUrl = 'https://iifnfqsusnjqyvegwchr.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpZm5mcXN1c25qcXl2ZWd3Y2hyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE1Nzk2MDQsImV4cCI6MjA1NzE1NTYwNH0.Lei4t4UKezBHkb3CNcXuVQ5S4Fr0fY0J4oswu-GtcVU';
    
    // Khởi tạo client
    const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);
    
    // Lưu vào biến global để các module khác sử dụng
    window.supabase = supabaseClient;
    console.log('✅ Supabase client đã được khởi tạo thành công');
    
    window._supabaseInitialized = true;
    return supabaseClient;
  } catch (error) {
    console.error('❌ Lỗi khởi tạo Supabase client:', error);
    return null;
  }
}

// Hàm đợi khởi tạo Supabase
window.waitForSupabase = async function() {
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    if (window.supabase && window.supabase.auth) {
      console.log('✅ Supabase đã sẵn sàng sau ' + attempts + ' lần thử');
      return window.supabase;
    }
    
    console.log(`Đang đợi Supabase khởi tạo... (${attempts + 1}/${maxAttempts})`);
    await new Promise(resolve => setTimeout(resolve, 300));
    attempts++;
  }
  
  console.warn('⚠️ Supabase không khởi tạo sau nhiều lần thử');
  return null;
};

// Đồng bộ hóa userData giữa các trang
window.syncUserData = function(userData) {
  if (!userData) return;
  
  // Lưu userData vào window để các trang khác có thể truy cập
  window.userData = userData;
  
  // Lưu các thông tin cơ bản vào localStorage để dùng giữa các trang
  localStorage.setItem('userEmail', userData.email);
  localStorage.setItem('userName', userData.user_metadata?.full_name || userData.email.split('@')[0]);
  localStorage.setItem('userId', userData.id);
  
  // Lưu thời gian đồng bộ cuối cùng
  localStorage.setItem('userDataLastSync', new Date().toISOString());
  
  console.log('✅ Đã đồng bộ userData:', userData.email);
};

// Kiểm tra trạng thái đăng nhập
async function checkLoginStatus() {
  try {
    // Ngăn không cho kiểm tra đồng thời nhiều lần
    if (window._checkingLogin) {
      console.log('Đang trong quá trình kiểm tra đăng nhập, bỏ qua');
      return isLoggedIn;
    }
    
    window._checkingLogin = true;
    console.log('Bắt đầu kiểm tra trạng thái đăng nhập...');
    
    // Kiểm tra các token
    const pathName = window.location.pathname;
    console.log('Path hiện tại:', pathName);
    
    // Lấy token từ các nguồn
    const cookieToken = getCookie('sb-access-token');
    const localToken = localStorage.getItem('sb-access-token');
    const sessionToken = sessionStorage.getItem('sb-access-token');
    
    console.log('Token từ cookie:', cookieToken ? 'Có' : 'Không có');
    console.log('Token từ localStorage:', localToken ? 'Có' : 'Không có');
    console.log('Token từ sessionStorage:', sessionToken ? 'Có' : 'Không có');
    
    // Kiểm tra và đồng bộ token nếu cần
    if (cookieToken || localToken || sessionToken) {
      console.log('✅ Đã tìm thấy token, đồng bộ hóa...');
      
      // Tìm token tồn tại
      const token = cookieToken || localToken || sessionToken;
      
      // Đồng bộ hóa token qua các kho lưu trữ
      if (!cookieToken && token) {
        document.cookie = `sb-access-token=${token}; path=/; max-age=${60 * 60 * 24 * 7}`;
      }
      
      if (!localToken && token) {
        localStorage.setItem('sb-access-token', token);
      }
      
      if (!sessionToken && token) {
        sessionStorage.setItem('sb-access-token', token);
      }
      
      // Kiểm tra token với Supabase
      try {
        // Đảm bảo supabase đã được khởi tạo
        if (!window.supabase) {
          await initSupabaseClient();
        }
        
        // Kiểm tra token hiện tại
        const { data, error } = await supabase.auth.getUser();
        
        if (error) {
          console.log('❌ Token không hợp lệ:', error.message);
          
          // Xóa token không hợp lệ
          document.cookie = 'sb-access-token=; path=/; max-age=0';
          localStorage.removeItem('sb-access-token');
          sessionStorage.removeItem('sb-access-token');
          
          isLoggedIn = false;
          localStorage.setItem('isLoggedIn', 'false');
          window._checkingLogin = false;
          return false;
        }
        
        // Token hợp lệ và có user
        if (data && data.user) {
          console.log('✅ Token hợp lệ, user:', data.user.email);
          isLoggedIn = true;
          localStorage.setItem('isLoggedIn', 'true');
          
          // Đồng bộ hóa thông tin user
          window.syncUserData(data.user);
          
          // Cập nhật UI tương ứng
          updateUserInfo(data.user);
          
          window._checkingLogin = false;
          return true;
        } else {
          // Không có data.user mặc dù không có lỗi
          console.log('❌ Không có thông tin user trong phản hồi');
          isLoggedIn = false;
          localStorage.removeItem('isLoggedIn');
          window._checkingLogin = false;
          return false;
        }
      } catch (error) {
        console.error('Lỗi kiểm tra token:', error);
        
        // Nếu lỗi mạng, giữ nguyên trạng thái hiện tại
        if (error.message && (error.message.includes('Failed to fetch') || error.message.includes('NetworkError'))) {
          console.log('Lỗi mạng khi kiểm tra token, giữ nguyên trạng thái hiện tại');
          window._checkingLogin = false;
          return isLoggedIn;
        }
        
        isLoggedIn = false;
        window._checkingLogin = false;
        return false;
      }
    } else {
      console.log('❌ Không tìm thấy token nào');
      isLoggedIn = false;
      localStorage.setItem('isLoggedIn', 'false');
      window._checkingLogin = false;
      return false;
    }
  } catch (error) {
    console.error('Lỗi kiểm tra đăng nhập:', error);
    window._checkingLogin = false;
    return false;
  }
}

// Cập nhật thông tin người dùng trên UI
function updateUserInfo(user) {
  const userNameElement = document.getElementById('user-name');
  const userEmailElement = document.getElementById('user-email');
  
  if (userNameElement) {
    userNameElement.textContent = user.user_metadata?.full_name || user.email.split('@')[0];
  }
  
  if (userEmailElement) {
    userEmailElement.textContent = user.email;
  }
}

// Xử lý đăng xuất
async function handleLogout() {
  try {
    console.log('Đang thực hiện đăng xuất...');
    
    // Đóng WebSocket connection nếu có
    if (window.app && window.app.ws) {
      window.app.forceClosed = true; // Đánh dấu đóng có chủ ý
      window.app.ws.close();
      window.app.ws = null;
      window.app.clearTimers(); // Xóa tất cả timer
      console.log('Đã đóng WebSocket connection');
    }

    // Xóa token và thông tin người dùng từ tất cả nơi lưu trữ
    localStorage.removeItem('sb-token');
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userName');
    sessionStorage.removeItem('last_login_check');
    
    // Xóa cookie
    document.cookie = 'sb_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    
    // Cập nhật biến toàn cục
    isLoggedIn = false;
    window._redirecting = false;
    window._checkingLogin = false;
    
    // Hiển thị overlay đăng xuất
    const overlay = document.createElement('div');
    overlay.className = 'logout-overlay';
    overlay.innerHTML = `
      <div class="logout-message">
        <div class="logout-spinner"></div>
        <p>Đang đăng xuất...</p>
      </div>
    `;
    document.body.appendChild(overlay);
    
    // Đợi 1 giây trước khi chuyển hướng
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Chuyển về trang đăng nhập (bằng replace để xóa lịch sử)
    console.log('Chuyển hướng đến trang login sau khi đăng xuất');
    window.location.replace('/login');
  } catch (error) {
    console.error('Lỗi khi đăng xuất:', error);
    
    // Trong trường hợp lỗi, vẫn chuyển về trang login
    alert('Có lỗi xảy ra khi đăng xuất, vui lòng thử lại.');
    window.location.replace('/login');
  }
}

// Hiển thị loading
function showLoading() {
  console.log('Hiển thị loading overlay');
  try {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      // Đảm bảo không có timeout cũ
      if (window._loadingTimeout) {
        clearTimeout(window._loadingTimeout);
      }
      overlay.style.display = 'flex';
    } else {
      console.error('Không tìm thấy loading-overlay, đang tạo mới');
      // Tạo loading overlay nếu không có
      const newOverlay = document.createElement('div');
      newOverlay.id = 'loading-overlay';
      newOverlay.innerHTML = `
        <div class="loading-container">
          <div class="loading-spinner"></div>
          <p>Đang tải dữ liệu...</p>
        </div>
      `;
      newOverlay.style.position = 'fixed';
      newOverlay.style.top = '0';
      newOverlay.style.left = '0';
      newOverlay.style.width = '100%';
      newOverlay.style.height = '100%';
      newOverlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
      newOverlay.style.display = 'flex';
      newOverlay.style.justifyContent = 'center';
      newOverlay.style.alignItems = 'center';
      newOverlay.style.zIndex = '9999';
      
      document.body.appendChild(newOverlay);
    }
    
    // Đặt timeout an toàn để tự động ẩn loading sau 15 giây
    window._loadingTimeout = setTimeout(() => {
      console.log('Tự động ẩn loading sau 15 giây');
      hideLoading();
    }, 15000);
  } catch (error) {
    console.error('Lỗi khi hiển thị loading overlay:', error);
  }
}

// Ẩn loading
function hideLoading() {
  console.log('Ẩn loading overlay');
  try {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      overlay.style.display = 'none';
      // Xóa timeout nếu có
      if (window._loadingTimeout) {
        clearTimeout(window._loadingTimeout);
        window._loadingTimeout = null;
      }
    } else {
      console.error('Không tìm thấy loading-overlay');
    }
  } catch (error) {
    console.error('Lỗi khi ẩn loading overlay:', error);
  }
}

// Tải dữ liệu dashboard
async function loadDashboardData() {
  try {
    // Hiển thị loading
    showLoading();
    
    // Lấy token
    const token = localStorage.getItem('sb-token');
    if (!token) {
      hideLoading();
      showError('Vui lòng đăng nhập lại');
      window.location.replace('/login');
      return;
    }

    // Ghi log loading
    console.log('Bắt đầu tải dữ liệu dashboard');
    
    // Khởi tạo các giá trị mặc định
    initializeDashboardUI();
    
    // Khởi tạo bộ lọc
    initDashboardFilters();

    try {
      // Lấy tổng quan chi phí
      console.log('Tải API summary...');
      const summaryResponse = await fetch('/api/dashboard/summary', {
        headers: { 'Authorization': `Bearer ${token}` },
        // Thêm timeout 8 giây
        signal: AbortSignal.timeout(8000)
      });
      
      if (summaryResponse.ok) {
        const summary = await summaryResponse.json();
        console.log('Đã nhận dữ liệu summary:', summary);
        updateDashboardSummary(summary);
      } else {
        console.error('Không thể tải dữ liệu tổng quan:', summaryResponse.status);
      }

      // Lấy chi phí theo thời gian
      console.log('Tải API timeline...');
      const timelineResponse = await fetch('/api/dashboard/timeline?range=7', {
        headers: { 'Authorization': `Bearer ${token}` },
        // Thêm timeout 8 giây
        signal: AbortSignal.timeout(8000)
      });
      
      if (timelineResponse.ok) {
        const timeline = await timelineResponse.json();
        console.log('Đã nhận dữ liệu timeline:', timeline);
        
        if (timeline.expenses?.length > 0) {
          const timeChartData = timeline.expenses.map(exp => ({
            date: new Date(exp.date).toLocaleDateString('vi-VN'),
            amount: exp.amount
          }));
          if (typeof window.renderTimeChart === 'function') {
            window.renderTimeChart(timeChartData);
          } else {
            console.error('Hàm renderTimeChart không tồn tại');
          }
        }
      } else {
        console.error('Không thể tải dữ liệu timeline:', timelineResponse.status);
      }

      // Lấy chi phí theo danh mục
      console.log('Tải API categories...');
      const categoryResponse = await fetch('/api/dashboard/categories?period=month', {
        headers: { 'Authorization': `Bearer ${token}` },
        // Thêm timeout 8 giây
        signal: AbortSignal.timeout(8000)
      });
      
      if (categoryResponse.ok) {
        const categories = await categoryResponse.json();
        console.log('Đã nhận dữ liệu categories:', categories);
        
        if (Object.keys(categories).length > 0) {
          if (typeof window.renderCategoryChart === 'function') {
            window.renderCategoryChart(categories);
          } else {
            console.error('Hàm renderCategoryChart không tồn tại');
          }
        }
      } else {
        console.error('Không thể tải dữ liệu danh mục:', categoryResponse.status);
      }

      // Lấy chi phí gần đây
      console.log('Tải API recent...');
      const recentResponse = await fetch('/api/dashboard/recent?limit=5', {
        headers: { 'Authorization': `Bearer ${token}` },
        // Thêm timeout 8 giây
        signal: AbortSignal.timeout(8000)
      });
      
      if (recentResponse.ok) {
        const recent = await recentResponse.json();
        console.log('Đã nhận dữ liệu recent:', recent);
        renderRecentExpenses(recent.expenses);
      } else {
        console.error('Không thể tải chi phí gần đây:', recentResponse.status);
        showEmptyState('recent-expenses-grid', 'Không có dữ liệu chi phí gần đây');
      }

      // Lấy chi phí định kỳ
      console.log('Tải API recurring...');
      const recurringResponse = await fetch('/api/dashboard/recurring', {
        headers: { 'Authorization': `Bearer ${token}` },
        // Thêm timeout 8 giây
        signal: AbortSignal.timeout(8000)
      });
      
      if (recurringResponse.ok) {
        const recurring = await recurringResponse.json();
        console.log('Đã nhận dữ liệu recurring:', recurring);
        renderRecurringExpenses(recurring.expenses);
      } else {
        console.error('Không thể tải chi phí định kỳ:', recurringResponse.status);
        showEmptyState('upcoming-recurring-expenses', 'Không có chi phí định kỳ');
      }

    } catch (error) {
      console.error('Lỗi khi tải dữ liệu:', error);
      // Hiển thị thông báo lỗi cụ thể nếu là lỗi timeout
      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        showError('Tải dữ liệu quá thời gian. Vui lòng thử lại sau.');
      } else {
        showError('Có lỗi xảy ra khi tải dữ liệu: ' + error.message);
      }
    } finally {
      // Đảm bảo luôn ẩn loading kể cả khi có lỗi
      console.log('Kết thúc tải dữ liệu dashboard');
      hideLoading();
    }
  } catch (error) {
    console.error('Lỗi nghiêm trọng khi tải dashboard:', error);
    // Đảm bảo luôn ẩn loading kể cả khi có lỗi
    hideLoading();
    showError('Không thể tải dữ liệu dashboard: ' + error.message);
  }
}

// Khởi tạo UI dashboard với giá trị mặc định
function initializeDashboardUI() {
  // Khởi tạo các giá trị mặc định cho tổng quan
  document.getElementById('total-month-expenses').textContent = formatCurrency(0);
  document.getElementById('average-daily-expense').textContent = formatCurrency(0);
  
  const changeElement = document.getElementById('month-expenses-change');
  if (changeElement) {
    const changeIcon = changeElement.querySelector('i');
    changeElement.textContent = '0%';
    changeElement.className = 'stat-change text-muted';
  }

  // Xóa nội dung các container
  const containers = [
    'recent-expenses-grid',
    'upcoming-recurring-expenses'
  ];
  
  containers.forEach(id => {
    const container = document.getElementById(id);
    if (container) container.innerHTML = '';
  });
}

// Cập nhật phần tổng quan dashboard
function updateDashboardSummary(summary) {
  try {
    // Kiểm tra summary có dữ liệu không
    if (!summary) {
      console.error('Không có dữ liệu summary');
      return;
    }
    
    console.log('Cập nhật UI với dữ liệu summary:', summary);
    
    // Cập nhật tổng chi phí
    const totalElement = document.getElementById('total-month-expenses');
    if (totalElement) {
      totalElement.textContent = formatCurrency(summary.currentMonthTotal || 0);
    } else {
      console.error('Không tìm thấy phần tử #total-month-expenses');
    }
    
    // Cập nhật chi phí trung bình
    const avgElement = document.getElementById('average-daily-expense');
    if (avgElement) {
      avgElement.textContent = formatCurrency(summary.averageDaily || 0);
    } else {
      console.error('Không tìm thấy phần tử #average-daily-expense');
    }
    
    // Cập nhật phần trăm thay đổi
    const changeElement = document.getElementById('month-expenses-change');
    if (!changeElement) {
      console.error('Không tìm thấy phần tử #month-expenses-change');
      return;
    }
    
    // Tìm icon trong changeElement, nếu không có thì tạo mới
    let changeIcon = changeElement.querySelector('i');
    if (!changeIcon) {
      console.warn('Không tìm thấy icon trong #month-expenses-change, tạo mới');
      changeIcon = document.createElement('i');
      changeIcon.className = 'bi bi-arrow-right';
      changeElement.prepend(changeIcon);
    }
    
    // Xóa nội dung text (giữ lại icon)
    const percentValue = `${Math.abs(summary.percentChange || 0).toFixed(1)}%`;
    
    // Xóa tất cả node con trừ icon đầu tiên
    while (changeElement.childNodes.length > 1) {
      changeElement.removeChild(changeElement.lastChild);
    }
    
    // Thêm text phần trăm
    changeElement.appendChild(document.createTextNode(percentValue));
    
    // Reset classes
    changeElement.classList.remove('text-danger', 'text-success', 'text-muted');
    
    // Cập nhật icon và class dựa trên giá trị
    if (summary.percentChange > 0) {
      changeIcon.className = 'bi bi-arrow-up';
      changeElement.classList.add('text-danger');
    } else if (summary.percentChange < 0) {
      changeIcon.className = 'bi bi-arrow-down';
      changeElement.classList.add('text-success');
    } else {
      changeIcon.className = 'bi bi-arrow-right';
      changeElement.classList.add('text-muted');
    }
  } catch (error) {
    console.error('Lỗi khi cập nhật dashboard summary:', error);
  }
}

// Hiển thị trạng thái trống
function showEmptyState(containerId, message) {
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="bi bi-inbox"></i>
        <p>${message}</p>
      </div>
    `;
  }
}

// Hiển thị thông báo lỗi
function showError(message) {
  const errorContainer = document.createElement('div');
  errorContainer.className = 'alert alert-danger alert-dismissible fade show';
  errorContainer.innerHTML = `
    <i class="bi bi-exclamation-triangle-fill"></i>
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;
  
  // Thêm vào đầu trang
  const mainContent = document.querySelector('.main-content');
  if (mainContent) {
    mainContent.insertBefore(errorContainer, mainContent.firstChild);
  }
  
  // Tự động ẩn sau 5 giây
  setTimeout(() => {
    errorContainer.remove();
  }, 5000);
}

// Render chi phí gần đây
function renderRecentExpenses(expenses) {
  const container = document.getElementById('recent-expenses-grid');
  const template = document.getElementById('expense-card-template');
  
  if (!container || !template) return;
  container.innerHTML = '';

  if (!expenses || expenses.length === 0) {
    showEmptyState('recent-expenses-grid', 'Không có chi phí gần đây');
    return;
  }

  expenses.forEach(expense => {
    try {
      const clone = template.content.cloneNode(true);
      
      // Cập nhật nội dung
      clone.querySelector('.expense-icon i').className = `bi bi-${getCategoryIcon(expense.category || expense.danh_muc)}`;
      clone.querySelector('.expense-title').textContent = expense.noi_dung || expense.title || 'Không có tiêu đề';
      clone.querySelector('.expense-category').textContent = expense.danh_muc || expense.category || 'Không phân loại';
      
      // Xử lý ngày tháng an toàn
      let dateText = '';
      try {
        const dateField = expense.ngay_thang || expense.date;
        if (dateField) {
          const expenseDate = new Date(dateField);
          if (!isNaN(expenseDate.getTime())) {
            dateText = expenseDate.toLocaleDateString('vi-VN');
          } else {
            dateText = dateField; // Sử dụng giá trị gốc nếu không thể chuyển đổi
          }
        } else {
          dateText = 'Không có ngày';
        }
      } catch (error) {
        console.error('Lỗi khi định dạng ngày tháng:', error);
        dateText = 'Không có ngày';
      }
      clone.querySelector('.expense-date').textContent = dateText;
      
      // Xử lý số tiền
      const amount = expense.gia_tien || expense.amount || 0;
      clone.querySelector('.expense-amount').textContent = formatCurrency(amount);

      container.appendChild(clone);
    } catch (error) {
      console.error('Lỗi khi render chi phí:', error, expense);
    }
  });
}

// Render chi phí định kỳ
function renderRecurringExpenses(expenses) {
  const container = document.getElementById('upcoming-recurring-expenses');
  const template = document.getElementById('recurring-expense-template');
  
  if (!container || !template) return;
  container.innerHTML = '';

  if (!expenses || expenses.length === 0) {
    showEmptyState('upcoming-recurring-expenses', 'Không có chi phí định kỳ sắp đến hạn');
    return;
  }

  expenses.forEach(expense => {
    try {
      const clone = template.content.cloneNode(true);
      
      // Cập nhật nội dung
      clone.querySelector('.recurring-expense-icon i').className = `bi bi-${getCategoryIcon(expense.category || expense.danh_muc)}`;
      clone.querySelector('.recurring-expense-title').textContent = expense.noi_dung || expense.title || 'Không có tiêu đề';
      clone.querySelector('.recurring-expense-category').textContent = expense.danh_muc || expense.category || 'Không phân loại';
      
      // Xử lý tần suất - mặc định là hàng tháng nếu không có
      const frequency = expense.frequency || 'monthly';
      clone.querySelector('.recurring-expense-frequency').textContent = getFrequencyText(frequency);
      
      // Xử lý số tiền
      const amount = expense.gia_tien || expense.amount || 0;
      clone.querySelector('.recurring-expense-amount').textContent = formatCurrency(amount);
      
      // Xử lý ngày tháng an toàn
      let dueDateText = '';
      try {
        const dateField = expense.ngay_thang || expense.next_date;
        if (dateField) {
          const nextDate = new Date(dateField);
          if (!isNaN(nextDate.getTime())) {
            dueDateText = nextDate.toLocaleDateString('vi-VN');
          } else {
            dueDateText = dateField; // Sử dụng giá trị gốc nếu không thể chuyển đổi
          }
        } else {
          dueDateText = 'Không có ngày';
        }
      } catch (error) {
        console.error('Lỗi khi định dạng ngày đến hạn:', error);
        dueDateText = 'Không có ngày';
      }
      clone.querySelector('.due-date').textContent = dueDateText;

      container.appendChild(clone);
    } catch (error) {
      console.error('Lỗi khi render chi phí định kỳ:', error, expense);
    }
  });
}

// Lấy icon cho danh mục
function getCategoryIcon(category) {
  const icons = {
    'Ăn uống': 'cup-hot',
    'Đi lại': 'car-front',
    'Mua sắm': 'cart',
    'Giải trí': 'film',
    'Giáo dục': 'book',
    'Y tế': 'heart-pulse',
    'Nhà cửa': 'house',
    'Hóa đơn': 'receipt',
    'Quà tặng': 'gift',
    'Tiết kiệm': 'piggy-bank',
    'Đầu tư': 'graph-up-arrow',
    'Khác': 'three-dots'
  };
  
  // Chuyển đổi tên danh mục sang chữ thường để so sánh không phân biệt hoa thường
  const normalizedCategory = category ? category.toLowerCase() : '';
  
  // Tìm khớp danh mục không phân biệt hoa thường
  for (const [key, value] of Object.entries(icons)) {
    if (key.toLowerCase() === normalizedCategory) {
      return value;
    }
  }
  
  // Trả về biểu tượng mặc định nếu không tìm thấy
  return 'tag';
}

// Lấy văn bản hiển thị cho tần suất
function getFrequencyText(frequency) {
  const frequencyMap = {
    'daily': 'Hàng ngày',
    'weekly': 'Hàng tuần',
    'monthly': 'Hàng tháng',
    'quarterly': 'Hàng quý',
    'yearly': 'Hàng năm'
  };
  
  return frequencyMap[frequency] || 'Hàng tháng';
}

// Định dạng tiền tệ
function formatCurrency(amount) {
  // Kiểm tra và chuyển đổi amount thành số nếu cần
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  // Kiểm tra nếu không phải số hợp lệ
  if (isNaN(numericAmount)) {
    return '0 ₫';
  }
  
  // Định dạng số với dấu phân cách hàng nghìn
  return numericAmount.toLocaleString('vi-VN') + ' ₫';
}

// Thiết lập bộ lọc dashboard
function initDashboardFilters() {
  // Lấy các phần tử DOM
  const statusFilter = document.getElementById('status-filter');
  const categoryFilter = document.getElementById('category-filter');
  const dateFrom = document.getElementById('date-from');
  const dateTo = document.getElementById('date-to');
  const applyFilterBtn = document.getElementById('apply-filter');
  const resetFilterBtn = document.getElementById('reset-filter');
  
  // Thiết lập giá trị mặc định cho bộ lọc ngày
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  
  // Format dates as YYYY-MM-DD for input values
  dateFrom.value = formatDateForInput(firstDayOfMonth);
  dateTo.value = formatDateForInput(today);
  
  // Lấy danh sách các danh mục từ API và điền vào dropdown
  loadCategories();
  
  // Gắn sự kiện
  if (applyFilterBtn) {
    applyFilterBtn.addEventListener('click', applyDashboardFilters);
  }
  
  if (resetFilterBtn) {
    resetFilterBtn.addEventListener('click', resetDashboardFilters);
  }
}

// Hàm để format ngày thành chuỗi YYYY-MM-DD cho input date
function formatDateForInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Lấy danh sách danh mục và điền vào dropdown
async function loadCategories() {
  try {
    const token = localStorage.getItem('sb-token');
    if (!token) return;
    
    // Tạo select element
    const categoryFilter = document.getElementById('category-filter');
    if (!categoryFilter) return;
    
    // Lấy danh sách các danh mục đã dùng từ API
    const response = await fetch('/api/dashboard/categories', {
      headers: { 'Authorization': `Bearer ${token}` },
      signal: AbortSignal.timeout(5000)
    });
    
    if (response.ok) {
      const categories = await response.json();
      
      if (Array.isArray(categories) && categories.length > 0) {
        // Lưu trữ một bản sao của option mặc định
        const defaultOption = categoryFilter.innerHTML;
        
        // Xóa các options hiện tại trừ option mặc định
        categoryFilter.innerHTML = defaultOption;
        
        // Thêm các danh mục mới
        categories.forEach(cat => {
          if (cat.name && cat.name !== 'Chưa có dữ liệu') {
            const option = document.createElement('option');
            option.value = cat.name;
            option.textContent = cat.name;
            categoryFilter.appendChild(option);
          }
        });
      }
    }
  } catch (error) {
    console.error('Lỗi khi tải danh mục:', error);
  }
}

// Áp dụng bộ lọc
async function applyDashboardFilters() {
  try {
    showLoading();
    
    // Lấy giá trị từ bộ lọc
    const status = document.getElementById('status-filter').value;
    const category = document.getElementById('category-filter').value;
    const dateFrom = document.getElementById('date-from').value;
    const dateTo = document.getElementById('date-to').value;
    
    const token = localStorage.getItem('sb-token');
    if (!token) {
      hideLoading();
      return;
    }
    
    // Xây dựng params cho API
    const params = new URLSearchParams();
    if (status && status !== 'all') params.append('status', status);
    if (category && category !== 'all') params.append('category', category);
    if (dateFrom) params.append('startDate', dateFrom);
    if (dateTo) params.append('endDate', dateTo);
    
    // Cập nhật summary với bộ lọc
    const summaryResponse = await fetch(`/api/dashboard/summary?${params.toString()}`, {
      headers: { 'Authorization': `Bearer ${token}` },
      signal: AbortSignal.timeout(8000)
    });
    
    if (summaryResponse.ok) {
      const summary = await summaryResponse.json();
      updateDashboardSummary(summary);
    }
    
    // Cập nhật timeline với bộ lọc
    const timelineResponse = await fetch(`/api/dashboard/timeline?${params.toString()}`, {
      headers: { 'Authorization': `Bearer ${token}` },
      signal: AbortSignal.timeout(8000)
    });
    
    if (timelineResponse.ok) {
      const timeline = await timelineResponse.json();
      
      if (timeline.expenses?.length > 0) {
        const timeChartData = timeline.expenses.map(exp => ({
          date: new Date(exp.date).toLocaleDateString('vi-VN'),
          amount: exp.amount
        }));
        if (typeof window.renderTimeChart === 'function') {
          window.renderTimeChart(timeChartData);
        }
      } else {
        // Hiển thị biểu đồ trống nếu không có dữ liệu
        if (typeof window.renderTimeChart === 'function') {
          window.renderTimeChart([]);
        }
      }
    }
    
    // Cập nhật category distribution với bộ lọc
    const categoryParams = new URLSearchParams(params);
    categoryParams.set('period', 'custom'); // Đánh dấu là filter tùy chỉnh
    
    const categoryResponse = await fetch(`/api/dashboard/categories?${categoryParams.toString()}`, {
      headers: { 'Authorization': `Bearer ${token}` },
      signal: AbortSignal.timeout(8000)
    });
    
    if (categoryResponse.ok) {
      const categories = await categoryResponse.json();
      
      if (Array.isArray(categories) && categories.length > 0) {
        if (typeof window.renderCategoryChart === 'function') {
          window.renderCategoryChart(categories);
        }
      } else {
        // Hiển thị biểu đồ trống nếu không có dữ liệu
        if (typeof window.renderCategoryChart === 'function') {
          window.renderCategoryChart([]);
        }
      }
    }
    
    // Cập nhật recent expenses với bộ lọc
    const recentResponse = await fetch(`/api/dashboard/recent?${params.toString()}`, {
      headers: { 'Authorization': `Bearer ${token}` },
      signal: AbortSignal.timeout(8000)
    });
    
    if (recentResponse.ok) {
      const recentData = await recentResponse.json();
      renderRecentExpenses(recentData.expenses || []);
    }
    
    hideLoading();
  } catch (error) {
    console.error('Lỗi khi áp dụng bộ lọc:', error);
    hideLoading();
  }
}

// Reset bộ lọc
function resetDashboardFilters() {
  // Reset các giá trị bộ lọc về mặc định
  const statusFilter = document.getElementById('status-filter');
  const categoryFilter = document.getElementById('category-filter');
  const dateFrom = document.getElementById('date-from');
  const dateTo = document.getElementById('date-to');
  
  if (statusFilter) statusFilter.value = 'all';
  if (categoryFilter) categoryFilter.value = 'all';
  
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  
  if (dateFrom) dateFrom.value = formatDateForInput(firstDayOfMonth);
  if (dateTo) dateTo.value = formatDateForInput(today);
  
  // Tải lại dữ liệu dashboard mặc định
  loadDashboardData();
}
