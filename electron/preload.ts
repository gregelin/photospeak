import { contextBridge, ipcRenderer } from 'electron'

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

export interface PhotoDetail {
  id: string
  filename: string
  creationDate: string
  width: number
  height: number
  imageBase64: string
}

const photosAPI = {
  getAlbums: (): Promise<Album[]> => ipcRenderer.invoke('photos:getAlbums'),
  getPhotos: (albumId?: string): Promise<Photo[]> => ipcRenderer.invoke('photos:getPhotos', albumId),
  getPhotosMeta: (albumId?: string): Promise<Photo[]> => ipcRenderer.invoke('photos:getPhotosMeta', albumId),
  getThumbnails: (photoIds: string[]): Promise<Record<string, string>> => ipcRenderer.invoke('photos:getThumbnails', photoIds),
  getPhoto: (photoId: string): Promise<PhotoDetail> => ipcRenderer.invoke('photos:getPhoto', photoId),
  getThumbnail: (photoId: string): Promise<string> => ipcRenderer.invoke('photos:getThumbnail', photoId)
}

const audioAPI = {
  selectFile: (): Promise<string | null> => ipcRenderer.invoke('audio:selectFile'),
  copyToStorage: (sourcePath: string, photoId: string): Promise<string> =>
    ipcRenderer.invoke('audio:copyToStorage', sourcePath, photoId),
  saveRecording: (photoId: string, base64Audio: string): Promise<string> =>
    ipcRenderer.invoke('audio:saveRecording', photoId, base64Audio),
  loadFile: (filePath: string): Promise<string | null> =>
    ipcRenderer.invoke('audio:loadFile', filePath)
}

const appAPI = {
  getUserDataPath: (): Promise<string> => ipcRenderer.invoke('app:getUserDataPath'),
  openPhotosSettings: (): Promise<void> => ipcRenderer.invoke('app:openPhotosSettings'),
  reload: (): Promise<void> => ipcRenderer.invoke('app:reload')
}

contextBridge.exposeInMainWorld('electron', {
  photos: photosAPI,
  audio: audioAPI,
  app: appAPI
})

// Type declarations for renderer
declare global {
  interface Window {
    electron: {
      photos: typeof photosAPI
      audio: typeof audioAPI
      app: typeof appAPI
    }
  }
}
