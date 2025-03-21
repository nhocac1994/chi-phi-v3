/**
 * Chi Phi App - Hệ thống biểu đồ tối ưu
 * Version: 3.0
 * Cập nhật: Tối ưu hiệu suất, giảm lag, cải thiện độ ổn định
 */

// Kiểm tra xem ChartSystem đã tồn tại chưa để tránh khai báo lại
if (typeof window.ChartSystem === 'undefined') {
  // Biến toàn cục để lưu trữ các instance biểu đồ
  window.ChartSystem = {
    // Lưu trữ các instance biểu đồ
    charts: {
      time: null,
      category: null
    },
    
    // Cấu hình mặc định
    config: {
      timeChartType: 'bar',
      animationDuration: 300,
      maxDataPoints: 30,
      debounceTime: 100,
      colors: {
        primary: '#5a67d8',
        secondary: '#4c51bf',
        background: 'rgba(90, 103, 216, 0.1)'
      }
    },
    
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
      // Thiết lập cấu hình Chart.js
      this._setupChartDefaults();
      
      // Thiết lập các container
      this._setupContainers();
      
      // Khởi tạo các biểu đồ
      this._initCharts();
      
      // Thiết lập các sự kiện
      this._setupEvents();
    },
    
    // Thiết lập cấu hình mặc định cho Chart.js
    _setupChartDefaults() {
      if (typeof Chart === 'undefined') {
        console.error('Chart.js chưa được tải');
        return;
      }
      
      // Cấu hình toàn cục
      Chart.defaults.font.size = 11;
      Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
      Chart.defaults.responsive = true;
      Chart.defaults.maintainAspectRatio = false;
      
      // Tối ưu hóa animation
      Chart.defaults.animation.duration = this.config.animationDuration;
      Chart.defaults.transitions.active.animation.duration = this.config.animationDuration;
      
      // Tắt các tính năng không cần thiết để tăng hiệu suất
      Chart.defaults.plugins.tooltip.enabled = true;
      Chart.defaults.plugins.legend.display = false;
    },
    
    // Thiết lập các container
    _setupContainers() {
      // Đảm bảo các container có kích thước cố định
      const containers = document.querySelectorAll('.chart-container');
      if (!containers.length) return;
      
      containers.forEach(container => {
        // Đặt kích thước cố định cho container
        container.style.maxHeight = '450px';
        
        // Đảm bảo chart-body có kích thước cố định
        const chartBody = container.querySelector('.chart-body');
        if (chartBody) {
          chartBody.style.height = '320px';
          chartBody.style.maxHeight = '350px';
          chartBody.style.overflow = 'hidden';
        }
        
        // Đảm bảo canvas có kích thước phù hợp
        const canvas = container.querySelector('canvas');
        if (canvas) {
          canvas.height = 320;
          canvas.style.maxHeight = '100%';
          canvas.style.height = '100%';
          canvas.style.width = '100%';
        }
        
        // Xử lý đặc biệt cho container biểu đồ danh mục
        if (container.querySelector('#category-distribution')) {
          const pieContainer = container.querySelector('.pie-chart-container');
          if (pieContainer) {
            pieContainer.style.display = 'flex';
            pieContainer.style.height = '100%';
            pieContainer.style.width = '100%';
            pieContainer.style.alignItems = 'center';
            pieContainer.style.justifyContent = 'space-between';
            pieContainer.style.overflow = 'hidden';
          }
        }
      });
    },
    
    // Khởi tạo các biểu đồ
    _initCharts() {
      // Khởi tạo biểu đồ thời gian
      this._initTimeChart();
      
      // Khởi tạo biểu đồ danh mục
      this._initCategoryChart();
    },
    
    // Khởi tạo biểu đồ thời gian
    _initTimeChart() {
      const canvas = document.getElementById('expenses-timeline');
      if (!canvas) return;
      
      // Tạo biểu đồ với dữ liệu trống
      this.renderTimeChart([]);
      
      // Thêm nút chuyển đổi biểu đồ
      this._setupChartToggle();
    },
    
    // Khởi tạo biểu đồ danh mục
    _initCategoryChart() {
      const canvas = document.getElementById('category-distribution');
      if (!canvas) return;
      
      // Tạo biểu đồ với dữ liệu mặc định
      this.renderCategoryChart([{name: 'Đang tải...', value: 1}]);
    },
    
    // Thiết lập các sự kiện
    _setupEvents() {
      // Xử lý sự kiện resize cửa sổ với debounce để tránh lag
      let resizeTimeout;
      window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => this._handleResize(), this.config.debounceTime);
      });
    },
    
    // Xử lý sự kiện resize cửa sổ
    _handleResize() {
      // Đảm bảo biểu đồ được vẽ lại khi kích thước cửa sổ thay đổi
      if (this.charts.time) {
        this.charts.time.resize();
      }
      if (this.charts.category) {
        this.charts.category.resize();
      }
    },
    
    // Thiết lập nút chuyển đổi biểu đồ
    _setupChartToggle() {
      const timeChartElement = document.getElementById('expenses-timeline');
      if (!timeChartElement) return;
      
      const chartContainer = timeChartElement.closest('.chart-container');
      if (!chartContainer) return;
      
      const chartHeader = chartContainer.querySelector('.chart-header');
      if (!chartHeader) return;
      
      // Kiểm tra xem đã có toggle container chưa
      if (chartHeader.querySelector('.chart-toggle')) return;
      
      // Tạo toggle container
      const toggleContainer = document.createElement('div');
      toggleContainer.className = 'chart-toggle';
      toggleContainer.innerHTML = `
        <button class="toggle-btn active" data-type="bar">
          <i class="bi bi-bar-chart"></i>
        </button>
        <button class="toggle-btn" data-type="line">
          <i class="bi bi-graph-up"></i>
        </button>
      `;
      chartHeader.appendChild(toggleContainer);
      
      // Thêm sự kiện cho nút chuyển đổi
      const toggleButtons = toggleContainer.querySelectorAll('.toggle-btn');
      toggleButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          // Cập nhật trạng thái active
          toggleButtons.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          
          // Cập nhật kiểu biểu đồ
          this.config.timeChartType = btn.getAttribute('data-type');
          
          // Lấy dữ liệu hiện tại từ biểu đồ
          let currentData = [];
          
          if (this.charts.time) {
            const chartData = this.charts.time.data;
            currentData = chartData.datasets[0].data.map((value, index) => ({
              date: chartData.labels[index],
              amount: value
            }));
          }
          
          // Vẽ lại biểu đồ với kiểu mới
          this.renderTimeChart(currentData);
        });
      });
    },
    
    // Vẽ biểu đồ thời gian
    renderTimeChart(timeData) {
      const canvas = document.getElementById('expenses-timeline');
      if (!canvas) return;
      
      // Đảm bảo dữ liệu hợp lệ
      if (!Array.isArray(timeData)) timeData = [];
      
      // Giới hạn số lượng điểm dữ liệu để tránh lag
      if (timeData.length > this.config.maxDataPoints) {
        timeData = timeData.slice(timeData.length - this.config.maxDataPoints);
      }
      
      // Chuẩn bị dữ liệu
      const dates = timeData.map(item => item.date || '');
      const amounts = timeData.map(item => item.amount || 0);
      
      // Phá hủy biểu đồ hiện tại nếu tồn tại
      if (this.charts.time) {
        this.charts.time.destroy();
        this.charts.time = null;
      }
      
      // Cấu hình dựa trên loại biểu đồ
      const isBarChart = this.config.timeChartType === 'bar';
      
      // Dataset chung
      const dataset = {
        label: 'Chi phí theo ngày',
        data: amounts
      };
      
      // Áp dụng cấu hình dựa trên loại biểu đồ
      if (isBarChart) {
        // Cấu hình cho biểu đồ cột
        Object.assign(dataset, {
          backgroundColor: 'rgba(90, 103, 216, 0.6)',
          borderColor: 'rgba(90, 103, 216, 1)',
          borderWidth: 1,
          borderRadius: 4,
          barPercentage: 0.6,
          maxBarThickness: 35
        });
      } else {
        // Cấu hình cho biểu đồ đường
        Object.assign(dataset, {
          borderColor: this.config.colors.primary,
          backgroundColor: this.config.colors.background,
          borderWidth: 2,
          pointBackgroundColor: this.config.colors.primary,
          pointBorderColor: '#ffffff',
          pointBorderWidth: 1,
          pointRadius: 3,
          pointHoverRadius: 5,
          fill: true,
          tension: 0.4
        });
      }
      
      // Tính toán giá trị tối đa cho trục y
      const maxValue = amounts.length > 0 ? Math.max(...amounts) : 0;
      // Đặt giá trị tối đa gợi ý để biểu đồ không kéo dài vô hạn
      const suggestedMax = maxValue > 0 ? Math.ceil(maxValue * 1.2 / 10000) * 10000 : 10000;
      
      // Tạo biểu đồ mới với hiệu suất tối ưu
      this.charts.time = new Chart(canvas, {
        type: this.config.timeChartType,
        data: {
          labels: dates,
          datasets: [dataset]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: {
            duration: this.config.animationDuration
          },
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  // Chỉ hiển thị số và đơn vị tiền tệ
                  return formatCurrency(context.raw);
                }
              },
              // Tối ưu hiệu suất tooltip
              animation: {
                duration: 150
              },
              displayColors: false
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              suggestedMax: suggestedMax,
              grace: '5%',
              ticks: {
                callback: function(value) {
                  // Chỉ hiển thị số và đơn vị tiền tệ
                  return formatCurrency(value);
                },
                maxTicksLimit: 5,
                font: {
                  size: 11
                }
              },
              grid: {
                display: true,
                drawBorder: false,
                color: 'rgba(200, 200, 200, 0.2)'
              }
            },
            x: {
              grid: {
                display: false,
                drawBorder: false
              },
              ticks: {
                maxRotation: 45,
                minRotation: 0,
                autoSkip: true,
                maxTicksLimit: 7,
                font: {
                  size: 11
                }
              }
            }
          },
          // Tối ưu hiệu suất khi hover
          hover: {
            mode: 'nearest',
            intersect: false,
            animationDuration: 150
          },
          // Tối ưu hiệu suất khi click
          onClick: null,
          // Tối ưu layout
          layout: {
            padding: {
              left: 5,
              right: 10,
              top: 10,
              bottom: 5
            }
          }
        }
      });
    },
    
    // Vẽ biểu đồ danh mục
    renderCategoryChart(categories) {
      const canvas = document.getElementById('category-distribution');
      if (!canvas) return;
      
      // Đảm bảo có dữ liệu hợp lệ
      if (!categories || !Array.isArray(categories) || categories.length === 0) {
        categories = [{name: 'Chưa có dữ liệu', value: 0}];
      }
      
      // Giới hạn số lượng danh mục để tránh lag
      if (categories.length > 10) {
        // Sắp xếp theo giá trị giảm dần
        categories.sort((a, b) => b.value - a.value);
        
        // Lấy 9 danh mục lớn nhất
        const topCategories = categories.slice(0, 9);
        
        // Tính tổng giá trị của các danh mục còn lại
        const otherValue = categories.slice(9).reduce((sum, cat) => sum + cat.value, 0);
        
        // Thêm danh mục "Khác" nếu có giá trị
        if (otherValue > 0) {
          topCategories.push({name: 'Khác', value: otherValue});
        }
        
        categories = topCategories;
      }
      
      // Phá hủy biểu đồ hiện tại nếu tồn tại
      if (this.charts.category) {
        this.charts.category.destroy();
        this.charts.category = null;
      }
      
      // Thiết lập kích thước canvas
      canvas.style.maxHeight = '100%';
      canvas.style.height = '100%';
      canvas.style.width = '100%';
      canvas.height = 320;
      
      // Đảm bảo container có kích thước phù hợp
      const pieContainer = canvas.closest('.pie-chart-container');
      if (pieContainer) {
        pieContainer.style.display = 'flex';
        pieContainer.style.height = '100%';
        pieContainer.style.width = '100%';
        pieContainer.style.alignItems = 'center';
        pieContainer.style.justifyContent = 'space-between';
        pieContainer.style.overflow = 'hidden';
        
        // Điều chỉnh kích thước canvas và legend container
        const legendContainer = document.getElementById('category-legend');
        if (legendContainer) {
          // Đảm bảo canvas không chiếm quá nhiều không gian
          canvas.style.maxWidth = '60%';
          canvas.style.flex = '0 0 60%';
          
          // Đảm bảo legend container có kích thước phù hợp
          legendContainer.style.flex = '0 0 35%';
          legendContainer.style.maxHeight = '320px';
          legendContainer.style.overflowY = 'auto';
          legendContainer.style.marginLeft = '5%';
        }
      }
      
      // Chuẩn bị dữ liệu
      const labels = categories.map(cat => cat.name);
      const values = categories.map(cat => cat.value);
      
      // Tạo màu ngẫu nhiên cho các danh mục
      const colors = categories.map((_, index) => {
        // Sử dụng màu từ bảng màu được xác định trước để tránh màu quá sáng hoặc quá tối
        const colorPalette = [
          'rgb(90, 103, 216)', // Indigo
          'rgb(72, 187, 120)', // Green
          'rgb(237, 100, 166)', // Pink
          'rgb(246, 173, 85)', // Orange
          'rgb(79, 209, 197)', // Teal
          'rgb(159, 122, 234)', // Purple
          'rgb(246, 109, 155)', // Rose
          'rgb(56, 178, 172)', // Cyan
          'rgb(129, 140, 248)', // Blue
          'rgb(246, 173, 85)', // Yellow
          'rgb(203, 213, 224)', // Gray
          'rgb(113, 128, 150)' // Cool Gray
        ];
        
        return colorPalette[index % colorPalette.length];
      });
      
      // Tạo biểu đồ mới với hiệu suất tối ưu
      this.charts.category = new Chart(canvas, {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{
            data: values,
            backgroundColor: colors,
            borderWidth: 1,
            borderColor: '#ffffff',
            hoverOffset: 5
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: {
            duration: this.config.animationDuration
          },
          cutout: '60%',
          radius: '90%',
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  const label = context.label || '';
                  const value = context.raw || 0;
                  const total = context.dataset.data.reduce((a, b) => a + b, 0);
                  const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                  // Chỉ hiển thị số và đơn vị tiền tệ một lần
                  return `${label}: ${formatCurrency(value)} (${percentage}%)`;
                }
              },
              // Tối ưu hiệu suất tooltip
              animation: {
                duration: 150
              },
              displayColors: false
            }
          },
          // Tối ưu hiệu suất khi hover
          hover: {
            mode: 'nearest',
            animationDuration: 150
          },
          // Tối ưu hiệu suất khi click
          onClick: null,
          // Tối ưu layout
          layout: {
            padding: 0
          }
        }
      });
      
      // Cập nhật legend tùy chỉnh
      this._updateCategoryLegend(categories, colors);
      
      // Đảm bảo biểu đồ được vẽ đúng kích thước
      setTimeout(() => {
        if (this.charts.category) {
          this.charts.category.resize();
        }
      }, 50);
    },
    
    // Cập nhật legend tùy chỉnh
    _updateCategoryLegend(categories, colors) {
      const legendContainer = document.getElementById('category-legend');
      if (!legendContainer) return;
      
      // Xóa legend cũ
      legendContainer.innerHTML = '';
      
      // Thiết lập style cho legend container
      legendContainer.style.marginTop = '0';
      legendContainer.style.maxHeight = '320px';
      legendContainer.style.overflowY = 'auto';
      legendContainer.style.flex = '0 0 35%';
      legendContainer.style.paddingLeft = '10px';
      
      // Không hiển thị legend nếu không có dữ liệu
      if (categories.length === 0 || (categories.length === 1 && categories[0].name === 'Chưa có dữ liệu')) {
        legendContainer.innerHTML = '<div class="no-data">Chưa có dữ liệu chi phí</div>';
        return;
      }
      
      // Tạo fragment để tối ưu hiệu suất DOM
      const fragment = document.createDocumentFragment();
      
      // Tạo các mục legend mới
      categories.forEach((category, index) => {
        const item = document.createElement('div');
        item.className = 'legend-item';
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.marginBottom = '8px';
        
        const colorBox = document.createElement('span');
        colorBox.className = 'color-box';
        colorBox.style.width = '12px';
        colorBox.style.height = '12px';
        colorBox.style.borderRadius = '2px';
        colorBox.style.marginRight = '8px';
        colorBox.style.backgroundColor = colors[index];
        
        const labelText = document.createElement('span');
        labelText.className = 'label-text';
        labelText.style.fontSize = '12px';
        labelText.style.color = '#4a5568';
        // Chỉ hiển thị số và đơn vị tiền tệ một lần
        labelText.textContent = `${category.name}: ${formatCurrency(category.value)}`;
        
        item.appendChild(colorBox);
        item.appendChild(labelText);
        fragment.appendChild(item);
      });
      
      // Thêm tất cả các mục vào container trong một lần để tối ưu hiệu suất
      legendContainer.appendChild(fragment);
    },
    
    // Xóa tất cả các biểu đồ
    resetCharts() {
      console.log('ChartSystem: Đang xóa tất cả biểu đồ...');
      
      try {
        // Xóa biểu đồ thời gian
        if (this.charts.time) {
          console.log('ChartSystem: Đang xóa biểu đồ thời gian');
          this.charts.time.destroy();
          this.charts.time = null;
          
          // Tạo lại canvas
          const timelineCanvas = document.getElementById('expenses-timeline');
          if (timelineCanvas) {
            const container = timelineCanvas.parentNode;
            if (container) {
              const newCanvas = document.createElement('canvas');
              newCanvas.id = 'expenses-timeline';
              newCanvas.width = timelineCanvas.width;
              newCanvas.height = timelineCanvas.height;
              newCanvas.className = timelineCanvas.className;
              container.replaceChild(newCanvas, timelineCanvas);
            }
          }
        }
        
        // Xóa biểu đồ danh mục
        if (this.charts.category) {
          console.log('ChartSystem: Đang xóa biểu đồ danh mục');
          this.charts.category.destroy();
          this.charts.category = null;
          
          // Tạo lại canvas
          const categoryCanvas = document.getElementById('category-distribution');
          if (categoryCanvas) {
            const container = categoryCanvas.parentNode;
            if (container) {
              const newCanvas = document.createElement('canvas');
              newCanvas.id = 'category-distribution';
              newCanvas.width = categoryCanvas.width;
              newCanvas.height = categoryCanvas.height;
              newCanvas.className = categoryCanvas.className;
              container.replaceChild(newCanvas, categoryCanvas);
            }
          }
        }
        
        // Xóa legend
        const legendContainer = document.getElementById('category-legend');
        if (legendContainer) {
          legendContainer.innerHTML = '';
        }
        
        console.log('ChartSystem: Đã xóa tất cả biểu đồ thành công');
        return true;
      } catch (error) {
        console.error('ChartSystem: Lỗi khi xóa biểu đồ:', error);
        return false;
      }
    }
  };
}

// Định dạng tiền tệ
function formatCurrency(amount) {
  // Định dạng số và thêm đơn vị tiền tệ
  return new Intl.NumberFormat('vi-VN').format(amount || 0) + ' đ';
}

// API công khai
window.renderTimeChart = function(timeData) {
  ChartSystem.renderTimeChart(timeData);
};

window.renderCategoryChart = function(categories) {
  ChartSystem.renderCategoryChart(categories);
};

// Thêm API công khai để reset biểu đồ
window.resetCharts = function() {
  return ChartSystem.resetCharts();
};

// Khởi tạo hệ thống biểu đồ
ChartSystem.init(); 