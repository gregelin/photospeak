/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface Album {
  id: string
  title: string
  count: number
}

interface Photo {
  id: string
  filename: string
  creationDate: string
  width: number
  height: number
  thumbnailBase64?: string
}

interface PhotoDetail extends Photo {
  imageBase64: string
}

interface Window {
  electron: {
    photos: {
      getAlbums: () => Promise<Album[]>
      getPhotos: (albumId?: string) => Promise<Photo[]>
      getPhoto: (photoId: string) => Promise<PhotoDetail>
      getThumbnail: (photoId: string) => Promise<string>
    }
    audio: {
      selectFile: () => Promise<string | null>
      copyToStorage: (sourcePath: string, photoId: string) => Promise<string>
      saveRecording: (photoId: string, base64Audio: string) => Promise<string>
      loadFile: (filePath: string) => Promise<string | null>
    }
    app: {
      getUserDataPath: () => Promise<string>
      openPhotosSettings: () => Promise<void>
      reload: () => Promise<void>
    }
  }
}
