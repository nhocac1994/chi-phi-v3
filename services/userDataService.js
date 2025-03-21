// services/userDataService.js
const { supabase } = require('../config/supabase');
const cache = require('../utils/cache');

class UserDataService {
  constructor(userId) {
    this.userId = userId;
    this.cacheKeyPrefix = `user:${userId}`;
  }

  // Lấy dữ liệu static (ít thay đổi)
  async getStaticData() {
    const cacheKey = `${this.cacheKeyPrefix}:static`;
    
    // Kiểm tra cache
    let data = await cache.get(cacheKey);
    
    // Nếu không có trong cache, truy vấn dữ liệu mới
    if (!data) {
      console.log(`[UserDataService] Tải dữ liệu static cho user ${this.userId}`);
      
      const [profileData, categoriesData, settingsData] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('user_id', this.userId)
          .single(),
        supabase
          .from('categories')
          .select('*')
          .eq('user_id', this.userId),
        supabase
          .from('settings')
          .select('*')
          .eq('user_id', this.userId)
          .single()
      ]);

      data = {
        profile: profileData.data,
        categories: categoriesData.data || [],
        settings: settingsData.data
      };
      
      // Lưu vào cache trong 1 giờ
      await cache.set(cacheKey, data, 3600);
    }
    
    return data;
  }

  // Lấy dữ liệu dynamic (hay thay đổi)
  async getDynamicData(type, options = {}) {
    const { limit = 20, page = 1, filters = {} } = options;
    const offset = (page - 1) * limit;

    switch (type) {
      case 'expenses':
        console.log(`[UserDataService] Tải expenses cho user ${this.userId}`);
        const { data: expenses } = await supabase
          .from('expenses')
          .select('*, categories(*)')
          .eq('user_id', this.userId)
          .order('date', { ascending: false })
          .range(offset, offset + limit - 1);
        return expenses || [];

      case 'reports':
        // Cache báo cáo ngắn hạn (1 giờ)
        const cacheKey = `${this.cacheKeyPrefix}:reports:${JSON.stringify(filters)}`;
        
        // Kiểm tra cache
        let data = await cache.get(cacheKey);
        
        // Nếu không có trong cache, truy vấn dữ liệu mới
        if (!data) {
          console.log(`[UserDataService] Tải reports cho user ${this.userId}`);
          
          const { data: reportsData } = await supabase
            .from('reports')
            .select('*')
            .eq('user_id', this.userId)
            .match(filters);
            
          data = reportsData || [];
          
          // Lưu vào cache trong 1 giờ
          await cache.set(cacheKey, data, 3600);
        }
        
        return data;

      default:
        return [];
    }
  }

  // Cập nhật dữ liệu static
  async updateStaticData(type, data) {
    const cacheKey = `${this.cacheKeyPrefix}:static`;
    const staticData = await cache.get(cacheKey);
    
    if (staticData) {
      staticData[type] = data;
      await cache.set(cacheKey, staticData, 3600);
    }
  }

  // Xóa cache
  async clearCache() {
    console.log(`[UserDataService] Xóa cache cho user ${this.userId}`);
    await cache.delPattern(`${this.cacheKeyPrefix}:`);
  }
}

module.exports = UserDataService;