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
  const audioAssociations = ref<Map<string, AudioAssociation>>(new Map())
  const loadingPhotos = ref(false)
  const loadingDetail = ref(false)

  // Computed
  const currentAlbum = computed(() =>
    albums.value.find(a => a.id === selectedAlbumId.value)
  )

  const selectedPhotoAudio = computed(() =>
    selectedPhoto.value ? audioAssociations.value.get(selectedPhoto.value.id) : null
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

    const storedPath = await window.electron.audio.copyToStorage(sourcePath, photoId)

    const association: AudioAssociation = {
      photoId,
      audioPath: storedPath,
      createdAt: Date.now()
    }

    audioAssociations.value.set(photoId, association)
    saveAssociations()

    return association
  }

  async function saveRecording(photoId: string, base64Audio: string, durationSecs?: number) {
    const storedPath = await window.electron.audio.saveRecording(photoId, base64Audio)

    const association: AudioAssociation = {
      photoId,
      audioPath: storedPath,
      createdAt: Date.now(),
      duration: durationSecs
    }

    audioAssociations.value.set(photoId, association)
    saveAssociations()

    return association
  }

  function removeAudio(photoId: string) {
    audioAssociations.value.delete(photoId)
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
        const entries = JSON.parse(data) as [string, AudioAssociation][]
        audioAssociations.value = new Map(entries)
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
