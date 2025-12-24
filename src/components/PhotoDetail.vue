<script setup lang="ts">
import { usePhotosStore } from '../stores/photos'
import AudioPanel from './AudioPanel.vue'

const photosStore = usePhotosStore()

function goBack() {
  photosStore.clearSelection()
}
</script>

<template>
  <div class="photo-detail" v-if="photosStore.selectedPhoto">
    <!-- Header -->
    <header class="detail-header">
      <button class="back-button" @click="goBack">
        ← Back
      </button>
      <h2 class="filename">{{ photosStore.selectedPhoto.filename }}</h2>
      <div class="spacer"></div>
    </header>

    <!-- Content area -->
    <div class="detail-content">
      <!-- Image view -->
      <div class="image-container">
        <div v-if="photosStore.loadingDetail" class="loading">
          Loading...
        </div>
        <img
          v-else-if="photosStore.selectedPhoto.imageBase64"
          :src="`data:image/jpeg;base64,${photosStore.selectedPhoto.imageBase64}`"
          :alt="photosStore.selectedPhoto.filename"
        />
      </div>

      <!-- Audio panel -->
      <AudioPanel />
    </div>
  </div>
</template>

<style scoped>
.photo-detail {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.detail-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  gap: 16px;
}

.back-button {
  padding: 6px 12px;
  border: none;
  background: var(--bg-secondary);
  color: var(--text-primary);
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

.back-button:hover {
  background: var(--bg-tertiary);
}

.filename {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
}

.spacer {
  flex: 1;
}

.detail-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.image-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: var(--bg-primary);
  overflow: hidden;
}

.image-container img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 4px;
}

.loading {
  color: var(--text-secondary);
}
</style>
