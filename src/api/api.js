import axios from 'axios';

// Lấy Device ID từ file .env
const deviceId = import.meta.env.VITE_DEVICE_ID;

// QUAN TRỌNG: Để rỗng chuỗi này. 
// Vì chúng ta dùng Proxy trong vite.config.js, nên request sẽ gửi đến localhost hiện tại.
const API_URL = import.meta.env.VITE_API_URL || 'https://demo.thingsboard.io';
//console.log(" API URL đang dùng là:", API_URL); // Bật Console (F12) để xem nó in ra cái gì
// 1. Tạo instance Axios
const API = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});

let accessToken = null;
let refreshToken = null;

// 2. Request Interceptor
API.interceptors.request.use(config => {
    const token = accessToken || localStorage.getItem('tb_token');
    if (token) {
        config.headers['X-Authorization'] = `Bearer ${token}`;
    }
    return config;
}, error => {
    return Promise.reject(error);
});

// 3. Response Interceptor
API.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            console.warn(" Token hết hạn. Đang đăng xuất...");
            logout();
            // window.location.reload(); // Bỏ comment nếu muốn tải lại trang
        }
        return Promise.reject(error);
    }
);

// 4. Hàm Login
export async function login(username, password) {
    try {
        // Đường dẫn này khớp với Proxy: /api -> https://demo.thingsboard.io/api
        const res = await API.post('/api/auth/login', { username, password });
        
        accessToken = res.data.token; 
        refreshToken = res.data.refreshToken;
        
        localStorage.setItem('tb_token', accessToken);
        localStorage.setItem('tb_refreshToken', refreshToken);

        return accessToken;
    } catch (error) {
        throw error;
    }
}

// 5. Hàm Logout
export function logout() {
    accessToken = null;
    refreshToken = null;
    localStorage.removeItem('tb_token');
    localStorage.removeItem('tb_refreshToken');
}

// 6. Gửi lệnh điều khiển (RPC OneWay)
export async function sendRpcCommand(method, params) {
    if (!deviceId) return console.error("Thiếu Device ID");
    
    // SỬA: Đường dẫn chuẩn của ThingsBoard là /plugins/rpc/oneway
    return API.post(`/api/plugins/rpc/oneway/${deviceId}`, {
        method: method,
        params: params
    });
}

// 7. Lấy trạng thái thiết bị (Attributes)
export async function getAttributes() {
    if (!deviceId) return console.error("Thiếu Device ID");

    // SỬA: Bỏ chữ "/DEVICE" thừa trong URL cũ
    // SỬA: Thêm CLIENT_SCOPE hoặc SERVER_SCOPE nếu cần, mặc định lấy tất cả
    return API.get(
        `/api/plugins/telemetry/${deviceId}/values/attributes?keys=curtain,window,garage,led1,led2,led3,led4`
    );
}

// BỔ SUNG: Hàm lấy dữ liệu cảm biến mới nhất (Telemetry)

export async function getDeviceAttributes(keys) {
    if (!deviceId) return console.error("Thiếu Device ID");
    
    // Nếu có truyền keys (ví dụ: "led1,fan"), API sẽ chỉ trả về các key đó
    const params = keys ? `?keys=${keys}` : '';
    
    // Endpoint chuẩn: /api/plugins/telemetry/{deviceId}/values/attributes
    const res = await API.get(`/api/plugins/telemetry/${deviceId}/values/attributes${params}`);
    return res.data; 
}

// 8. Lấy dữ liệu cảm biến mới nhất (Telemetry - Dùng cho Nhiệt độ, Gas)
export async function getLatestTelemetry(keys) {
    if (!deviceId) return console.error("Thiếu Device ID");

    const params = keys ? `?keys=${keys}` : '';
    
    // Endpoint chuẩn: /api/plugins/telemetry/{deviceId}/values/timeseries
    const res = await API.get(`/api/plugins/telemetry/${deviceId}/values/timeseries${params}`);
    return res.data;
}
// api.js (hoặc services/websocket.js)

export function updateRealtime(onData) {
    const token = localStorage.getItem('tb_token');
    // Lưu ý: Biến deviceId và WS_URL đã được khai báo ở đầu file như code trước
    // const deviceId = ...; 
    // const WS_URL = ...;

    if (!token || !deviceId) return;

    const ws = new WebSocket(`wss://demo.thingsboard.io/api/ws/plugins/telemetry?token=${token}`);

    ws.onopen = () => {
        console.log("WS Connected - Listening for ESP32 updates...");

        const objectToSubscribe = {
            // 1. Lắng nghe Telemetry (Dữ liệu cảm biến, trạng thái gửi liên tục)
            tsSubCmds: [{
                entityType: "DEVICE",
                entityId: deviceId,
                scope: "LATEST_TELEMETRY",
                cmdId: 10,
                keys: "window,garage,curtain,emergency,gas,fire"
            }],
            // 2. Lắng nghe Attributes (Trạng thái công tắc)
            attrSubCmds: [
                {
                    // Lắng nghe lệnh từ Web gửi xuống (Shared Attributes)
                    entityType: "DEVICE",
                    entityId: deviceId,
                    scope: "SHARED_SCOPE", 
                    cmdId: 11,
                    keys: "window,garage,curtain,emergency,gas,fire"
                },
                {
                    // QUAN TRỌNG: Lắng nghe trạng thái từ ESP32 gửi lên (Client Attributes)
                    entityType: "DEVICE",
                    entityId: deviceId,
                    scope: "CLIENT_SCOPE", 
                    cmdId: 12, // ID mới cho Client Scope
                    keys: "window,garage,curtain,emergency,gas,fire"
                }
            ]
        };

        ws.send(JSON.stringify(objectToSubscribe));
    };

    ws.onmessage = (msg) => {
        try {
            const data = JSON.parse(msg.data);
            
            // Kiểm tra xem dữ liệu đến từ cmdId nào (10, 11 hay 12 đều chấp nhận)
            if (data.subscriptionId === 10 || data.subscriptionId === 11 || data.subscriptionId === 12) {
                // ThingsBoard trả về format: { data: { key: [[ts, value]] } }
                if (data.data) {
                    //console.log(" Nhận dữ liệu mới từ TB:", data.data);
                    onData(data.data); 
                }
            }
        } catch (e) {
            console.error("Lỗi parse WS:", e);
        }
    };

    ws.onclose = () => console.warn("WebSocket closed");
    return ws;
}