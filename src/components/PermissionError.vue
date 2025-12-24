<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  error: string
}>()

const isPermissionError = computed(() =>
  props.error.toLowerCase().includes('not authorized') ||
  props.error.toLowerCase().includes('access denied') ||
  props.error.toLowerCase().includes('permission')
)
</script>

<template>
  <div class="permission-error">
    <div class="error-icon">🔒</div>

    <h2>Photos Access Required</h2>

    <p class="description">
      PhotoSpeak needs access to your Photos library to browse and display your images.
    </p>

    <div class="steps">
      <h3>How to grant access:</h3>
      <ol>
        <li>
          <span class="step-number">1</span>
          <div class="step-content">
            <strong>Open System Settings</strong>
            <p>Click the Apple menu  → System Settings</p>
          </div>
        </li>
        <li>
          <span class="step-number">2</span>
          <div class="step-content">
            <strong>Go to Privacy & Security</strong>
            <p>Scroll down in the sidebar and click "Privacy & Security"</p>
          </div>
        </li>
        <li>
          <span class="step-number">3</span>
          <div class="step-content">
            <strong>Select Photos</strong>
            <p>Find and click "Photos" in the list</p>
          </div>
        </li>
        <li>
          <span class="step-number">4</span>
          <div class="step-content">
            <strong>Enable PhotoSpeak / Electron</strong>
            <p>Toggle on access for "Electron" or "PhotoSpeak"</p>
          </div>
        </li>
        <li>
          <span class="step-number">5</span>
          <div class="step-content">
            <strong>Restart the app</strong>
            <p>Close and reopen PhotoSpeak for changes to take effect</p>
          </div>
        </li>
      </ol>
    </div>

    <div class="actions">
      <button class="open-settings-btn" @click="openSettings">
        Open System Settings
      </button>
      <button class="reload-btn" @click="reload">
        Reload App
      </button>
    </div>

    <details class="error-details">
      <summary>Technical details</summary>
      <code>{{ error }}</code>
    </details>
  </div>
</template>

<script lang="ts">
function openSettings() {
  window.electron.app.openPhotosSettings()
}

function reload() {
  window.electron.app.reload()
}
</script>

<style scoped>
.permission-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 40px;
  text-align: center;
  max-width: 600px;
  margin: 0 auto;
}

.error-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

h2 {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 12px;
}

.description {
  color: var(--text-secondary);
  font-size: 15px;
  margin-bottom: 32px;
  line-height: 1.5;
}

.steps {
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: 24px;
  text-align: left;
  width: 100%;
  margin-bottom: 24px;
}

.steps h3 {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 16px;
  color: var(--text-secondary);
}

.steps ol {
  list-style: none;
  padding: 0;
  margin: 0;
}

.steps li {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.steps li:last-child {
  margin-bottom: 0;
}

.step-number {
  width: 28px;
  height: 28px;
  background: var(--accent);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  flex-shrink: 0;
}

.step-content {
  flex: 1;
}

.step-content strong {
  display: block;
  font-size: 14px;
  margin-bottom: 4px;
}

.step-content p {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0;
}

.actions {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
}

.open-settings-btn {
  padding: 12px 24px;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.open-settings-btn:hover {
  background: #0066dd;
}

.reload-btn {
  padding: 12px 24px;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.reload-btn:hover {
  background: #4a4a4a;
}

.error-details {
  font-size: 12px;
  color: var(--text-secondary);
}

.error-details summary {
  cursor: pointer;
  margin-bottom: 8px;
}

.error-details code {
  display: block;
  background: var(--bg-tertiary);
  padding: 12px;
  border-radius: 6px;
  font-family: monospace;
  font-size: 11px;
  word-break: break-all;
  text-align: left;
}
</style>
