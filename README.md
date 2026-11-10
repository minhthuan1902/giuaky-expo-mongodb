# BÀI GIỮA KỲ - QUẢN LÝ NGƯỜI DÙNG (EXPO + MONGODB)

**Đúng đề thi 11/2026:** React Native (Expo) chạy Web và iPhone; Node.js + Express API; MongoDB.

**Database:** `giuaky_users` / collection `users` có đúng bốn trường dữ liệu do đề yêu cầu: `email`, `matkhau`, `hoten`, `hinhanh`. MongoDB tự tạo `_id`. Không thêm `role`, `phone`, `createdAt`, `__v`. Mật khẩu được băm bcrypt; hình ảnh được lưu ngay trong trường `hinhanh` dưới dạng data URI base64 để file JSON xuất ra chứa cả ảnh.

## Chuẩn bị trên Windows 11
- Node.js **22.13+** và npm; kiểm tra: `node -v`, `npm -v`.
- MongoDB local (MongoDB Community Server đang chạy) **hoặc** MongoDB Atlas. Compass chỉ là công cụ quan sát CSDL, không thay thế database server.
- iPhone cài **Expo Go** phiên bản tương thích Expo SDK 58 (nếu Expo Go trên App Store chưa tương thích, vẫn demo bản Web bằng Safari).
- VS Code, Chrome; laptop và iPhone chung Wi-Fi để demo với API cục bộ.

## BƯỚC 1 - Chạy API (terminal PowerShell thứ nhất)

```powershell
cd backend
npm install
Copy-Item .env.example .env
notepad .env
npm start
```

Sửa `backend/.env`:
- Nếu MongoDB Community Server chạy trên máy: giữ `MONGO_URI=mongodb://127.0.0.1:27017/giuaky_users`.
- Nếu MongoDB Atlas: dán chuỗi `mongodb+srv://.../giuaky_users?...` từ nút **Connect > Drivers** trên Atlas; tạo Database User và cho phép địa chỉ IP của laptop trong Network Access. **Không chia sẻ URI/password trong báo cáo hay GitHub**.
- Thay `JWT_SECRET` bằng một chuỗi bí mật dài từ 32 ký tự, không giữ giá trị mẫu.

Nếu thành công, terminal hiển thị đường dẫn API. Kiểm tra trên Chrome:

`http://localhost:3000/api/health`

Kết quả mong đợi: `{ "ok": true, "database": true }`.

## BƯỚC 2 - Cấu hình IP laptop (PowerShell)

```powershell
ipconfig
```

Tìm **IPv4 Address** của card Wi-Fi, ví dụ `192.168.1.10` (chỉ là ví dụ). Điền IP thật của bạn vào `app/.env`:

```powershell
cd ../app
Copy-Item .env.example .env
notepad .env
```

Ví dụ nội dung `app/.env`:

```dotenv
EXPO_PUBLIC_API_URL=http://192.168.1.10:3000
```

Trên iPhone dùng IP Wi-Fi này; **không dùng `localhost`**. Nếu Windows Firewall hỏi, cho phép Node.js trong mạng Private. Không mở máy chủ này trực tiếp ra Internet.

## BƯỚC 3 - Cài app và chạy Web

Trong terminal PowerShell thứ hai, khi đã ở `app/`:

```powershell
npm install
npx expo install --fix
npx expo start --web --host lan
```

Mở URL Expo hiển thị trong terminal bằng Chrome laptop; thường cổng 8081. Nếu bạn thay đổi `.env`, **dừng Expo và chạy lại**.

## BƯỚC 4 - Chạy trên iPhone

Ở terminal Expo, nhấn `Ctrl + C`, sau đó:

```powershell
npx expo start --lan
```

- Mở **Expo Go** trên iPhone, quét QR do Expo cung cấp.
- Nếu không tương thích phiên bản Expo Go: mở bản Flutter/React Native **Web** (Expo web) từ Safari qua địa chỉ `http://IP-LAPTOP:8081` nếu cổng Expo là 8081. Cách này chạy CRUD trên iPhone nhưng **không phải app iOS native**, nên cần xác nhận thầy có chấp nhận demo Safari cho mục 0,5 điểm di động hay không.
- Nếu iPhone không mở được API, thử Safari: `http://IP-LAPTOP:3000/api/health`, kiểm tra cùng Wi-Fi, router không bật client isolation, firewall và backend đang chạy.

## BƯỚC 5 - Demo theo đúng các yêu cầu

1. Khi MongoDB chưa có dữ liệu, app sẽ hiển thị **Tạo tài khoản đầu tiên**; nhập họ tên, email và mật khẩu (ít nhất 6 ký tự), có thể chọn ảnh.
2. Đăng nhập và xem **danh sách người dùng**. Có tìm kiếm theo họ tên/email.
3. Nhấn **+ Thêm người dùng**; nhập `hoten`, `email`, `matkhau`, chọn `hinhanh`; lưu và xem danh sách.
4. Nhấn **Sửa**, thay đổi tên, email, ảnh hoặc mật khẩu; bấm **Lưu thay đổi**.
5. Nhấn **Xóa**, xác nhận; xem danh sách cập nhật.
6. **Đăng xuất** và **đăng nhập lại** bằng email/mật khẩu đã tạo.
7. Mở app trên iPhone (Expo Go) để chọn ảnh và xem thông tin.
8. Mở MongoDB Compass để chụp collection và bốn trường dữ liệu cho báo cáo Word.

**Ghi chú:** Mỗi tài khoản trong CSDL đều có thể đăng nhập vào phân hệ quản lý; đề yêu cầu chỉ bốn trường nên ứng dụng không tự thêm trường `role` để phân quyền.

## BƯỚC 6 - Nộp file Database bắt buộc

Trong **MongoDB Compass**: kết nối DB -> `giuaky_users` -> `users` -> **Export Data** -> JSON (đặt tên `users.json`).

Hoặc dùng MongoDB Database Tools (nếu đã cài `mongoexport`):

```powershell
mongoexport --uri="mongodb://127.0.0.1:27017/giuaky_users" --collection=users --out=users.json --jsonArray
```

Nếu đang dùng Atlas, thay URI tương ứng bằng URI Atlas của bạn (không chụp màn hình có mật khẩu).

**Chú ý:** JSON export chứa **hash mật khẩu** và ảnh base64; không tải file chứa dữ liệu thật/nhạy cảm lên GitHub công khai. Chỉ dùng dữ liệu giả cho bài thi.

## BƯỚC 7 - Báo cáo & hồ sơ nộp thầy

- Tạo báo cáo Word chụp các bước: cài npm, `backend/.env` đã **che bí mật**, chạy server, chạy app Web, tạo admin, Thêm/Hiển thị/Sửa/Xóa/Đăng nhập, chọn ảnh và demo iPhone, ảnh collection MongoDB Compass.
- Chèn link GitHub source code (**KHÔNG commit .env**), link video demo, file `users.json` xuất từ MongoDB.
- Mã nguồn trong ZIP này chỉ được tạo để làm bài mới, không phải kết quả chạy/kiểm thử thực tế trên máy của bạn; hãy tự chạy và chụp bằng máy của bạn trước khi nộp.

## Sơ đồ

```text
React Native / Expo (Chrome Web, Expo Go iPhone)
                    |
                    v
Node.js + Express REST API (http://IP-LAPTOP:3000)
                    |
                    v
MongoDB local hoặc Atlas (giuaky_users.users)
```

## Lỗi thường gặp
- `ECONNREFUSED 27017`: MongoDB local chưa chạy. Dùng Atlas hoặc khởi động MongoDB Server.
- `MongoServerError authentication failed`: sai tài khoản/mật khẩu trong connection string Atlas.
- `Khong ket noi duoc API`: kiểm tra IP laptop trong `app/.env`, Windows Firewall, backend, cùng mạng.
- `Project is incompatible with this version of Expo Go`: cập nhật Expo Go/đúng SDK, hoặc demo Web trên Safari và xác nhận điều kiện điểm di động với thầy.
- `Unable to resolve module`: chạy `npm install` rồi `npx expo install --fix` trong `app`.
- Ảnh quá lớn: chọn ảnh nhỏ hơn; ứng dụng nén mức 0.35, ảnh phải dưới ~3 MB sau mã hóa.
