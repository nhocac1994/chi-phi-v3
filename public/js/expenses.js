// Quản lý trạng thái toàn cục
const ExpensesState = {
  expenses: [],
  filters: {
    search: '',
    status: 'all'
  }
};

// Hàm khởi tạo trang chi phí
async function initExpensesPage() {
  console.log('Khởi tạo trang chi phí...');
  
  try {
    // Hiển thị loading
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
      loadingIndicator.style.display = 'flex';
    }

    // Thiết lập datalist cho các input
    setupDatalist();
    
    // Thiết lập các sự kiện
    setupEventListeners();
  
  // Tải dữ liệu chi phí
    await loadExpenses();
    
    // Khởi tạo bộ lọc
    initFilters();
    
    // Cập nhật gợi ý cho datalist
    updateDatalistSuggestions();
    
    // Ẩn loading
    if (loadingIndicator) {
      loadingIndicator.style.display = 'none';
    }
    
  } catch (error) {
    console.error('Lỗi khởi tạo trang:', error);
    showToast('Có lỗi xảy ra: ' + error.message, 'error');
  }
}

// Tải danh sách chi phí
async function loadExpenses(token) {
  try {
    // Sử dụng token được truyền vào hoặc lấy từ cookie
    token = token || getCookie('sb_token');
    console.log('Token sử dụng để tải dữ liệu:', token ? 'Có token' : 'Không có token');
    
    // Hiển thị loading
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) loadingIndicator.style.display = 'flex';
    
    // Nếu vẫn không tìm thấy token, thử từ AppUtils một lần nữa
    if (!token && window.AppUtils && typeof window.AppUtils.getToken === 'function') {
      token = window.AppUtils.getToken();
      console.log('Thử lấy token từ AppUtils:', token ? 'Có token' : 'Không có token');
    }
    
    console.log('Gửi request API với', token ? 'có token' : 'không có token');
    
    const response = await fetch('/api/expenses', {
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
        'Accept': 'application/json'
      }
    });
    
    console.log('API Response status:', response.status);
    
    // Xử lý lỗi xác thực
    if (response.status === 401) {
      console.error('Token hết hạn hoặc không hợp lệ');
      throw new Error('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại');
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error response:', errorText);
      try {
        const errorData = JSON.parse(errorText);
        throw new Error(errorData.error || 'Không thể tải dữ liệu chi phí');
      } catch (jsonError) {
        throw new Error('Lỗi server: ' + response.status);
      }
    }

    const data = await response.json();
    console.log('Dữ liệu API trả về:', data);

    // Kiểm tra cấu trúc dữ liệu
    if (!data) {
      throw new Error('Không nhận được dữ liệu từ server');
    }
    
    // Lấy danh sách chi phí từ dữ liệu API
    let expenses;
    if (data.expenses && Array.isArray(data.expenses)) {
      // Cấu trúc mới: { expenses: [...], pagination: {...} }
      expenses = data.expenses;
      console.log('Đã nhận dữ liệu với định dạng mới: ', expenses.length, 'chi phí');
    } else if (Array.isArray(data)) {
      // Cấu trúc cũ: [...] (mảng trực tiếp)
      expenses = data;
      console.log('Đã nhận dữ liệu với định dạng cũ: ', expenses.length, 'chi phí');
    } else {
      // Không đúng định dạng
      console.error('Dữ liệu không đúng định dạng:', data);
      expenses = [];
    }
    
    // Xử lý dữ liệu ảnh
    expenses = expenses.map(expense => {
      // Xử lý trường images
      if (expense.images) {
        // Trường hợp images là chuỗi JSON
        if (typeof expense.images === 'string') {
          try {
            expense.images = JSON.parse(expense.images);
          } catch (e) {
            console.error('Lỗi parse JSON cho images:', e, expense.images);
            expense.images = [];
          }
        }
        
        // Đảm bảo images luôn là mảng
        if (!Array.isArray(expense.images)) {
          expense.images = [expense.images];
        }
      } else {
        expense.images = [];
      }
      
      console.log(`Chi phí ${expense.id} có ${expense.images.length} ảnh:`, expense.images);
      return expense;
    });
    
    // Lưu vào state toàn cục
    ExpensesState.expenses = expenses;
    
    console.log('Đã tải được', ExpensesState.expenses.length, 'chi phí');
    renderExpenses(ExpensesState.expenses);
    updateExpenseCounter(ExpensesState.expenses.length);
    
    // Cập nhật danh sách gợi ý tên chi phí sau khi tải dữ liệu
    updateExpenseSuggestions();
    
    // Ẩn loading
    if (loadingIndicator) loadingIndicator.style.display = 'none';
    
  } catch (error) {
    console.error('Lỗi tải chi phí:', error);
    showToast(error.message || 'Không thể tải danh sách chi phí', 'error');
    
    // Ẩn loading
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) loadingIndicator.style.display = 'none';
    
    // Hiển thị thông báo không có dữ liệu
    const container = document.getElementById('expenses-list');
    if (container) {
      container.innerHTML = `<div class="no-expenses">Lỗi tải dữ liệu: ${error.message}</div>`;
    }
    
    if (error.message.includes('đăng nhập') || error.message.includes('phiên')) {
      handleAuthError();
    }
  }
}

// Hàm tải lại dữ liệu chi phí (tự động)
async function reloadExpenses(showLoadingToast = false) {
  try {
    if (showLoadingToast) {
      showToast('Đang tải lại dữ liệu...', 'info');
    }
    
    // Lấy token từ cookie hoặc các nguồn khác
    const token = getCookie('sb_token') || localStorage.getItem('token') || sessionStorage.getItem('sb_token');
    
    // Gọi lại hàm loadExpenses để tải dữ liệu mới
    await loadExpenses(token);
    
    if (showLoadingToast) {
      showToast('Đã cập nhật dữ liệu mới nhất', 'success');
    }
    
    // Áp dụng lại bộ lọc nếu có
    if (ExpensesState.filters && (ExpensesState.filters.search || ExpensesState.filters.status !== 'all')) {
      applyFilters();
    }
  } catch (error) {
    console.error('Lỗi khi tải lại dữ liệu:', error);
    showToast('Không thể tải lại dữ liệu: ' + error.message, 'error');
  }
}

// Kiểm tra xác thực người dùng
async function checkAuthentication() {
  // Thử lấy token từ nhiều nguồn
  let token = getCookie('sb_token') || sessionStorage.getItem('sb_token') || localStorage.getItem('token');
  
  if (!token) {
    console.error('Không tìm thấy token đăng nhập trong bất kỳ nguồn nào');
    return false;
  }

  try {
    // Kiểm tra token với API
    const response = await fetch('/api/check-auth', {
    headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });

  if (!response.ok) {
      console.error('Token không hợp lệ, status:', response.status);
      return false;
    }

    const authData = await response.json();
    if (!authData.success) {
      console.error('Xác thực thất bại:', authData.error);
      return false;
    }

    console.log('Xác thực thành công:', authData.user.email);
    
    // Lưu token vào tất cả các nơi lưu trữ
    setCookie('sb_token', token);
    sessionStorage.setItem('sb_token', token);
    localStorage.setItem('token', token);
    
    return true;
  } catch (error) {
    console.error('Lỗi kiểm tra xác thực:', error);
    return false;
  }
}

// Hàm lưu cookie
function setCookie(name, value, days = 7) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${value}; expires=${expires}; path=/`;
  console.log(`Cookie ${name} đã được đặt, hết hạn: ${expires}`);
}

// Biến lưu thông tin chi phí trước đó
let lastExpenseInfo = {
  danh_muc: '',
  dia_diem: '',
  da_su_dung: false // Cờ để kiểm tra đã sử dụng thông tin trước đó chưa
};

// Thiết lập các sự kiện
function setupEventListeners() {
  // Xóa tất cả dropdown cũ
  removeAllOldDropdowns();
  
  // Cập nhật HTML form
  updateFormHTML();
  
  // Sự kiện cho modal thêm chi phí
  const addExpenseBtn = document.getElementById('add-expense-btn');
  const addExpenseModal = document.getElementById('addExpenseModal');
  const closeModalBtns = document.querySelectorAll('.close-modal-btn');
  
  addExpenseBtn?.addEventListener('click', () => {
    // Xóa lại dropdown cũ mỗi khi mở modal
    removeAllOldDropdowns();
    
    openModal(addExpenseModal);
    // Thiết lập ngày mặc định là ngày hiện tại
    const dateInput = document.getElementById('expenseDate');
    if (dateInput) {
      const today = new Date().toISOString().split('T')[0];
      dateInput.value = today;
    }
    
    // Thay thế các input bằng input mới có datalist
    replaceInputsWithDatalist();
    
    // Cập nhật danh sách gợi ý mỗi khi mở modal
    updateDatalistSuggestions();
    
    // Thiết lập tự động chuyển trường
    setupFormAutoAdvance();
    
    // Thêm nút tự động điền thông tin từ chi phí trước đó
    addQuickFillButton();
    
    // Thiết lập lưu form tự động
    setupFormAutosave();
    
    // Kiểm tra và khôi phục dữ liệu form nếu có
    restoreFormState();
    
    // Focus vào trường đầu tiên sau khi mở modal
    setTimeout(() => {
      document.getElementById('expenseName')?.focus();
    }, 300);
  });
  
  closeModalBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      closeModal(addExpenseModal);
    });
  });
  
  // Sự kiện lưu chi phí
  const saveExpenseBtn = document.getElementById('saveExpenseBtn');
  saveExpenseBtn?.addEventListener('click', async function() {
    // Lưu thông tin cho lần tiếp theo trước khi lưu chi phí
    const categoryInput = document.getElementById('expenseCategory');
    const locationInput = document.getElementById('expenseLocation');
    
    if (categoryInput && categoryInput.value) {
      lastExpenseInfo.danh_muc = categoryInput.value;
    }
    
    if (locationInput && locationInput.value) {
      lastExpenseInfo.dia_diem = locationInput.value;
    }
    
    // Đặt lại cờ đã sử dụng
    lastExpenseInfo.da_su_dung = false;
    
    // Gọi hàm xử lý lưu chi phí
    await handleSaveExpense();
  });
  
  // Sự kiện upload ảnh
  const imageInput = document.getElementById('expenseImages');
  imageInput?.addEventListener('change', handleImageUpload);
  
  // Định dạng số tiền khi nhập
  const amountInput = document.getElementById('expenseAmount');
  if (amountInput) {
    amountInput.addEventListener('input', formatAmountOnInput);
    amountInput.addEventListener('focus', function() {
      // Khi focus, chuyển về định dạng không có dấu phân cách để dễ nhập
      const value = this.value.replace(/\./g, '');
      this.value = value;
    });
    
    amountInput.addEventListener('blur', function() {
      // Khi blur, định dạng lại với dấu phân cách
      if (this.value) {
        const numericValue = this.value.replace(/\./g, '');
        if (!isNaN(numericValue)) {
          this.value = formatNumberWithCommas(numericValue);
        }
      }
    });
  }
  
  // Thêm nút tải lại dữ liệu
  const reloadButton = document.getElementById('reload-expenses-btn');
  if (reloadButton) {
    reloadButton.addEventListener('click', () => reloadExpenses(true));
  }
  
  // Thiết lập tải lại tự động mỗi 2 phút
  setInterval(() => reloadExpenses(false), 120000);
}

// Thêm nút tự động điền thông tin từ chi phí trước đó
function addQuickFillButton() {
  // Kiểm tra xem đã có nút chưa và có thông tin để điền không
  if (document.getElementById('quick-fill-btn') || 
      (!lastExpenseInfo.danh_muc && !lastExpenseInfo.dia_diem) || 
      lastExpenseInfo.da_su_dung) {
    return;
  }
  
  // Tìm form
  const form = document.getElementById('addExpenseForm');
  if (!form) return;
  
  // Tạo nút
  const quickFillBtn = document.createElement('button');
  quickFillBtn.id = 'quick-fill-btn';
  quickFillBtn.type = 'button';
  quickFillBtn.className = 'btn btn-sm btn-outline-secondary mb-3';
  quickFillBtn.innerHTML = '<i class="bi bi-lightning"></i> Điền nhanh';
  quickFillBtn.title = 'Điền nhanh thông tin từ chi phí trước đó';
  
  // Thêm sự kiện
  quickFillBtn.addEventListener('click', function() {
    // Điền danh mục nếu có
    if (lastExpenseInfo.danh_muc) {
      const categoryInput = document.getElementById('expenseCategory');
      if (categoryInput) categoryInput.value = lastExpenseInfo.danh_muc;
    }
    
    // Điền địa điểm nếu có
    if (lastExpenseInfo.dia_diem) {
      const locationInput = document.getElementById('expenseLocation');
      if (locationInput) locationInput.value = lastExpenseInfo.dia_diem;
    }
    
    // Đánh dấu đã sử dụng
    lastExpenseInfo.da_su_dung = true;
    
    // Focus vào trường tên chi phí
    document.getElementById('expenseName')?.focus();
    
    // Xóa nút sau khi sử dụng
    quickFillBtn.remove();
    
    // Hiển thị thông báo
    showToast('Đã điền thông tin nhanh', 'success');
  });
  
  // Thêm vào form, phía trên trường đầu tiên
  const firstField = form.querySelector('.form-group');
  if (firstField) {
    form.insertBefore(quickFillBtn, firstField);
  } else {
    form.prepend(quickFillBtn);
  }
}

// Hàm xóa tất cả dropdown cũ 
function removeAllOldDropdowns() {
  console.log('Đang xóa tất cả dropdown cũ...');
  
  // 1. Xóa các phần tử dropdown hiện có
  const oldDropdowns = document.querySelectorAll('.expense-dropdown');
  console.log(`Tìm thấy ${oldDropdowns.length} dropdown cũ`);
  oldDropdowns.forEach(dropdown => {
    console.log(`Xóa dropdown: ${dropdown.id}`);
    dropdown.remove();
  });
  
  // 2. Xóa tất cả các sự kiện autocomplete cũ
  const expenseNameInput = document.getElementById('expenseName');
  const locationInput = document.getElementById('expenseLocation');
  
  // Xóa sự kiện keydown cũ
  if (expenseNameInput && expenseNameInput.autoCompleteKeydownHandler) {
    expenseNameInput.removeEventListener('keydown', expenseNameInput.autoCompleteKeydownHandler);
    delete expenseNameInput.autoCompleteKeydownHandler;
  }
  
  if (locationInput && locationInput.autoCompleteKeydownHandler) {
    locationInput.removeEventListener('keydown', locationInput.autoCompleteKeydownHandler);
    delete locationInput.autoCompleteKeydownHandler;
  }
  
  // 3. Xóa các click handler toàn cục
  const oldDropdownClickHandlers = document.querySelectorAll('[data-dropdown-click-handler]');
  oldDropdownClickHandlers.forEach(el => {
    const handlerName = el.getAttribute('data-dropdown-click-handler');
    if (handlerName && window[handlerName]) {
      document.removeEventListener('click', window[handlerName]);
    }
  });
}

// Thiết lập dropdown autocomplete
function setupAutoComplete(inputId, dropdownId, getSuggestionsCallback) {
  console.log('setupAutoComplete đã bị vô hiệu hóa - sử dụng datalist thay thế');
  // Hàm này đã bị vô hiệu hóa để ngăn tạo ra dropdown cũ
  // Sử dụng datalist HTML5 thay thế
  return;
}

// Hiển thị tất cả gợi ý khi chưa nhập gì
function showAllSuggestions(dropdownElement, getSuggestionsCallback, inputElement) {
  // Lấy tất cả gợi ý
  const allSuggestions = getSuggestionsCallback('');
  
  // Nếu có gợi ý, hiển thị dropdown
  if (allSuggestions && allSuggestions.length > 0) {
    createDropdownItems(dropdownElement, allSuggestions, '', inputElement);
    dropdownElement.classList.add('show');
  }
}

// Hiển thị gợi ý phù hợp với giá trị nhập vào
function showMatchingSuggestions(value, dropdownElement, getSuggestionsCallback, inputElement) {
  // Nếu không có giá trị, hiển thị tất cả gợi ý
  if (!value) {
    showAllSuggestions(dropdownElement, getSuggestionsCallback, inputElement);
    return;
  }
  
  // Lấy danh sách gợi ý dựa trên callback được truyền vào
  const suggestions = getSuggestionsCallback(value);
  
  // Nếu không có gợi ý, không hiển thị dropdown
  if (!suggestions || suggestions.length === 0) {
    dropdownElement.classList.remove('show');
    return;
  }
  
  // Tạo các mục dropdown
  createDropdownItems(dropdownElement, suggestions, value, inputElement);
  
  // Hiển thị dropdown
  dropdownElement.classList.add('show');
}

// Tạo các mục dropdown
function createDropdownItems(dropdownElement, suggestions, inputValue, inputElement) {
  // Xóa nội dung hiện tại
  dropdownElement.innerHTML = '';
  
  // Lưu callback function từ thuộc tính data
  const getSuggestionsCallback = dropdownElement.getAttribute('data-callback-function');
  
  // Thêm header cho dropdown trên thiết bị di động
  if (window.innerWidth <= 768) {
    const header = document.createElement('div');
    header.className = 'expense-dropdown-header';
    header.innerHTML = `
      <div>Chọn một mục</div>
      <button class="expense-dropdown-close">×</button>
    `;
    
    // Thêm sự kiện đóng dropdown
    const closeBtn = header.querySelector('.expense-dropdown-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function() {
        dropdownElement.classList.remove('show');
      });
    }
    
    dropdownElement.appendChild(header);
  }
  
  // Tạo mục cho mỗi gợi ý
  suggestions.forEach(suggestion => {
    const item = document.createElement('div');
    item.className = 'expense-dropdown-item';
    item.textContent = suggestion;
    
    // Sự kiện click để chọn giá trị
    item.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      inputElement.value = suggestion;
      dropdownElement.classList.remove('show');
      inputElement.blur(); // Bỏ focus khỏi input sau khi chọn
    });
    
    dropdownElement.appendChild(item);
  });
  
  // Kiểm tra nếu không có gợi ý
  if (suggestions.length === 0) {
    const noSuggestion = document.createElement('div');
    noSuggestion.className = 'expense-dropdown-item no-suggestions';
    noSuggestion.textContent = 'Không có gợi ý';
    dropdownElement.appendChild(noSuggestion);
  }
}

// Thiết lập mục đang active
function setActive(items, index) {
  // Xóa active từ tất cả các mục
  for (let i = 0; i < items.length; i++) {
    items[i].classList.remove('active');
  }
  
  // Đảm bảo index nằm trong khoảng hợp lệ
  if (index >= items.length) index = 0;
  if (index < 0) index = items.length - 1;
  
  // Thêm class active cho mục hiện tại
  items[index].classList.add('active');
  
  // Đảm bảo item đang active luôn hiển thị trong vùng nhìn thấy
  items[index].scrollIntoView({ block: 'nearest' });
}

// Đóng tất cả các dropdown
function closeAllDropdowns() {
  const dropdowns = document.getElementsByClassName('expense-dropdown');
  for (let i = 0; i < dropdowns.length; i++) {
    dropdowns[i].classList.remove('show');
  }
}

// Lấy gợi ý địa điểm
function getLocationSuggestions(query) {
  const provinces = [
    "Hà Nội", "TP Hồ Chí Minh", "Đà Nẵng", "Hải Phòng", "Cần Thơ",
    "An Giang", "Bà Rịa - Vũng Tàu", "Bắc Giang", "Bắc Kạn", "Bạc Liêu",
    "Bắc Ninh", "Bến Tre", "Bình Định", "Bình Dương", "Bình Phước",
    "Bình Thuận", "Cà Mau", "Cao Bằng", "Đắk Lắk", "Đắk Nông",
    "Điện Biên", "Đồng Nai", "Đồng Tháp", "Gia Lai", "Hà Giang",
    "Hà Nam", "Hà Tĩnh", "Hải Dương", "Hậu Giang", "Hòa Bình",
    "Hưng Yên", "Khánh Hòa", "Kiên Giang", "Kon Tum", "Lai Châu",
    "Lâm Đồng", "Lạng Sơn", "Lào Cai", "Long An", "Nam Định",
    "Nghệ An", "Ninh Bình", "Ninh Thuận", "Phú Thọ", "Phú Yên",
    "Quảng Bình", "Quảng Nam", "Quảng Ngãi", "Quảng Ninh", "Quảng Trị",
    "Sóc Trăng", "Sơn La", "Tây Ninh", "Thái Bình", "Thái Nguyên",
    "Thanh Hóa", "Thừa Thiên Huế", "Tiền Giang", "Trà Vinh", "Tuyên Quang",
    "Vĩnh Long", "Vĩnh Phúc", "Yên Bái"
  ];
  
  // Nếu query rỗng, trả về tất cả các tỉnh thành
  if (!query) {
    return provinces;
  }
  
  // Lọc theo query
  return provinces.filter(province => 
    province.toLowerCase().includes(query.toLowerCase())
  );
}

// Lấy gợi ý tên chi phí
function getExpenseNameSuggestions(query) {
  // Nếu không có dữ liệu chi phí, trả về mảng rỗng
  if (!ExpensesState.expenses || ExpensesState.expenses.length === 0) {
    return [];
  }
  
  // Lấy danh sách tên chi phí độc nhất
  const expenseNames = [...new Set(ExpensesState.expenses.map(expense => expense.noi_dung))];
  
  // Nếu query rỗng, trả về tất cả các tên chi phí
  if (!query) {
    return expenseNames;
  }
  
  // Lọc theo query
  return expenseNames.filter(name => 
    name.toLowerCase().includes(query.toLowerCase())
  );
}

// Định dạng số tiền khi nhập
function formatAmountOnInput(e) {
  // Lấy vị trí con trỏ hiện tại
  const cursorPosition = e.target.selectionStart;
  const value = e.target.value;
  const lengthBefore = value.length;
  
  // Chỉ giữ lại các chữ số
  let cleanValue = value.replace(/\D/g, '');
  
  // Định dạng số với dấu chấm phân cách hàng nghìn
  if (cleanValue) {
    cleanValue = formatNumberWithCommas(cleanValue);
  }
  
  // Cập nhật giá trị
  e.target.value = cleanValue;
  
  // Tính toán vị trí con trỏ mới
  const lengthAfter = cleanValue.length;
  const newPosition = cursorPosition + (lengthAfter - lengthBefore);
  
  // Đặt lại vị trí con trỏ
  e.target.setSelectionRange(Math.max(0, newPosition), Math.max(0, newPosition));
}

// Định dạng số với dấu chấm phân cách hàng nghìn
function formatNumberWithCommas(number) {
  return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// Khởi tạo bộ lọc
function initFilters() {
  const searchInput = document.getElementById('filter-search');
  const statusSelect = document.getElementById('filter-status');
  
  // Thiết lập sự kiện lọc
  searchInput?.addEventListener('input', (e) => {
    ExpensesState.filters.search = e.target.value;
    applyFilters();
  });
  
  statusSelect?.addEventListener('change', (e) => {
    ExpensesState.filters.status = e.target.value;
    applyFilters();
  });
}

// Áp dụng bộ lọc
function applyFilters() {
  const { search, status } = ExpensesState.filters;
  let filteredExpenses = [...ExpensesState.expenses];
  
  // Lọc theo từ khóa
  if (search) {
    filteredExpenses = filteredExpenses.filter(expense => 
      expense.noi_dung.toLowerCase().includes(search.toLowerCase()) ||
      expense.danh_muc.toLowerCase().includes(search.toLowerCase()) ||
      expense.dia_diem?.toLowerCase().includes(search.toLowerCase())
    );
  }
  
  // Lọc theo trạng thái
  if (status !== 'all') {
    filteredExpenses = filteredExpenses.filter(expense => 
      expense.trang_thai === status
    );
  }
  
  renderExpenses(filteredExpenses);
  updateExpenseCounter(filteredExpenses.length, ExpensesState.expenses.length);
}

/**
 * Lấy màu tương ứng với danh mục chi phí
 * @param {string} category - Tên danh mục
 * @returns {string} - Mã màu CSS
 */
function getCategoryColor(category) {
  const categoryColors = {
    'Thực phẩm': 'var(--food-color, #ff6b6b)',
    'Ăn uống': 'var(--food-color, #ff6b6b)',
    'Di chuyển': 'var(--transport-color, #4dabf7)',
    'Phương tiện': 'var(--transport-color, #4dabf7)',
    'Mua sắm': 'var(--shopping-color, #9775fa)',
    'Giải trí': 'var(--entertainment-color, #f783ac)',
    'Giáo dục': 'var(--education-color, #748ffc)',
    'Học tập': 'var(--education-color, #748ffc)',
    'Y tế': 'var(--health-color, #51cf66)',
    'Sức khỏe': 'var(--health-color, #51cf66)',
    'Nhà cửa': 'var(--home-color, #ffa94d)',
    'Thuê nhà': 'var(--home-color, #ffa94d)',
    'Hóa đơn': 'var(--bill-color, #69db7c)',
    'Công việc': 'var(--work-color, #22b8cf)',
    'Xã hội': 'var(--social-color, #da77f2)',
    'Du lịch': 'var(--travel-color, #5c7cfa)'
  };

  return categoryColors[category] || 'var(--default-color, #74c0fc)';
}

// Tạo thẻ chi phí
function createExpenseCard(expense) {
  try {
    // Tạo card mới từ đầu thay vì dùng template
    const card = document.createElement('div');
    card.className = 'expense-card';
    card.setAttribute('data-id', expense.id || expense.ma_chi_phi || '');
    
    // Lấy dữ liệu
    const expenseData = {
      id: expense.id || expense.ma_chi_phi || '',
      title: expense.noi_dung || 'Chi phí không tên',
      amount: parseFloat(expense.gia_tien) || 0,
      category: expense.danh_muc || 'Khác',
      date: expense.ngay_thang ? new Date(expense.ngay_thang) : new Date(),
      location: expense.dia_diem || '',
      notes: expense.ghi_chu || '',
      images: []
    };
    
    // Xử lý hình ảnh
    if (expense.images) {
      try {
        if (typeof expense.images === 'string') {
          try {
            expenseData.images = JSON.parse(expense.images);
          } catch (e) {
            expenseData.images = [expense.images];
          }
        } else if (Array.isArray(expense.images)) {
          expenseData.images = expense.images;
        } else if (typeof expense.images === 'object') {
          expenseData.images = [expense.images];
        }
      } catch (error) {
        console.error('Lỗi xử lý hình ảnh:', error);
      }
    }
    
    // Lấy icon và màu theo danh mục
    const iconClass = getCategoryIcon(expenseData.category);
    const iconColor = getCategoryColor(expenseData.category);
    
    card.innerHTML = `
      <div class="expense-card-icon-container">
        <i class="expense-card-icon bi ${iconClass}"></i>
      </div>
      <div class="expense-card-main">
        <div class="expense-card-title-row">
          <span class="expense-card-title">${expenseData.title}</span>
          <div class="expense-card-category">${expenseData.category}</div>
        </div>
        <div class="expense-card-amount">${formatCurrency(expenseData.amount)}</div>
        
        <div class="expense-card-details">
          <div class="expense-card-location">
            <i class="bi bi-geo-alt"></i>
            <span>${expenseData.location || 'Không có địa điểm'}</span>
          </div>
          <div class="expense-card-date">${formatDate(expenseData.date)}</div>
        </div>
        
        <div class="expense-card-notes-container">
          <div class="expense-card-notes">
            <i class="bi bi-sticky"></i>
            <span>${expenseData.notes || 'Không có ghi chú'}</span>
          </div>
          <div class="expense-card-image-count">
            <i class="bi bi-images"></i>
            <span>${expenseData.images.length}</span>
          </div>
        </div>
      </div>
    `;
    
    // Áp dụng màu cho icon
    const iconElement = card.querySelector('.expense-card-icon');
    if (iconElement) {
      iconElement.style.color = iconColor;
    }
    
    // Hiển thị hình ảnh nếu có
    if (expenseData.images && expenseData.images.length > 0) {
      const imagesContainer = document.createElement('div');
      imagesContainer.className = 'expense-card-images';
      
      // Hiển thị tối đa 4 hình ảnh
      const maxImages = 4;
      const displayImages = expenseData.images.slice(0, maxImages);
      
      // Thêm các hình ảnh vào container
      displayImages.forEach(img => {
        const imgUrl = typeof img === 'object' ? (img.url || img.path || '') : img;
        if (!imgUrl) return;
        
        const imgContainer = document.createElement('div');
        imgContainer.className = 'expense-card-image';
        
        const imgElement = document.createElement('img');
        imgElement.src = imgUrl;
        imgElement.alt = 'Hình ảnh chi phí';
        imgElement.loading = 'lazy';
        
        imgContainer.appendChild(imgElement);
        imagesContainer.appendChild(imgContainer);
      });
      
      // Nếu có nhiều hơn maxImages, hiển thị +X
      if (expenseData.images.length > maxImages) {
        const moreImages = document.createElement('div');
        moreImages.className = 'expense-card-image expense-more-images';
        moreImages.innerHTML = `<span>+${expenseData.images.length - maxImages}</span>`;
        imagesContainer.appendChild(moreImages);
      }
      
      // Thêm container vào card
      card.appendChild(imagesContainer);
    }
    
    // Thêm sự kiện click để xem chi tiết
    card.addEventListener('click', () => {
      showExpenseDetail(expense);
    });
    
    return card;
  } catch (error) {
    console.error('Lỗi khi tạo expense card:', error);
    
    // Trả về thẻ thay thế khi có lỗi
    const errorCard = document.createElement('div');
    errorCard.className = 'expense-card error';
    errorCard.innerHTML = `<div class="expense-card-title">Lỗi hiển thị chi phí</div>`;
    return errorCard;
  }
}

// Hàm hỗ trợ giới hạn độ dài chuỗi
function truncateText(text, maxLength) {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

// Hiển thị danh sách chi phí
function renderExpenses(expenses) {
  const container = document.getElementById('expenses-list');
  if (!container) return;
  
  container.innerHTML = '';
  
  // Kiểm tra xem expenses có phải là mảng hợp lệ không
  if (!Array.isArray(expenses) || expenses.length === 0) {
    console.log('Không có dữ liệu chi phí hoặc dữ liệu không đúng định dạng:', expenses);
    container.innerHTML = '<div class="no-expenses">Không có chi phí nào</div>';
    return;
  }
  
  expenses.forEach(expense => {
    container.appendChild(createExpenseCard(expense));
  });
}

// Xử lý lưu chi phí
async function handleSaveExpense() {
  try {
    showToast('Đang xử lý...', 'info');
    
    // Thu thập dữ liệu form
    const noi_dung = document.getElementById('expenseName').value.trim();
    let gia_tien = document.getElementById('expenseAmount').value.trim();
    const danh_muc = document.getElementById('expenseCategory').value.trim();
    const dia_diem = document.getElementById('expenseLocation').value.trim();
    const ngay_thang = document.getElementById('expenseDate').value.trim();
    const ghi_chu = document.getElementById('expenseNote').value.trim();
    
    if (!noi_dung || noi_dung.length < 2) {
      showToast('Tên chi phí phải có ít nhất 2 ký tự', 'error');
      return;
    }
    
    gia_tien = gia_tien.replace(/\./g, '');
    if (!gia_tien || isNaN(parseFloat(gia_tien)) || parseFloat(gia_tien) <= 0) {
      showToast('Số tiền không hợp lệ', 'error');
      return;
    }
    if (!danh_muc) {
      showToast('Vui lòng chọn danh mục', 'error');
      return;
    }
    if (!ngay_thang) {
      showToast('Vui lòng chọn ngày chi tiêu', 'error');
        return;
    }
  
    const token = window.AppUtils?.getToken() || getCookie('sb_token');
    if (!token) {
      showToast('Vui lòng đăng nhập lại để thực hiện chức năng này', 'error');
      return;
    }
    
    const saveBtn = document.getElementById('saveExpenseBtn');
    const isEditMode = saveBtn.getAttribute('data-mode') === 'edit';
    const expenseId = isEditMode ? document.getElementById('expenseId')?.value : null;
    if (isEditMode && !expenseId) {
      showToast('Không tìm thấy ID chi phí cần chỉnh sửa', 'error');
      return;
    }
    
    // Lấy các hình ảnh hiện có
    const imageInput = document.getElementById('expenseImages');
    const hasNewImages = imageInput.files.length > 0;
    const currentImages = [];
    const previewContainer = document.getElementById('imagePreviewContainer');
    if (previewContainer) {
      previewContainer.querySelectorAll('.expense-image-preview img').forEach(img => {
        if (img.src.startsWith('http')) {
          currentImages.push(img.src);
        }
      });
    }
    
    const expenseData = {
      noi_dung,
      gia_tien,
      danh_muc,
      dia_diem: dia_diem || "không có địa điểm",
      ngay_thang,
      ghi_chu: ghi_chu || "không có ghi chú"
    };
    if (isEditMode) {
      expenseData.id = expenseId;
    } else {
      expenseData.trang_thai = "Chưa thanh toán";
    }
    
    // --- Save expense JSON (BƯỚC 1) ---
    const url = isEditMode ? `/api/expenses/${expenseId}` : '/api/expenses';
      const method = isEditMode ? 'PUT' : 'POST';
      const response = await fetch(url, {
        method: method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(expenseData)
      });
      
      if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText);
    }
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || `Lỗi khi ${isEditMode ? 'cập nhật' : 'lưu'} chi phí`);
      }
    // Update state and UI using the returned data
    const updatedExpense = result.data;
        if (isEditMode) {
      const idx = ExpensesState.expenses.findIndex(e =>
            e.id === expenseId || e.ma_chi_phi === expenseId
          );
      if (idx !== -1) {
        ExpensesState.expenses[idx] = updatedExpense;
          }
        } else {
      ExpensesState.expenses.unshift(updatedExpense);
        }
        renderExpenses(ExpensesState.expenses);

    // --- Immediately close modal and reset form ---
    closeModal(document.getElementById('addExpenseModal'));
    resetForm('addExpenseForm');
    saveBtn.textContent = 'Lưu';
    saveBtn.removeAttribute('data-mode');
    showToast(`Đã ${isEditMode ? 'cập nhật' : 'thêm'} chi phí thành công`, 'success');
    
    // --- Start background tasks ---
    // 1. Optionally reload expenses in background
    reloadExpenses().catch(err => console.error('Reload error:', err));
    
    // 2. If co hình ảnh mới, async upload images (không block UI)
    if (hasNewImages) {
      (async () => {
        try {
        const uploadFormData = new FormData();
          uploadFormData.append('expense_id', updatedExpense.id);
        Array.from(imageInput.files).forEach(file => {
          uploadFormData.append('images', file);
          });
          const uploadResponse = await fetch('/api/expenses/upload-images', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: uploadFormData,
            credentials: 'include'
          });
          if (uploadResponse.ok) {
            const uploadResult = await uploadResponse.json();
            if (uploadResult.success && uploadResult.imageUrls) {
              // Update the expense data in state with new image URLs
              updatedExpense.images = [...(updatedExpense.images || []), ...uploadResult.imageUrls];
              const idx = ExpensesState.expenses.findIndex(e =>
                e.id === updatedExpense.id || e.ma_chi_phi === updatedExpense.id
              );
              if (idx !== -1) {
                ExpensesState.expenses[idx].images = updatedExpense.images;
                renderExpenses(ExpensesState.expenses);
              }
        }
      } else {
            console.warn('Upload ảnh thất bại');
          }
        } catch (uploadError) {
          console.error('Lỗi upload ảnh:', uploadError);
        }
      })();
    }
    
    // Update suggestions asynchronously
    updateExpenseSuggestions();
    
  } catch (error) {
    console.error('Lỗi lưu chi phí:', error);
    showToast('Không thể lưu chi phí: ' + error.message, 'error');
  }
}

// Xử lý upload ảnh
function handleImageUpload(event) {
  const files = event.target.files;
  const previewContainer = document.getElementById('imagePreviewContainer');
  previewContainer.innerHTML = '';
  
  Array.from(files).forEach(file => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const preview = document.createElement('div');
      preview.className = 'expense-image-preview';
      preview.innerHTML = `
        <img src="${e.target.result}" alt="Preview">
        <button class="expense-remove-image" data-file="${file.name}">
          <i class="bi bi-x"></i>
        </button>
      `;
      previewContainer.appendChild(preview);
    };
    reader.readAsDataURL(file);
  });
}

// Lấy vị trí hiện tại
function getCurrentLocation() {
  if (!navigator.geolocation) {
    showToast('Trình duyệt không hỗ trợ lấy vị trí', 'error');
    return;
  }
  
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      try {
        const { latitude, longitude } = position.coords;
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
        );
        
        if (!response.ok) throw new Error('Không thể lấy địa chỉ');
        
        const data = await response.json();
        document.getElementById('expenseLocation').value = data.display_name;
        
      } catch (error) {
        console.error('Lỗi lấy vị trí:', error);
        showToast('Không thể lấy địa chỉ hiện tại', 'error');
      }
    },
    (error) => {
      console.error('Lỗi lấy vị trí:', error);
      showToast('Không thể lấy vị trí hiện tại', 'error');
    }
  );
}

// Hiển thị chi tiết chi phí - chỉnh sửa phần tạo lightbox
function showExpenseDetail(expense) {
  console.log('Hiển thị chi tiết chi phí:', expense);
  
  try {
    // Lấy tham chiếu đến modal
    const detailModal = document.getElementById('expense-detail-modal');
    if (!detailModal) {
      console.error('Không tìm thấy modal chi tiết');
      return;
    }
    
    // Xóa tất cả hình ảnh hiện có
    const imagesContainer = document.getElementById('expense-detail-images');
    if (imagesContainer) {
      imagesContainer.innerHTML = '';
      
      // Thêm style cho container
      imagesContainer.style.display = 'grid';
      imagesContainer.style.gridTemplateColumns = 'repeat(auto-fill, minmax(110px, 1fr))';
      imagesContainer.style.gap = '10px';
      imagesContainer.style.marginTop = '15px';
    }
    
    // Cập nhật dữ liệu trong modal
    const expenseData = {
      id: expense.ma_chi_phi || expense.id,
      content: expense.noi_dung || '-',
      amount: expense.gia_tien || 0,
      category: expense.danh_muc || '-',
      date: formatDate(expense.ngay_thang) || '-',
      location: expense.dia_diem || 'Không có',
      note: expense.ghi_chu || 'Không có ghi chú',
      status: expense.trang_thai || 'Chưa thanh toán',
      images: expense.images || []
    };
    
    // Cập nhật UI
    document.getElementById('expense-detail-gia-tien').textContent = formatCurrency(expenseData.amount);
    document.getElementById('expense-detail-ngay').textContent = expenseData.date;
    document.getElementById('expense-detail-danh-muc').textContent = expenseData.category;
    document.getElementById('expense-detail-dia-diem').textContent = expenseData.location;
    document.getElementById('expense-detail-noi-dung').textContent = expenseData.content;
    document.getElementById('expense-detail-ghi-chu').textContent = expenseData.note;
    
    // Cập nhật trạng thái
    const statusBadge = document.getElementById('detail-status-badge');
    const statusText = document.getElementById('detail-status');
    
    if (statusText) {
      statusText.textContent = expenseData.status;
    }
    
    if (statusBadge) {
      if (expenseData.status === 'Đã thanh toán') {
        statusBadge.style.backgroundColor = 'var(--success-bg, #d1e7dd)';
        statusBadge.style.color = 'var(--success-color, #0f5132)';
        statusBadge.querySelector('i').className = 'bi bi-check-circle';
      } else {
        statusBadge.style.backgroundColor = 'var(--warning-bg, #fff3cd)';
        statusBadge.style.color = 'var(--warning-color, #664d03)';
        statusBadge.querySelector('i').className = 'bi bi-exclamation-circle';
      }
    }
    
    // Hiển thị hình ảnh
    if (expenseData.images && expenseData.images.length > 0 && imagesContainer) {
      console.log('Hiển thị', expenseData.images.length, 'hình ảnh');
      
      // Xóa tất cả nội dung cũ
      imagesContainer.innerHTML = '';
      
      // Thêm tiêu đề phần hình ảnh
      const imageTitle = document.createElement('div');
      imageTitle.className = 'expense-detail-image-title';
      imageTitle.style.width = '100%';
      imageTitle.style.marginBottom = '10px';
      imageTitle.style.fontWeight = 'bold';
      imageTitle.style.display = 'flex';
      imageTitle.style.alignItems = 'center';
      imageTitle.innerHTML = `
        <i class="bi bi-images" style="margin-right: 8px; color: var(--primary)"></i>
        <span>Hình ảnh (${expenseData.images.length})</span>
      `;
      imagesContainer.appendChild(imageTitle);
      
      // Chuyển đổi dữ liệu hình ảnh thành mảng
      let imageArray = [];
      
      // Xử lý các trường hợp dữ liệu khác nhau
      if (typeof expenseData.images === 'string') {
        try {
          const parsed = JSON.parse(expenseData.images);
          imageArray = Array.isArray(parsed) ? parsed : [parsed];
        } catch (e) {
          imageArray = expenseData.images.startsWith('http') ? [expenseData.images] : [];
        }
      } else if (Array.isArray(expenseData.images)) {
        imageArray = expenseData.images;
      } else if (expenseData.images && typeof expenseData.images === 'object') {
        imageArray = [expenseData.images];
      }
      
      // Lọc bỏ các giá trị null, undefined
      imageArray = imageArray.filter(img => img);
      
      // Nếu không có hình ảnh, hiển thị thông báo
      if (imageArray.length === 0) {
        const noImageEl = document.createElement('div');
        noImageEl.textContent = 'Không có hình ảnh';
        noImageEl.style.color = 'var(--text-muted)';
        noImageEl.style.fontStyle = 'italic';
        noImageEl.style.padding = '15px 0';
        noImageEl.style.textAlign = 'center';
        noImageEl.style.width = '100%';
        imagesContainer.appendChild(noImageEl);
        return;
      }
      
      // Tạo container hình ảnh dạng grid
      const imageGridContainer = document.createElement('div');
      imageGridContainer.className = 'expense-detail-image-grid';
      imageGridContainer.style.display = 'grid';
      imageGridContainer.style.gridTemplateColumns = 'repeat(auto-fill, minmax(110px, 1fr))';
      imageGridContainer.style.gap = '10px';
      imageGridContainer.style.width = '100%';
      imagesContainer.appendChild(imageGridContainer);
      
      // Hiển thị hình ảnh
      imageArray.forEach((img, index) => {
        const imageUrl = typeof img === 'object' ? (img.url || img.path || '') : img;
        if (!imageUrl) return;
        
        // Tạo phần tử hình ảnh
        const imgContainer = document.createElement('div');
        imgContainer.className = 'expense-detail-image';
        imgContainer.style.position = 'relative';
        imgContainer.style.borderRadius = '8px';
        imgContainer.style.overflow = 'hidden';
        imgContainer.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
        imgContainer.style.aspectRatio = '1 / 1';
        imgContainer.style.cursor = 'pointer';
        
        // Thêm nền nạp
        const shimmer = document.createElement('div');
        shimmer.className = 'expense-image-shimmer';
        shimmer.style.position = 'absolute';
        shimmer.style.width = '100%';
        shimmer.style.height = '100%';
        shimmer.style.backgroundColor = '#f6f7f8';
        shimmer.style.backgroundImage = 'linear-gradient(to right, #f6f7f8 0%, #edeef1 20%, #f6f7f8 40%, #f6f7f8 100%)';
        shimmer.style.backgroundSize = '200% 100%';
        shimmer.style.animation = 'shimmer 2s infinite linear';
        imgContainer.appendChild(shimmer);
        
        // CSS animation cho shimmer
        if (!document.getElementById('shimmer-animation')) {
          const styleSheet = document.createElement('style');
          styleSheet.id = 'shimmer-animation';
          styleSheet.textContent = `
            @keyframes shimmer {
              0% { background-position: -200% 0; }
              100% { background-position: 200% 0; }
            }
          `;
          document.head.appendChild(styleSheet);
        }
        
        const imgElement = document.createElement('img');
        imgElement.style.width = '100%';
        imgElement.style.height = '100%';
        imgElement.style.objectFit = 'cover';
        imgElement.style.position = 'relative';
        imgElement.style.zIndex = '1';
        imgElement.style.transition = 'transform 0.3s ease';
        imgElement.src = imageUrl;
        imgElement.alt = `Hình ảnh chi phí ${index + 1}`;
        imgElement.loading = 'lazy'; // Lazy loading để tối ưu
        
        // Thêm nút phóng to
        const zoomIndicator = document.createElement('div');
        zoomIndicator.className = 'expense-image-zoom';
        zoomIndicator.innerHTML = '<i class="bi bi-zoom-in"></i>';
        zoomIndicator.style.position = 'absolute';
        zoomIndicator.style.bottom = '5px';
        zoomIndicator.style.right = '5px';
        zoomIndicator.style.zIndex = '2';
        zoomIndicator.style.backgroundColor = 'rgba(0,0,0,0.5)';
        zoomIndicator.style.color = 'white';
        zoomIndicator.style.borderRadius = '50%';
        zoomIndicator.style.width = '26px';
        zoomIndicator.style.height = '26px';
        zoomIndicator.style.display = 'flex';
        zoomIndicator.style.justifyContent = 'center';
        zoomIndicator.style.alignItems = 'center';
        zoomIndicator.style.fontSize = '14px';
        
        // Hiệu ứng hover
        imgContainer.addEventListener('mouseenter', () => {
          imgElement.style.transform = 'scale(1.05)';
          zoomIndicator.style.backgroundColor = 'rgba(0,0,0,0.7)';
        });
        
        imgContainer.addEventListener('mouseleave', () => {
          imgElement.style.transform = 'scale(1)';
          zoomIndicator.style.backgroundColor = 'rgba(0,0,0,0.5)';
        });
        
        // Xử lý lỗi hình ảnh
        imgElement.onerror = function() {
          this.src = '/images/image-error.svg';
          this.style.objectFit = 'contain';
          this.style.padding = '8px';
          this.onerror = null;
          shimmer.style.display = 'none';
        };
        
        // Ẩn shimmer khi ảnh đã tải xong
        imgElement.onload = function() {
          shimmer.style.display = 'none';
        };
        
        // Thêm sự kiện click để xem hình ảnh đầy đủ
        imgContainer.addEventListener('click', () => {
          showImageLightbox(imageUrl, imageArray);
        });
        
        imgContainer.appendChild(imgElement);
        imgContainer.appendChild(zoomIndicator);
        imageGridContainer.appendChild(imgContainer);
      });
      
      // Nút xem tất cả nếu có nhiều hình ảnh
      if (imageArray.length > 6) {
        const viewAllBtn = document.createElement('button');
        viewAllBtn.className = 'expense-view-all-images-btn';
        viewAllBtn.innerHTML = '<i class="bi bi-images"></i> Xem tất cả';
        viewAllBtn.style.marginTop = '15px';
        viewAllBtn.style.backgroundColor = 'var(--primary, #0d6efd)';
        viewAllBtn.style.color = 'white';
        viewAllBtn.style.border = 'none';
        viewAllBtn.style.borderRadius = '4px';
        viewAllBtn.style.padding = '8px 15px';
        viewAllBtn.style.cursor = 'pointer';
        viewAllBtn.style.display = 'flex';
        viewAllBtn.style.alignItems = 'center';
        viewAllBtn.style.gap = '5px';
        viewAllBtn.style.margin = '15px auto 0';
        
        viewAllBtn.addEventListener('click', () => {
          showImageLightbox(imageArray[0], imageArray);
        });
        
        imagesContainer.appendChild(viewAllBtn);
      }
    } else if (imagesContainer) {
      // Nếu không có hình ảnh
      const noImageEl = document.createElement('div');
      noImageEl.textContent = 'Không có hình ảnh';
      noImageEl.style.color = 'var(--text-muted)';
      noImageEl.style.fontStyle = 'italic';
      noImageEl.style.padding = '15px 0';
      noImageEl.style.textAlign = 'center';
      noImageEl.style.width = '100%';
      
      imagesContainer.innerHTML = '';
      imagesContainer.appendChild(noImageEl);
    }
    
    // Hiển thị modal
    detailModal.style.display = 'block';
    setTimeout(() => {
      detailModal.classList.add('show');
    }, 10);
    
    // Đặt ID chi phí cho các nút hành động
    const editButton = document.getElementById('edit-parent-btn');
    const deleteButton = document.getElementById('delete-parent-btn');
    
    if (editButton) {
      editButton.setAttribute('data-id', expenseData.id);
      editButton.onclick = function() {
        detailModal.classList.remove('show');
      setTimeout(() => {
          detailModal.style.display = 'none';
          HandleEditExpense(expense);
      }, 300);
      };
    }
    
    if (deleteButton) {
      deleteButton.setAttribute('data-id', expenseData.id);
      deleteButton.onclick = function() {
        const confirmed = window.confirm('Bạn có chắc chắn muốn xóa chi phí này?');
        if (confirmed) {
          detailModal.classList.remove('show');
        setTimeout(() => {
            detailModal.style.display = 'none';
            handleDeleteExpense(expense);
        }, 300);
      }
      };
    }
    
    // Đặt sự kiện cho nút đóng
    const closeDetailBtn = document.getElementById('close-detail-modal');
    const closeXBtn = document.querySelector('.expense-detail-close');
    
    if (closeDetailBtn) {
      closeDetailBtn.onclick = function() {
        detailModal.classList.remove('show');
        setTimeout(() => {
          detailModal.style.display = 'none';
        }, 300);
      };
    }
    
    if (closeXBtn) {
      closeXBtn.onclick = function() {
        detailModal.classList.remove('show');
        setTimeout(() => {
          detailModal.style.display = 'none';
        }, 300);
      };
    }
    
  } catch (error) {
    console.error('Lỗi khi hiển thị chi tiết chi phí:', error);
  }
}

// Hàm hiển thị lightbox cho hình ảnh - sửa hoàn toàn
function showImageLightbox(currentImageUrl, allImages) {
  console.log('Hiển thị lightbox cho ảnh:', currentImageUrl);
  
  // Tìm và xóa tất cả lightbox cũ trên trang
  document.querySelectorAll('.expense-lightbox').forEach(box => {
    document.body.removeChild(box);
  });
  
  // Tạo lightbox mới trực tiếp trong DOM
  const lightbox = document.createElement('div');
    lightbox.className = 'expense-lightbox';
  lightbox.style.cssText = `
    display: none;
    position: fixed;
    z-index: 10000;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.95);
    padding: 0;
    box-sizing: border-box;
    opacity: 0;
    transition: opacity 0.3s ease;
  `;
  
  // Tạo HTML nội dung lightbox
    lightbox.innerHTML = `
    <div class="expense-lightbox-close" style="position: absolute; top: 20px; right: 25px; color: white; font-size: 24px; cursor: pointer; z-index: 10001; background-color: rgba(0,0,0,0.5); width: 48px; height: 48px; border-radius: 50%; display: flex; justify-content: center; align-items: center; transition: all 0.3s ease;">
      <i class="bi bi-x-lg"></i>
    </div>
    <div class="expense-lightbox-container" style="position: relative; width: 100%; height: 100%; display: flex; justify-content: center; align-items: center;">
      <img class="expense-lightbox-image" src="" alt="Ảnh chi tiết" style="max-width: 90%; max-height: 85%; object-fit: contain; border-radius: 5px; box-shadow: 0 5px 15px rgba(0,0,0,0.5); transition: transform 0.3s ease, opacity 0.3s ease; z-index: 9000;">
      <div class="expense-lightbox-navigation" style="position: absolute; width: 100%; height: 100%; top: 0; left: 0; pointer-events: none; z-index: 9001;">
        <div class="expense-lightbox-prev" style="position: absolute; top: 50%; transform: translateY(-50%); color: white; cursor: pointer; background-color: rgba(0, 0, 0, 0.5); border-radius: 50%; transition: all 0.3s ease; z-index: 10001; width: 60px; height: 60px; display: flex; justify-content: center; align-items: center; pointer-events: auto; left: 25px;">
          <i class="bi bi-chevron-left" style="font-size: 32px;"></i>
        </div>
        <div class="expense-lightbox-next" style="position: absolute; top: 50%; transform: translateY(-50%); color: white; cursor: pointer; background-color: rgba(0, 0, 0, 0.5); border-radius: 50%; transition: all 0.3s ease; z-index: 10001; width: 60px; height: 60px; display: flex; justify-content: center; align-items: center; pointer-events: auto; right: 25px;">
          <i class="bi bi-chevron-right" style="font-size: 32px;"></i>
        </div>
      </div>
    </div>
    <div class="expense-lightbox-counter" style="position: absolute; bottom: 25px; left: 50%; transform: translateX(-50%); color: white; background-color: rgba(0,0,0,0.6); padding: 8px 16px; border-radius: 30px; font-size: 16px; font-weight: 500; letter-spacing: 1px;">1 / 1</div>
  `;
  
  // Thêm lightbox vào body
    document.body.appendChild(lightbox);
    
  // Lấy tham chiếu đến các phần tử
    const closeBtn = lightbox.querySelector('.expense-lightbox-close');
  const lightboxImg = lightbox.querySelector('.expense-lightbox-image');
  const prevBtn = lightbox.querySelector('.expense-lightbox-prev');
  const nextBtn = lightbox.querySelector('.expense-lightbox-next');
  const counter = lightbox.querySelector('.expense-lightbox-counter');
  
  // Thêm sự kiện đóng
    closeBtn.addEventListener('click', () => {
      lightbox.classList.remove('show');
      setTimeout(() => {
      if (document.body.contains(lightbox)) {
        document.body.removeChild(lightbox);
      }
      }, 300);
    });
    
    // Thêm sự kiện click bên ngoài ảnh để đóng
    lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox || e.target.classList.contains('expense-lightbox-container')) {
        lightbox.classList.remove('show');
  setTimeout(() => {
        if (document.body.contains(lightbox)) {
          document.body.removeChild(lightbox);
        }
        }, 300);
      }
    });
  
  // Xác định danh sách ảnh hợp lệ
  const validImages = allImages.filter(img => {
    const url = typeof img === 'object' ? (img.url || img.path || '') : img;
    return url && url.trim() !== '';
  });
  
  if (validImages.length === 0) return;
  
  // Tìm vị trí ảnh hiện tại
  const currentIndex = validImages.findIndex(img => {
    const url = typeof img === 'object' ? (img.url || img.path || '') : img;
    return url === currentImageUrl;
  });
  
  let currentIdx = currentIndex >= 0 ? currentIndex : 0;
  
  // Hàm cập nhật ảnh hiện tại
  const updateImage = () => {
    const imgUrl = typeof validImages[currentIdx] === 'object' 
      ? (validImages[currentIdx].url || validImages[currentIdx].path || '') 
      : validImages[currentIdx];
    
    // Hiệu ứng fade out trước khi đổi ảnh
    lightboxImg.style.opacity = '0';
    lightboxImg.style.transform = 'scale(0.95)';
    
    setTimeout(() => {
    lightboxImg.src = imgUrl;
      // Cập nhật bộ đếm
      counter.textContent = `${currentIdx + 1} / ${validImages.length}`;
      
      // Hiệu ứng fade in sau khi đổi ảnh
      setTimeout(() => {
        lightboxImg.style.opacity = '1';
        lightboxImg.style.transform = 'scale(1)';
      }, 50);
    }, 200);
  };
  
  updateImage();
  
  // Ẩn nút điều hướng nếu chỉ có 1 ảnh
  if (validImages.length <= 1) {
    prevBtn.style.display = 'none';
    nextBtn.style.display = 'none';
    counter.style.display = 'none';
  } else {
    prevBtn.style.display = 'flex';
    nextBtn.style.display = 'flex';
    counter.style.display = 'block';
    
    // Thêm sự kiện điều hướng
    prevBtn.onclick = (e) => {
      e.stopPropagation();
      currentIdx = (currentIdx - 1 + validImages.length) % validImages.length;
      updateImage();
    };
    
    nextBtn.onclick = (e) => {
      e.stopPropagation();
      currentIdx = (currentIdx + 1) % validImages.length;
      updateImage();
    };
    
    // Thêm điều hướng bằng bàn phím
    const keyHandler = (e) => {
      if (!document.body.contains(lightbox)) {
        document.removeEventListener('keydown', keyHandler);
        return;
      }
      
      if (e.key === 'ArrowLeft') {
        prevBtn.click();
      } else if (e.key === 'ArrowRight') {
        nextBtn.click();
      } else if (e.key === 'Escape') {
        closeBtn.click();
      }
    };
    
    document.addEventListener('keydown', keyHandler);
    
    // Thêm vuốt trên thiết bị di động
    let touchStartX = 0;
    let touchEndX = 0;
    
    const touchStartHandler = (e) => {
      touchStartX = e.changedTouches[0].screenX;
    };
    
    const touchEndHandler = (e) => {
      touchEndX = e.changedTouches[0].screenX;
      const threshold = 50;
      
      if (touchEndX - touchStartX > threshold) {
        // Vuốt sang phải -> ảnh trước
        prevBtn.click();
      } else if (touchStartX - touchEndX > threshold) {
        // Vuốt sang trái -> ảnh tiếp theo
        nextBtn.click();
      }
    };
    
    lightbox.addEventListener('touchstart', touchStartHandler);
    lightbox.addEventListener('touchend', touchEndHandler);
  }
  
  // Thêm sự kiện hover cho nút
  prevBtn.addEventListener('mouseenter', () => {
    prevBtn.style.backgroundColor = 'rgba(13, 110, 253, 0.8)';
    prevBtn.style.transform = 'translateY(-50%) scale(1.1)';
  });
  
  prevBtn.addEventListener('mouseleave', () => {
    prevBtn.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    prevBtn.style.transform = 'translateY(-50%)';
  });
  
  nextBtn.addEventListener('mouseenter', () => {
    nextBtn.style.backgroundColor = 'rgba(13, 110, 253, 0.8)';
    nextBtn.style.transform = 'translateY(-50%) scale(1.1)';
  });
  
  nextBtn.addEventListener('mouseleave', () => {
    nextBtn.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    nextBtn.style.transform = 'translateY(-50%)';
  });
  
  closeBtn.addEventListener('mouseenter', () => {
    closeBtn.style.backgroundColor = 'rgba(220, 53, 69, 0.8)';
    closeBtn.style.transform = 'scale(1.1)';
  });
  
  closeBtn.addEventListener('mouseleave', () => {
    closeBtn.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    closeBtn.style.transform = 'scale(1)';
  });
  
  // Hiển thị lightbox
  lightbox.style.display = 'flex';
  setTimeout(() => {
    lightbox.classList.add('show');
    lightbox.style.opacity = '1';
  }, 10);
  
  // Thêm media query cho responsive
  if (window.innerWidth <= 768) {
    prevBtn.style.width = '48px';
    prevBtn.style.height = '48px';
    nextBtn.style.width = '48px';
    nextBtn.style.height = '48px';
    prevBtn.querySelector('i').style.fontSize = '28px';
    nextBtn.querySelector('i').style.fontSize = '28px';
  }
  
  if (window.innerWidth <= 576) {
    prevBtn.style.width = '40px';
    prevBtn.style.height = '40px';
    nextBtn.style.width = '40px';
    nextBtn.style.height = '40px';
    closeBtn.style.width = '40px';
    closeBtn.style.height = '40px';
    prevBtn.querySelector('i').style.fontSize = '22px';
    nextBtn.querySelector('i').style.fontSize = '22px';
  }
}

// Xử lý chỉnh sửa chi phí
async function HandleEditExpense(expense) {
  console.log('Chỉnh sửa chi phí:', expense);
  
  try {
    // Xóa dropdown cũ trước khi mở form
    removeAllOldDropdowns();
    
    // Lấy tham chiếu đến modal thêm/chỉnh sửa chi phí
    const editModal = document.getElementById('addExpenseModal');
    if (!editModal) {
      console.error('Không tìm thấy modal chỉnh sửa');
      return;
    }
    
    // Đổi tiêu đề modal
    const modalTitle = editModal.querySelector('.expense-modal-title');
    if (modalTitle) {
      modalTitle.textContent = 'Chỉnh sửa chi phí';
    }
    
    // Xóa dữ liệu form draft nếu có
    localStorage.removeItem('expense_form_draft');
    
    // Mở modal
    openModal(editModal);
    
    // Sau khi modal hiển thị, thiết lập lại tất cả input
    setTimeout(() => {
      // Thay thế các input bằng input mới có datalist
      replaceInputsWithDatalist();
      
      // Đợi một lúc để các phần tử mới được tạo
      setTimeout(() => {
    // Điền dữ liệu vào form
    document.getElementById('expenseName').value = expense.noi_dung || '';
    
    // Định dạng số tiền
    const amountValue = expense.gia_tien || 0;
    document.getElementById('expenseAmount').value = formatNumberWithCommas(amountValue.toString());
    
    // Chọn danh mục
    document.getElementById('expenseCategory').value = expense.danh_muc || '';
    
    // Thiết lập địa điểm nếu có
    document.getElementById('expenseLocation').value = expense.dia_diem || '';
    
    // Thiết lập ngày tháng
    if (expense.ngay_thang) {
      // Chuyển đổi về định dạng YYYY-MM-DD cho input type="date"
      const expenseDate = new Date(expense.ngay_thang);
      const dateString = expenseDate.toISOString().split('T')[0];
      document.getElementById('expenseDate').value = dateString;
    }
    
    // Thiết lập ghi chú
    document.getElementById('expenseNote').value = expense.ghi_chu || '';
        
        // Cập nhật lại datalist
        updateDatalistSuggestions();
        
        // Thiết lập tự động chuyển trường
        setupFormAutoAdvance();
        
        // Thiết lập lưu form tự động
        setupFormAutosave();
    
    // Xóa preview hình ảnh hiện tại
    const previewContainer = document.getElementById('imagePreviewContainer');
    if (previewContainer) {
      previewContainer.innerHTML = '';
      
      // Hiển thị hình ảnh hiện có nếu có
      if (expense.images && expense.images.length > 0) {
        let imageArray = expense.images;
        
        // Đảm bảo imageArray là mảng
        if (!Array.isArray(imageArray)) {
          try {
            imageArray = typeof imageArray === 'string' ? 
                         JSON.parse(imageArray) : [imageArray];
            
            if (!Array.isArray(imageArray)) {
              imageArray = [imageArray];
            }
          } catch (e) {
            imageArray = typeof imageArray === 'string' ? 
                         [imageArray] : [];
          }
        }
        
            // Hiển thị từng hình ảnh
            imageArray.forEach(imageUrl => {
              if (typeof imageUrl === 'string' && imageUrl.startsWith('http')) {
                // Tạo phần tử hiển thị hình ảnh
                const previewItem = document.createElement('div');
                previewItem.className = 'expense-image-preview';
                
                // Tạo hình ảnh
                const img = document.createElement('img');
                img.src = imageUrl;
                img.alt = 'Chi phí';
                previewItem.appendChild(img);
                
                // Thêm nút xóa
                const removeBtn = document.createElement('button');
                removeBtn.type = 'button';
                removeBtn.className = 'expense-image-remove';
                removeBtn.innerHTML = '<i class="bi bi-x"></i>';
                
                // Sự kiện xóa hình ảnh
                removeBtn.addEventListener('click', function() {
                  previewItem.remove();
                });
                
                previewItem.appendChild(removeBtn);
                previewContainer.appendChild(previewItem);
          }
        });
      }
    }
    
        // Thêm input ID ẩn
        let expenseIdInput = document.getElementById('expenseId');
    if (!expenseIdInput) {
          expenseIdInput = document.createElement('input');
          expenseIdInput.type = 'hidden';
          expenseIdInput.id = 'expenseId';
          document.getElementById('addExpenseForm').appendChild(expenseIdInput);
        }
        expenseIdInput.value = expense.id || expense.ma_chi_phi;
        
        // Đặt nút Save ở chế độ chỉnh sửa
        const saveBtn = document.getElementById('saveExpenseBtn');
        if (saveBtn) {
          saveBtn.textContent = 'Cập nhật';
          saveBtn.setAttribute('data-mode', 'edit');
        }
        
        // Focus vào trường đầu tiên
        document.getElementById('expenseName')?.focus();
      }, 100);
    }, 100);
    
  } catch (error) {
    console.error('Lỗi khi chỉnh sửa chi phí:', error);
    showToast('Không thể mở form chỉnh sửa: ' + error.message, 'error');
  }
}

// Xử lý xóa chi phí
async function handleDeleteExpense(expense) {
  try {
    // Xác nhận trước khi xóa
    const confirmed = confirm(`Bạn có chắc muốn xóa chi phí "${expense.noi_dung || expense.ten_chi_phi}" không?`);
    if (!confirmed) return;
    
    const expenseId = expense.id || expense.ma_chi_phi;
    
    // Hiển thị thông báo đang xử lý
    showToast('Đang xóa chi phí...', 'info');
    
    // Lấy token
    const token = getCookie('sb_token') || localStorage.getItem('token') || sessionStorage.getItem('sb_token');
    if (!token) {
      throw new Error('Bạn chưa đăng nhập hoặc phiên đã hết hạn');
    }
    
    // Gửi request API
    const response = await fetch(`/api/expenses/${expenseId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Không thể xóa chi phí');
    }
    
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Xóa không thành công');
    }
    
    console.log(`Đã xóa chi phí ID: ${expenseId}`);
    
    // Tải lại dữ liệu từ server thay vì xóa cục bộ
    await reloadExpenses();
    
    // Đóng modal chi tiết nếu đang mở
    closeModal(document.getElementById('expenseDetailModal'));
    
    showToast('Đã xóa chi phí thành công', 'success');
    
  } catch (error) {
    console.error('Lỗi khi xóa chi phí:', error);
    showToast(error.message || 'Không thể xóa chi phí', 'error');
  }
}

// Utility functions
function openModal(modal) {
  if (!modal) return;
  modal.style.display = 'block';
  setTimeout(() => modal.classList.add('show'), 10);
}

function closeModal(modal) {
  if (!modal) return;
  modal.classList.remove('show');
  setTimeout(() => modal.style.display = 'none', 300);
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `expense-toast ${type}`;
  toast.innerHTML = `
    <div class="expense-toast-content">
      <span class="expense-toast-message">${message}</span>
      <button class="expense-toast-close">
            <i class="bi bi-x"></i>
          </button>
    </div>
  `;
  
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  
  const closeBtn = toast.querySelector('.expense-toast-close');
  closeBtn.onclick = () => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  };
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function resetForm(formId) {
  const form = document.getElementById(formId);
  if (!form) return;
  form.reset();
  
  // Xóa tất cả dropdown cũ
  removeAllOldDropdowns();
  
  const previewContainer = document.getElementById('imagePreviewContainer');
  if (previewContainer) previewContainer.innerHTML = '';
  
  // Đặt lại tiêu đề modal
  const modalTitle = document.querySelector('.expense-modal-title');
  if (modalTitle) {
    modalTitle.textContent = 'Thêm chi phí mới';
  }
  
  // Đặt lại nút Save
  const saveBtn = document.getElementById('saveExpenseBtn');
  if (saveBtn) {
    saveBtn.textContent = 'Lưu';
    saveBtn.removeAttribute('data-mode');
  }
  
  // Xóa input ID nếu có
  const expenseIdInput = document.getElementById('expenseId');
  if (expenseIdInput) {
    expenseIdInput.remove();
  }
  
  // Đặt ngày mặc định là ngày hiện tại
  const dateInput = document.getElementById('expenseDate');
  if (dateInput) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
  }
}

function updateExpenseCounter(filteredCount, totalCount = null) {
  const filteredElement = document.getElementById('filtered-count');
  const totalElement = document.getElementById('total-count');
  
  if (filteredElement) filteredElement.textContent = filteredCount;
  if (totalElement) totalElement.textContent = totalCount || filteredCount;
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('vi-VN');
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND'
  }).format(amount);
}

// Hàm lấy icon cho danh mục
function getCategoryIcon(category) {
  const icons = {
    'Thực phẩm': 'bi-egg-fried',
    'Ăn uống': 'bi-cup-hot',
    'Di chuyển': 'bi-car-front',
    'Phương tiện': 'bi-car-front',
    'Mua sắm': 'bi-cart',
    'Giải trí': 'bi-film',
    'Giáo dục': 'bi-book',
    'Học tập': 'bi-book',
    'Y tế': 'bi-heart-pulse',
    'Sức khỏe': 'bi-heart-pulse',
    'Nhà cửa': 'bi-house',
    'Thuê nhà': 'bi-house-door',
    'Hóa đơn': 'bi-receipt',
    'Công việc': 'bi-briefcase',
    'Xã hội': 'bi-people',
    'Du lịch': 'bi-airplane',
    'Khác': 'bi-three-dots'
  };
  
  return icons[category] || 'bi-tag';
}

// Xử lý lỗi xác thực
function handleAuthError() {
  console.log('Đang xử lý lỗi xác thực...');
  
  // Xóa token cũ
  document.cookie = 'sb_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
  
  // Chuyển hướng sau 2 giây
  setTimeout(() => {
    const currentPath = encodeURIComponent(window.location.pathname);
    window.location.href = `/login?redirect=${currentPath}`;
  }, 2000);
}

// Hàm lấy giá trị cookie
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }
  
// Kiểm tra hình ảnh đã lưu
function checkSavedImages() {
  if (ExpensesState.expenses && ExpensesState.expenses.length > 0) {
    console.log('== KIỂM TRA HÌNH ẢNH ĐÃ LƯU ==');
    let totalExpenses = ExpensesState.expenses.length;
    let expensesWithImages = 0;
    let totalImages = 0;
    
    ExpensesState.expenses.forEach((expense, index) => {
      let images = [];
      
      // Kiểm tra các định dạng images có thể có
      if (expense.images) {
        if (Array.isArray(expense.images)) {
          images = expense.images;
        } else if (typeof expense.images === 'string') {
          try {
            const parsed = JSON.parse(expense.images);
            images = Array.isArray(parsed) ? parsed : [parsed];
          } catch (e) {
            if (expense.images.startsWith('http')) {
              images = [expense.images];
            }
          }
        }
      }
      
      if (images.length > 0) {
        expensesWithImages++;
        totalImages += images.length;
        console.log(`Chi phí ${index+1}: "${expense.noi_dung}" có ${images.length} ảnh:`);
        images.forEach(img => console.log(' - ' + img));
      }
    });
    
    console.log(`\nTỔNG KẾT:
- Tổng số chi phí: ${totalExpenses}
- Số chi phí có ảnh: ${expensesWithImages}
- Tổng số ảnh: ${totalImages}`);
    
    return { totalExpenses, expensesWithImages, totalImages };
  } else {
    console.log('Chưa có dữ liệu chi phí được tải');
    return null;
  }
}

// Thêm vào export
window.ExpensesManager = {
  initExpensesPage,
  loadExpenses,
  createExpenseCard,
  handleSaveExpense,
  handleImageUpload,
  getCurrentLocation,
  showExpenseDetail,
  checkDbInfo,
  checkSavedImages
};

// Thêm nút khởi động lại để người dùng có thể khắc phục vấn đề
function addRestartButton() {
  // Kiểm tra xem đã có nút chưa
  if (document.getElementById('restart-app-btn')) return;
  
  // Tạo nút
  const restartBtn = document.createElement('button');
  restartBtn.id = 'restart-app-btn';
  restartBtn.className = 'btn btn-warning restart-btn';
  restartBtn.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Khởi động lại';
  restartBtn.style = 'position: fixed; bottom: 20px; right: 20px; z-index: 9999;';
  
  // Thêm sự kiện
  restartBtn.addEventListener('click', function() {
    restartPage();
  });
  
  // Thêm vào body
  document.body.appendChild(restartBtn);
}

// Thêm hàm khởi động lại trang khi cần
function restartPage() {
  console.log('Khởi động lại trang để giải quyết vấn đề giao diện...');
  
  // Hiển thị thông báo
  showToast('Đang tải lại trang để cải thiện giao diện...', 'info');
  
  // Xóa tất cả dropdown cũ
  document.querySelectorAll('.expense-dropdown, [id$="-dropdown"]').forEach(el => el.remove());
  
  // Xóa cả datalist cũ
  document.querySelectorAll('datalist').forEach(el => el.remove());
  
  // Xóa cache session storage
  sessionStorage.removeItem('expense_datalist_init');
  
  // Đặt cờ trong localStorage để trang biết đã được khởi động lại
  localStorage.setItem('expense_datalist_fix', Date.now().toString());
  
  // Khởi động lại trang sau 1 giây
  setTimeout(() => {
    window.location.reload();
  }, 1000);
}

// Thay thế hoàn toàn các input bằng input mới
function replaceInputsWithDatalist() {
  console.log('Đang thay thế các input...');
  
  // Tìm các input cần thay thế
  const nameInput = document.getElementById('expenseName');
  const locationInput = document.getElementById('expenseLocation');
  
  if (nameInput) {
    // Lưu giá trị hiện tại
    const currentValue = nameInput.value;
    // Lưu các thuộc tính quan trọng khác
    const parent = nameInput.parentNode;
    const placeholder = nameInput.placeholder || 'Nhập tên chi phí';
    const id = nameInput.id;
    const required = nameInput.required;
    
    // Tạo input mới
    const newNameInput = document.createElement('input');
    newNameInput.type = 'text';
    newNameInput.id = id;
    newNameInput.name = id;
    newNameInput.placeholder = placeholder;
    newNameInput.value = currentValue;
    newNameInput.className = nameInput.className;
    newNameInput.required = required;
    newNameInput.setAttribute('list', 'expense-names-datalist');
    newNameInput.setAttribute('autocomplete', 'off');
    
    // Thay thế input cũ bằng input mới
    parent.replaceChild(newNameInput, nameInput);
    console.log('Đã thay thế input tên chi phí');
  }
  
  if (locationInput) {
    // Lưu giá trị hiện tại
    const currentValue = locationInput.value;
    // Lưu các thuộc tính quan trọng khác
    const parent = locationInput.parentNode;
    const placeholder = locationInput.placeholder || 'Nhập địa điểm';
    const id = locationInput.id;
    
    // Tạo input mới
    const newLocationInput = document.createElement('input');
    newLocationInput.type = 'text';
    newLocationInput.id = id;
    newLocationInput.name = id;
    newLocationInput.placeholder = placeholder;
    newLocationInput.value = currentValue;
    newLocationInput.className = locationInput.className;
    newLocationInput.setAttribute('list', 'locations-datalist');
    newLocationInput.setAttribute('autocomplete', 'off');
    
    // Thay thế input cũ bằng input mới
    parent.replaceChild(newLocationInput, locationInput);
    console.log('Đã thay thế input địa điểm');
  }
  
  // Tạo datalist cho tên chi phí (nếu chưa có)
  let expenseDatalist = document.getElementById('expense-names-datalist');
  if (!expenseDatalist) {
    expenseDatalist = document.createElement('datalist');
    expenseDatalist.id = 'expense-names-datalist';
    document.body.appendChild(expenseDatalist);
    
    // Thêm gợi ý ban đầu
    const expenseNames = [...new Set(ExpensesState.expenses.map(expense => expense.noi_dung))];
    expenseDatalist.innerHTML = expenseNames
      .map(name => `<option value="${name}">`)
      .join('');
  }
  
  // Tạo datalist cho địa điểm (nếu chưa có)
  let locationDatalist = document.getElementById('locations-datalist');
  if (!locationDatalist) {
    locationDatalist = document.createElement('datalist');
    locationDatalist.id = 'locations-datalist';
    document.body.appendChild(locationDatalist);
    
    // Thêm gợi ý địa điểm
    const locations = [
      "Hà Nội", "TP Hồ Chí Minh", "Đà Nẵng", "Hải Phòng", "Cần Thơ",
      "An Giang", "Bà Rịa - Vũng Tàu", "Bắc Giang", "Bắc Kạn", "Bạc Liêu",
      "Bắc Ninh", "Bến Tre", "Bình Định", "Bình Dương", "Bình Phước",
      "Bình Thuận", "Cà Mau", "Cao Bằng", "Đắk Lắk", "Đắk Nông",
      "Điện Biên", "Đồng Nai", "Đồng Tháp", "Gia Lai", "Hà Giang",
      "Hà Nam", "Hà Tĩnh", "Hải Dương", "Hậu Giang", "Hòa Bình",
      "Hưng Yên", "Khánh Hòa", "Kiên Giang", "Kon Tum", "Lai Châu",
      "Lâm Đồng", "Lạng Sơn", "Lào Cai", "Long An", "Nam Định",
      "Nghệ An", "Ninh Bình", "Ninh Thuận", "Phú Thọ", "Phú Yên",
      "Quảng Bình", "Quảng Nam", "Quảng Ngãi", "Quảng Ninh", "Quảng Trị",
      "Sóc Trăng", "Sơn La", "Tây Ninh", "Thái Bình", "Thái Nguyên",
      "Thanh Hóa", "Thừa Thiên Huế", "Tiền Giang", "Trà Vinh", "Tuyên Quang",
      "Vĩnh Long", "Vĩnh Phúc", "Yên Bái"
    ];
    locationDatalist.innerHTML = locations
      .map(location => `<option value="${location}">`)
      .join('');
  }
  
  // Xóa tất cả dropdown cũ và sự kiện của chúng
  removeAllOldDropdowns();
  
  console.log('Đã hoàn thành việc thay thế input và thiết lập datalist');
}

// Cập nhật hàm injectFixButton để sửa triệt để hơn
// function injectFixButton() {
//   // Kiểm tra xem đã có nút chưa
//   if (document.getElementById('fix-datalist-btn')) return;
  
//   // Luôn thêm nút này để người dùng có thể sửa
//   const fixBtn = document.createElement('button');
//   fixBtn.id = 'fix-datalist-btn';
//   fixBtn.innerHTML = 'Sửa lỗi gợi ý';
//   fixBtn.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 9999; background-color: #dc3545; color: white; border: none; border-radius: 5px; padding: 10px 15px; cursor: pointer;';
  
//   // Thêm sự kiện
//   fixBtn.addEventListener('click', function() {
//     // Xóa tất cả dropdown cũ
//     removeAllOldDropdowns();
    
//     // Thay thế hoàn toàn các input bằng input mới
//     replaceInputsWithDatalist();
    
//     // Thông báo
//     showToast('Đã sửa lỗi gợi ý', 'success');
    
//     // Xóa nút sau 3 giây
//     setTimeout(() => {
//       fixBtn.remove();
//     }, 3000);
//   });
  
//   // Thêm vào body
//   document.body.appendChild(fixBtn);
  
//   console.log('Đã thêm nút sửa lỗi');
// }

// Thiết lập datalist cho form
function setupDatalist() {
  console.log('Thiết lập datalist cho form...');
  
  // Tạo datalist cho tên chi phí nếu chưa có
  let expenseDatalist = document.getElementById('expense-names-datalist');
  if (!expenseDatalist) {
    expenseDatalist = document.createElement('datalist');
    expenseDatalist.id = 'expense-names-datalist';
    document.body.appendChild(expenseDatalist);
  }
  
  // Tạo datalist cho địa điểm nếu chưa có
  let locationDatalist = document.getElementById('locations-datalist');
  if (!locationDatalist) {
    locationDatalist = document.createElement('datalist');
    locationDatalist.id = 'locations-datalist';
    document.body.appendChild(locationDatalist);
  }
  
  // Cập nhật các gợi ý cho datalist
  updateDatalistSuggestions();
  
  // Thay thế các input cũ bằng input mới có datalist
  replaceInputsWithDatalist();
  
  console.log('Đã thiết lập datalist xong');
}

// Cập nhật HTML form để sử dụng datalist
function updateFormHTML() {
  console.log('Cập nhật HTML form...');
  
  // Tìm form
  const form = document.getElementById('addExpenseForm');
  if (!form) {
    console.error('Không tìm thấy form');
    return;
  }
  
  // Kiểm tra xem form đã được cập nhật chưa
  if (form.getAttribute('data-updated') === 'true') {
    console.log('Form đã được cập nhật trước đó');
    return;
  }
  
  // Đánh dấu form đã được cập nhật
  form.setAttribute('data-updated', 'true');
  
  // Thay thế các input bằng input mới có datalist
  replaceInputsWithDatalist();
  
  console.log('Đã cập nhật HTML form');
}

// Cập nhật gợi ý cho datalist
function updateDatalistSuggestions() {
  console.log('Cập nhật gợi ý cho datalist...');
  
  // Cập nhật datalist tên chi phí
  const expenseDatalist = document.getElementById('expense-names-datalist');
  if (expenseDatalist) {
    // Lấy danh sách tên chi phí độc nhất
    const expenseNames = [...new Set(ExpensesState.expenses.map(expense => expense.noi_dung))];
    
    // Cập nhật datalist
    expenseDatalist.innerHTML = expenseNames
      .filter(name => name && name.trim() !== '') // Lọc bỏ các giá trị rỗng
      .map(name => `<option value="${name.replace(/"/g, '&quot;')}">`)
      .join('');
    
    console.log(`Đã cập nhật ${expenseNames.length} gợi ý tên chi phí`);
  }
  
  // Cập nhật datalist địa điểm
  const locationDatalist = document.getElementById('locations-datalist');
  if (locationDatalist) {
    // Danh sách tỉnh thành cố định
    const provinces = [
      "Hà Nội", "TP Hồ Chí Minh", "Đà Nẵng", "Hải Phòng", "Cần Thơ",
      "An Giang", "Bà Rịa - Vũng Tàu", "Bắc Giang", "Bắc Kạn", "Bạc Liêu",
      "Bắc Ninh", "Bến Tre", "Bình Định", "Bình Dương", "Bình Phước",
      "Bình Thuận", "Cà Mau", "Cao Bằng", "Đắk Lắk", "Đắk Nông",
      "Điện Biên", "Đồng Nai", "Đồng Tháp", "Gia Lai", "Hà Giang",
      "Hà Nam", "Hà Tĩnh", "Hải Dương", "Hậu Giang", "Hòa Bình",
      "Hưng Yên", "Khánh Hòa", "Kiên Giang", "Kon Tum", "Lai Châu",
      "Lâm Đồng", "Lạng Sơn", "Lào Cai", "Long An", "Nam Định",
      "Nghệ An", "Ninh Bình", "Ninh Thuận", "Phú Thọ", "Phú Yên",
      "Quảng Bình", "Quảng Nam", "Quảng Ngãi", "Quảng Ninh", "Quảng Trị",
      "Sóc Trăng", "Sơn La", "Tây Ninh", "Thái Bình", "Thái Nguyên",
      "Thanh Hóa", "Thừa Thiên Huế", "Tiền Giang", "Trà Vinh", "Tuyên Quang",
      "Vĩnh Long", "Vĩnh Phúc", "Yên Bái"
    ];
    
    // Lấy danh sách địa điểm từ chi phí hiện có
    const expenseLocations = [...new Set(ExpensesState.expenses
      .map(expense => expense.dia_diem)
      .filter(location => location && location.trim() !== '' && location !== 'Không có địa điểm' && location !== 'không có địa điểm')
    )];
    
    // Kết hợp hai danh sách và loại bỏ trùng lặp
    const combinedLocations = [...new Set([...provinces, ...expenseLocations])];
    
    // Cập nhật datalist
    locationDatalist.innerHTML = combinedLocations
      .map(location => `<option value="${location.replace(/"/g, '&quot;')}">`)
      .join('');
    
    console.log(`Đã cập nhật ${combinedLocations.length} gợi ý địa điểm`);
  }
}

// Khởi tạo trang khi DOM đã sẵn sàng
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOMContentLoaded event fired in expenses.js');
  
  // Đăng ký một MutationObserver để theo dõi sự thay đổi DOM
  const observer = new MutationObserver(function(mutations) {
    // Kiểm tra xem có dropdown cũ không
    const hasDropdowns = document.querySelectorAll('.expense-dropdown').length > 0;
    if (hasDropdowns) {
      console.log('Phát hiện dropdown cũ, thực hiện sửa tự động...');
      // Xóa tất cả dropdown cũ
      removeAllOldDropdowns();
      // Thay thế các input bằng input mới
      replaceInputsWithDatalist();
    }
  });
  
  // Bắt đầu quan sát DOM
  observer.observe(document.body, { 
    childList: true, 
    subtree: true 
  });
  
  // Thêm nút sửa lỗi
  setTimeout(injectFixButton, 2000);
  
  // Tự động gọi init nếu đang ở trang expenses
  if (window.location.pathname.includes('/expenses')) {
    console.log('Đang ở trang expenses, tự động khởi tạo');
    initExpensesPage();
  }
});

// Thiết lập tự động chuyển trường cho form
function setupFormAutoAdvance() {
  console.log('Thiết lập tự động chuyển trường cho form...');
  
  // Lấy tất cả các input trong form
  const form = document.getElementById('addExpenseForm');
  if (!form) return;
  
  // Lấy các trường trong form theo thứ tự
  const inputs = [
    document.getElementById('expenseName'),
    document.getElementById('expenseAmount'),
    document.getElementById('expenseCategory'),
    document.getElementById('expenseLocation'),
    document.getElementById('expenseDate'),
    document.getElementById('expenseNote')
  ].filter(input => input); // Lọc bỏ các giá trị null
  
  // Thiết lập sự kiện cho từng trường
  inputs.forEach((input, index) => {
    // Thêm sự kiện cho trường hiện tại
    input.addEventListener('keydown', function(e) {
      // Chuyển sang trường tiếp theo khi nhấn Enter (trừ trường ghi chú cuối cùng)
      if (e.key === 'Enter' && index < inputs.length - 1) {
        e.preventDefault(); // Ngăn submit form
        
        // Tự động chọn gợi ý đầu tiên trong datalist (nếu có)
        if (input.hasAttribute('list') && input.value) {
          const datalistId = input.getAttribute('list');
          const datalist = document.getElementById(datalistId);
          if (datalist && datalist.options.length > 0) {
            // Tìm gợi ý phù hợp đầu tiên
            for (let i = 0; i < datalist.options.length; i++) {
              const option = datalist.options[i];
              if (option.value.toLowerCase().startsWith(input.value.toLowerCase())) {
                input.value = option.value;
                break;
              }
            }
          }
        }
        
        // Chuyển sang trường tiếp theo
        inputs[index + 1].focus();
      }
      
      // Nếu là trường cuối và nhấn Enter, trigger submit form
      if (e.key === 'Enter' && index === inputs.length - 1) {
        e.preventDefault();
        document.getElementById('saveExpenseBtn')?.click();
      }
    });
    
    // Thêm sự kiện tự động điền giá trị khi chọn từ datalist
    if (input.hasAttribute('list')) {
      input.addEventListener('input', function() {
        // Kiểm tra xem giá trị có khớp với bất kỳ option nào trong datalist
        const datalistId = input.getAttribute('list');
        const datalist = document.getElementById(datalistId);
        
        if (datalist) {
          for (let i = 0; i < datalist.options.length; i++) {
            if (datalist.options[i].value === input.value) {
              // Nếu giá trị khớp hoàn toàn, tự động chuyển sang trường tiếp theo
              if (index < inputs.length - 1) {
                setTimeout(() => {
                  inputs[index + 1].focus();
                }, 100);
              }
              break;
            }
          }
        }
      });
    }
  });
  
  // Thiết lập tự động điền ngày hiện tại nếu trường ngày trống
  const dateInput = document.getElementById('expenseDate');
  if (dateInput && !dateInput.value) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
  }
  
  console.log('Đã thiết lập tự động chuyển trường');
}

// Lưu trạng thái form khi người dùng nhập
function saveFormState() {
  try {
    const formData = {
      noi_dung: document.getElementById('expenseName')?.value || '',
      gia_tien: document.getElementById('expenseAmount')?.value || '',
      danh_muc: document.getElementById('expenseCategory')?.value || '',
      dia_diem: document.getElementById('expenseLocation')?.value || '',
      ghi_chu: document.getElementById('expenseNote')?.value || '',
      timestamp: Date.now()
    };
    
    // Lưu vào localStorage
    localStorage.setItem('expense_form_draft', JSON.stringify(formData));
    console.log('Đã lưu trạng thái form:', formData);
  } catch (error) {
    console.error('Lỗi khi lưu trạng thái form:', error);
  }
}

// Khôi phục trạng thái form từ localStorage
function restoreFormState() {
  try {
    // Kiểm tra xem có dữ liệu lưu không
    const formDataStr = localStorage.getItem('expense_form_draft');
    if (!formDataStr) return false;
    
    // Parse dữ liệu
    const formData = JSON.parse(formDataStr);
    
    // Kiểm tra thời gian lưu (chỉ khôi phục nếu lưu trong 24 giờ qua)
    const MAX_AGE = 24 * 60 * 60 * 1000; // 24 giờ
    if (Date.now() - formData.timestamp > MAX_AGE) {
      // Dữ liệu quá cũ, xóa đi
      localStorage.removeItem('expense_form_draft');
      return false;
    }
    
    // Hiển thị nút khôi phục
    showRestoreButton(formData);
    
    return true;
  } catch (error) {
    console.error('Lỗi khi khôi phục trạng thái form:', error);
    return false;
  }
}

// Hiển thị nút khôi phục dữ liệu
function showRestoreButton(formData) {
  // Kiểm tra xem đã có nút chưa 
  if (document.getElementById('restore-form-btn')) return;
  
  // Tìm form
  const form = document.getElementById('addExpenseForm');
  if (!form) return;
  
  // Tạo nút
  const restoreBtn = document.createElement('button');
  restoreBtn.id = 'restore-form-btn';
  restoreBtn.type = 'button';
  restoreBtn.className = 'btn btn-sm btn-warning mb-3';
  restoreBtn.innerHTML = '<i class="bi bi-arrow-counterclockwise"></i> Khôi phục dữ liệu chưa lưu';
  
  // Thêm sự kiện
  restoreBtn.addEventListener('click', function() {
    // Điền lại các trường
    if (formData.noi_dung) document.getElementById('expenseName').value = formData.noi_dung;
    if (formData.gia_tien) document.getElementById('expenseAmount').value = formData.gia_tien;
    if (formData.danh_muc) document.getElementById('expenseCategory').value = formData.danh_muc;
    if (formData.dia_diem) document.getElementById('expenseLocation').value = formData.dia_diem;
    if (formData.ghi_chu) document.getElementById('expenseNote').value = formData.ghi_chu;
    
    // Xóa nút và dữ liệu lưu tạm
    restoreBtn.remove();
    localStorage.removeItem('expense_form_draft');
    
    // Hiển thị thông báo
    showToast('Đã khôi phục dữ liệu form', 'success');
  });
  
  // Thêm nút vào form
  const firstField = form.querySelector('.form-group');
  if (firstField) {
    form.insertBefore(restoreBtn, firstField);
  } else {
    form.prepend(restoreBtn);
  }
}

// Thiết lập lưu form tự động
function setupFormAutosave() {
  // Lấy tất cả các input trong form
  const form = document.getElementById('addExpenseForm');
  if (!form) return;
  
  // Các trường cần theo dõi
  const inputs = [
    document.getElementById('expenseName'),
    document.getElementById('expenseAmount'),
    document.getElementById('expenseCategory'),
    document.getElementById('expenseLocation'),
    document.getElementById('expenseNote')
  ].filter(input => input);
  
  // Biến để theo dõi timeout
  let saveTimeout;
  
  // Thêm sự kiện input cho tất cả các trường
  inputs.forEach(input => {
    input.addEventListener('input', function() {
      // Hủy timeout trước đó nếu có
      if (saveTimeout) clearTimeout(saveTimeout);
      
      // Lưu sau 1 giây không có hoạt động nhập liệu
      saveTimeout = setTimeout(saveFormState, 1000);
    });
  });
  
  // Xóa dữ liệu lưu khi lưu form thành công
  const saveBtn = document.getElementById('saveExpenseBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', function() {
      // Xóa dữ liệu lưu tạm sau khi lưu thành công
      setTimeout(() => {
        localStorage.removeItem('expense_form_draft');
      }, 1000);
    });
  }
}

// QUAN TRỌNG - Đảm bảo không có lightbox cũ tồn tại trước khi script chạy
document.addEventListener('DOMContentLoaded', function() {
  // Xóa mọi lightbox cũ có thể còn tồn tại trên trang
  document.querySelectorAll('.expense-lightbox').forEach(box => {
    if (document.body.contains(box)) {
      document.body.removeChild(box);
    }
  });
  
  // Thêm event listener cho bất kỳ click nào trên trang để xóa lightbox cũ
  document.addEventListener('click', function(e) {
    if (!e.target.closest('.expense-lightbox') && 
        !e.target.closest('.expense-detail-image') && 
        !e.target.closest('.expense-card-image')) {
      document.querySelectorAll('.expense-lightbox').forEach(box => {
        if (document.body.contains(box)) {
          // Xóa lightbox cũ bỏ quên
          box.classList.remove('show');
          setTimeout(() => {
            if (document.body.contains(box)) {
              document.body.removeChild(box);
            }
          }, 300);
        }
      });
    }
  });
});

// Cập nhật danh sách gợi ý tên chi phí sau khi tải dữ liệu
    updateExpenseSuggestions();

// Sửa thành:
// Cập nhật danh sách gợi ý tên chi phí sau khi tải dữ liệu
    if (typeof updateExpenseSuggestions === 'function') {
      updateExpenseSuggestions();
    }

// Thêm hàm updateExpenseSuggestions vào cuối file
function updateExpenseSuggestions() {
  try {
    console.log('Cập nhật danh sách gợi ý tên chi phí');
    // Lấy tên chi phí từ danh sách chi phí hiện có
    if (ExpensesState && ExpensesState.expenses && ExpensesState.expenses.length > 0) {
      // Lưu danh sách tên chi phí vào localStorage để sử dụng cho gợi ý
      const expenseNames = [...new Set(ExpensesState.expenses.map(expense => expense.ten_chi_phi))];
      if (expenseNames.length > 0) {
        localStorage.setItem('expenseSuggestions', JSON.stringify(expenseNames));
        console.log('Đã cập nhật', expenseNames.length, 'gợi ý tên chi phí');
      }
    }
  } catch (error) {
    console.error('Lỗi khi cập nhật gợi ý tên chi phí:', error);
  }
}

// Thêm hàm checkDbInfo
function checkDbInfo() {
  try {
    console.log('Kiểm tra thông tin cơ sở dữ liệu');
    // Kiểm tra kết nối đến Supabase
    if (window.supabase) {
      console.log('Kết nối Supabase có sẵn');
      return true;
    } else {
      console.warn('Chưa khởi tạo kết nối Supabase');
      return false;
    }
  } catch (error) {
    console.error('Lỗi khi kiểm tra thông tin cơ sở dữ liệu:', error);
    return false;
  }
}