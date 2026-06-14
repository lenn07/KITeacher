import type { ElectronAPI } from '@electron-toolkit/preload'
import type { KiTeacherApi } from '@shared/ipc'

declare global {
  interface Window {
    electron: ElectronAPI
    api: KiTeacherApi
  }
}

export {}
