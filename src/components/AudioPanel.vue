<script setup lang="ts">
import { ref, watch, computed, onUnmounted } from 'vue'
import { usePhotosStore } from '../stores/photos'

const photosStore = usePhotosStore()

const audioRef = ref<HTMLAudioElement | null>(null)
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)

// Recording state
const isRecording = ref(false)
const recordingTime = ref(0)
const mediaRecorder = ref<MediaRecorder | null>(null)
const recordingInterval = ref<number | null>(null)
const audioChunks = ref<Blob[]>([])

const audioAssociation = computed(() =>
  photosStore.selectedPhoto ? photosStore.audioAssociations.get(photosStore.selectedPhoto.id) : null
)

const hasAudio = computed(() => !!audioAssociation.value)

// Audio source loaded via IPC (not file:// URL)
const audioSrc = ref<string | null>(null)

// Load audio when association changes
watch(audioAssociation, async (newVal) => {
  if (newVal?.audioPath) {
    audioSrc.value = await window.electron.audio.loadFile(newVal.audioPath)
  } else {
    audioSrc.value = null
  }
}, { immediate: true })

const audioFilename = computed(() => {
  if (!audioAssociation.value) return ''
  const parts = audioAssociation.value.audioPath.split('/')
  return parts[parts.length - 1]
})

const progress = computed(() => {
  if (duration.value === 0) return 0
  return (currentTime.value / duration.value) * 100
})

const timeDisplay = computed(() => {
  const format = (secs: number) => {
    if (!isFinite(secs) || isNaN(secs)) return '--:--'
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }
  return `${format(currentTime.value)} / ${format(duration.value)}`
})

const recordingTimeDisplay = computed(() => {
  const m = Math.floor(recordingTime.value / 60)
  const s = recordingTime.value % 60
  return `${m}:${s.toString().padStart(2, '0')}`
})

async function startRecording() {
  if (!photosStore.selectedPhoto) return

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaRecorder.value = new MediaRecorder(stream)
    audioChunks.value = []

    mediaRecorder.value.ondataavailable = (e) => {
      if (e.data.size > 0) {
        audioChunks.value.push(e.data)
      }
    }

    mediaRecorder.value.onstop = async () => {
      const blob = new Blob(audioChunks.value, { type: 'audio/webm' })
      const finalDuration = recordingTime.value
      await saveRecording(blob, finalDuration)
      stream.getTracks().forEach(track => track.stop())
    }

    mediaRecorder.value.start()
    isRecording.value = true
    recordingTime.value = 0

    recordingInterval.value = window.setInterval(() => {
      recordingTime.value++
    }, 1000)
  } catch (err) {
    console.error('Failed to start recording:', err)
    alert('Could not access microphone. Please grant microphone permission.')
  }
}

function stopRecording() {
  if (mediaRecorder.value && isRecording.value) {
    mediaRecorder.value.stop()
    isRecording.value = false
    if (recordingInterval.value) {
      clearInterval(recordingInterval.value)
      recordingInterval.value = null
    }
  }
}

async function saveRecording(blob: Blob, durationSecs: number) {
  if (!photosStore.selectedPhoto) return

  // Convert blob to base64 and send to main process
  const reader = new FileReader()
  reader.onloadend = async () => {
    const base64 = (reader.result as string).split(',')[1]
    await photosStore.saveRecording(photosStore.selectedPhoto!.id, base64, durationSecs)
  }
  reader.readAsDataURL(blob)
}

function removeAudio() {
  if (!photosStore.selectedPhoto) return
  if (audioRef.value) {
    audioRef.value.pause()
  }
  photosStore.removeAudio(photosStore.selectedPhoto.id)
}

function togglePlay() {
  if (!audioRef.value) return
  if (isPlaying.value) {
    audioRef.value.pause()
  } else {
    audioRef.value.play()
  }
}

function seek(e: MouseEvent) {
  if (!audioRef.value || duration.value === 0) return
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const x = e.clientX - rect.left
  const percent = x / rect.width
  audioRef.value.currentTime = percent * duration.value
}

function onTimeUpdate() {
  if (audioRef.value) {
    currentTime.value = audioRef.value.currentTime
  }
}

function onLoadedMetadata() {
  if (audioRef.value) {
    // Use stored duration if audio metadata is invalid
    const metaDuration = audioRef.value.duration
    if (isFinite(metaDuration) && !isNaN(metaDuration)) {
      duration.value = metaDuration
    } else if (audioAssociation.value?.duration) {
      duration.value = audioAssociation.value.duration
    }
  }
}

watch(() => photosStore.selectedPhoto?.id, () => {
  isPlaying.value = false
  currentTime.value = 0
  duration.value = 0
  // Stop any ongoing recording when switching photos
  if (isRecording.value) {
    stopRecording()
  }
})

onUnmounted(() => {
  if (audioRef.value) {
    audioRef.value.pause()
  }
  if (isRecording.value) {
    stopRecording()
  }
})
</script>

<template>
  <aside class="audio-panel">
    <h3 class="panel-title">Audio</h3>

    <!-- Recording in progress -->
    <div v-if="isRecording" class="recording-active">
      <div class="recording-indicator">
        <span class="recording-dot"></span>
        <span>Recording...</span>
      </div>
      <div class="recording-time">{{ recordingTimeDisplay }}</div>
      <button class="stop-btn" @click="stopRecording">
        ⏹️ Stop Recording
      </button>
    </div>

    <!-- Has existing audio -->
    <div v-else-if="hasAudio && audioSrc" class="audio-controls">
      <audio
        ref="audioRef"
        :src="audioSrc"
        @play="isPlaying = true"
        @pause="isPlaying = false"
        @ended="isPlaying = false"
        @timeupdate="onTimeUpdate"
        @loadedmetadata="onLoadedMetadata"
      />

      <div class="audio-file">
        <span class="audio-icon">🎵</span>
        <span class="audio-name">{{ audioFilename }}</span>
      </div>

      <div class="progress-bar" @click="seek">
        <div class="progress-fill" :style="{ width: `${progress}%` }"></div>
      </div>

      <div class="controls-row">
        <button class="control-btn play-btn" @click="togglePlay">
          {{ isPlaying ? '⏸' : '▶️' }}
        </button>
        <span class="time-display">{{ timeDisplay }}</span>
        <button class="control-btn remove-btn" @click="removeAudio" title="Remove audio">
          🗑️
        </button>
      </div>
    </div>

    <!-- No audio yet -->
    <div v-else class="no-audio">
      <p>No audio recorded</p>
      <button class="record-btn" @click="startRecording">
        🎙️ Record Audio
      </button>
    </div>
  </aside>
</template>

<style scoped>
.audio-panel {
  width: 280px;
  background: var(--bg-secondary);
  border-left: 1px solid var(--border);
  padding: 16px;
  display: flex;
  flex-direction: column;
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 16px;
  color: var(--text-secondary);
}

.audio-controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.audio-file {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--bg-tertiary);
  border-radius: 8px;
}

.audio-icon {
  font-size: 16px;
}

.audio-name {
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.progress-bar {
  height: 6px;
  background: var(--bg-tertiary);
  border-radius: 3px;
  cursor: pointer;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 3px;
  transition: width 0.1s linear;
}

.controls-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.control-btn {
  width: 36px;
  height: 36px;
  border: none;
  background: var(--bg-tertiary);
  border-radius: 50%;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.control-btn:hover {
  background: #4a4a4a;
}

.play-btn {
  width: 44px;
  height: 44px;
  font-size: 18px;
}

.time-display {
  flex: 1;
  font-size: 12px;
  color: var(--text-secondary);
  text-align: center;
}

.remove-btn {
  font-size: 14px;
}

.no-audio {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 24px;
  color: var(--text-secondary);
}

.record-btn {
  padding: 12px 24px;
  border: none;
  background: #e53935;
  color: white;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.record-btn:hover {
  background: #c62828;
}

/* Recording active state */
.recording-active {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 24px;
}

.recording-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #e53935;
  font-weight: 500;
}

.recording-dot {
  width: 12px;
  height: 12px;
  background: #e53935;
  border-radius: 50%;
  animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.recording-time {
  font-size: 32px;
  font-weight: 300;
  font-variant-numeric: tabular-nums;
}

.stop-btn {
  padding: 12px 24px;
  border: none;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.stop-btn:hover {
  background: #4a4a4a;
}
</style>
