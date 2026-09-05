# Local Execution & Verification Guide: KhaataKitab

This document provides verified, reproducible instructions to set up, install, run, build, and test **KhaataKitab** locally.

---

## 1. System Requirements & Prerequisites

| Requirement | Value / Tested Specification | Status |
| :--- | :--- | :--- |
| **Node.js** | **v18+ (tested on Node v22.17.1)** | Compatible |
| **Package Manager** | **npm (v10.9.2) or bun** (repository includes `package-lock.json` and `bun.lock`) | Verified working with `npm` |
| **OS** | Windows, macOS, or Linux | Tested on Windows 11 (PowerShell) |
| **Java JDK (Android build only)** | **JDK 17 or JDK 21** (e.g. Android Studio JBR at `C:\Program Files\Android\Android Studio\jbr`) | Required only for native Android packaging |
| **Android SDK (Android build only)** | Android SDK 34 / 35 (e.g. `%LOCALAPPDATA%\Android\Sdk`) | Required only for native Android packaging |

---

## 2. Environment Variables (`.env`)

The project uses Vite environment variables prefixed with `VITE_`. A `.env` file exists at the workspace root:

```ini
VITE_SUPABASE_PROJECT_ID="your-project-id"
VITE_SUPABASE_PUBLISHABLE_KEY="your-supabase-publishable-key"
VITE_SUPABASE_URL="https://your-project-id.supabase.co"
```

### Is Supabase Required to Run?
* **No for Core Ledger / Offline Bookkeeping:** The entire ledger, transactions, inventory, category suggestions, and on-device Naive Bayes ML classifier run locally in the browser via **IndexedDB (Dexie.js)** and **localStorage**.
* **Yes for Cloud AI Features:** The AI Copilot chat (`/ai`), Gemini receipt scanning (`ScanReceiptDialog`), and remote categorization fallbacks require access to the Supabase Edge Functions URL specified in `VITE_SUPABASE_URL`.
* **Database Dependency:** There is **no remote PostgreSQL database requirement**; no tables exist in Supabase for this app.

---

## 3. Installation

From the project root directory:

```bash
npm install
```

*(Note: If using Bun on systems where `bun` is installed, `bun install` also works).*

---

## 4. Running the Web Application (Development Server)

Start the local development server:

```bash
npm run dev
```

* **Default URL:** `http://localhost:5173/`
* **Network URL:** Displayed in the terminal output (e.g., `http://<your-lan-ip>:5173/`)
* **Behavior:** Hot Module Replacement (HMR) is active via `@vitejs/plugin-react-swc`.

---

## 5. Production Build Verification

To compile and verify the production bundle:

```bash
npm run build
```

* **Output Directory:** `dist/`
* **Artifacts produced:**
  * `dist/index.html` (~2.5 kB)
  * `dist/assets/index-*.js` (~1.8 MB raw / ~550 kB gzip)
  * `dist/assets/index-*.css` (~82 kB raw / ~13 kB gzip)
  * `dist/assets/pdf.worker.min-*.mjs` (~1.2 MB for client-side PDF handling)
* **Previewing the production build locally:**
  ```bash
  npm run preview
  ```

---

## 6. Android / Capacitor Setup & Packaging

The repository contains an Android Capacitor project in `android/`.

### Step 6.1: Sync Web Assets to Native Android Container
After running `npm run build`:

```bash
npx cap sync android
```
This updates web assets into `android/app/src/main/assets/public/` and registers native plugins (`@capacitor/camera`).

### Step 6.2: Build Android Debug APK

Ensure `JAVA_HOME` points to a valid JDK (such as Android Studio's bundled JBR) and `ANDROID_HOME` points to your Android SDK:

**PowerShell (Windows):**
```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
cd android
.\gradlew.bat assembleDebug
```

**Bash (Linux / macOS):**
```bash
export JAVA_HOME="/path/to/jdk-17-or-21"
export ANDROID_HOME="$HOME/Android/Sdk"
cd android
./gradlew assembleDebug
```

### Step 6.3: Opening in Android Studio
To inspect and run on a connected Android device or emulator:
```bash
npx cap open android
```

---

## 7. Verification Findings & Technical Distinctions

During clean local verification:

1. **Web Dev Server (`npm run dev`):** Passed. Starts in ~400ms on port 5173 and serves HTTP 200 responses cleanly.
2. **Production Build (`npm run build`):** Passed. Successfully transforms 3,400+ modules and produces `dist/`. *(Note: Emits rollup warnings regarding chunk sizes and circular dynamic/static imports for ML modules, but compilation completes with exit code 0).*
3. **Capacitor Sync (`npx cap sync android`):** Passed. Copies assets and updates plugins in under 2s.
4. **Android Gradle Engine (`gradlew`):** Passed. Gradle 8.9 executes task graph successfully once standard `JAVA_HOME` and `ANDROID_HOME` paths are supplied.
5. **Real SMS & Cloud Sync Reality Check:**
   - **Environment vs. Bug:** The fact that SMS permissions and SMS sync operate on simulated demo data in web mode is an architectural limitation (Capacitor web fallback), not a build or runtime failure.
   - **Authentication:** Any email with a password of 6 or more characters is accepted immediately due to client-side localStorage authentication.
