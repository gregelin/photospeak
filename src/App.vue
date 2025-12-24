<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { usePhotosStore } from './stores/photos'
import AlbumList from './components/AlbumList.vue'
import PhotoGrid from './components/PhotoGrid.vue'
import PhotoDetail from './components/PhotoDetail.vue'
import PermissionError from './components/PermissionError.vue'

const photosStore = usePhotosStore()
const error = ref<string | null>(null)
const loading = ref(true)

const isPermissionError = computed(() => {
  if (!error.value) return false
  const msg = error.value.toLowerCase()
  return msg.includes('not authorized') ||
         msg.includes('access denied') ||
         msg.includes('permission')
})

onMounted(async () => {
  try {
    await photosStore.loadAlbums()
    await photosStore.loadPhotos()
  } catch (err: any) {
    error.value = err.message || 'Failed to load photos'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="app-container">
    <!-- Sidebar with albums -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <h1>PhotoSpeak</h1>
      </div>
      <AlbumList />
    </aside>

    <!-- Main content area -->
    <main class="main-content">
      <div v-if="loading" class="loading">
        <p>Loading photos...</p>
      </div>

      <!-- Permission error screen -->
      <PermissionError v-else-if="isPermissionError" :error="error!" />

      <!-- Generic error -->
      <div v-else-if="error" class="error">
        <p>{{ error }}</p>
        <p class="hint">Make sure you've built the Swift helper:<br>
          <code>cd swift-helper && swift build -c release</code>
        </p>
      </div>

      <template v-else>
        <!-- Photo grid or detail view -->
        <PhotoDetail v-if="photosStore.selectedPhoto || photosStore.loadingDetail" />
        <PhotoGrid v-else />
      </template>
    </main>
  </div>
</template>

<style scoped>
.app-container {
  display: flex;
  height: 100vh;
  width: 100vw;
}

.sidebar {
  width: var(--sidebar-width);
  background: var(--bg-secondary);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  -webkit-app-region: drag;
}

.sidebar-header {
  padding: 48px 16px 16px;
  border-bottom: 1px solid var(--border);
}

.sidebar-header h1 {
  font-size: 18px;
  font-weight: 600;
}

.main-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.loading,
.error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-secondary);
}

.error .hint {
  margin-top: 16px;
  font-size: 13px;
  text-align: center;
}

.error code {
  display: block;
  margin-top: 8px;
  padding: 8px 12px;
  background: var(--bg-tertiary);
  border-radius: 4px;
  font-family: monospace;
}
</style>
