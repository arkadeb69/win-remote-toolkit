import os
import sys
import time
import socket
import logging
import secrets
import json
import ctypes
import uuid
from datetime import datetime, timedelta
from flask import Flask, render_template, request, redirect, url_for, session, jsonify
from werkzeug.security import check_password_hash

def get_local_mac():
    """Retrieves the physical MAC address of the system."""
    try:
        # uuid.getnode() returns the MAC address as a 48-bit integer
        mac = uuid.getnode()
        # Format as AA:BB:CC:DD:EE:FF
        return ':'.join(('%012X' % mac)[i:i+2] for i in range(0, 12, 2))
    except Exception:
        return '00:00:00:00:00:00'


# Record server start time for uptime calculation
START_TIME = time.time()

# Setup logging
log_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "app.log")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(log_file, encoding="utf-8"),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("PCRemoteLock")

app = Flask(__name__)

# Load configurations
config_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "config.json")
try:
    with open(config_path, "r") as f:
        config = json.load(f)
except Exception as e:
    logger.critical(f"Failed to load config.json: {e}")
    sys.exit(1)

# Check if target_mac is set; if not, auto-detect and write back
if "target_mac" not in config or not config["target_mac"]:
    config["target_mac"] = get_local_mac()
    try:
        with open(config_path, "w") as f:
            json.dump(config, f, indent=4)
        logger.info(f"Auto-detected MAC address and saved to config: {config['target_mac']}")
    except Exception as e:
        logger.error(f"Failed to write auto-detected MAC back to config.json: {e}")

# Configure Flask app
app.secret_key = config.get("secret_key", secrets.token_hex(24))
session_timeout = config.get("session_timeout_minutes", 15)
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(minutes=session_timeout)

def get_local_ip():
    """Resolves the primary local network IP address of the server."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # Does not send actual packets; just routes local interface
        s.connect(("10.255.255.255", 1))
        ip = s.getsockname()[0]
    except Exception:
        ip = "127.0.0.1"
    finally:
        s.close()
    return ip

def get_uptime_string():
    """Formats the server uptime duration into a readable format."""
    delta = time.time() - START_TIME
    hours, remainder = divmod(int(delta), 3600)
    minutes, seconds = divmod(remainder, 60)
    return f"{hours:02d}h {minutes:02d}m {seconds:02d}s"

@app.before_request
def security_checks():
    """Initializes CSRF tokens, checks session timeout, and enforces authentication."""
    # Ensure CSRF token is initialized in the session
    if "csrf_token" not in session:
        session["csrf_token"] = secrets.token_hex(32)
        
    # Enforce session permanence for expiration tracking
    if session.get("logged_in"):
        session.permanent = True

    # 1. CSRF Verification for POST requests
    if request.method == "POST":
        # CSRF token can be passed in form payload or via custom header
        token = request.form.get("csrf_token") or request.headers.get("X-CSRF-Token")
        if not token or token != session.get("csrf_token"):
            logger.warning(f"CSRF violation blocked from IP: {request.remote_addr}")
            return jsonify({"error": "CSRF token validation failed."}), 400

    # 2. Authentication routing guards
    # Allow access to static assets and login endpoints without auth
    if request.endpoint not in ("login", "static") and not session.get("logged_in"):
        # For API requests, return a JSON error
        if request.path.startswith("/api/"):
            return jsonify({"error": "Session expired or unauthorized."}), 401
        # For browser requests, redirect to login page
        return redirect(url_for("login"))

@app.context_processor
def inject_csrf_token():
    """Injects the CSRF token into template rendering contexts."""
    return dict(csrf_token=session.get("csrf_token", ""))

# ==============================================================================
# Routes
# ==============================================================================

@app.route("/")
def index():
    if session.get("logged_in"):
        return redirect(url_for("dashboard"))
    return redirect(url_for("login"))

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        password = request.form.get("password")
        stored_hash = config.get("password_hash")
        
        if not password:
            return render_template("login.html", error="Password is required.")
            
        if check_password_hash(stored_hash, password):
            session.clear() # Clear any existing session elements (session fixation defense)
            session["logged_in"] = True
            session["csrf_token"] = secrets.token_hex(32)
            session.permanent = True
            logger.info(f"Successful login from IP: {request.remote_addr}")
            return redirect(url_for("dashboard"))
        else:
            logger.warning(f"Failed login attempt from IP: {request.remote_addr}")
            return render_template("login.html", error="Invalid password.")
            
    return render_template("login.html")

@app.route("/dashboard")
def dashboard():
    return render_template("dashboard.html")

@app.route("/logout", methods=["GET", "POST"])
def logout():
    logger.info(f"Session logged out for IP: {request.remote_addr}")
    session.clear()
    return redirect(url_for("login"))

# ==============================================================================
# API Endpoints
# ==============================================================================

@app.route("/api/status", methods=["GET"])
def api_status():
    """Returns real-time status details of the computer."""
    return jsonify({
        "status": "Running",
        "current_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "device_name": socket.gethostname(),
        "ip_address": get_local_ip(),
        "uptime": get_uptime_string(),
        "mac_address": config.get("target_mac", "00:00:00:00:00:00")
    })

@app.route("/api/lock", methods=["POST"])
def api_lock():
    """Triggers the native Windows LockWorkStation command."""
    logger.info(f"Lock PC command requested by IP: {request.remote_addr}")
    try:
        # Native Windows API Call
        # LockWorkStation locks the user's active session, showing the lock screen.
        # It operates securely inside the user's login session.
        result = ctypes.windll.user32.LockWorkStation()
        if result != 0:
            logger.info("PC lock executed successfully.")
            return jsonify({"status": "success", "message": "PC locked successfully."})
        else:
            # When result is 0, LockWorkStation failed
            error_code = ctypes.GetLastError()
            logger.error(f"LockWorkStation failed with error code: {error_code}")
            return jsonify({"status": "error", "message": f"LockWorkStation failed (code {error_code})."}), 500
    except Exception as e:
        logger.error(f"Failed to lock PC: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/api/shutdown", methods=["POST"])
def api_shutdown():
    """Triggers a forced system shutdown in 1 second."""
    logger.info(f"System shutdown requested by IP: {request.remote_addr}")
    try:
        # /s is shutdown, /t 1 is timer 1 second, /f is force running apps
        os.system("shutdown /s /t 1 /f")
        return jsonify({"status": "success", "message": "Shutdown sequence initiated."})
    except Exception as e:
        logger.error(f"Failed to execute shutdown: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/api/sleep", methods=["POST"])
def api_sleep():
    """Triggers native Windows sleep (suspend state)."""
    logger.info(f"System sleep requested by IP: {request.remote_addr}")
    try:
        # SetSuspendState(bHibernate=False, bForce=True, bWakeupEventsDisabled=False)
        # This puts the system into Standby (Sleep) and keeps Wakeup events enabled (needed for Wake-on-LAN)
        result = ctypes.windll.powrprof.SetSuspendState(0, 1, 0)
        if result != 0:
            logger.info("PC sleep executed successfully.")
            return jsonify({"status": "success", "message": "PC put to sleep successfully."})
        else:
            error_code = ctypes.GetLastError()
            logger.error(f"SetSuspendState failed with error code: {error_code}")
            return jsonify({"status": "error", "message": f"SetSuspendState failed (code {error_code})."}), 500
    except Exception as e:
        logger.error(f"Failed to put PC to sleep: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/api/wake", methods=["POST"])
def api_wake():
    """Sends a Wake-on-LAN magic packet to the target MAC address."""
    mac_addr = config.get("target_mac")
    if not mac_addr or mac_addr == "00:00:00:00:00:00":
        return jsonify({"status": "error", "message": "No valid target MAC address configured."}), 400
    
    logger.info(f"Wake-on-LAN magic packet requested for MAC: {mac_addr} by IP: {request.remote_addr}")
    try:
        # Clean MAC address representation
        mac_clean = mac_addr.replace(":", "").replace("-", "")
        if len(mac_clean) != 12:
            raise ValueError(f"Invalid MAC address format: {mac_addr}")
        
        # Create Magic Packet
        magic_packet = b'\xff' * 6 + bytes.fromhex(mac_clean) * 16
        
        # Send packet via UDP broadcast to port 9
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        sock.sendto(magic_packet, ("255.255.255.255", 9))
        sock.close()
        
        return jsonify({"status": "success", "message": f"Wake-on-LAN magic packet sent to {mac_addr}."})
    except Exception as e:
        logger.error(f"Failed to send Wake-on-LAN packet: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == "__main__":
    port = config.get("port", 5000)
    logger.info(f"PC Remote Lock backend starting on port {port}...")
    # Listen on 0.0.0.0 to enable local network accessibility
    app.run(host="0.0.0.0", port=port, debug=False)
