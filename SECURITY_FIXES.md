# 🔒 Security Fixes Implementation Guide

## 📋 Tóm tắt các sửa lỗi bảo mật

Hệ thống IoT SmartHome đã được cập nhật với 4 fix bảo mật chính:

### 1️⃣ JWT Token Management - ✅ FIXED
**Vấn đề:** Token lưu trong localStorage dễ bị XSS tấn công  
**Giải pháp:** Token giữ trong memory (RAM) thay vì localStorage

**Thay đổi:**
- `api.js`: Biến `accessToken` giữ trong memory, không lưu `localStorage.setItem()`
- `HomeView.vue`: Loại bỏ dependency trên localStorage token

**Backend Requirement:**
- ✅ Server phải support HttpOnly Cookies (optional, for session persistence)
- ✅ Hoặc sử dụng Refresh Token flow với short-lived access tokens

```javascript
// ✅ Frontend hiện tại
let accessToken = null; // Only in memory

// ✅ Backend Config (recommended)
// Response header khi login:
// Set-Cookie: tb_token=...; HttpOnly; Secure; SameSite=Strict
```

---

### 2️⃣ WebSocket Token Exposure - ✅ FIXED
**Vấn đề:** Token trong URL (`?token=xxx`) → lộ qua server logs, browser history  
**Giải pháp:** Gửi token qua message body, không URL

**Thay đổi:**
- `api.js`: Hàm `updateRealtime()` - token gửi qua AUTH message
- WebSocket connection: `wss://demo.thingsboard.io/api/ws/plugins/telemetry` (không có token)
- Heartbeat + Auto-reconnect: Exponential backoff retry

**Backend Requirement:**
- ✅ ThingsBoard phải hỗ trợ AUTH message format:
```javascript
{
  "type": "AUTH",
  "token": "jwt_token_here"
}
```

---

### 3️⃣ Device ID Exposure & IDOR - ✅ FIXED
**Vấn đề:** Device ID hardcoded (`VITE_DEVICE_ID`) → brute force + IDOR attacks  
**Giải pháp:** Fetch device config từ backend, kiểm tra authorization

**Thay đổi:**
- `api.js`: 
  - Thêm hàm `fetchAuthorizedDevices()` - call `/api/user/devices`
  - Hàm `isDeviceAuthorized()` - kiểm tra user có quyền
  - Tất cả API calls kiểm tra authorization trước khi execute
  
- `HomeView.vue`: 
  - `onMounted()` gọi `fetchAuthorizedDevices()` trước
  - Logout nếu fetch devices fail

**Backend Requirement:**
- ✅ API endpoint: `GET /api/user/devices`
  ```json
  {
    "devices": ["device-id-1", "device-id-2"],
    "deviceId": "device-id-1",
    "apiUrl": "https://demo.thingsboard.io",
    "allowedMethods": ["setWindow", "setGarage", "setCurtain", "setLed1", "setLed2", "setLed3", "setLed4"]
  }
  ```

---

### 4️⃣ Arbitrary RPC Execution - ✅ FIXED
**Vấn đề:** Attacker có thể gửi bất kỳ RPC method nào (`rebootDevice`, `resetConfig`, etc.)  
**Giải pháp:** Whitelist các methods được phép + validate params

**Thay đổi:**
- `api.js`:
  - `ALLOWED_RPC_METHODS` - whitelist 8 methods được phép
  - `validateRpcMethod()` - check method + params type + length
  - `sendRpcCommand()` - validate trước khi gửi

- Hàm `sendRpcCommand(method, [params])` bây giờ:
  - ✅ Kiểm tra method có trong whitelist
  - ✅ Validate số lượng parameters
  - ✅ Validate kiểu dữ liệu (boolean, etc.)
  - ✅ Kiểm tra user có quyền access device
  - ✅ Ném error nếu không hợp lệ

**Whitelist RPC Methods:**
```javascript
ALLOWED_RPC_METHODS = {
  'setWindow': { maxParams: 1, validateFn: (p) => typeof p[0] === 'boolean' },
  'setGarage': { maxParams: 1, validateFn: (p) => typeof p[0] === 'boolean' },
  'setCurtain': { maxParams: 1, validateFn: (p) => typeof p[0] === 'boolean' },
  'setDoor': { maxParams: 1, validateFn: (p) => typeof p[0] === 'boolean' },
  'setLed1' to 'setLed4': { maxParams: 1, ... }
}
```

**Backend Requirement:**
- ✅ Server-side validate: Re-check RPC method + user permission
- ✅ Rate limiting: Max 10 RPC calls per minute per user
- ✅ Audit logging: Ghi lại tất cả RPC commands

---

## 📝 Additional Security Improvements

### 5. WebSocket Message Validation
- ✅ Validate subscriptionId
- ✅ Whitelist allowed data keys
- ✅ Check timestamp hợp lệ
- ✅ Sanitize string values (loại bỏ control characters)
- ✅ Max 5 validation errors → disconnect

### 6. Error Handling
- ✅ Production mode: Generic error messages (không lộ stack trace)
- ✅ Development mode: Detailed errors
- ✅ Error reporting: Gửi error logs đến backend

### 7. Content-Type Validation
- ✅ API responses phải có `Content-Type: application/json`
- ✅ Validate response data type

### 8. WebSocket Heartbeat
- ✅ Ping mỗi 30 giây
- ✅ Auto-reconnect với exponential backoff (2^n seconds)
- ✅ Max 5 reconnect attempts
- ✅ Timeout management

---

## 🚀 Implementation Checklist

### Frontend (Vue.js) - ✅ COMPLETED
- [x] Lưu token trong memory thay localStorage
- [x] Fetch device config từ backend
- [x] Whitelist + validate RPC methods
- [x] WebSocket token gửi qua message body
- [x] Message validation & sanitization
- [x] Error handling sanitization
- [x] Heartbeat & auto-reconnect

### Backend (ThingsBoard API) - ⚠️ TODO
- [ ] Endpoint: `GET /api/user/devices` - trả về authorized devices
- [ ] Endpoint: `GET /api/device-config` - trả về device configuration
- [ ] Config: HttpOnly Cookies support (optional)
- [ ] Config: WebSocket AUTH message support
- [ ] Implement: Rate limiting on login (5 attempts/minute)
- [ ] Implement: Rate limiting on RPC (10 calls/minute per user)
- [ ] Implement: Server-side RPC method validation
- [ ] Implement: Audit logging for all RPC commands
- [ ] Config: CORS settings (allow only trusted origins)
- [ ] Config: CSRF token support (optional)

---

## 🔧 How to Test Security Fixes

### Test 1: Token Memory Storage
```javascript
// Open DevTools Console
localStorage.getItem('tb_token') // Should be NULL ✅

// Token chỉ giữ trong memory (không thể access từ console)
```

### Test 2: WebSocket Token
```bash
# Capture network traffic (DevTools > Network)
# WebSocket URL should NOT contain token
wss://demo.thingsboard.io/api/ws/plugins/telemetry ✅
# (Not: ?token=xxx)
```

### Test 3: Device Authorization
```javascript
// Test invalid deviceId
import { sendRpcCommand } from './api/api.js'
sendRpcCommand('setWindow', [true]) // Should throw "not authorized" ❌
```

### Test 4: RPC Method Whitelist
```javascript
import { sendRpcCommand } from './api/api.js'
sendRpcCommand('rebootDevice', []) // Should throw "not allowed" ❌
sendRpcCommand('setWindow', [true]) // Should work ✅
```

### Test 5: Browser History
```
1. Login
2. Open DevTools > Application > Cookies
3. tb_token should NOT be visible (hoặc HttpOnly flag)
4. History should NOT contain ?token=... URLs
```

---

## ⚠️ IMPORTANT: Breaking Changes

The following function signatures have changed:

### OLD → NEW

```javascript
// OLD (Unsafe)
sendRpcCommand(method, params)
sendRpcCommand('setWindow', true)

// NEW (Safe - params must be array)
sendRpcCommand(method, [params])
sendRpcCommand('setWindow', [true])
```

Update all function calls:
```javascript
// HomeView.vue - UPDATED ✅
await sendRpcCommand(`set${key}`, [newState])
await sendRpcCommand(`setLed${index + 1}`, [newState])

// Other components - NEED TO UPDATE
// Example:
// OLD: await sendRpcCommand('setWindow', true)
// NEW: await sendRpcCommand('setWindow', [true])
```

---

## 📚 Backend Implementation Notes

### Option 1: Backend Proxy (Recommended)
```
Frontend → Backend Proxy → ThingsBoard API

Benefits:
- ✅ Backend validates all requests
- ✅ Backend controls RPC methods
- ✅ Backend handles device authorization
- ✅ Frontend không biết thực device ID
```

### Option 2: Direct ThingsBoard (Current)
```
Frontend → ThingsBoard API (Direct)

Issues:
- ⚠️ Must implement all validation on frontend
- ⚠️ Device ID exposed via devtools
- ⚠️ Harder to implement complex authorization rules
```

**Recommendation:** Implement backend proxy for production

---

## 🔍 Security Best Practices

1. **HTTPS Only**
   - All connections must use HTTPS/WSS protocol
   - Clear HSTS header

2. **CORS Configuration**
   ```javascript
   // Allow only trusted origins
   Access-Control-Allow-Origin: https://yourdomain.com
   Access-Control-Allow-Credentials: true
   ```

3. **Rate Limiting**
   - Login: 5 attempts per minute
   - RPC: 10 calls per minute per user
   - API: 100 requests per minute

4. **Audit Logging**
   - Log all RPC commands with user ID, timestamp, device ID
   - Log failed authentication attempts
   - Log unauthorized access attempts

5. **Token Expiration**
   - Access token: 15 minutes TTL
   - Refresh token: 7 days TTL
   - Implement refresh token rotation

6. **CSRF Protection**
   - Generate CSRF token on login
   - Require CSRF token in POST/PUT/DELETE requests
   - SameSite=Strict cookie flag

---

## 📞 Support & Questions

If you encounter issues:

1. Check backend endpoints are implemented
2. Verify Content-Type headers
3. Enable debug logging (PROD mode check)
4. Check WebSocket connection status
5. Review browser DevTools Network tab

---

**Last Updated:** 2026-04-04  
**Security Review:** Level II (Frontend + Data Validation)  
**Next Review:** Implement backend proxy & server-side validation
