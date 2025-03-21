// utils/cache.js

/**
 * Cache đơn giản dùng memory
 */
class MemoryCache {
  constructor() {
    this.cache = {};
    this.debug = process.env.DEBUG_CACHE === 'true';
    
    if (this.debug) {
      console.log('[Cache] Khởi tạo Memory Cache');
    }
  }

  /**
   * Lấy giá trị từ cache
   * @param {string} key - Key để lấy giá trị
   * @returns {Promise<any>} - Giá trị từ cache hoặc null nếu không tìm thấy
   */
  async get(key) {
    if (!key) return null;
    
    try {
      const item = this.cache[key];
      
      // Nếu không tìm thấy
      if (!item) {
        if (this.debug) console.log(`[Cache] MISS: ${key}`);
        return null;
      }
      
      // Nếu đã hết hạn
      if (item.expiry && item.expiry < Date.now()) {
        if (this.debug) console.log(`[Cache] EXPIRED: ${key}`);
        delete this.cache[key];
        return null;
      }
      
      if (this.debug) console.log(`[Cache] HIT: ${key}`);
      return item.value;
    } catch (error) {
      console.error(`[Cache] Lỗi khi lấy ${key}:`, error.message);
      return null;
    }
  }

  /**
   * Lưu giá trị vào cache
   * @param {string} key - Key để lưu giá trị
   * @param {any} value - Giá trị cần lưu
   * @param {number} ttlSeconds - Thời gian sống (giây)
   * @returns {Promise<boolean>} - true nếu thành công
   */
  async set(key, value, ttlSeconds = 300) {
    if (!key) return false;
    
    try {
      const expiry = ttlSeconds ? Date.now() + (ttlSeconds * 1000) : null;
      
      this.cache[key] = {
        value,
        expiry
      };
      
      if (this.debug) {
        console.log(`[Cache] SET: ${key} (TTL: ${ttlSeconds}s)`);
      }
      
      return true;
    } catch (error) {
      console.error(`[Cache] Lỗi khi lưu ${key}:`, error.message);
      return false;
    }
  }

  /**
   * Xóa giá trị khỏi cache
   * @param {string} key - Key cần xóa
   * @returns {Promise<boolean>} - true nếu thành công
   */
  async del(key) {
    if (!key) return false;
    
    try {
      delete this.cache[key];
      
      if (this.debug) {
        console.log(`[Cache] DEL: ${key}`);
      }
      
      return true;
    } catch (error) {
      console.error(`[Cache] Lỗi khi xóa ${key}:`, error.message);
      return false;
    }
  }

  /**
   * Xóa toàn bộ cache với pattern
   * @param {string} pattern - Pattern để tìm các key cần xóa
   * @returns {Promise<number>} - Số lượng key đã xóa
   */
  async delPattern(pattern) {
    if (!pattern) return 0;
    
    try {
      const regex = new RegExp(pattern);
      let count = 0;
      
      Object.keys(this.cache).forEach(key => {
        if (regex.test(key)) {
          delete this.cache[key];
          count++;
        }
      });
      
      if (this.debug && count > 0) {
        console.log(`[Cache] DEL PATTERN: ${pattern} (${count} keys)`);
      }
      
      return count;
    } catch (error) {
      console.error(`[Cache] Lỗi khi xóa theo pattern ${pattern}:`, error.message);
      return 0;
    }
  }

  /**
   * Xóa hết cache
   * @returns {Promise<boolean>} - true nếu thành công
   */
  async flush() {
    try {
      this.cache = {};
      
      if (this.debug) {
        console.log('[Cache] FLUSH: Đã xóa toàn bộ cache');
      }
      
      return true;
    } catch (error) {
      console.error('[Cache] Lỗi khi xóa toàn bộ cache:', error.message);
      return false;
    }
  }
}

// Tạo instance cache toàn cục
const cacheInstance = new MemoryCache();

module.exports = cacheInstance;