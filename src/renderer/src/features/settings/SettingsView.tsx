/**
 * Einstellungen (Etappe 5).
 *
 * API-Key (sicher gespeichert, Verbindungstest), Modellwahl und Erklär-Niveau.
 * Sämtlicher Zugriff läuft über `window.api.settings` – die UI sieht den Key nie
 * im Klartext, nur das `hasApiKey`-Flag.
 *
 * Modell/Niveau werden direkt bei Änderung gespeichert; der API-Key hat eigene
 * Aktionen (Speichern/Entfernen/Testen), weil er bewusst eingegeben wird und
 * nicht zurückgelesen werden kann.
 */
import { useEffect, useState } from 'react'
import type {
  AppSettings,
  ConnectionTestResult,
  ExplanationLevel,
  SettingsState
} from '@shared/settings'
import { EXPLANATION_LEVEL_OPTIONS, MODEL_OPTIONS } from '@shared/settings'

interface SettingsViewProps {
  onBack: () => void
}

export function SettingsView({ onBack }: SettingsViewProps): React.JSX.Element {
  const [settings, setSettings] = useState<SettingsState | null>(null)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.api.settings
      .get()
      .then(setSettings)
      .catch(() => setError('Einstellungen konnten nicht geladen werden.'))
  }, [])

  /** Eine Einstellung speichern und den zurückgegebenen Stand übernehmen. */
  async function patch(partial: Partial<AppSettings>): Promise<void> {
    setError(null)
    setTestResult(null)
    try {
      setSettings(await window.api.settings.save(partial))
    } catch {
      setError('Speichern ist fehlgeschlagen.')
    }
  }

  async function handleSaveKey(): Promise<void> {
    const key = apiKeyInput.trim()
    if (!key) return
    setBusy(true)
    setError(null)
    setTestResult(null)
    try {
      await window.api.settings.setApiKey(key)
      setApiKeyInput('')
      setSettings(await window.api.settings.get())
    } catch {
      setError('Der API-Key konnte nicht gespeichert werden.')
    } finally {
      setBusy(false)
    }
  }

  async function handleClearKey(): Promise<void> {
    setBusy(true)
    setError(null)
    setTestResult(null)
    try {
      await window.api.settings.clearApiKey()
      setSettings(await window.api.settings.get())
    } catch {
      setError('Der API-Key konnte nicht entfernt werden.')
    } finally {
      setBusy(false)
    }
  }

  async function handleTest(): Promise<void> {
    if (!settings) return
    setTesting(true)
    setTestResult(null)
    try {
      // Frisch eingetippter Key hat Vorrang, sonst wird der gespeicherte getestet.
      const result = await window.api.settings.testConnection(
        settings.model,
        apiKeyInput.trim() || undefined
      )
      setTestResult(result)
    } catch {
      setTestResult({ ok: false, message: 'Der Test konnte nicht ausgeführt werden.' })
    } finally {
      setTesting(false)
    }
  }

  if (!settings) {
    return (
      <main className="settings">
        <header className="view-header">
          <button className="btn ghost" onClick={onBack}>
            ← Übersicht
          </button>
          <h2>Einstellungen</h2>
        </header>
        <p className="muted">{error ?? 'Lade Einstellungen…'}</p>
      </main>
    )
  }

  const canTest = settings.hasApiKey || apiKeyInput.trim().length > 0

  return (
    <main className="settings">
      <header className="view-header">
        <button className="btn ghost" onClick={onBack}>
          ← Übersicht
        </button>
        <h2>Einstellungen</h2>
      </header>

      {error && <p className="error">{error}</p>}

      <section className="settings-section">
        <h3>Claude API-Key</h3>
        <p className="muted settings-hint">
          Dein Key wird verschlüsselt im Schlüsselbund deines Systems gespeichert –
          nie im Klartext.
        </p>
        <div className="settings-row">
          <input
            type="password"
            className="settings-input"
            placeholder={settings.hasApiKey ? '•••••••••• (gespeichert)' : 'sk-ant-…'}
            value={apiKeyInput}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => {
              setApiKeyInput(e.target.value)
              setTestResult(null)
            }}
          />
          <button
            className="btn primary"
            onClick={handleSaveKey}
            disabled={busy || apiKeyInput.trim().length === 0}
          >
            Speichern
          </button>
        </div>
        <div className="settings-actions">
          <button className="btn ghost" onClick={handleTest} disabled={testing || !canTest}>
            {testing ? 'Teste…' : 'Verbindung testen'}
          </button>
          {settings.hasApiKey && (
            <button className="btn ghost danger" onClick={handleClearKey} disabled={busy}>
              Key entfernen
            </button>
          )}
        </div>
        {testResult &&
          (testResult.ok ? (
            <p className="settings-status ok">✓ Verbindung erfolgreich.</p>
          ) : (
            <p className="settings-status fail">✗ {testResult.message}</p>
          ))}
      </section>

      <section className="settings-section">
        <h3>Modell</h3>
        <select
          className="settings-input"
          value={settings.model}
          onChange={(e) => patch({ model: e.target.value })}
        >
          {MODEL_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label} – {opt.hint}
            </option>
          ))}
        </select>
      </section>

      <section className="settings-section">
        <h3>Erklär-Niveau</h3>
        <select
          className="settings-input"
          value={settings.explanationLevel}
          onChange={(e) => patch({ explanationLevel: e.target.value as ExplanationLevel })}
        >
          {EXPLANATION_LEVEL_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </section>

    </main>
  )
}
