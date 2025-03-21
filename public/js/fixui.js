/**
 * File để sửa lỗi giao diện người dùng
 */

// Sửa lỗi lightbox
(function() {
  // Định nghĩa hàm tạo lightbox đúng
  window.createCorrectLightbox = function(imgSrc, allImages = []) {
    console.log('FixUI: Tạo lightbox đúng cấu trúc');
    
    // Xóa mọi lightbox cũ
    document.querySelectorAll('.expense-lightbox').forEach(box => {
      if (document.body.contains(box)) {
        document.body.removeChild(box);
      }
    });
    
    if (!allImages.length && imgSrc) {
      allImages = [imgSrc];
    }
    
    // Tìm vị trí của ảnh hiện tại trong mảng
    const currentIndex = allImages.findIndex(src => src === imgSrc) || 0;
    
    // Tạo lightbox mới với cấu trúc đúng
    const lightbox = document.createElement('div');
    lightbox.className = 'expense-lightbox';
    lightbox.style.position = 'fixed';
    lightbox.style.top = '0';
    lightbox.style.left = '0';
    lightbox.style.width = '100%';
    lightbox.style.height = '100%';
    lightbox.style.backgroundColor = 'rgba(0, 0, 0, 0.65)';
    lightbox.style.display = 'flex';
    lightbox.style.justifyContent = 'center';
    lightbox.style.alignItems = 'center';
    lightbox.style.zIndex = '9999';
    lightbox.style.opacity = '0';
    lightbox.style.transition = 'opacity 0.3s ease';
    
    // HTML bên trong lightbox - CẢI THIỆN NÚT ĐIỀU HƯỚNG
    lightbox.innerHTML = `
      <div class="expense-lightbox-close" style="position: absolute; top: 15px; right: 20px; color: white; font-size: 30px; cursor: pointer; background-color: rgba(0,0,0,0.6); width: 50px; height: 50px; border-radius: 50%; display: flex; justify-content: center; align-items: center; z-index: 10002;">
        <i class="bi bi-x-lg"></i>
      </div>
      <div class="expense-lightbox-container" style="position: relative; max-width: 90%; max-height: 90%; display: flex; justify-content: center; align-items: center;">
        <img class="expense-lightbox-image" src="${imgSrc}" alt="Ảnh chi tiết" style="max-width: 100%; max-height: 90vh; object-fit: contain; border-radius: 5px; user-select: none; -webkit-user-drag: none;">
        
        <!-- CẢI THIỆN NAVIGATION: THÊM CLASS VÀ STYLE RÕ RÀN -->
        <div class="expense-lightbox-navigation" style="position: absolute; width: 100%; display: flex; justify-content: space-between; align-items: center; top: 50%; transform: translateY(-50%); pointer-events: none; z-index: 10001;">
          <button class="expense-lightbox-prev" style="pointer-events: auto; width: 60px; height: 60px; background-color: rgba(0, 0, 0, 0.8); border: 2px solid rgba(255, 255, 255, 0.5); border-radius: 50%; display: flex; justify-content: center; align-items: center; cursor: pointer; margin-left: 15px; transition: all 0.3s ease; outline: none; box-shadow: 0 0 15px rgba(0,0,0,0.5);">
            <i class="bi bi-chevron-left" style="font-size: 28px; color: white;"></i>
          </button>
          <button class="expense-lightbox-next" style="pointer-events: auto; width: 60px; height: 60px; background-color: rgba(0, 0, 0, 0.8); border: 2px solid rgba(255, 255, 255, 0.5); border-radius: 50%; display: flex; justify-content: center; align-items: center; cursor: pointer; margin-right: 15px; transition: all 0.3s ease; outline: none; box-shadow: 0 0 15px rgba(0,0,0,0.5);">
            <i class="bi bi-chevron-right" style="font-size: 28px; color: white;"></i>
          </button>
        </div>
      </div>
      
      <!-- THÊM SWIPE INDICATOR -->
      <div class="expense-swipe-indicator" style="position: absolute; bottom: 60px; left: 50%; transform: translateX(-50%); color: white; background-color: rgba(0,0,0,0.6); padding: 8px 16px; border-radius: 30px; display: none;">
        <i class="bi bi-arrow-left-right" style="margin-right: 8px;"></i>
        <span>Vuốt để chuyển ảnh</span>
      </div>
      
      <div class="expense-lightbox-counter" style="position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); color: white; font-size: 16px; background-color: rgba(0,0,0,0.6); padding: 8px 16px; border-radius: 30px;">${currentIndex + 1} / ${allImages.length}</div>
    `;
    
    // Thêm lightbox vào body
    document.body.appendChild(lightbox);
    
    // Hiển thị lightbox với animation
    setTimeout(() => {
      lightbox.style.opacity = '1';
      lightbox.classList.add('show');
      
      // Hiển thị swipe indicator trên thiết bị di động
      if (isMobileDevice() && allImages.length > 1) {
        const swipeIndicator = lightbox.querySelector('.expense-swipe-indicator');
        swipeIndicator.style.display = 'flex';
        swipeIndicator.style.alignItems = 'center';
        
        // Ẩn swipe indicator sau 3 giây
        setTimeout(() => {
          swipeIndicator.style.opacity = '0';
          setTimeout(() => {
            swipeIndicator.style.display = 'none';
          }, 300);
        }, 3000);
      }
    }, 10);
    
    // Thêm event listeners
    const closeBtn = lightbox.querySelector('.expense-lightbox-close');
    const prevBtn = lightbox.querySelector('.expense-lightbox-prev');
    const nextBtn = lightbox.querySelector('.expense-lightbox-next');
    const image = lightbox.querySelector('.expense-lightbox-image');
    const counter = lightbox.querySelector('.expense-lightbox-counter');
    
    // Thêm hover effect cho các nút (CẢI THIỆN)
    prevBtn.addEventListener('mouseover', () => {
      prevBtn.style.backgroundColor = 'rgba(13, 110, 253, 0.8)';
      prevBtn.style.borderColor = 'white';
      prevBtn.style.transform = 'translateX(5px) scale(1.1)';
    });
    prevBtn.addEventListener('mouseout', () => {
      prevBtn.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
      prevBtn.style.borderColor = 'rgba(255, 255, 255, 0.5)';
      prevBtn.style.transform = 'translateX(0) scale(1)';
    });
    nextBtn.addEventListener('mouseover', () => {
      nextBtn.style.backgroundColor = 'rgba(13, 110, 253, 0.8)';
      nextBtn.style.borderColor = 'white';
      nextBtn.style.transform = 'translateX(-5px) scale(1.1)';
    });
    nextBtn.addEventListener('mouseout', () => {
      nextBtn.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
      nextBtn.style.borderColor = 'rgba(255, 255, 255, 0.5)';
      nextBtn.style.transform = 'translateX(0) scale(1)';
    });
    closeBtn.addEventListener('mouseover', () => {
      closeBtn.style.backgroundColor = 'rgba(220, 53, 69, 0.8)';
    });
    closeBtn.addEventListener('mouseout', () => {
      closeBtn.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
    });
    
    // Đóng lightbox
    function closeLightbox() {
      lightbox.style.opacity = '0';
      setTimeout(() => {
        if (document.body.contains(lightbox)) {
          document.body.removeChild(lightbox);
        }
      }, 300);
    }
    
    closeBtn.addEventListener('click', closeLightbox);
    
    // Di chuyển giữa các ảnh (CẢI THIỆN)
    function showImage(index) {
      if (index < 0) index = allImages.length - 1;
      if (index >= allImages.length) index = 0;
      
      // Hiệu ứng fade
      image.style.opacity = '0';
      image.style.transform = 'scale(0.95)';
      
      setTimeout(() => {
        image.src = allImages[index];
        counter.textContent = `${index + 1} / ${allImages.length}`;
        
        // Hiệu ứng fade in
        setTimeout(() => {
          image.style.opacity = '1';
          image.style.transform = 'scale(1)';
        }, 50);
      }, 200);
    }
    
    // Thêm style transition cho ảnh
    image.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
    image.style.opacity = '1';
    
    if (allImages.length > 1) {
      prevBtn.addEventListener('click', () => {
        const currentIndex = allImages.indexOf(image.src);
        showImage(currentIndex - 1);
      });
      
      nextBtn.addEventListener('click', () => {
        const currentIndex = allImages.indexOf(image.src);
        showImage(currentIndex + 1);
      });
      
      // Keyboard navigation
      document.addEventListener('keydown', function keyNav(e) {
        if (e.key === 'ArrowLeft') {
          const currentIndex = allImages.indexOf(image.src);
          showImage(currentIndex - 1);
        } else if (e.key === 'ArrowRight') {
          const currentIndex = allImages.indexOf(image.src);
          showImage(currentIndex + 1);
        } else if (e.key === 'Escape') {
          closeLightbox();
          document.removeEventListener('keydown', keyNav);
        }
      });
      
      // Làm nổi bật nút prev/next
      prevBtn.style.display = 'flex';
      nextBtn.style.display = 'flex';
    } else {
      // Ẩn nút prev/next nếu chỉ có 1 ảnh
      prevBtn.style.display = 'none';
      nextBtn.style.display = 'none';
    }
    
    // Click vào lightbox để đóng
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) {
        closeLightbox();
      }
    });
    
    // CẢI THIỆN: Vuốt để chuyển ảnh
    let touchStartX = 0;
    let touchEndX = 0;
    let touchStartY = 0;
    let touchEndY = 0;
    let initialTimestamp = 0;
    
    // Thêm sự kiện cho việc kéo và vuốt
    lightbox.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
      touchStartY = e.changedTouches[0].screenY;
      initialTimestamp = e.timeStamp;
    }, { passive: true });
    
    lightbox.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      touchEndY = e.changedTouches[0].screenY;
      const touchDuration = e.timeStamp - initialTimestamp;
      handleSwipe(touchDuration);
    }, { passive: true });
    
    function handleSwipe(duration) {
      // Tính toán khoảng cách vuốt
      const deltaX = touchEndX - touchStartX;
      const deltaY = touchEndY - touchStartY;
      
      // Kiểm tra xem có phải vuốt ngang hay không
      // Là vuốt ngang nếu khoảng cách ngang lớn hơn dọc
      const isHorizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY);
      
      // Tính toán ngưỡng dựa trên kích thước màn hình
      const threshold = Math.min(window.innerWidth * 0.15, 100); // Ngưỡng động
      
      // Tốc độ vuốt
      const speed = Math.abs(deltaX) / duration;
      
      // Chuyển ảnh nếu vuốt ngang với khoảng cách đủ lớn hoặc tốc độ đủ nhanh
      if (isHorizontalSwipe && (Math.abs(deltaX) > threshold || speed > 0.5)) {
        const currentIndex = allImages.indexOf(image.src);
        
        if (deltaX > 0) {
          // Vuốt sang phải -> ảnh trước
          showImage(currentIndex - 1);
          
          // Hiển thị hiệu ứng
          showSwipeEffectIndicator('prev');
        } else {
          // Vuốt sang trái -> ảnh tiếp theo
          showImage(currentIndex + 1);
          
          // Hiển thị hiệu ứng
          showSwipeEffectIndicator('next');
        }
      }
    }
    
    // Hiển thị chỉ báo khi vuốt
    function showSwipeEffectIndicator(direction) {
      // Tạo chỉ báo hiệu ứng
      const indicator = document.createElement('div');
      indicator.className = 'swipe-effect-indicator';
      indicator.style.position = 'absolute';
      indicator.style.top = '50%';
      indicator.style.transform = 'translateY(-50%)';
      indicator.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
      indicator.style.borderRadius = '50%';
      indicator.style.width = '80px';
      indicator.style.height = '80px';
      indicator.style.display = 'flex';
      indicator.style.justifyContent = 'center';
      indicator.style.alignItems = 'center';
      indicator.style.opacity = '0.8';
      indicator.style.transition = 'opacity 0.3s ease';
      
      // Đặt vị trí và nội dung dựa trên hướng
      if (direction === 'prev') {
        indicator.style.left = '20px';
        indicator.innerHTML = '<i class="bi bi-chevron-left" style="font-size: 40px; color: white;"></i>';
      } else {
        indicator.style.right = '20px';
        indicator.innerHTML = '<i class="bi bi-chevron-right" style="font-size: 40px; color: white;"></i>';
      }
      
      // Thêm vào lightbox
      lightbox.appendChild(indicator);
      
      // Xóa sau khi hiệu ứng kết thúc
      setTimeout(() => {
        indicator.style.opacity = '0';
        setTimeout(() => {
          if (lightbox.contains(indicator)) {
            lightbox.removeChild(indicator);
          }
        }, 300);
      }, 500);
    }
    
    // Thêm responsive design
    setLightboxResponsive();
    
    // Làm responsive cho lightbox trên các thiết bị khác nhau
    function setLightboxResponsive() {
      if (window.innerWidth <= 768) {
        // Tablet
        prevBtn.style.width = '50px';
        prevBtn.style.height = '50px';
        nextBtn.style.width = '50px';
        nextBtn.style.height = '50px';
        prevBtn.querySelector('i').style.fontSize = '24px';
        nextBtn.querySelector('i').style.fontSize = '24px';
      }
      
      if (window.innerWidth <= 576) {
        // Điện thoại
        prevBtn.style.width = '45px';
        prevBtn.style.height = '45px';
        nextBtn.style.width = '45px';
        nextBtn.style.height = '45px';
        closeBtn.style.width = '40px';
        closeBtn.style.height = '40px';
        prevBtn.style.marginLeft = '10px';
        nextBtn.style.marginRight = '10px';
        prevBtn.querySelector('i').style.fontSize = '22px';
        nextBtn.querySelector('i').style.fontSize = '22px';
      }
    }
    
    // Trả về lightbox để có thể tham chiếu sau này
    return lightbox;
  };
  
  // Ghi đè hàm showImageLightbox nếu nó đã tồn tại
  const originalShowImageLightbox = window.showImageLightbox;
  window.showImageLightbox = function(imgSrc, allImages = []) {
    console.log('FixUI: Đã ghi đè hàm showImageLightbox');
    return window.createCorrectLightbox(imgSrc, allImages);
  };
  
  // Chạy ngay khi script được tải
  function fixUI() {
    console.log('FixUI: Đang sửa lỗi UI');
    
    // Tạo MutationObserver để theo dõi các thay đổi DOM
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length) {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1 && node.classList && node.classList.contains('expense-lightbox')) {
              // Kiểm tra xem đây có phải là lightbox cũ không
              const hasContainer = node.querySelector('.expense-lightbox-container');
              const hasNavigation = node.querySelector('.expense-lightbox-navigation');
              
              if (!hasContainer || !hasNavigation) {
                console.log('FixUI: Phát hiện lightbox cũ, đang thay thế bằng cấu trúc mới');
                
                // Lấy thông tin ảnh
                const imgElement = node.querySelector('img.expense-lightbox-image');
                if (imgElement && imgElement.src) {
                  const imgSrc = imgElement.src;
                  
                  // Xóa lightbox cũ
                  if (document.body.contains(node)) {
                    document.body.removeChild(node);
                  }
                  
                  // Tạo lightbox mới
                  window.createCorrectLightbox(imgSrc);
                }
              }
            }
          });
        }
      });
    });
    
    // Bắt đầu theo dõi các thay đổi trong DOM
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Ghi đè các sự kiện click
    document.addEventListener('click', function(e) {
      // Tìm hình ảnh được click
      const imgElement = e.target.closest('.expense-card-image img, .expense-detail-image img');
      if (imgElement) {
        console.log('FixUI: Đã chặn click hình ảnh mặc định');
        e.preventDefault();
        e.stopPropagation();
        
        // Lấy tất cả hình ảnh trong container
        const container = imgElement.closest('.expense-card-images, .expense-detail-images');
        const allImages = container ? Array.from(container.querySelectorAll('img')).map(img => img.src) : [imgElement.src];
        
        // Tạo lightbox mới
        window.createCorrectLightbox(imgElement.src, allImages);
        return false;
      }
    }, true);  // Sử dụng capture để chặn các sự kiện trước khi chúng được xử lý
  }
  
  // Chạy khi DOM đã sẵn sàng
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fixUI);
  } else {
    fixUI();
  }
  
  // Thông báo khi tải xong
  window.addEventListener('load', function() {
    console.log('FixUI: Đã tải xong và kích hoạt');
  });
})();

function fixUIForDatalist() { document.querySelectorAll(".expense-dropdown").forEach(el => el.remove()); setupDatalist(); alert("Đã sửa lỗi giao diện!");}

// Hàm kiểm tra thiết bị di động
function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
}
