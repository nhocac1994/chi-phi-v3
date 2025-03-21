# Ứng dụng Quản lý Chi phí

Ứng dụng quản lý chi phí cho phép người dùng theo dõi, phân loại và quản lý các chi phí cá nhân.

## Thiết lập Supabase

### Bước 1: Tạo tài khoản và dự án Supabase
1. Đăng ký tài khoản tại [Supabase](https://supabase.io)
2. Tạo dự án mới và lưu lại thông tin kết nối (URL và Anon key)

### Bước 2: Thiết lập cấu trúc cơ sở dữ liệu
1. Đăng nhập vào Supabase Dashboard
2. Chọn dự án của bạn
3. Vào mục "SQL Editor"
4. Tạo một query mới với nội dung từ file `supabase-setup.sql` đính kèm trong dự án
5. Chạy query để tạo các bảng và chính sách bảo mật

### Bước 3: Bật tính năng xác thực
1. Trong Supabase Dashboard, vào mục "Authentication" > "Providers"
2. Bật "Email" provider
3. Cấu hình các tùy chọn như "Confirm email" (tùy chọn)

### Cấu trúc cơ sở dữ liệu

#### Bảng auth.users (tự động tạo bởi Supabase)
- Lưu thông tin xác thực người dùng

#### Bảng profiles
- Lưu thông tin hồ sơ người dùng
- Liên kết với auth.users qua id

#### Bảng parent_expenses
- Lưu thông tin chi phí chính
- Có trường user_id để liên kết với người dùng

#### Bảng child_expenses
- Lưu thông tin chi tiết chi phí
- Liên kết với parent_expenses qua parent_id

## Luồng dữ liệu
1. Người dùng đăng nhập/đăng ký
2. Khi đăng nhập thành công, hệ thống tự động lấy các chi phí của người dùng đó dựa vào user_id
3. Parent_expenses chứa thông tin tổng quan về chi phí
4. Child_expenses chứa chi tiết của từng chi phí

## Chính sách bảo mật
- Mỗi người dùng chỉ có thể xem và chỉnh sửa dữ liệu của chính mình
- Các chính sách Row Level Security (RLS) đã được cấu hình để đảm bảo điều này

## Cài đặt và chạy ứng dụng

```bash
# Cài đặt dependencies
npm install

# Chạy ứng dụng ở môi trường phát triển
npm run dev
```

## Môi trường
Tạo file `.env` ở thư mục gốc với nội dung:

```
PORT=3000
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key
```

Thay thế `your-supabase-url` và `your-supabase-anon-key` bằng thông tin từ dự án Supabase của bạn. 