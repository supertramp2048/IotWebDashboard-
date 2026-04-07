<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { GoogleGenAI } from '@google/genai'

const emit = defineEmits(['parsed-result'])

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || ''
const modelName = import.meta.env.VITE_GEMINI_MODEL || ''

const viewText = ref('Nhấn vào biểu tượng để bắt đầu nói.')
const isListening = ref(false)
const isAnalyzing = ref(false)
const isStartingListening = ref(false)
const errorMessage = ref('')
const MAX_RECORDING_MS = 20000

let recognition = null
let listeningTimeoutId = null

const speechRecognitionCtor =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null

const isSpeechSupported = computed(() => Boolean(speechRecognitionCtor))

function clearListeningTimeout() {
  if (listeningTimeoutId) {
    clearTimeout(listeningTimeoutId)
    listeningTimeoutId = null
  }
}

function stopListeningNow() {
  if (!recognition) {
    return
  }

  isStartingListening.value = false
  clearListeningTimeout()
  try {
    recognition.stop()
  } catch {
    // Ignore invalid state errors when recognizer has not fully started.
  }
}

function parseGeminiJson(rawText) {
  const cleanText = rawText.trim()

  try {
    return JSON.parse(cleanText)
  } catch {
    const fenceRemoved = cleanText.replace(/```json|```/gi, '').trim()
    const jsonCandidate = fenceRemoved.match(/\{[\s\S]*\}/)?.[0]

    if (!jsonCandidate) {
      throw new Error('Gemini khong tra ve JSON hop le.')
    }

    return JSON.parse(jsonCandidate)
  }
}

async function analyzeSentenceWithGemini(sentence) {
  isAnalyzing.value = true
  errorMessage.value = ''

  const prompt = `Bạn là **Voice Home Assistant** – trợ lý giọng nói chuyên điều khiển nhà thông minh bằng tiếng Việt. Nhiệm vụ của bạn là nhận diện và xử lý **tất cả** các câu lệnh giọng nói của người dùng trong một lượt, sau đó chuyển đổi thành các lệnh điều khiển thiết bị.

### Danh sách thiết bị được hỗ trợ (phải dùng chính xác định danh này):
1. đèn_phòng_ngủ
2. đèn_phòng_khách
3. đèn_phòng_bếp
4. đèn_gara
5. cửa_chính
6. cửa_sổ
7. rèm_cửa
8. cửa_gara

### Hành động được phép:
- Đèn (4 loại): "bật" hoặc "tắt"
- Cửa / Rèm (4 loại): "mở" hoặc "đóng"

### Quy tắc xử lý quan trọng (Bắt buộc tuân thủ):
- Xử lý **tất cả** lệnh hợp lệ trong một câu nói của người dùng (có thể có 1, 2, 3 hoặc nhiều lệnh cùng lúc).
- Hiểu được cách nói tự nhiên của tiếng Việt: “bật đèn ngủ và mở cửa gara”, “tắt đèn phòng khách phòng bếp”, “mở rèm cửa và đóng cửa chính”...
- **[QUY TẮC NHÓM]** Nếu người dùng dùng từ gom nhóm như "tắt hết đèn" hoặc "bật tất cả đèn", bạn PHẢI tự động trích xuất toàn bộ 4 thiết bị đèn có trong danh sách và gán hành động tương ứng cho từng thiết bị một vào mảng JSON. Không được hỏi lại nếu đã rõ nhóm thiết bị.
- Nếu có lệnh không rõ hoặc không có thiết bị → bỏ qua lệnh đó và vẫn thực hiện các lệnh hợp lệ còn lại.
- Nếu toàn bộ lệnh đều mù mờ, không chứa bất kỳ chủ thể nào → trả về mảng rỗng và message hỏi lại.

### Bắt buộc: Trả về đúng định dạng JSON sau (Tuyệt đối không thêm bất kỳ văn bản nào ngoài JSON):

{
  "commands": [
    {
      "device": "tên_thiết_bị",
      "action": "bật|tắt|mở|đóng"
    }
  ],
  "message": "Câu trả lời nói với người dùng (bằng tiếng Việt, vui vẻ, thân thiện, tóm tắt tất cả hành động đã thực hiện)"
}

### Dữ liệu Mẫu (Few-shot Examples):

Người dùng nói: "Bật đèn phòng ngủ và mở cửa gara"
→ {
  "commands": [
    {"device": "đèn_phòng_ngủ", "action": "bật"},
    {"device": "cửa_gara", "action": "mở"}
  ],
  "message": "Đã bật đèn phòng ngủ và mở cửa gara rồi ạ!"
}

Người dùng nói: "Tắt đèn phòng khách phòng bếp, mở rèm cửa"
→ {
  "commands": [
    {"device": "đèn_phòng_khách", "action": "tắt"},
    {"device": "đèn_phòng_bếp", "action": "tắt"},
    {"device": "rèm_cửa", "action": "mở"}
  ],
  "message": "Đã tắt đèn phòng khách, tắt đèn phòng bếp và mở rèm cửa!"
}

Người dùng nói: "Tắt hết đèn đi"
→ {
  "commands": [
    {"device": "đèn_phòng_ngủ", "action": "tắt"},
    {"device": "đèn_phòng_khách", "action": "tắt"},
    {"device": "đèn_phòng_bếp", "action": "tắt"},
    {"device": "đèn_gara", "action": "tắt"}
  ],
  "message": "Đã tắt toàn bộ hệ thống đèn trong nhà rồi ạ!"
}

Người dùng nói: "Tắt cái này đi"
→ {
  "commands": [],
  "message": "Dạ bạn muốn thao tác với thiết bị nào ạ? Cửa, rèm hay đèn?"
}

Bây giờ hãy chờ câu lệnh giọng nói của người dùng và xử lý tất cả lệnh trong một lần.
Lệnh thoại người dùng: "${sentence}"`

  try {
    const ai = new GoogleGenAI({ apiKey })
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        temperature: 0.1,
        responseMimeType: 'application/json'
      }
    })

    const modelText = response?.text
    if (!modelText) {
      throw new Error('Khong lay duoc noi dung tra ve tu Gemini.')
    }

    const parsed = parseGeminiJson(modelText)
    console.log(parsed)
    emit('parsed-result', parsed)

    // Sau khi xu ly xong, thay van ban nhan duoc bang message tu Gemini.
    viewText.value = parsed?.message ? String(parsed.message) : 'Khong co message trong ket qua.'
  } catch (error) {
    console.error(error)
    errorMessage.value = error instanceof Error ? error.message : String(error || 'unknown')
  } finally {
    isAnalyzing.value = false
  }
}

function getRecognition() {
  if (!speechRecognitionCtor) {
    return null
  }

  if (recognition) {
    return recognition
  }

  recognition = new speechRecognitionCtor()
  recognition.lang = 'vi-VN'
  recognition.continuous = false
  recognition.interimResults = false
  recognition.maxAlternatives = 1

  recognition.onstart = () => {
    isStartingListening.value = false
    isListening.value = true
    errorMessage.value = ''
    clearListeningTimeout()
    listeningTimeoutId = setTimeout(() => {
      if (isListening.value) {
        stopListeningNow()
      }
    }, MAX_RECORDING_MS)
  }

  recognition.onend = () => {
    isStartingListening.value = false
    isListening.value = false
    clearListeningTimeout()
  }

  recognition.onerror = (event) => {
    isStartingListening.value = false
    isListening.value = false
    clearListeningTimeout()
    console.error(event)
    errorMessage.value = event?.error || 'unknown'
  }

  recognition.onresult = async (event) => {
    const spokenText = event?.results?.[0]?.[0]?.transcript || ''
    const sentence = spokenText.trim()

    if (!sentence) {
      viewText.value = 'Khong nhan duoc cau noi. Vui long thu lai.'
      return
    }

    // Hien thi van ban vua noi de xu ly.
    viewText.value = sentence
    await analyzeSentenceWithGemini(sentence)
  }

  return recognition
}

function startListening() {
  errorMessage.value = ''

  if (!isSpeechSupported.value) {
    errorMessage.value = 'Trinh duyet nay khong ho tro SpeechRecognition API.'
    return
  }

  if (!apiKey.trim()) {
    errorMessage.value = 'Thieu VITE_GEMINI_API_KEY trong frontend/.env.'
    return
  }

  if (isAnalyzing.value) {
    return
  }

  if (isListening.value || isStartingListening.value) {
    stopListeningNow()
    return
  }

  const recognizer = getRecognition()
  if (!recognizer) {
    errorMessage.value = 'Khong khoi tao duoc bo nhan dien giong noi.'
    return
  }

  try {
    isStartingListening.value = true
    recognizer.start()
  } catch {
    isStartingListening.value = false
    errorMessage.value = 'Mic dang bat. Vui long doi mot chut.'
  }
}

onBeforeUnmount(() => {
  isStartingListening.value = false
  clearListeningTimeout()
  if (recognition) {
    recognition.onstart = null
    recognition.onend = null
    recognition.onresult = null
    recognition.onerror = null
    recognition = null
  }
})
</script>

<template>
  <main class="assistant-shell">
    <section class="minimal-wrap">
      <button
        class="mic-btn"
        :class="{ active: isListening, busy: isAnalyzing }"
        :disabled="isAnalyzing"
        aria-label="Bat dau ghi am"
        @click="startListening"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Zm5-3a1 1 0 1 1 2 0a7 7 0 0 1-6 6.93V20h3a1 1 0 1 1 0 2H8a1 1 0 1 1 0-2h3v-2.07A7 7 0 0 1 5 11a1 1 0 1 1 2 0a5 5 0 1 0 10 0Z" />
        </svg>
      </button>

      <p class="voice-text">{{ viewText }}</p>
      <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>
    </section>
  </main>
</template>

<style scoped>
.assistant-shell {
  --bg-a: #f4fbff;
  --bg-b: #ebfff4;
  --ink: #0f172a;
  --danger: #b42318;
  --mic: #0f766e;
  --mic-live: #ea580c;

  min-height: 100%;
  color: var(--ink);
  font-family: Segoe UI, sans-serif;
  background:
    radial-gradient(circle at 15% 20%, rgba(15, 118, 110, 0.2), transparent 36%),
    radial-gradient(circle at 85% 14%, rgba(234, 88, 12, 0.14), transparent 32%),
    linear-gradient(165deg, var(--bg-a), var(--bg-b));
}

* {
  box-sizing: border-box;
}

.minimal-wrap {
  min-height: 70vh;
  padding: 24px;
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 20px;
}

.mic-btn {
  width: 112px;
  height: 112px;
  border: 0;
  border-radius: 999px;
  background: var(--mic);
  color: #fff;
  display: grid;
  place-items: center;
  cursor: pointer;
  box-shadow: 0 14px 34px rgba(15, 118, 110, 0.35);
  transition: transform 130ms ease, background-color 130ms ease;
}

.mic-btn svg {
  width: 44px;
  height: 44px;
  fill: currentColor;
}

.mic-btn:hover {
  transform: translateY(-2px);
}

.mic-btn.active {
  background: var(--mic-live);
  animation: pulse 1.1s infinite;
}

.mic-btn.busy {
  opacity: 0.72;
  cursor: wait;
}

.voice-text {
  margin: 0;
  max-width: 780px;
  text-align: center;
  font-size: clamp(1.05rem, 2.1vw, 1.32rem);
  line-height: 1.45;
}

.error-text {
  margin: 0;
  max-width: 780px;
  text-align: center;
  color: var(--danger);
  font-weight: 600;
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(234, 88, 12, 0.45);
  }

  100% {
    box-shadow: 0 0 0 22px rgba(234, 88, 12, 0);
  }
}
</style>
