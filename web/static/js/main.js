document.addEventListener('DOMContentLoaded', () => {
    // Theme Management
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');
    
    // Set theme on load
    const currentTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);
    updateThemeIcon(currentTheme);

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            let theme = document.documentElement.getAttribute('data-theme');
            let newTheme = theme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            updateThemeIcon(newTheme);
        });
    }

    function updateThemeIcon(theme) {
        if (!themeIcon) return;
        themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }

    // Dashboard Specific Features
    const connectionBadge = document.getElementById('connection-badge');
    const badgeText = document.getElementById('badge-text');
    const serverUptime = document.getElementById('server-uptime');
    const deviceName = document.getElementById('device-name');
    const ipAddress = document.getElementById('ip-address');
    const serverTime = document.getElementById('server-time');
    const macAddress = document.getElementById('mac-address');

    // Polling System
    let pollInterval;
    function pollStatus() {
        fetch('/api/status')
            .then(response => {
                if (!response.ok) throw new Error('Network response not ok');
                return response.json();
            })
            .then(data => {
                // Update connection badge state
                if (connectionBadge) {
                    connectionBadge.className = 'status-badge badge-connected';
                    if (badgeText) badgeText.textContent = 'Connected';
                }
                
                // Update dashboard fields
                if (serverUptime) serverUptime.textContent = data.uptime;
                if (deviceName) deviceName.textContent = data.device_name;
                if (ipAddress) ipAddress.textContent = data.ip_address;
                if (serverTime) serverTime.textContent = data.current_time;
                if (macAddress) macAddress.textContent = data.mac_address;
            })
            .catch(error => {
                console.error('Error fetching server status:', error);
                // Update connection badge state to disconnected
                if (connectionBadge) {
                    connectionBadge.className = 'status-badge badge-disconnected';
                    if (badgeText) badgeText.textContent = 'Disconnected';
                }
            });
    }

    // Run polling if we are on the dashboard (indicated by existence of connectionBadge)
    if (connectionBadge) {
        pollStatus(); // initial poll
        pollInterval = setInterval(pollStatus, 3000); // poll every 3 seconds
    }

// Helper to show dynamic success overlay
    function showSuccess(icon, title, subtitle) {
        const successOverlay = document.getElementById('success-overlay');
        const successIcon = document.getElementById('success-icon');
        const successTitle = document.getElementById('success-title');
        const successSubtitle = document.getElementById('success-subtitle');

        if (successOverlay && successIcon && successTitle && successSubtitle) {
            successIcon.textContent = icon;
            successTitle.textContent = title;
            successSubtitle.textContent = subtitle;
            successOverlay.classList.add('active');

            setTimeout(() => {
                successOverlay.classList.remove('active');
            }, 3000);
        }
    }

    // Lock Screen Direct Actions (Single Tap)
    const lockBtn = document.getElementById('lock-btn');
    const shutdownBtn = document.getElementById('shutdown-btn');
    const sleepBtn = document.getElementById('sleep-btn');
    const wakeBtn = document.getElementById('wake-btn');

    if (lockBtn) {
        lockBtn.addEventListener('click', () => {
            const csrfTokenMeta = document.querySelector('meta[name="csrf-token"]');
            const csrfToken = csrfTokenMeta ? csrfTokenMeta.getAttribute('content') : '';

            lockBtn.disabled = true;
            const lockBtnText = lockBtn.querySelector('.lock-btn-text');
            const originalText = lockBtnText.textContent;
            lockBtnText.textContent = 'LOCKING...';

            fetch('/api/lock', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    showSuccess('✅', 'PC Locked Successfully', 'Returning to dashboard shortly...');
                    setTimeout(() => {
                        lockBtn.disabled = false;
                        lockBtnText.textContent = originalText;
                    }, 3000);
                } else {
                    alert('Error locking PC: ' + (data.message || 'Unknown error'));
                    lockBtn.disabled = false;
                    lockBtnText.textContent = originalText;
                }
            })
            .catch(error => {
                console.error('API Error:', error);
                alert('Failed to connect to server to lock PC.');
                lockBtn.disabled = false;
                lockBtnText.textContent = originalText;
            });
        });
    }

    if (shutdownBtn) {
        shutdownBtn.addEventListener('click', () => {
            const csrfTokenMeta = document.querySelector('meta[name="csrf-token"]');
            const csrfToken = csrfTokenMeta ? csrfTokenMeta.getAttribute('content') : '';

            shutdownBtn.disabled = true;
            const originalText = shutdownBtn.innerHTML;
            shutdownBtn.innerHTML = '<span class="power-icon">⏳</span><span class="power-text">Shutting...</span>';

            fetch('/api/shutdown', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    showSuccess('🔌', 'PC Shutdown Initiated', 'Your computer is shutting down now...');
                    setTimeout(() => {
                        shutdownBtn.disabled = false;
                        shutdownBtn.innerHTML = originalText;
                    }, 3000);
                } else {
                    alert('Error shutting down: ' + (data.message || 'Unknown error'));
                    shutdownBtn.disabled = false;
                    shutdownBtn.innerHTML = originalText;
                }
            })
            .catch(error => {
                console.error('API Error:', error);
                alert('Failed to connect to server to shut down PC.');
                shutdownBtn.disabled = false;
                shutdownBtn.innerHTML = originalText;
            });
        });
    }

    if (sleepBtn) {
        sleepBtn.addEventListener('click', () => {
            const csrfTokenMeta = document.querySelector('meta[name="csrf-token"]');
            const csrfToken = csrfTokenMeta ? csrfTokenMeta.getAttribute('content') : '';

            sleepBtn.disabled = true;
            const originalText = sleepBtn.innerHTML;
            sleepBtn.innerHTML = '<span class="power-icon">⏳</span><span class="power-text">Sleeping...</span>';

            fetch('/api/sleep', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    showSuccess('💤', 'PC Sleeping', 'Your computer is going to sleep...');
                    setTimeout(() => {
                        sleepBtn.disabled = false;
                        sleepBtn.innerHTML = originalText;
                    }, 3000);
                } else {
                    alert('Error putting PC to sleep: ' + (data.message || 'Unknown error'));
                    sleepBtn.disabled = false;
                    sleepBtn.innerHTML = originalText;
                }
            })
            .catch(error => {
                console.error('API Error:', error);
                alert('Failed to connect to server to put PC to sleep.');
                sleepBtn.disabled = false;
                sleepBtn.innerHTML = originalText;
            });
        });
    }

    if (wakeBtn) {
        wakeBtn.addEventListener('click', () => {
            const csrfTokenMeta = document.querySelector('meta[name="csrf-token"]');
            const csrfToken = csrfTokenMeta ? csrfTokenMeta.getAttribute('content') : '';

            wakeBtn.disabled = true;
            const originalText = wakeBtn.innerHTML;
            wakeBtn.innerHTML = '<span class="power-icon">⏳</span><span class="power-text">Waking...</span>';

            fetch('/api/wake', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    showSuccess('⚡', 'Wake Up Packet Sent', 'Wake-on-LAN magic packet sent successfully!');
                    setTimeout(() => {
                        wakeBtn.disabled = false;
                        wakeBtn.innerHTML = originalText;
                    }, 3000);
                } else {
                    alert('Error sending wake packet: ' + (data.message || 'Unknown error'));
                    wakeBtn.disabled = false;
                    wakeBtn.innerHTML = originalText;
                }
            })
            .catch(error => {
                console.error('API Error:', error);
                alert('Failed to connect to server to send wake packet.');
                wakeBtn.disabled = false;
                wakeBtn.innerHTML = originalText;
            });
        });
    }

});
