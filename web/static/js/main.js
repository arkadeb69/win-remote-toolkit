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

    // ==============================================================================
    // Landing Page Clock and Uptime System
    // ==============================================================================
    const landingCard = document.getElementById('landing-status-card');
    const landingServerTime = document.getElementById('landing-server-time');
    const landingServerUptime = document.getElementById('landing-server-uptime');

    if (landingCard && landingServerTime && landingServerUptime) {
        // Retrieve initial values injected by Flask
        const rawTimeStr = landingCard.getAttribute('data-server-time');
        let uptimeSeconds = parseInt(landingCard.getAttribute('data-uptime-seconds') || '0', 10);
        
        // Parse the ISO 8601 string
        let serverDate = rawTimeStr ? new Date(rawTimeStr) : new Date();

        function formatUptime(totalSeconds) {
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            
            const pad = (num) => String(num).padStart(2, '0');
            return `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
        }

        function formatServerTime(date) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const seconds = String(date.getSeconds()).padStart(2, '0');
            return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
        }

        // Set initial values
        landingServerTime.textContent = formatServerTime(serverDate);
        landingServerUptime.textContent = formatUptime(uptimeSeconds);

        // Update clock and uptime every second
        setInterval(() => {
            // Increment by 1 second (1000ms)
            serverDate.setSeconds(serverDate.getSeconds() + 1);
            uptimeSeconds += 1;

            landingServerTime.textContent = formatServerTime(serverDate);
            landingServerUptime.textContent = formatUptime(uptimeSeconds);
        }, 1000);
    }

    // ==============================================================================
    // Dashboard Specific Features (Polling & API Calls)
    // ==============================================================================
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

    // ==============================================================================
    // Automatic Live Status Detection
    // ==============================================================================
    const checkServerStatus = () => {
        let failureCount = 0;
        let isRedirecting = false;

        const performCheck = async () => {
            if (isRedirecting) return;

            try {
                const response = await fetch('https://lock.arkadeb.in', {
                    method: 'HEAD',
                    cache: 'no-store'
                });

                // Check for server-side gateway/tunnel errors indicating the laptop/server is offline
                if (!response.ok && [502, 503, 504, 530].includes(response.status)) {
                    isRedirecting = true;
                    window.location.href = 'https://lock.arkadeb.in';
                    return;
                }

                // If response was successful, reset consecutive failure count
                failureCount = 0;
            } catch (error) {
                // If a request fails (e.g. network/CORS error), increment failure count.
                // It will automatically retry in 5 seconds via the interval.
                // Do not display any JavaScript errors to the user.
                failureCount += 1;

                // If it fails consecutively (at least 2 failed attempts), trigger redirect
                if (failureCount >= 2) {
                    isRedirecting = true;
                    window.location.href = 'https://lock.arkadeb.in';
                }
            }
        };

        // Run checking every 5 seconds
        setInterval(performCheck, 5000);
    };

    checkServerStatus();

});

