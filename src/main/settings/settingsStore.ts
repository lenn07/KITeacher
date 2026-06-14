/**
 * Persistenz der Einstellungen und des API-Keys (Etappe 5).
 *
 * Zwei getrennte Ablagen, weil sie unterschiedlich schützenswert sind:
 *  - Nicht-geheime Einstellungen (Modell, Niveau) liegen als JSON in
 *    `settings.json`.
 *  - Der API-Key wird mit Electrons `safeStorage` verschlüsselt (Schlüssel im
 *    OS-Keychain) und als Bytes in `apikey.bin` abgelegt – nie im Klartext.
 *
 * Der Key verlässt diesen Prozess nicht: `getApiKey()` ist nur für den
 * KI-Service im Main gedacht, es gibt keinen IPC-Kanal, der ihn herausgibt.
 */
import { safeStorage } from 'electron'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'fs'
import type { AppSettings } from '@shared/settings'
import { DEFAULT_SETTINGS } from '@shared/settings'
import { apiKeyPath, settingsPath } from '../storage/paths'

/** Sorgt dafür, dass Fremd-/Teilwerte aus der Datei sauber auf den Typ fallen. */
function normalize(raw: Partial<AppSettings>): AppSettings {
  const level = raw.explanationLevel
  return {
    model: typeof raw.model === 'string' && raw.model ? raw.model : DEFAULT_SETTINGS.model,
    explanationLevel:
      level === 'einfach' || level === 'standard' || level === 'detailliert'
        ? level
        : DEFAULT_SETTINGS.explanationLevel
  }
}

export const settingsStore = {
  /** Liest die Einstellungen; fehlende/kaputte Datei → Defaults. */
  getSettings(): AppSettings {
    if (!existsSync(settingsPath())) return { ...DEFAULT_SETTINGS }
    try {
      const parsed = JSON.parse(readFileSync(settingsPath(), 'utf-8')) as Partial<AppSettings>
      return normalize(parsed)
    } catch {
      // Beschädigte Datei nicht fatal werden lassen – mit Defaults weiterarbeiten.
      return { ...DEFAULT_SETTINGS }
    }
  },

  /** Übernimmt (teilweise) geänderte Werte und schreibt sie zurück. */
  saveSettings(partial: Partial<AppSettings>): AppSettings {
    const next = normalize({ ...this.getSettings(), ...partial })
    writeFileSync(settingsPath(), JSON.stringify(next, null, 2), 'utf-8')
    return next
  },

  /** Ob ein API-Key hinterlegt ist (ohne ihn zu entschlüsseln). */
  hasApiKey(): boolean {
    return existsSync(apiKeyPath())
  },

  /** Verschlüsselt den Key via Keychain und legt ihn ab. */
  setApiKey(apiKey: string): void {
    const trimmed = apiKey.trim()
    if (!trimmed) throw new Error('Der API-Key darf nicht leer sein.')
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Sichere Speicherung ist auf diesem System nicht verfügbar.')
    }
    writeFileSync(apiKeyPath(), safeStorage.encryptString(trimmed))
  },

  /** Liefert den entschlüsselten Key oder `null`. Nur im Main verwenden. */
  getApiKey(): string | null {
    if (!existsSync(apiKeyPath())) return null
    try {
      return safeStorage.decryptString(readFileSync(apiKeyPath()))
    } catch {
      return null
    }
  },

  /** Entfernt den gespeicherten Key. */
  clearApiKey(): void {
    rmSync(apiKeyPath(), { force: true })
  }
}
