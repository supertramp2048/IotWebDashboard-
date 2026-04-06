# 🔧 Backend API Specification - Security Fixes Required

## Overview
Frontend đã được update để tương thích với các security best practices. Backend cần implement các API endpoints mới để hỗ trợ.

---

## 📡 Required Backend Endpoints

### 1. GET /api/user/devices
**Purpose:** Trả về danh sách device mà user được phép truy cập  
**Authentication:** Required (JWT token)  
**Rate Limit:** 100 requests/minute

#### Request
```
GET /api/user/devices
Headers: 
  - X-Authorization: Bearer {jwt_token}
  - Content-Type: application/json
```

#### Response (200 OK)
```json
{
  "devices": [
    "device-id-1",
    "device-id-2"
  ],
  "deviceId": "device-id-1",
  "apiUrl": "https://demo.thingsboard.io",
  "allowedMethods": [
    "setWindow",
    "setGarage",
    "setCurtain",
    "setDoor",
    "setLed1",
    "setLed2",
    "setLed3",
    "setLed4"
  ],
  "csrfToken": "csrf-token-here"
}
```

#### Response (401 Unauthorized)
```json
{
  "error": "Invalid or expired token"
}
```

#### Response (403 Forbidden)
```json
{
  "error": "No devices assigned to this user"
}
```

---

### 2. POST /api/auth/login
**Purpose:** Xác thực user và trả về token  
**Rate Limit:** 5 attempts per minute per IP  
**Lock-out:** 15 minutes after 5 failed attempts

#### Request
```json
POST /api/auth/login
{
  "username": "user@example.com",
  "password": "password123"
}
```

#### Response (200 OK)
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "refresh-token-here",
  "expiresIn": 900,
  "csrfToken": "csrf-token-here"
}
```

**Headers:**
```
Set-Cookie: tb_token=...; HttpOnly; Secure; SameSite=Strict; Max-Age=900
```

#### Response (401 Unauthorized)
```json
{
  "error": "Invalid username or password"
}
```

#### Response (429 Too Many Requests)
```json
{
  "error": "Too many login attempts. Try again after 15 minutes."
}
```

---

### 3. POST /api/auth/refresh
**Purpose:** Làm mới access token bằng refresh token  
**Authentication:** Refresh token (via HttpOnly Cookie)

#### Request
```
POST /api/auth/refresh
Headers:
  - Cookie: tb_token=...; refresh_token=...
```

#### Response (200 OK)
```json
{
  "token": "new-access-token...",
  "expiresIn": 900
}
```

#### Response (401 Unauthorized)
```json
{
  "error": "Invalid or expired refresh token"
}
```

---

## 🔐 WebSocket Configuration

### Current Implementation
- Server: `wss://demo.thingsboard.io/api/ws/plugins/telemetry`
- Token: Sent via message body (AUTH message)

### Required WebSocket Support

#### 1. AUTH Message (Frontend → Backend)
```json
{
  "type": "AUTH",
  "token": "jwt-token-here"
}
```

#### 2. AUTH Response (Backend → Frontend)
```json
{
  "type": "AUTH_RESPONSE",
  "success": true,
  "error": null
}
```

#### 3. PING Message (Frontend → Backend)
```json
{
  "type": "PING"
}
```

#### 4. PONG Response (Backend → Frontend)
```json
{
  "type": "PONG"
}
```

---

## 🛡️ Security Requirements

### 1. Rate Limiting
```
Endpoint: /api/auth/login
- Max 5 attempts per minute per IP
- Lockout 15 minutes after 5 failures
- Return 429 status code

Endpoint: /api/plugins/rpc/oneway/{deviceId}
- Max 10 RPC calls per minute per user
- Return 429 status code

General API:
- Max 100 requests per minute per IP
- Return 429 status code
```

### 2. RPC Method Validation
```javascript
// Server-side whitelist (duplicate frontend validation)
ALLOWED_RPC_METHODS = [
  'setWindow',
  'setGarage',
  'setCurtain',
  'setDoor',
  'setLed1',
  'setLed2',
  'setLed3',
  'setLed4'
]

// Validate before executing
if (!ALLOWED_RPC_METHODS.includes(method)) {
  return 403 { error: 'Method not allowed' }
}
```

### 3. Device Authorization
```javascript
// Check user has access to device before RPC execution
const userDevices = getUserDevices(userId)
if (!userDevices.includes(deviceId)) {
  return 403 { error: 'Access denied' }
}
```

### 4. Audit Logging
```javascript
// Log all RPC commands
{
  timestamp: "2026-04-04T10:30:00Z",
  userId: "user-123",
  deviceId: "device-xyz",
  method: "setWindow",
  params: [true],
  status: "success"
}

// Log all failed RPC attempts
{
  timestamp: "2026-04-04T10:30:00Z",
  userId: "user-123",
  deviceId: "device-xyz",
  method: "rebootDevice",
  error: "Method not allowed",
  status: "rejected"
}
```

### 5. CORS Configuration
```
Access-Control-Allow-Origin: https://yourdomain.com
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, X-Authorization, X-CSRF-Token
Access-Control-Max-Age: 86400
```

### 6. Security Headers
```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'self'; connect-src 'self' wss://demo.thingsboard.io
Referrer-Policy: strict-origin-when-cross-origin
```

### 7. Input Validation
```javascript
// Login endpoint
- username: String, max 255 chars, email format
- password: String, max 255 chars

// Device authorization
- deviceId: UUID format
- userId: UUID format

// RPC payload
- method: String, max 100 chars, alphanumeric + underscore
- params: Array, max 10 items, each item max 1000 chars
```

---

## 📊 Response Status Codes

| Status | Use Case |
|--------|----------|
| 200 | Success |
| 400 | Bad Request (invalid input) |
| 401 | Unauthorized (invalid token) |
| 403 | Forbidden (no permission) |
| 429 | Rate Limit Exceeded |
| 500 | Internal Server Error |

---

## 🔄 Implementation Priority

### Phase 1 (Critical)
- [ ] Implement `/api/user/devices` endpoint
- [ ] Add RPC method whitelist validation
- [ ] Add device authorization check before RPC

### Phase 2 (Important)
- [ ] Implement rate limiting (5/minute login, 10/minute RPC)
- [ ] Add CSRF token support
- [ ] Implement audit logging

### Phase 3 (Recommended)
- [ ] Update WebSocket to support AUTH message
- [ ] Implement HttpOnly Cookie support
- [ ] Add security headers

### Phase 4 (Future)
- [ ] Implement `/api/auth/refresh` endpoint
- [ ] Add device activity monitoring
- [ ] Advanced threat detection

---

## 📋 Testing Checklist

After implementing backend changes:

- [ ] Test `/api/user/devices` returns correct device list
- [ ] Test RPC method validation (accept allowed, reject others)
- [ ] Test device authorization (reject if user has no access)
- [ ] Test rate limiting (block after threshold)
- [ ] Test CORS headers are correct
- [ ] Test audit logs are created for all RPC commands
- [ ] Test error messages don't leak sensitive info
- [ ] Test token expiration and refresh
- [ ] Test WebSocket AUTH message handling
- [ ] Load test (simulate 100+ concurrent users)

---

## 🚀 Deployment Checklist

Before going to production:

- [ ] All rate limits configured
- [ ] Audit logging enabled and monitored
- [ ] Security headers configured
- [ ] HTTPS/WSS only (no HTTP/WS)
- [ ] CORS whitelist updated
- [ ] RPC method whitelist reviewed
- [ ] Error messages sanitized
- [ ] Log rotation configured
- [ ] Database backups scheduled
- [ ] Incident response plan ready

---

## 📞 Questions & Issues

If you have questions about these requirements:

1. Review the SECURITY_FIXES.md file for context
2. Check the updated api.js for frontend implementation
3. Review OWASP Top 10 best practices
4. Test with the provided security test cases

---

**Last Updated:** 2026-04-04  
**Prepared for:** Backend Team  
**Next Step:** Phase 1 Implementation
