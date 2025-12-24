<script setup lang="ts">
import { usePhotosStore } from '../stores/photos'

const photosStore = usePhotosStore()

function openPhoto(photoId: string) {
  photosStore.selectPhoto(photoId)
}

function hasAudio(photoId: string): boolean {
  const clips = photosStore.audioAssociations.get(photoId)
  return !!clips && clips.length > 0
}
</script>

<template>
  <div class="photo-grid-container">
    <header class="grid-header">
      <h2>{{ photosStore.currentAlbum?.title || 'All Photos' }}</h2>
      <span class="photo-count">{{ photosStore.photos.length }} photos</span>
    </header>

    <div v-if="photosStore.loadingPhotos" class="loading">
      Loading photos...
    </div>

    <div v-else-if="photosStore.photos.length === 0" class="empty">
      No photos found
    </div>

    <div v-else class="photo-grid">
      <div
        v-for="photo in photosStore.photos"
        :key="photo.id"
        class="photo-item"
        @click="openPhoto(photo.id)"
      >
        <div class="photo-wrapper">
          <img
            v-if="photo.thumbnailBase64"
            :src="`data:image/jpeg;base64,${photo.thumbnailBase64}`"
            :alt="photo.filename"
          />
          <div v-else class="placeholder loading">
            <span class="spinner"></span>
          </div>
          <div v-if="hasAudio(photo.id)" class="audio-badge" title="Has audio">
            🔊
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.photo-grid-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.grid-header {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.grid-header h2 {
  font-size: 20px;
  font-weight: 600;
}

.photo-count {
  font-size: 13px;
  color: var(--text-secondary);
}

.loading,
.empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
}

.photo-grid {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
  align-content: start;
}

.photo-item {
  cursor: pointer;
  transition: transform 0.15s ease;
}

.photo-item:hover {
  transform: scale(1.02);
}

.photo-item:active {
  transform: scale(0.98);
}

.photo-wrapper {
  position: relative;
  width: 100%;
  padding-bottom: 100%; /* 1:1 aspect ratio */
  background: var(--bg-secondary);
  border-radius: 8px;
  overflow: hidden;
}

.photo-wrapper img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.placeholder {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  color: var(--text-secondary);
}

.placeholder.loading {
  background: var(--bg-tertiary);
}

.spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--bg-secondary);
  border-top-color: var(--text-secondary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.audio-badge {
  position: absolute;
  bottom: 6px;
  right: 6px;
  width: 24px;
  height: 24px;
  background: rgba(0, 0, 0, 0.7);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}
</style>
