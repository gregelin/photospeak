<script setup lang="ts">
import { usePhotosStore } from '../stores/photos'

const photosStore = usePhotosStore()

function selectAlbum(albumId: string | null) {
  photosStore.loadPhotos(albumId || undefined)
  photosStore.clearSelection()
}
</script>

<template>
  <nav class="album-list">
    <button
      class="album-item"
      :class="{ active: !photosStore.selectedAlbumId }"
      @click="selectAlbum(null)"
    >
      <span class="album-icon">📷</span>
      <span class="album-name">All Photos</span>
    </button>

    <div class="album-section">
      <h3 class="section-title">Albums</h3>
      <button
        v-for="album in photosStore.albums"
        :key="album.id"
        class="album-item"
        :class="{ active: photosStore.selectedAlbumId === album.id }"
        @click="selectAlbum(album.id)"
      >
        <span class="album-icon">📁</span>
        <span class="album-name">{{ album.title }}</span>
        <span class="album-count">{{ album.count }}</span>
      </button>
    </div>
  </nav>
</template>

<style scoped>
.album-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  -webkit-app-region: no-drag;
}

.album-section {
  margin-top: 16px;
}

.section-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 8px;
}

.album-item {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 13px;
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
  gap: 8px;
}

.album-item:hover {
  background: var(--bg-tertiary);
}

.album-item.active {
  background: var(--accent);
}

.album-icon {
  font-size: 14px;
}

.album-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.album-count {
  font-size: 11px;
  color: var(--text-secondary);
}

.album-item.active .album-count {
  color: rgba(255, 255, 255, 0.7);
}
</style>
