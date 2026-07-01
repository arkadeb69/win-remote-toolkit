# PC Remote Lock

A mobile-friendly Flask web application that allows you to lock, sleep, or shutdown your Windows PC from anywhere over the internet via Cloudflare Tunnels.

Tags: `windows-lock`, `remote-lock`, `flask-app`, `cloudflare-tunnel`, `python`, `win32-api`

## Features

- **Single-Tap Remote Actions**: Trigger system commands (Lock, Sleep, Shutdown) using native Windows APIs.
- **Access Anywhere**: Expose the local application safely to the internet using Cloudflare Tunnels without opening router ports.
- **Security Protections**: Access is protected using PBKDF2/scrypt password hashing and CSRF token verification.
- **Live Status Monitoring**: The control panel shows PC name, server uptime, local IP address, and server time.
- **Theme Support**: Live toggle between light and dark visual themes.

## Directory Structure

```text
Bluetooth Lock/
├── web/                     # Flask Web Application
│   ├── app.py               # Flask server and API endpoints
│   ├── static/              # CSS and JavaScript assets
│   │   ├── css/
│   │   │   └── style.css    # Layout and styling definitions
│   │   └── js/
│   │       └── main.js      # AJAX polling and theme handlers
│   └── templates/           # HTML views
│       ├── login.html
│       └── dashboard.html
│
├── config.json              # Web app security configuration (hashed password)
├── requirements.txt         # Package dependencies
├── start.vbs                # VBS script to launch the web app silently
└── README.md                # Project documentation
```

## Getting Started

### 1. Prerequisites
* Windows 10 or 11.
* Python 3.10+ installed. Make sure to check "Add Python to PATH" during installation.

### 2. Setup
1. Clone or download this repository.
2. Open your terminal (PowerShell or Command Prompt) in the repository root.
3. Install the dependencies:
   ```powershell
   pip install -r requirements.txt
   ```

### 3. Password Setup
1. Generate a secure hash in Python:
   ```powershell
   python -c "from werkzeug.security import generate_password_hash; print(generate_password_hash('your_password_here'))"
   ```
2. Create `config.json` in the root directory (using `config.json.example` as a template) and insert the generated hash into the `password_hash` field.

## How to Run

### Method 1: Console Mode (Visible Window)
Start the server in your active terminal:
```powershell
python web/app.py
```
Upon starting, the server will log the local IP address (e.g. `192.168.1.15`).

### Method 2: Background Mode (Silent)
Double-click **`start.vbs`** in your project folder. The server will launch silently in the background using the windowless Python launcher (`pyw.exe`). You won't see any command prompt windows.
*(To stop it, open Task Manager, locate `pythonw.exe`, and select **End Task**).*

---

## Deployment & Accessibility Options

### Option A: Local Network Access (Home Wi-Fi)
To access the web interface from your phone on the same Wi-Fi network:
1. Open port `5000` in Windows Defender Firewall:
   * Open **Windows Defender Firewall with Advanced Security**.
   * Go to **Inbound Rules** -> **New Rule...**
   * Select **Port** -> **TCP** -> Specific local ports: `5000`.
   * Select **Allow the connection**.
   * Name the rule (e.g. `PC Remote Lock Server`) and finish.
2. Open `http://<YOUR_PC_IP>:5000` in your phone's browser.

### Option B: Internet Access (Cloudflare Tunnels)
To securely control your PC from anywhere in the world without exposing your home IP address:
1. Register a domain name (or use a free domain) in Cloudflare.
2. Set up a **Cloudflare Tunnel** (`cloudflared`) on your PC.
3. Route your custom domain (e.g., `lock.yourdomain.com`) to the local port:
   * Service Type: `HTTP`
   * URL: `localhost:5000`
4. The web dashboard will now be securely accessible via HTTPS from any internet-connected device.
