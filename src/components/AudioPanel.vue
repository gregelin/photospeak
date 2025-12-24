<script setup lang="ts">
import { ref, watch, computed, onUnmounted } from 'vue'
import { usePhotosStore, type AudioAssociation } from '../stores/photos'

const photosStore = usePhotosStore()

// Playback state
const playingClipId = ref<string | null>(null)
const audioRef = ref<HTMLAudioElement | null>(null)
const currentTime = ref(0)
const duration = ref(0)

// Recording state
const isRecording = ref(false)
const recordingTime = ref(0)
const mediaRecorder = ref<MediaRecorder | null>(null)
const recordingInterval = ref<number | null>(null)
const audioChunks = ref<Blob[]>([])

// Audio sources cache (clipId -> data URL)
const audioSources = ref<Map<string, string>>(new Map())

const clips = computed(() => photosStore.selectedPhotoAudio)
const hasClips = computed(() => clips.value.length > 0)

const progress = computed(() => {
  if (duration.value === 0) return 0
  return (currentTime.value / duration.value) * 100
})

const recordingTimeDisplay = computed(() => {
  const m = Math.floor(recordingTime.value / 60)
  const s = recordingTime.value % 60
  return `${m}:${s.toString().padStart(2, '0')}`
})

function formatTime(secs: number): string {
  if (!isFinite(secs) || isNaN(secs)) return '--:--'
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatClipName(clip: AudioAssociation): string {
  const date = new Date(clip.createdAt)
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

// Load audio source for a clip
async function loadAudioSource(clip: AudioAssociation): Promise<string | null> {
  if (audioSources.value.has(clip.id)) {
    return audioSources.value.get(clip.id)!
  }
  const src = await window.electron.audio.loadFile(clip.audioPath)
  if (src) {
    audioSources.value.set(clip.id, src)
  }
  return src
}

async function playClip(clip: AudioAssociation) {
  // Stop current playback if any
  if (audioRef.value) {
    audioRef.value.pause()
  }

  const src = await loadAudioSource(clip)
  if (!src) return

  // Create new audio element
  const audio = new Audio(src)
  audioRef.value = audio
  playingClipId.value = clip.id
  currentTime.value = 0
  duration.value = clip.duration || 0

  audio.onloadedmetadata = () => {
    if (isFinite(audio.duration) && !isNaN(audio.duration)) {
      duration.value = audio.duration
    }
  }

  audio.ontimeupdate = () => {
    currentTime.value = audio.currentTime
  }

  audio.onended = () => {
    playingClipId.value = null
    currentTime.value = 0
  }

  audio.onpause = () => {
    if (playingClipId.value === clip.id && audio.currentTime >= audio.duration - 0.1) {
      playingClipId.value = null
    }
  }

  audio.play()
}

function pauseClip() {
  if (audioRef.value) {
    audioRef.value.pause()
    playingClipId.value = null
  }
}

function toggleClip(clip: AudioAssociation) {
  if (playingClipId.value === clip.id) {
    pauseClip()
  } else {
    playClip(clip)
  }
}

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

  const reader = new FileReader()
  reader.onloadend = async () => {
    const base64 = (reader.result as string).split(',')[1]
    await photosStore.saveRecording(photosStore.selectedPhoto!.id, base64, durationSecs)
  }
  reader.readAsDataURL(blob)
}

function removeClip(clip: AudioAssociation) {
  if (!photosStore.selectedPhoto) return

  // Stop if this clip is playing
  if (playingClipId.value === clip.id) {
    pauseClip()
  }

  // Remove from cache
  audioSources.value.delete(clip.id)

  photosStore.removeAudio(photosStore.selectedPhoto.id, clip.id)
}

// Reset state when switching photos
watch(() => photosStore.selectedPhoto?.id, () => {
  pauseClip()
  currentTime.value = 0
  duration.value = 0
  audioSources.value.clear()

  if (isRecording.value) {
    stopRecording()
  }
})

onUnmounted(() => {
  pauseClip()
  if (isRecording.value) {
    stopRecording()
  }
})
</script>

<template>
  <aside class="audio-panel">
    <h3 class="panel-title">Audio Clips</h3>

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

    <template v-else>
      <!-- Clips list -->
      <div v-if="hasClips" class="clips-list">
        <div
          v-for="clip in clips"
          :key="clip.id"
          class="clip-item"
          :class="{ playing: playingClipId === clip.id }"
        >
          <button class="play-btn" @click="toggleClip(clip)">
            {{ playingClipId === clip.id ? '⏸' : '▶️' }}
          </button>

          <div class="clip-info">
            <span class="clip-name">{{ formatClipName(clip) }}</span>
            <span class="clip-duration">{{ formatTime(clip.duration || 0) }}</span>
          </div>

          <!-- Progress bar for playing clip -->
          <div v-if="playingClipId === clip.id" class="mini-progress">
            <div class="mini-progress-fill" :style="{ width: `${progress}%` }"></div>
          </div>

          <button class="delete-btn" @click="removeClip(clip)" title="Delete clip">
            🗑️
          </button>
        </div>
      </div>

      <!-- Empty state -->
      <div v-else class="no-clips">
        <p>No audio clips</p>
      </div>

      <!-- Record button (always visible) -->
      <button class="record-btn" @click="startRecording">
        🎙️ Record New Clip
      </button>
    </template>
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
  gap: 12px;
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
}

.clips-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 300px;
  overflow-y: auto;
}

.clip-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  background: var(--bg-tertiary);
  border-radius: 8px;
  position: relative;
}

.clip-item.playing {
  background: var(--bg-primary);
  box-shadow: 0 0 0 2px var(--accent);
}

.play-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: var(--accent);
  color: white;
  border-radius: 50%;
  cursor: pointer;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.play-btn:hover {
  opacity: 0.9;
}

.clip-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.clip-name {
  font-size: 13px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.clip-duration {
  font-size: 11px;
  color: var(--text-secondary);
}

.mini-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--bg-tertiary);
  border-radius: 0 0 8px 8px;
  overflow: hidden;
}

.mini-progress-fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.1s linear;
}

.delete-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.6;
  flex-shrink: 0;
}

.delete-btn:hover {
  opacity: 1;
}

.no-clips {
  padding: 24px;
  text-align: center;
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
  margin-top: auto;
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
  flex: 1;
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
  background: var(--border);
}
</style>
