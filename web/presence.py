import sys
import os
import json
import time
import signal
import atexit
import logging
from datetime import datetime
import threading

logger = logging.getLogger("PCRemoteLock.Presence")

# Resolve status.json path in the workspace root
STATUS_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "status.json")

def write_status(status_str):
    try:
        timestamp = datetime.now().astimezone().replace(microsecond=0).isoformat()
        data = {
            "status": status_str,
            "lastSeen": timestamp,
            "activity": "Working on laptop",
            "device": "Arkadeb's Laptop",
            "version": "1.0"
        }
        with open(STATUS_PATH, "w") as f:
            json.dump(data, f, indent=4)
        logger.debug(f"Presence updated: {status_str} at {timestamp}")
    except Exception as e:
        logger.error(f"Failed to write status.json: {e}")

def presence_daemon():
    while True:
        write_status("online")
        time.sleep(5)

# Signal handler
def handle_exit_signal(signum, frame):
    logger.info(f"Received exit signal {signum}. Writing offline status...")
    write_status("offline")
    sys.exit(0)

# ctypes Windows Window listener
def windows_message_listener():
    import ctypes
    from ctypes import wintypes

    # Load libraries
    user32 = ctypes.windll.user32
    kernel32 = ctypes.windll.kernel32

    # Win32 Constants
    WM_DESTROY = 0x0002
    WM_QUERYENDSESSION = 0x0011
    WM_ENDSESSION = 0x0016
    WM_POWERBROADCAST = 0x0218
    PBT_APMSUSPEND = 0x0004

    class_name = u"PCRemoteLockPresenceListener"

    # Define WNDPROC callback
    WNDPROC = ctypes.WINFUNCTYPE(ctypes.c_int64, wintypes.HWND, ctypes.c_uint, wintypes.WPARAM, wintypes.LPARAM)

    # Set up DefWindowProcW function signature to avoid 64-bit argument/return conversions overflow
    user32.DefWindowProcW.argtypes = [wintypes.HWND, ctypes.c_uint, wintypes.WPARAM, wintypes.LPARAM]
    user32.DefWindowProcW.restype = ctypes.c_int64

    # Set up PostQuitMessage signature
    user32.PostQuitMessage.argtypes = [ctypes.c_int]
    user32.PostQuitMessage.restype = None

    def wnd_proc(hwnd, msg, wparam, lparam):
        if msg == WM_QUERYENDSESSION or msg == WM_ENDSESSION:
            logger.info("Windows Session Ending / Shutdown detected. Saving offline state...")
            write_status("offline")
            return 1
        elif msg == WM_POWERBROADCAST:
            if wparam == PBT_APMSUSPEND:
                logger.info("Windows Suspend/Sleep detected. Saving offline state...")
                write_status("offline")
        elif msg == WM_DESTROY:
            user32.PostQuitMessage(0)
            return 0
        return user32.DefWindowProcW(hwnd, msg, wparam, lparam)

    # Keep a reference to prevent garbage collection
    global _wnd_proc_holder
    _wnd_proc_holder = WNDPROC(wnd_proc)

    h_instance = kernel32.GetModuleHandleW(None)

    # Register class
    class WNDCLASSEX(ctypes.Structure):
        _fields_ = [
            ("cbSize", ctypes.c_uint),
            ("style", ctypes.c_uint),
            ("lpfnWndProc", WNDPROC),
            ("cbClsExtra", ctypes.c_int),
            ("cbWndExtra", ctypes.c_int),
            ("hInstance", wintypes.HINSTANCE),
            ("hIcon", wintypes.HICON),
            ("hCursor", wintypes.HCURSOR),
            ("hbrBackground", wintypes.HBRUSH),
            ("lpszMenuName", wintypes.LPCWSTR),
            ("lpszClassName", wintypes.LPCWSTR),
            ("hIconSm", wintypes.HICON)
        ]

    wnd_class = WNDCLASSEX()
    wnd_class.cbSize = ctypes.sizeof(WNDCLASSEX)
    wnd_class.style = 0
    wnd_class.lpfnWndProc = _wnd_proc_holder
    wnd_class.cbClsExtra = 0
    wnd_class.cbWndExtra = 0
    wnd_class.hInstance = h_instance
    wnd_class.hIcon = 0
    wnd_class.hCursor = 0
    wnd_class.hbrBackground = 0
    wnd_class.lpszMenuName = None
    wnd_class.lpszClassName = class_name
    wnd_class.hIconSm = 0

    user32.RegisterClassExW.argtypes = [ctypes.POINTER(WNDCLASSEX)]
    user32.RegisterClassExW.restype = wintypes.ATOM

    if not user32.RegisterClassExW(ctypes.byref(wnd_class)):
        logger.error("Failed to register hidden listener window class")
        return

    # CreateWindowExW signature setup
    user32.CreateWindowExW.argtypes = [
        wintypes.DWORD, wintypes.LPCWSTR, wintypes.LPCWSTR, wintypes.DWORD,
        ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int,
        wintypes.HWND, wintypes.HMENU, wintypes.HINSTANCE, wintypes.LPVOID
    ]
    user32.CreateWindowExW.restype = wintypes.HWND

    # Create hidden window
    hwnd = user32.CreateWindowExW(
        0, class_name, u"PC Remote Lock Hidden Listener",
        0, 0, 0, 0, 0,
        None, None, h_instance, None
    )

    if not hwnd:
        logger.error("Failed to create hidden window")
        return

    logger.info("Hidden presence window listener started successfully.")

    # GetMessageW, TranslateMessage, DispatchMessageW signatures setup
    user32.GetMessageW.argtypes = [ctypes.POINTER(wintypes.MSG), wintypes.HWND, ctypes.c_uint, ctypes.c_uint]
    user32.GetMessageW.restype = wintypes.BOOL
    user32.TranslateMessage.argtypes = [ctypes.POINTER(wintypes.MSG)]
    user32.TranslateMessage.restype = wintypes.BOOL
    user32.DispatchMessageW.argtypes = [ctypes.POINTER(wintypes.MSG)]
    user32.DispatchMessageW.restype = ctypes.c_int64

    # Message loop
    msg = wintypes.MSG()
    while user32.GetMessageW(ctypes.byref(msg), None, 0, 0) != 0:
        user32.TranslateMessage(ctypes.byref(msg))
        user32.DispatchMessageW(ctypes.byref(msg))

def start_presence_system():
    # Write initial online state immediately
    write_status("online")

    # Start loop thread
    t = threading.Thread(target=presence_daemon, name="PresenceDaemon")
    t.daemon = True
    t.start()

    # Register exit handlers
    atexit.register(lambda: write_status("offline"))
    
    # Catch SIGINT (Ctrl+C) and SIGBREAK
    signal.signal(signal.SIGINT, handle_exit_signal)
    try:
        signal.signal(signal.SIGBREAK, handle_exit_signal)
    except AttributeError:
        pass # SIGBREAK is Windows only

    # Start hidden windows message listener in a background thread on Windows
    if os.name == 'nt':
        try:
            w_thread = threading.Thread(target=windows_message_listener, name="WindowsMessageListener")
            w_thread.daemon = True
            w_thread.start()
        except Exception as e:
            logger.error(f"Failed to start Windows message listener: {e}")
