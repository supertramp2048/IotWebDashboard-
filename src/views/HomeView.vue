<template>
  <div class="min-h-screen w-full bg-gray-100 font-sans text-gray-800">
    <header class="bg-white w-full shadow-sm sticky top-0 z-50">
      <div class="w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <h1 class="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
          <span class="w-3 h-3 rounded-full" :class="isConnected ? 'bg-green-500' : 'bg-red-500'"></span>
          Smart Home HKI
        </h1>
        <div class="text-sm text-gray-500">
          {{ isConnected ? 'Connected via WebSocket' : 'Connecting...' }}
        </div>
        <div>
          <button @click="logoutClick" class="text-red-500">log out</button>
        </div>
      </div>
    </header>

    <main class="w-full px-4 sm:px-6 lg:px-8 py-8">
      <div class="grid grid-cols-1 md:grid-cols-12 gap-6 mb-6">
        <div class="md:col-span-3 bg-white rounded-2xl shadow-md p-6 flex flex-col items-center justify-center relative overflow-hidden">
          <h2 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Gas Level</h2>
          <div class="relative w-40 h-40">
            <svg class="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke="#e5e7eb" stroke-width="8" />
              <circle 
                cx="50" cy="50" r="45" fill="none" stroke="#3b82f6" stroke-width="8"
                stroke-linecap="round"
                :stroke-dasharray="283" 
                :stroke-dashoffset="283 - (telemetry?.gas / 5000 * 283)"
                class="transition-all duration-500 ease-out"
              />
            </svg>
            <div class="absolute inset-0 flex flex-col items-center justify-center">
              <span class="text-3xl font-bold text-gray-700">{{ telemetry.gas }}</span>
              <span class="text-xs text-gray-400">ppm</span>
            </div>
          </div>
        </div>

        <div class="md:col-span-9 grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div 
            v-for="(val, key) in switches" 
            :key="key"
            class="bg-white relative rounded-2xl shadow-md p-6 flex flex-col items-center justify-between transition-all hover:shadow-lg"
          >
            <ElementLoader v-if="cardsLoading.includes(key)" :loading="isCardLoading" />
            <span class="text-sm font-semibold text-gray-600 uppercase">{{ key }}</span>
            <button 
              @click="toggleSwitch(key)"
              class="relative inline-flex h-8 w-14 items-center rounded-full transition-colors duration-300 focus:outline-none"
              :class="val ? 'bg-blue-600' : 'bg-gray-200'"
              :disabled="uiLocked"
            >
              <span 
                class="inline-block h-6 w-6 transform rounded-full bg-white transition-transform duration-300 shadow-sm"
                :class="val ? 'translate-x-7' : 'translate-x-1'"
              />
            </button>
            <div class="mt-4 text-4xl" :class="val ? 'text-blue-500' : 'text-gray-300'">
              <i class="mdi" :class="getIcon(key)"></i>
            </div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
        <div 
          v-for="(led, index) in leds" 
          :key="index"
          @click="toggleLed(index)"
          class="bg-white rounded-2xl shadow-md p-6 cursor-pointer group hover:bg-gray-50 transition-all active:scale-95 border border-transparent"
          :class="{ '!border-blue-200 !bg-blue-50': led.value }"
        >
          <div class="flex flex-col items-center text-center">
            <span class="text-sm font-medium text-gray-500 mb-4">{{ led.label }}</span>
            <div 
              class="w-16 h-16 rounded-full flex items-center justify-center mb-3 transition-colors duration-300 shadow-inner"
              :class="led.value ? 'bg-blue-500 text-white shadow-blue-200' : 'bg-gray-100 text-gray-300'"
            >
              <i class="mdi mdi-power text-3xl"></i>
            </div>
            <span class="text-xs font-bold tracking-wide" :class="led.value ? 'text-blue-600' : 'text-gray-400'">
              {{ led.value ? 'ACTIVE' : 'INACTIVE' }}
            </span>
          </div>
        </div>
      </div>
    </main>
    <div v-if="emergency" class="bg-red-500 w-full rounded-2xl">
      <p class="text-2xl font-bold text-gray-800 uppercase">
        {{ isFireDetected ? (isGasOver ? 'CÓ CHÁY & RÒ RỈ GAS!' : 'ĐANG XẢY RA CHÁY!') : 'PHÁT HIỆN RÒ RỈ GAS!' }}
      </p>
      <div class="bg-red-50 py-4 rounded-2xl border-2 border-red-200">
        <span class="text-white text-sm block mb-1">Nồng độ gas hiện tại</span>
        <span class="text-5xl font-mono font-black text-red-600">{{ telemetry.gas }}</span>
        <span class="text-xl font-bold text-red-400"> ppm</span>
      </div>
      <p class="text-white font-medium italic animate-pulse">Vui lòng kiểm tra hệ thống và ngắt nguồn điện!</p>
    </div>
    <div v-if="emergency && !ConfirmEmergency" class="fixed inset-0 z-[999] flex items-center justify-center bg-red-600/90 backdrop-blur-sm animate-pulse-fast">
      <div class="bg-white p-10 rounded-3xl shadow-2xl text-center max-w-lg mx-4 border-[10px] border-red-500 shadow-red-500/50 scale-up-center">
        <div class="mb-6 relative">
          <i class="mdi mdi-alert-decagram text-red-600 text-8xl inline-block animate-bounce"></i>
          <i class="mdi mdi-fire text-orange-500 text-4xl absolute -top-2 -right-2 animate-ping"></i>
        </div>
        <h2 class="text-5xl font-black text-red-700 mb-4 tracking-tighter">BÁO ĐỘNG ĐỎ</h2>
        <div class="space-y-4">
          <p class="text-2xl font-bold text-gray-800 uppercase">
            {{ isFireDetected ? (isGasOver ? 'CÓ CHÁY & RÒ RỈ GAS!' : 'ĐANG XẢY RA CHÁY!') : 'PHÁT HIỆN RÒ RỈ GAS!' }}
          </p>
          <div class="bg-red-50 py-4 rounded-2xl border-2 border-red-200">
            <span class="text-gray-500 text-sm block mb-1">Nồng độ gas hiện tại</span>
            <span class="text-5xl font-mono font-black text-red-600">{{ telemetry.gas }}</span>
            <span class="text-xl font-bold text-red-400"> ppm</span>
          </div>
          <p class="text-gray-600 font-medium italic animate-pulse">Vui lòng kiểm tra hệ thống và ngắt nguồn điện!</p>
        </div>
        <button @click="ConfirmEmergency = true" class="mt-8 px-8 py-3 bg-red-600 text-white rounded-full font-bold hover:bg-red-700 active:scale-90">
          ĐÃ XÁC NHẬN
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import ElementLoader from '../components/loader.vue'
import { Haptics } from '@capacitor/haptics'
import { LocalNotifications } from '@capacitor/local-notifications'
import { Capacitor } from '@capacitor/core'
import { sendRpcCommand, updateRealtime, logout } from '../api/api'

// --- 1. STATE MANAGEMENT ---
const router = useRouter()
const isCardLoading = ref(false)
const emergency = ref(false)
const isGasOver = ref(false)
const isFireDetected = ref(false)
const ConfirmEmergency = ref(false)
const isConnected = ref(localStorage.getItem('tb_token') != null)
const uiLocked = ref(false)
let cardsLoading = ref([])
let socket = null

const telemetry = reactive({ gas: 0 })
const switches = reactive({ 'Window': false, 'Garage': false, 'Curtain': false })
const leds = reactive([
  { label: 'Nhà Xe', value: false },
  { label: 'Phòng bếp', value: false },
  { label: 'Phòng khách', value: false },
  { label: 'Phòng ngủ', value: false }
])

const alarmAudio = typeof Audio !== 'undefined' ? new Audio('/alarm.mp3') : null
if (alarmAudio) alarmAudio.loop = true

// --- 2. HELPER FUNCTIONS ---

const getIcon = (key) => {
  const map = {
    'Window': 'mdi-window-open-variant',
    'Curtain': 'mdi-curtains',
    'Garage': 'mdi-garage-variant'
  }
  return map[key] || 'mdi-power-plug'
}

const sendPushover = async (message) => {
  const token = import.meta.env.VITE_PUSHOVER_APP_TOKEN
  const user = import.meta.env.VITE_PUSHOVER_USER_KEY
  if (!token || !user) return

  const body = new URLSearchParams({
    token: token,
    user: user,
    message: message,
    title: " CẢNH BÁO SMART HOME",
    priority: "2",
    retry: "30",
    expire: "3600",
    sound: "siren"
  })

  try {
    await fetch("https://api.pushover.net/1/messages.json", { method: "POST", body: body })
  } catch (e) { console.error("Pushover Error", e) }
}

const showDesktopNotification = (title, body) => {
  if (!("Notification" in window)) return
  if (Notification.permission === "granted") {
    new Notification(title, { body })
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then(p => { if (p === "granted") new Notification(title, { body }) })
  }
}

// --- 3. WATCHERS ---

watch(emergency, async (isEmergency) => {
  if (isEmergency) {
    const alertMsg = `Cảnh báo: ${isFireDetected.value ? 'CHÁY' : ''} ${isGasOver.value ? 'RÒ RỈ GAS' : ''}! Gas: ${telemetry.gas} ppm.`
    
    sendPushover(alertMsg)
    if (Capacitor.getPlatform() === 'web') showDesktopNotification("KHẨN CẤP", alertMsg)

    try {
      await Haptics.vibrate({ duration: 1000 })
      if (alarmAudio) alarmAudio.play().catch(() => {})

      if (Capacitor.getPlatform() !== 'web') {
        await LocalNotifications.requestPermissions()
        await LocalNotifications.createChannel({
          id: 'emergency-channel',
          name: 'Emergency',
          importance: 5,
          sound: 'alarm.mp3'
        })
        await LocalNotifications.schedule({
          notifications: [{ title: " KHẨN CẤP", body: alertMsg, id: 100, sound: 'alarm.mp3', ongoing: true }]
        })
      }
    } catch (e) { console.error(e) }
  } else {
    ConfirmEmergency.value = false
    if (Capacitor.getPlatform() !== 'web') await LocalNotifications.cancel({ notifications: [{ id: 100 }] })
    if (alarmAudio) { alarmAudio.pause(); alarmAudio.currentTime = 0 }
  }
})

// --- 4. LIFECYCLE ---

onMounted(() => {
  if ("Notification" in window) Notification.requestPermission()

  socket = updateRealtime((data) => {
    isConnected.value = true
    if (data.gas) {
      telemetry.gas = Number(data.gas[0][1])
      isGasOver.value = telemetry.gas >= 1000
    }
    if (data.fire) isFireDetected.value = Number(data.fire[0][1]) === 1
    if (data.emergency) emergency.value = data.emergency[0][1] === 'true'
    
    // Đồng bộ thiết bị
    if (data.window) switches['Window'] = data.window[0][1] === 'true'
    if (data.garage) switches['Garage'] = data.garage[0][1] === 'true'
    if (data.curtain) switches['Curtain'] = data.curtain[0][1] === 'true'
    if (data.led1) leds[0].value = data.led1[0][1] === 'true'
    if (data.led2) leds[1].value = data.led2[0][1] === 'true'
    if (data.led3) leds[2].value = data.led3[0][1] === 'true'
    if (data.led4) leds[3].value = data.led4[0][1] === 'true'
  })
})

const toggleSwitch = async (key) => {
  cardsLoading.value.push(key)
  isCardLoading.value = true
  try {
    const newState = !switches[key]
    await sendRpcCommand(`set${key}`, newState)
    switches[key] = newState
  } finally {
    isCardLoading.value = false
    cardsLoading.value = cardsLoading.value.filter(i => i !== key)
  }
}

const toggleLed = async (index) => {
  const newState = !leds[index].value
  await sendRpcCommand(`setLed${index+1}`, newState)
  leds[index].value = newState
}

const logoutClick = async () => { await logout(); router.push('/login') }

onUnmounted(() => { if (socket) socket.close() })
</script>

<style scoped>
@import url('https://cdn.jsdelivr.net/npm/@mdi/font@6.x/css/materialdesignicons.min.css');
.animate-pulse-fast { animation: pulse-red 0.5s infinite; }
@keyframes pulse-red {
  0%, 100% { background-color: rgba(220, 38, 38, 0.9); }
  50% { background-color: rgba(153, 27, 27, 0.95); }
}
.scale-up-center { animation: scale-up 0.4s both; }
@keyframes scale-up { 0% { transform: scale(0.5); } 100% { transform: scale(1); } }
</style>