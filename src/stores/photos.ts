import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface Album {
  id: string
  title: string
  count: number
}

export interface Photo {
  id: string
  filename: string
  creationDate: string
  width: number
  height: number
  thumbnailBase64?: string
}

export interface PhotoDetail extends Photo {
  imageBase64: string
}

export interface AudioAssociation {
  id: string  // Unique clip identifier
  photoId: string
  audioPath: string
  createdAt: number
  duration?: number  // Duration in seconds (for recorded audio)
}

export const usePhotosStore = defineStore('photos', () => {
  // State
  const albums = ref<Album[]>([])
  const photos = ref<Photo[]>([])
  const selectedAlbumId = ref<string | null>(null)
  const selectedPhoto = ref<PhotoDetail | null>(null)
  const audioAssociations = ref<Map<string, AudioAssociation[]>>(new Map())
  const loadingPhotos = ref(false)
  const loadingDetail = ref(false)

  // Computed
  const currentAlbum = computed(() =>
    albums.value.find(a => a.id === selectedAlbumId.value)
  )

  const selectedPhotoAudio = computed(() =>
    selectedPhoto.value ? audioAssociations.value.get(selectedPhoto.value.id) || [] : []
  )

  // Actions
  async function loadAlbums() {
    try {
      albums.value = await window.electron.photos.getAlbums()
    } catch (err) {
      console.error('Failed to load albums:', err)
      albums.value = []
    }
  }

  async function loadPhotos(albumId?: string) {
    loadingPhotos.value = true
    try {
      selectedAlbumId.value = albumId || null
      // Use cached thumbnail loading (fast after first load)
      photos.value = await window.electron.photos.getPhotos(albumId)
    } catch (err) {
      console.error('Failed to load photos:', err)
      photos.value = []
    } finally {
      loadingPhotos.value = false
    }
  }

  async function selectPhoto(photoId: string) {
    loadingDetail.value = true
    try {
      selectedPhoto.value = await window.electron.photos.getPhoto(photoId)
    } catch (err) {
      console.error('Failed to load photo:', err)
      selectedPhoto.value = null
    } finally {
      loadingDetail.value = false
    }
  }

  function clearSelection() {
    selectedPhoto.value = null
  }

  async function attachAudio(photoId: string) {
    const sourcePath = await window.electron.audio.selectFile()
    if (!sourcePath) return null

    const clipId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const storedPath = await window.electron.audio.copyToStorage(sourcePath, photoId, clipId)

    const association: AudioAssociation = {
      id: clipId,
      photoId,
      audioPath: storedPath,
      createdAt: Date.now()
    }

    const existing = audioAssociations.value.get(photoId) || []
    audioAssociations.value.set(photoId, [...existing, association])
    saveAssociations()

    return association
  }

  async function saveRecording(photoId: string, base64Audio: string, durationSecs?: number) {
    const clipId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const storedPath = await window.electron.audio.saveRecording(photoId, base64Audio, clipId)

    const association: AudioAssociation = {
      id: clipId,
      photoId,
      audioPath: storedPath,
      createdAt: Date.now(),
      duration: durationSecs
    }

    const existing = audioAssociations.value.get(photoId) || []
    audioAssociations.value.set(photoId, [...existing, association])
    saveAssociations()

    return association
  }

  function removeAudio(photoId: string, clipId: string) {
    const clips = audioAssociations.value.get(photoId)
    if (!clips) return

    const filtered = clips.filter(c => c.id !== clipId)
    if (filtered.length === 0) {
      audioAssociations.value.delete(photoId)
    } else {
      audioAssociations.value.set(photoId, filtered)
    }
    saveAssociations()
  }

  function saveAssociations() {
    const data = Array.from(audioAssociations.value.entries())
    localStorage.setItem('audioAssociations', JSON.stringify(data))
  }

  function loadAssociations() {
    try {
      const data = localStorage.getItem('audioAssociations')
      if (data) {
        const entries = JSON.parse(data) as [string, AudioAssociation | AudioAssociation[]][]
        const migratedMap = new Map<string, AudioAssociation[]>()

        for (const [photoId, value] of entries) {
          if (Array.isArray(value)) {
            // New format: already an array
            migratedMap.set(photoId, value)
          } else {
            // Old format: single object - migrate to array with generated ID
            const migrated: AudioAssociation = {
              ...value,
              id: value.id || `migrated-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
            }
            migratedMap.set(photoId, [migrated])
          }
        }

        audioAssociations.value = migratedMap
        // Save migrated data
        saveAssociations()
      }
    } catch (err) {
      console.error('Failed to load associations:', err)
    }
  }

  // Initialize
  loadAssociations()

  return {
    // State
    albums,
    photos,
    selectedAlbumId,
    selectedPhoto,
    audioAssociations,
    loadingPhotos,
    loadingDetail,
    // Computed
    currentAlbum,
    selectedPhotoAudio,
    // Actions
    loadAlbums,
    loadPhotos,
    selectPhoto,
    clearSelection,
    attachAudio,
    saveRecording,
    removeAudio
  }
})
