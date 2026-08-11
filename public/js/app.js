document.addEventListener('DOMContentLoaded', () => {
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const chatMessages = document.getElementById('chat-messages');
    
    // AI Provider Selection Setup
    let preferredAIProvider = localStorage.getItem('kurukoo_preferred_ai_provider') || 'auto';
    const modelPills = document.querySelectorAll('.model-pill');
    
    function updateModelPillsUI() {
        modelPills.forEach(pill => {
            const prov = pill.getAttribute('data-provider');
            if (prov === preferredAIProvider) {
                pill.classList.add('active');
                pill.style.background = 'var(--terracotta)';
                pill.style.color = 'white';
                pill.style.borderColor = 'var(--terracotta)';
            } else {
                pill.classList.remove('active');
                pill.style.background = 'white';
                pill.style.color = '#555';
                pill.style.borderColor = 'rgba(217, 122, 92, 0.2)';
            }
        });
    }
    
    modelPills.forEach(pill => {
        pill.addEventListener('click', () => {
            const prov = pill.getAttribute('data-provider');
            preferredAIProvider = prov;
            localStorage.setItem('kurukoo_preferred_ai_provider', prov);
            updateModelPillsUI();
        });
    });
    
    // Initial call
    updateModelPillsUI();
    
    // UI Triggers
    const pwaDrawer = document.getElementById('pwa-drawer');
    const drawerHandle = document.getElementById('drawer-handle');
    const drawerBalance = document.getElementById('drawer-balance');
    const drawerActivity = document.getElementById('drawer-activity');
    const workToggle = document.getElementById('work-toggle');
    const langSelect = document.getElementById('lang-select');
    
    const reloadModal = document.getElementById('reload-modal');
    const openReloadBtn = document.getElementById('open-reload-btn');
    const closeReloadBtn = document.getElementById('close-reload-btn');
    
    const sosModal = document.getElementById('sos-modal');
    const sosTrigger = document.getElementById('sos-trigger');
    const closeSosBtn = document.getElementById('close-sos-btn');
    const emergencyContactsDiv = document.getElementById('emergency-contacts');
    
    const voiceTrigger = document.getElementById('voice-trigger');

    // Phone and Auth state (dynamic, stored in localStorage)
    let userPhone = localStorage.getItem('kurukoo_user_phone') || '';
    window.userCountry = 'ng';
    function getCurrencySymbol() {
        const c = window.userCountry || (userPhone && userPhone.startsWith('+44') ? 'gb' : userPhone && userPhone.startsWith('+233') ? 'gh' : 'ng');
        if (c === 'gb') return '£';
        if (c === 'gh') return 'GH₵';
        return '₦';
    }

    // Login Overlay Elements
    const loginOverlay = document.getElementById('login-overlay');
    const loginForm = document.getElementById('login-form');
    const loginPhone = document.getElementById('login-phone');
    const otpSection = document.getElementById('otp-section');
    const loginOtpInput = document.getElementById('login-otp');
    const verifyOtpBtn = document.getElementById('verify-otp-btn');
    
    let generatedOtp = '';

    // Check if phone number is saved, otherwise redirect to the actual login system
    if (!userPhone) {
        const pathParts = window.location.pathname.split('/');
        const countryContext = ['ng', 'gh', 'gb'].includes(pathParts[1]) ? pathParts[1] : 'ng';
        window.location.href = `/${countryContext}/login`;
        return;
    } else {
        if (loginOverlay) loginOverlay.style.display = 'none';
        initPWA();
    }

    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const phone = loginPhone.value.trim();
            if (!phone) return;
            
            // Validate basic phone format
            if (!/^\+?[0-9]{7,15}$/.test(phone.replace(/[\s-]/g, ''))) {
                alert('Please enter a valid phone number (e.g. +2348030000000)');
                return;
            }

            // CONFIRM-based OTP delivery simulation
            generatedOtp = String(Math.floor(1000 + Math.random() * 9000));
            const confirmed = confirm(`[SMS BRIDGE MOCK] Verification code is being sent to ${phone}.\n\nYour 4-digit code is: ${generatedOtp}\n\nClick OK to simulate SMS delivery and enter the code.`);
            
            if (confirmed) {
                if (otpSection) otpSection.style.display = 'flex';
                if (loginOtpInput) {
                    loginOtpInput.value = generatedOtp;
                    loginOtpInput.focus();
                }
            }
        });
    }

    if (verifyOtpBtn) {
        verifyOtpBtn.addEventListener('click', async () => {
            const enteredOtp = loginOtpInput.value.trim();
            if (enteredOtp === generatedOtp && enteredOtp !== '') {
                const phoneInput = loginPhone.value.trim().replace(/[\s-]/g, '');
                
                try {
                    const res = await fetch('/api/auth/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ phone: phoneInput })
                    });
                    const data = await res.json();
                    if (data.success) {
                        localStorage.setItem('kurukoo_user_phone', phoneInput);
                        localStorage.setItem('kurukoo_auth_token', data.token);
                        userPhone = phoneInput;
                        if (loginOverlay) loginOverlay.style.display = 'none';
                        initPWA();
                        alert('Successfully logged in!');
                    } else {
                        alert('Login failed: ' + (data.error || 'Unknown error'));
                    }
                } catch (e) {
                    console.error('Login error:', e);
                    alert('Network error during login');
                }
            } else {
                alert('Incorrect verification code. Please try again.');
            }
        });
    }

    // Global API Fetch helper
    async function apiFetch(url, options = {}) {
        const token = localStorage.getItem('kurukoo_auth_token');
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers,
        };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        return fetch(url, { ...options, headers });
    }

    // --- Collapsible ChatGPT-style Sidebar and Thread Manager ---
    let activeChatId = localStorage.getItem('kurukoo_active_chat_id') || 'default';
    
    // Seed default conversations if not present
    function getConversations() {
        let convs = localStorage.getItem(`kurukoo_convs_${userPhone}`);
        if (!convs) {
            convs = [
                { id: 'default', title: 'Current Conversation', icon: '💬' },
                { id: 'fcm-keep-alive', title: 'Keep-Alive Loophole', icon: '⚡' },
                { id: 'ride-booking', title: 'Request Okada Ride', icon: '🚗' },
                { id: 'plumber-task', title: 'Hire Plumber Ibadan', icon: '🔧' }
            ];
            localStorage.setItem(`kurukoo_convs_${userPhone}`, JSON.stringify(convs));
            
            // Seed messages for these conversations
            const seedMessages = {
                'fcm-keep-alive': [
                    { sender: 'bot', content: 'Welcome to Kurukoo Keep-Alive Simulator! I bypass Meta\'s 24-hour pricing window using free FCM push alerts to trigger user responses. Would you like to activate the loophole?', created_at: new Date(Date.now() - 3600000).toISOString() },
                    { sender: 'user', content: 'Yes, activate please.', created_at: new Date(Date.now() - 3000000).toISOString() },
                    { sender: 'bot', content: '🎉 Loophole Activated successfully! System registered. Keep-alive signal is broadcasting.', created_at: new Date(Date.now() - 2900000).toISOString() }
                ],
                'ride-booking': [
                    { sender: 'user', content: 'Request a standard ride near Ibadan', created_at: new Date(Date.now() - 7200000).toISOString() },
                    { sender: 'bot', content: 'Searching for local Okada riders and taxi drivers near you...', created_at: new Date(Date.now() - 7100000).toISOString(), card_data: JSON.stringify({ type: 'ride_picker', title: 'Select Ride Option', desc: 'Select standard or express delivery' }) }
                ],
                'plumber-task': [
                    { sender: 'user', content: 'Find a plumber', created_at: new Date(Date.now() - 14400000).toISOString() },
                    { sender: 'bot', content: 'I matched Chidi Plumber near Ring Road, Ibadan (Verified, available now). Score: 98 points.', created_at: new Date(Date.now() - 14300000).toISOString(), card_data: JSON.stringify({ type: 'job_dispatch', title: 'Chidi Plumber', desc: 'Plumbing & pipe repairs in Ibadan. Click accept to connect instantly.' }) }
                ]
            };
            for (const cid in seedMessages) {
                localStorage.setItem(`kurukoo_msgs_${userPhone}_${cid}`, JSON.stringify(seedMessages[cid]));
            }
        } else {
            try {
                convs = JSON.parse(convs);
            } catch (e) {
                convs = [
                    { id: 'default', title: 'Current Conversation', icon: '💬' }
                ];
            }
        }
        return convs;
    }

    function saveConversations(convs) {
        localStorage.setItem(`kurukoo_convs_${userPhone}`, JSON.stringify(convs));
    }

    function renderSidebarHistory() {
        const historyList = document.getElementById('history-list');
        if (!historyList) return;
        const convs = getConversations();
        historyList.innerHTML = '';

        convs.forEach(c => {
            const item = document.createElement('div');
            item.className = `history-item ${activeChatId === c.id ? 'active' : ''}`;
            item.setAttribute('data-chat-id', c.id);
            
            const icon = document.createElement('span');
            icon.className = 'history-item-icon';
            icon.textContent = c.icon || '💬';
            
            const title = document.createElement('span');
            title.className = 'history-item-title';
            
            // Clean up title: remove duplicate starting emoji/icon if present
            let itemTitle = c.title || '';
            if (c.icon && itemTitle.startsWith(c.icon)) {
                itemTitle = itemTitle.slice(c.icon.length).trim();
            }
            title.textContent = itemTitle;

            item.appendChild(icon);
            item.appendChild(title);

            // Allow deleting non-default chats
            if (c.id !== 'default') {
                const delBtn = document.createElement('span');
                delBtn.className = 'history-item-delete';
                delBtn.textContent = '✕';
                delBtn.title = 'Delete Chat';
                delBtn.onclick = (e) => {
                    e.stopPropagation();
                    if (confirm(`Are you sure you want to delete "${c.title}"?`)) {
                        deleteConversation(c.id);
                    }
                };
                item.appendChild(delBtn);
            }

            item.onclick = () => {
                selectConversation(c.id);
            };

            historyList.appendChild(item);
        });
    }

    function deleteConversation(cid) {
        let convs = getConversations();
        convs = convs.filter(c => c.id !== cid);
        saveConversations(convs);
        localStorage.removeItem(`kurukoo_msgs_${userPhone}_${cid}`);
        if (activeChatId === cid) {
            activeChatId = 'default';
            localStorage.setItem('kurukoo_active_chat_id', 'default');
        }
        renderSidebarHistory();
        loadMessages();
    }

    window.showDashboardView = function(viewId) {
        document.querySelectorAll('.dashboard-view').forEach(v => {
            v.style.display = 'none';
        });
        const targetView = document.getElementById(viewId);
        if (targetView) {
            targetView.style.display = 'flex';
        }
        
        // Remove active class from all footer items
        document.querySelectorAll('.sidebar-footer-item').forEach(b => {
            b.classList.remove('active');
        });
        
        // Remove active class from recent chats items
        if (viewId !== 'view-chat') {
            document.querySelectorAll('.history-item').forEach(item => {
                item.classList.remove('active');
            });
        } else {
            // Re-apply active class to current active chat item
            document.querySelectorAll('.history-item').forEach(item => {
                if (item.getAttribute('data-chat-id') === activeChatId) {
                    item.classList.add('active');
                } else {
                    item.classList.remove('active');
                }
            });
        }
        
        // Highlight corresponding button
        if (viewId === 'view-gateway') {
            document.getElementById('sidebar-gateway-btn')?.classList.add('active');
        } else if (viewId === 'view-devices') {
            document.getElementById('sidebar-devices-btn')?.classList.add('active');
        } else if (viewId === 'view-settings') {
            document.getElementById('sidebar-settings-btn')?.classList.add('active');
        }
    };

    function selectConversation(cid) {
        activeChatId = cid;
        localStorage.setItem('kurukoo_active_chat_id', cid);
        
        // On mobile, close sidebar on selection
        const sidebar = document.getElementById('dashboard-sidebar');
        const backdrop = document.getElementById('sidebar-backdrop');
        if (sidebar && window.innerWidth <= 768) {
            sidebar.classList.remove('open');
            backdrop.classList.remove('visible');
        }

        window.showDashboardView('view-chat');
        renderSidebarHistory();
        loadMessages();
    }

    function initSidebarControls() {
        const sidebar = document.getElementById('dashboard-sidebar');
        const backdrop = document.getElementById('sidebar-backdrop');
        const toggleDesktop = document.getElementById('sidebar-toggle-desktop');
        const toggleMobile = document.getElementById('sidebar-toggle-mobile');
        const toggleExpand = document.getElementById('sidebar-toggle-expand');
        const collapseFloating = document.getElementById('desktop-collapse-floating');
        
        const settingsBtn = document.getElementById('sidebar-settings-btn');
        const devicesBtn = document.getElementById('sidebar-devices-btn');
        const gatewayBtn = document.getElementById('sidebar-gateway-btn');
        const newChatBtn = document.getElementById('new-chat-btn');
        const sosTriggerTop = document.getElementById('sos-trigger-top');

        // Toggle Sidebar on Desktop (Collapse)
        if (toggleDesktop) {
            toggleDesktop.addEventListener('click', () => {
                sidebar.classList.add('collapsed');
                if (collapseFloating) collapseFloating.classList.add('visible');
            });
        }

        // Toggle Sidebar on Desktop (Expand)
        if (toggleExpand) {
            toggleExpand.addEventListener('click', () => {
                sidebar.classList.remove('collapsed');
                if (collapseFloating) collapseFloating.classList.remove('visible');
            });
        }

        // Toggle Sidebar on Mobile
        if (toggleMobile) {
            toggleMobile.addEventListener('click', () => {
                sidebar.classList.add('open');
                if (backdrop) backdrop.classList.add('visible');
            });
        }

        // Mobile Backdrop Close
        if (backdrop) {
            backdrop.addEventListener('click', () => {
                sidebar.classList.remove('open');
                backdrop.classList.remove('visible');
            });
        }

        // SOS Top Bar Button
        if (sosTriggerTop) {
            sosTriggerTop.addEventListener('click', () => {
                sosModal.classList.add('open');
                if (typeof loadEmergencyContacts === 'function') loadEmergencyContacts();
            });
        }

        // Footer settings clicks - swaps views in the main container!
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                window.showDashboardView('view-settings');
                if (window.innerWidth <= 768) {
                    sidebar.classList.remove('open');
                    backdrop.classList.remove('visible');
                }
            });
        }

        if (devicesBtn) {
            devicesBtn.addEventListener('click', () => {
                window.showDashboardView('view-devices');
                if (window.innerWidth <= 768) {
                    sidebar.classList.remove('open');
                    backdrop.classList.remove('visible');
                }
            });
        }

        if (gatewayBtn) {
            gatewayBtn.addEventListener('click', () => {
                window.showDashboardView('view-gateway');
                if (window.innerWidth <= 768) {
                    sidebar.classList.remove('open');
                    backdrop.classList.remove('visible');
                }
            });
        }

        // New Chat Button
        if (newChatBtn) {
            newChatBtn.addEventListener('click', () => {
                const newId = 'chat_' + Date.now();
                const convs = getConversations();
                convs.unshift({ id: newId, title: 'New Chat', icon: '💬' });
                saveConversations(convs);
                activeChatId = newId;
                localStorage.setItem('kurukoo_active_chat_id', newId);
                localStorage.setItem(`kurukoo_msgs_${userPhone}_${newId}`, JSON.stringify([]));
                window.showDashboardView('view-chat');
                renderSidebarHistory();
                loadMessages();
                if (window.innerWidth <= 768) {
                    sidebar.classList.remove('open');
                    backdrop.classList.remove('visible');
                }
            });
        }
    }

    async function initPWA() {
        const isConfigured = await updateProfile();
        initSidebarControls();
        renderSidebarHistory();
        loadMessages();
        loadEscrowOrders();
        if (typeof window.renderDevices === "function") window.renderDevices();
        
        // Auto-show correct view on initial load based on activeChatId
        if (activeChatId) {
            window.showDashboardView('view-chat');
        }
    }

    // --- Pull-down Drawer toggle ---
    if (drawerHandle) {
        drawerHandle.addEventListener('click', () => {
            pwaDrawer.classList.toggle('open');
        });
    }

    // --- Modals logic ---
    if (openReloadBtn) {
        openReloadBtn.addEventListener('click', () => {
            reloadModal.classList.add('open');
            pwaDrawer.classList.remove('open');
        });
    }
    const openReloadBtnNested = document.getElementById('open-reload-btn-nested');
    if (openReloadBtnNested) {
        openReloadBtnNested.addEventListener('click', () => {
            reloadModal.classList.add('open');
        });
    }
    if (closeReloadBtn) {
        closeReloadBtn.addEventListener('click', () => {
            reloadModal.classList.remove('open');
        });
    }

    if (sosTrigger) {
        sosTrigger.addEventListener('click', () => {
            sosModal.classList.add('open');
            if (typeof loadEmergencyContacts === 'function') loadEmergencyContacts();
        });
    }
    if (closeSosBtn) {
        closeSosBtn.addEventListener('click', () => {
            sosModal.classList.remove('open');
        });
    }

    // --- Load Profile / Wallet and update Account Panel ---
    async function updateProfile() {
        if (!userPhone) return;
        try {
            const res = await apiFetch(`/api/profile?phone=${encodeURIComponent(userPhone)}`);
            const data = await res.json();
            if (data?.profile) {
                window.appPhone = userPhone;
                const bal = data.profile.wallet_balance_minor;
                drawerBalance.textContent = `${bal} Points`;
                workToggle.checked = data.profile.is_available === 1;
                
                // Populate Drawer inputs with existing data
                const profileName = document.getElementById('profile-name');
                const profileLocation = document.getElementById('profile-location');
                const profileCountry = document.getElementById('profile-country');
                const wakeWordToggle = document.getElementById('wake-word-toggle');
                
                if (profileName) profileName.value = data.profile.name || '';
                if (profileLocation) profileLocation.value = data.profile.location || '';
                if (profileCountry) profileCountry.value = data.profile.country || 'ng';
                if (wakeWordToggle) {
                    wakeWordToggle.checked = localStorage.getItem('kurukoo_wakeword_' + userPhone) === 'true';
                }

                // Update Sidebar User Profile
                const sidebarName = document.getElementById('sidebar-username');
                const sidebarPhone = document.getElementById('sidebar-userphone');
                const sidebarLetter = document.getElementById('sidebar-avatar-letter');
                
                const displayName = data.profile.name || 'Kurukoo User';
                if (sidebarName) sidebarName.textContent = displayName;
                if (sidebarPhone) sidebarPhone.textContent = userPhone;
                if (sidebarLetter) sidebarLetter.textContent = displayName.charAt(0).toUpperCase();

                // Render dynamic skills tags
                const tagsDiv = document.getElementById('profile-skills-tags');
                if (tagsDiv && data.skills) {
                    tagsDiv.innerHTML = data.skills.map(s => `
                        <span class="skill-tag" style="display:inline-flex; align-items:center; gap:4px; font-size:11px; font-weight:600; padding:4px 8px; border-radius:12px; background:rgba(217, 122, 92, 0.1); color:var(--terracotta);">
                            ${s.skill}
                            <span style="cursor:pointer; font-weight:bold; color:red;" onclick="removeUserSkillFromDrawer('${s.skill.replace(/'/g, "\\'")}')">&times;</span>
                        </span>
                    `).join('');
                }

                // Render wallet balance
                const walletDiv = document.getElementById('drawer-wallet');
                if (walletDiv) {
                    const country = data.profile.country || 'ng';
                    window.userCountry = country;
                    const balMinor = data.profile.wallet_balance_minor || 0;
                    const sym = getCurrencySymbol();
                    if (country === 'gb') {
                        walletDiv.textContent = `${sym}${(balMinor / 500).toFixed(2)}`;
                    } else if (country === 'gh') {
                        walletDiv.textContent = `${sym}${(balMinor / 5).toFixed(2)}`;
                    } else {
                        walletDiv.textContent = `${sym}${(balMinor * 10).toLocaleString()}`;
                    }
                }
                
                // Add activity logs
                if (drawerActivity) {
                    drawerActivity.innerHTML = `
                        <div style="padding: 4px 0; border-bottom: 1px solid #eee;">Current Balance: <strong>${bal} Points</strong></div>
                        <div style="padding: 4px 0; border-bottom: 1px solid #eee;">Tier: <strong>${data.profile.subscription_tier}</strong> (${data.profile.country.toUpperCase()})</div>
                    `;
                }

                // Check contributor tasks
                if (data.profile.is_contributor === 1) {
                    const tPanel = document.getElementById('tasks-panel');
                    if (tPanel) tPanel.style.display = 'block';
                    const tList = document.getElementById('tasks-list');
                    if (tList) {
                        fetch(`/api/tasks?phone=${encodeURIComponent(userPhone)}`)
                            .then(r => r.json())
                            .then(tasks => {
                                tList.innerHTML = tasks.length === 0 ? '<div style="padding:4px 0;">No available tasks.</div>' : tasks.map(t => `
                                    <div style="padding:6px; border:1px solid #eee; border-radius:4px; margin-bottom:6px; background:#fcfcfc;">
                                        <strong>${t.title}</strong> - <span style="color:var(--terracotta);">${t.points_reward} Points</span><br>
                                        <span style="font-size:11px;">${t.description}</span><br>
                                        <button onclick="acceptTask(${t.id})" style="margin-top:4px; padding:4px 8px; font-size:11px; background:var(--electric-blue); color:white; border:none; border-radius:4px; cursor:pointer;">Accept Task</button>
                                    </div>
                                `).join('');
                            });
                    }
                }
                return data.profile.name && data.profile.name !== 'New User';
            }
            return false;
        } catch (e) {
            console.error('Error fetching profile:', e);
            return false;
        }
    }

    // Save Drawer Settings
    window.saveDrawerProfileSettings = async function() {
        const profileName = document.getElementById('profile-name');
        const profileLocation = document.getElementById('profile-location');
        const profileCountry = document.getElementById('profile-country');
        const wakeWordToggle = document.getElementById('wake-word-toggle');
        
        if (!profileName || !profileName.value.trim()) {
            alert('Name cannot be empty.');
            return;
        }
        if (!profileLocation || !profileLocation.value.trim()) {
            alert('Location cannot be empty.');
            return;
        }

        try {
            const res = await apiFetch('/api/profile/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: userPhone,
                    name: profileName.value.trim(),
                    location: profileLocation.value.trim(),
                    country: profileCountry ? profileCountry.value : 'ng'
                })
            });

            if (res.ok) {
                if (wakeWordToggle) {
                    localStorage.setItem('kurukoo_wakeword_' + userPhone, wakeWordToggle.checked ? 'true' : 'false');
                }
                alert('Account settings saved successfully!');
                await updateProfile();
            } else {
                alert('Failed to save settings.');
            }
        } catch (err) {
            console.error(err);
            alert('Failed to save settings.');
        }
    };

    // Add listed skill from Drawer
    window.addUserSkillFromDrawer = async function() {
        const addSkillInput = document.getElementById('add-skill-input');
        if (!addSkillInput || !addSkillInput.value.trim()) {
            alert('Please enter a skill name.');
            return;
        }
        const sk = addSkillInput.value.trim();

        try {
            const res = await apiFetch('/api/profile/skills/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: userPhone, skill: sk })
            });
            if (res.ok) {
                addSkillInput.value = '';
                await updateProfile();
            } else {
                alert('Error adding skill.');
            }
        } catch (err) {
            console.error(err);
        }
    };

    // Remove listed skill from Drawer
    window.removeUserSkillFromDrawer = async function(sk) {
        if (!confirm(`Are you sure you want to remove "${sk}" from your skills list?`)) return;
        try {
            const res = await apiFetch('/api/profile/skills/remove', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: userPhone, skill: sk })
            });
            if (res.ok) {
                await updateProfile();
            } else {
                alert('Error removing skill.');
            }
        } catch (err) {
            console.error(err);
        }
    };

    // Share contacts trigger
    window.shareWithContacts = function() {
        alert('Contacts permission granted! Scanning address book for Kurukoo verified providers...');
        setTimeout(async () => {
            const res = await fetch('/api/points/topup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: userPhone, amount: 10 })
            });
            if (res.ok) {
                alert('🎉 Contact sync complete! +10 Points awarded to your balance.');
                await updateProfile();
            }
        }, 1500);
    };

    // Logout function
    window.logoutPWA = function() {
        if (!confirm('Are you sure you want to log out of Kurukoo?')) return;
        localStorage.removeItem('kurukoo_user_phone');
        window.location.reload();
    };

    window.acceptTask = async function(taskId) {
        try {
            await fetch('/api/tasks/accept', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: userPhone, taskId })
            });
            alert('Task accepted! Check your chat thread for instructions.');
            updateProfile();
            setTimeout(() => {
                fetch('/api/tasks/complete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone: userPhone, taskId, result: 'Completed successfully.' })
                }).then(r => r.json()).then(res => {
                    if (res.success) {
                        appendMessage('assistant', `Task #${taskId} completed. You earned ${res.reward} Points!`);
                        updateProfile();
                    }
                });
            }, 5000);
        } catch (e) {
            console.error(e);
        }
    };

    // Work availability toggle handler
    if (workToggle) {
        workToggle.addEventListener('change', async () => {
            try {
                await apiFetch('/api/profile/availability', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone: userPhone, is_available: workToggle.checked ? 1 : 0 })
                });
                await updateProfile();
            } catch (e) {
                console.error('Failed to toggle availability:', e);
            }
        });
    }

    // Emergency contacts loader
    async function loadEmergencyContacts() {
        try {
            emergencyContactsDiv.innerHTML = '<div style="font-size:13px; color:#555;">Querying emergency pipeline...</div>';
            const res = await fetch(`/api/emergency?phone=${encodeURIComponent(userPhone)}`);
            const data = await res.json();
            if (data?.contacts && data.contacts.length > 0) {
                emergencyContactsDiv.innerHTML = data.contacts.map(c => `
                    <div style="display:flex; justify-content:space-between; align-items:center; background:#FFF5F5; padding:8px 12px; border-radius:6px; border:1px solid #FAD2D2;">
                        <div>
                            <strong style="color:var(--danger-red); font-size:13px;">${c.name}</strong>
                        </div>
                        <a href="tel:${c.phone}" style="background:var(--danger-red); color:white; text-decoration:none; padding:4px 10px; border-radius:4px; font-weight:bold; font-size:12px;">CALL ${c.phone}</a>
                    </div>
                `).join('');
            } else {
                emergencyContactsDiv.innerHTML = '<div style="font-size:13px; color:#555;">No local emergency responders found. Dial 112 / 999.</div>';
            }
        } catch (e) {
            console.error('Error loading emergency contacts:', e);
            emergencyContactsDiv.innerHTML = '<div style="font-size:13px; color:red;">Failed to connect to local emergency services. Dial 112 / 999.</div>';
        }
    }

    // Reload balance pack helper
    window.topupPoints = async (amount) => {
        try {
            const res = await fetch('/api/points/topup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: userPhone, amount })
            });
            const result = await res.json();
            if (result.success) {
                reloadModal.classList.remove('open');
                alert(`Successfully topped up ${amount} Points!`);
                await updateProfile();
            }
        } catch (e) {
            console.error('Error topping up:', e);
        }
    };

    // 7. Load & Render messages history with interactive cards
    async function loadMessages() {
        try {
            let messages = [];
            if (activeChatId === 'default') {
                const res = await fetch(`/api/messages?phone=${encodeURIComponent(userPhone)}`);
                messages = await res.json();
            } else {
                const stored = localStorage.getItem(`kurukoo_msgs_${userPhone}_${activeChatId}`);
                messages = stored ? JSON.parse(stored) : [];
            }
            
            chatMessages.innerHTML = '';
            
            messages.forEach(m => {
                const bubble = document.createElement('div');
                bubble.className = `message-bubble ${m.sender === 'user' ? 'user' : 'bot'}`;
                
                const senderLabel = document.createElement('span');
                senderLabel.className = 'message-sender';
                senderLabel.style.fontSize = '0.65rem';
                senderLabel.style.fontWeight = '800';
                senderLabel.style.display = 'block';
                senderLabel.style.marginBottom = '2px';
                senderLabel.style.opacity = '0.8';
                senderLabel.textContent = m.sender === 'user' ? 'You' : m.sender === 'SUPPORT' ? 'Support' : 'Kurukoo Agent';
                bubble.appendChild(senderLabel);

                const contentText = document.createElement('div');
                contentText.textContent = m.content;
                bubble.appendChild(contentText);

                // Inline card rendering if card_data exists
                if (m.card_data) {
                    try {
                        const cardData = typeof m.card_data === 'string' ? JSON.parse(m.card_data) : m.card_data;
                        const card = renderInlineCard(cardData);
                        if (card) bubble.appendChild(card);
                    } catch (e) {
                        console.error('Failed parsing card data:', e);
                    }
                }

                // Add timestamp safely
                if (m.created_at) {
                    const date = new Date(m.created_at);
                    if (!isNaN(date.getTime())) {
                        const ts = document.createElement('span');
                        ts.className = 'message-timestamp';
                        ts.textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        bubble.appendChild(ts);
                    }
                }

                chatMessages.appendChild(bubble);
            });
            
            chatMessages.scrollTop = chatMessages.scrollHeight;
        } catch (e) {
            console.error('Failed to load messages', e);
        }
    }

    // Render interactive inline card structures based on context
    function renderInlineCard(card) {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'inline-card';

        if (card.type === 'autonomous_agent_state') {
            cardDiv.style.background = '#f8fafc';
            cardDiv.style.borderLeft = '4px solid #f97316';
            cardDiv.style.padding = '12px';
            cardDiv.style.borderRadius = '8px';
            cardDiv.style.boxShadow = 'inset 0 1px 3px rgba(0,0,0,0.05)';
            cardDiv.style.marginTop = '6px';

            if (card.thoughts) {
                const thoughtEl = document.createElement('div');
                thoughtEl.style.fontSize = '0.8rem';
                thoughtEl.style.fontStyle = 'italic';
                thoughtEl.style.color = '#475569';
                thoughtEl.style.background = '#f1f5f9';
                thoughtEl.style.padding = '10px';
                thoughtEl.style.borderRadius = '6px';
                thoughtEl.style.marginBottom = '8px';
                thoughtEl.style.border = '1px solid #e2e8f0';
                thoughtEl.innerHTML = `🧠 <strong>Thinking process:</strong><br>${card.thoughts}`;
                cardDiv.appendChild(thoughtEl);
            }

            const detailsEl = document.createElement('div');
            detailsEl.style.fontSize = '0.85rem';
            detailsEl.style.fontWeight = '500';
            detailsEl.style.color = '#1e293b';
            detailsEl.style.marginBottom = '8px';
            detailsEl.innerHTML = `🎯 <strong>Agent Category Match:</strong> ${card.category ? card.category.toUpperCase() : 'UNKNOWN'}`;
            if (card.selectedType) {
                detailsEl.innerHTML += `<br>✨ <strong>Selected Option:</strong> ${card.selectedType}`;
            }
            cardDiv.appendChild(detailsEl);

            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'inline-card-actions';

            if (!card.hasAllDetails) {
                let options = [];
                if (card.category === 'ride') {
                    options = ['🏍️ Okada', '🛺 Keke', '🚗 Taxi / Car'];
                } else if (card.category === 'food') {
                    options = ['🍲 Suya & Masa', '🍚 Rice & Yam Bundle', '🍢 Caterer Platter'];
                } else if (card.category === 'artisan') {
                    options = ['🔧 Mobile Mechanic', '🛡️ Event Security', '🇬🇧 Electricity Bill'];
                }

                options.forEach(opt => {
                    const btn = document.createElement('button');
                    btn.className = 'btn-card';
                    btn.textContent = opt;
                    btn.onclick = () => submitInlineMessage(opt);
                    actionsDiv.appendChild(btn);
                });
            } else {
                const statusEl = document.createElement('div');
                statusEl.style.color = '#10b981';
                statusEl.style.fontSize = '0.8rem';
                statusEl.style.fontWeight = '700';
                statusEl.style.marginTop = '4px';
                statusEl.innerHTML = `⚡ Launching Kurukoo autonomous matching engine... Agent fully synchronized!`;
                cardDiv.appendChild(statusEl);
            }

            if (actionsDiv.hasChildNodes()) {
                cardDiv.appendChild(actionsDiv);
            }

            return cardDiv;
        }

        // Check for product image
        if (card.image || card.type === 'product_card' || card.type === 'affiliate_card') {
            const img = document.createElement('img');
            img.className = 'card-thumbnail';
            img.src = card.image || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=400';
            img.alt = card.title || 'Product Image';
            img.onclick = () => {
                // Simple inline expand effect
                if (img.style.maxHeight === 'none') {
                    img.style.maxHeight = '140px';
                } else {
                    img.style.maxHeight = 'none';
                }
            };
            cardDiv.appendChild(img);
        }

        const title = document.createElement('div');
        title.className = 'inline-card-header';
        title.textContent = card.title || 'Interactive Option';
        cardDiv.appendChild(title);

        if (card.desc) {
            const desc = document.createElement('div');
            desc.className = 'inline-card-body';
            desc.textContent = card.desc;
            cardDiv.appendChild(desc);
        }

        const cur = getCurrencySymbol();
        // Add metadata like source and price
        if (card.type === 'product_card') {
            const src = document.createElement('div');
            src.className = 'card-source';
            src.textContent = `Local · ${card.providerName || 'Verified Supplier'}`;
            cardDiv.appendChild(src);

            const prc = document.createElement('div');
            prc.className = 'card-price';
            let pText = card.price || (cur === '£' ? '£25.00' : cur === 'GH₵' ? 'GH₵250' : '₦30,000');
            if (cur === '£') pText = pText.replace('₦', '£').replace('GH₵', '£');
            else if (cur === 'GH₵') pText = pText.replace('₦', 'GH₵').replace('£', 'GH₵');
            prc.textContent = pText;
            cardDiv.appendChild(prc);
        } else if (card.type === 'affiliate_card') {
            const src = document.createElement('div');
            src.className = 'card-source';
            src.textContent = `via ${card.platformName || 'Jumia'}`;
            cardDiv.appendChild(src);

            const prc = document.createElement('div');
            prc.className = 'card-price';
            let pText = card.price || (cur === '£' ? '£20.00' : cur === 'GH₵' ? 'GH₵200' : '₦25,000');
            if (cur === '£') pText = pText.replace('₦', '£').replace('GH₵', '£');
            else if (cur === 'GH₵') pText = pText.replace('₦', 'GH₵').replace('£', 'GH₵');
            prc.textContent = pText;
            cardDiv.appendChild(prc);
        } else if (card.type === 'arbitrage_deal') {
            const prc = document.createElement('div');
            prc.className = 'card-price';
            prc.style.color = 'var(--electric-blue)';
            let bPrice = card.buyPrice || (cur === '£' ? '£10.00' : cur === 'GH₵' ? 'GH₵100' : '₦10,000');
            let sPrice = card.sellPrice || (cur === '£' ? '£15.00' : cur === 'GH₵' ? 'GH₵150' : '₦15,000');
            let profit = card.profit || (cur === '£' ? '£5.00' : cur === 'GH₵' ? 'GH₵50' : '₦5,000');
            if (cur === '£') {
                bPrice = bPrice.replace('₦', '£').replace('GH₵', '£');
                sPrice = sPrice.replace('₦', '£').replace('GH₵', '£');
                profit = profit.replace('₦', '£').replace('GH₵', '£');
            } else if (cur === 'GH₵') {
                bPrice = bPrice.replace('₦', 'GH₵').replace('£', 'GH₵');
                sPrice = sPrice.replace('₦', 'GH₵').replace('£', 'GH₵');
                profit = profit.replace('₦', 'GH₵').replace('£', 'GH₵');
            }
            prc.textContent = `Buy: ${bPrice} | Sell: ${sPrice} (Profit: +${profit})`;
            cardDiv.appendChild(prc);
        }

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'inline-card-actions';

        if (card.type === 'ride_picker') {
            const rideOpts = cur === '£' 
                ? ['Standard Ride (£5)', 'Executive (£12)', 'Bicycle Delivery (£3)'] 
                : cur === 'GH₵' 
                ? ['Okada (GH₵15)', 'Keke (GH₵25)', 'Taxi / Car (GH₵80)', 'Bicycle (GH₵10)'] 
                : ['Okada (₦500)', 'Keke (₦800)', 'Taxi / Car (₦2,000)', 'Bicycle Delivery (₦300)'];
            rideOpts.forEach(opt => {
                const btn = document.createElement('button');
                btn.className = 'btn-card';
                btn.textContent = opt;
                btn.onclick = () => submitInlineMessage(`I request a ride: ${opt}`);
                actionsDiv.appendChild(btn);
            });
        } else if (card.type === 'pulse_toggle') {
            const btnGoLive = document.createElement('button');
            btnGoLive.className = 'btn-card primary';
            btnGoLive.textContent = 'Go Live (Deduct 5 Points)';
            btnGoLive.onclick = async () => {
                const res = await fetch('/api/pulse/activate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone: userPhone, skill: 'service_provider', lat: 7.3775, lng: 3.9470 })
                });
                const result = await res.json();
                alert(result.message);
                await updateProfile();
                await loadMessages();
            };
            actionsDiv.appendChild(btnGoLive);
        } else if (card.type === 'survey') {
            const btnYes = document.createElement('button');
            btnYes.className = 'btn-card primary';
            btnYes.textContent = 'Yes';
            btnYes.onclick = async () => {
                try {
                    btnYes.disabled = true;
                    btnNo.disabled = true;
                    btnYes.textContent = 'Thanks!';
                    await fetch('/api/survey/response', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ phone: userPhone, question: card.question || card.title || 'Survey Question', answer: 'Yes' })
                    });
                    alert('🎉 Survey response submitted successfully! +1 Point has been awarded to your balance.');
                    await submitInlineMessage('Yes');
                } catch (err) {
                    console.error(err);
                    await submitInlineMessage('Yes');
                }
            };
            
            const btnNo = document.createElement('button');
            btnNo.className = 'btn-card';
            btnNo.textContent = 'No';
            btnNo.onclick = async () => {
                try {
                    btnYes.disabled = true;
                    btnNo.disabled = true;
                    btnNo.textContent = 'Thanks!';
                    await fetch('/api/survey/response', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ phone: userPhone, question: card.question || card.title || 'Survey Question', answer: 'No' })
                    });
                    alert('🎉 Survey response submitted successfully! +1 Point has been awarded to your balance.');
                    await submitInlineMessage('No');
                } catch (err) {
                    console.error(err);
                    await submitInlineMessage('No');
                }
            };
            
            actionsDiv.appendChild(btnYes);
            actionsDiv.appendChild(btnNo);
        } else if (card.type === 'job_dispatch' || card.type === 'arbitrage_deal') {
            const btnAccept = document.createElement('button');
            btnAccept.className = 'btn-card primary';
            btnAccept.textContent = card.type === 'arbitrage_deal' ? 'Accept Trade' : 'Accept Job & Start WebRTC';
            btnAccept.onclick = async () => {
                const roomId = `room-${Math.floor(1000 + Math.random() * 9000)}`;
                try {
                    await fetch('/api/webrtc/create', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ roomId, phone: userPhone })
                    });
                } catch (err) {
                    console.error('Signaling error:', err);
                }
                if (window.openWebRTCOverlay) {
                    window.openWebRTCOverlay(roomId);
                }
                await submitInlineMessage(`I accept this job. (Connecting WebRTC Room: ${roomId})`);
            };
            
            const btnDecline = document.createElement('button');
            btnDecline.className = 'btn-card';
            btnDecline.textContent = 'Decline';
            btnDecline.onclick = () => submitInlineMessage('Decline Offer');
            
            actionsDiv.appendChild(btnAccept);
            actionsDiv.appendChild(btnDecline);
        } else if (card.type === 'product_card') {
            const btnOrder = document.createElement('button');
            btnOrder.className = 'btn-card primary';
            btnOrder.textContent = `Order Now`;
            btnOrder.onclick = () => submitInlineMessage(`Confirm Order: ${card.title}`);
            actionsDiv.appendChild(btnOrder);
        } else if (card.type === 'affiliate_card') {
            const btnBuy = document.createElement('button');
            btnBuy.className = 'btn-card primary';
            btnBuy.textContent = `Buy on ${card.platformName || 'Jumia'}`;
            btnBuy.onclick = () => {
                window.open(card.url || 'https://jumia.com.ng', '_blank');
                submitInlineMessage(`Opened affiliate link for ${card.title}`);
            };
            actionsDiv.appendChild(btnBuy);
        } else if (card.actions) {
            card.actions.forEach(act => {
                const btn = document.createElement('button');
                btn.className = 'btn-card';
                btn.textContent = act.label;
                btn.onclick = () => submitInlineMessage(act.text);
                actionsDiv.appendChild(btn);
            });
        }

        if (actionsDiv.hasChildNodes()) {
            cardDiv.appendChild(actionsDiv);
        }

        return cardDiv;
    }

    // Helper to send inline responses easily
    async function submitInlineMessage(text) {
        if (!text) return;
        
        if (activeChatId !== 'default') {
            const stored = localStorage.getItem(`kurukoo_msgs_${userPhone}_${activeChatId}`);
            const currentMsgs = stored ? JSON.parse(stored) : [];
            currentMsgs.push({
                sender: 'user',
                content: text,
                created_at: new Date().toISOString()
            });
            localStorage.setItem(`kurukoo_msgs_${userPhone}_${activeChatId}`, JSON.stringify(currentMsgs));
        }

        const recipient = localStorage.getItem('kurukoo_support_recipient');
        await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                phone: userPhone, 
                message: text, 
                channel: 'pwa', 
                recipient: recipient || undefined,
                provider: preferredAIProvider
            })
        });
        await updateProfile();

        if (activeChatId !== 'default') {
            try {
                const res = await fetch(`/api/messages?phone=${encodeURIComponent(userPhone)}`);
                const dbMessages = await res.json();
                if (dbMessages && dbMessages.length > 0) {
                    const lastAssistantMsg = [...dbMessages].reverse().find(m => m.sender !== 'user');
                    if (lastAssistantMsg) {
                        const stored = localStorage.getItem(`kurukoo_msgs_${userPhone}_${activeChatId}`);
                        const currentMsgs = stored ? JSON.parse(stored) : [];
                        if (currentMsgs.length === 0 || currentMsgs[currentMsgs.length - 1].content !== lastAssistantMsg.content) {
                            currentMsgs.push({
                                sender: lastAssistantMsg.sender === 'SUPPORT' ? 'SUPPORT' : 'bot',
                                content: lastAssistantMsg.content,
                                card_data: lastAssistantMsg.card_data,
                                created_at: lastAssistantMsg.created_at || new Date().toISOString()
                            });
                            localStorage.setItem(`kurukoo_msgs_${userPhone}_${activeChatId}`, JSON.stringify(currentMsgs));
                        }
                    }
                }
            } catch (e) {
                console.error('Failed to sync inline response to custom thread:', e);
            }
        }

        await loadMessages();
    }

    // 8. Chat message form submit
    if (chatForm) {
        chatForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const text = chatInput.value.trim();
            if (!text) return;
            chatInput.value = '';

            // Handle leaving Support Chat
            if (text.toLowerCase() === 'exit' || text.toLowerCase() === 'exit support' || text.toLowerCase() === 'reset') {
                localStorage.removeItem('kurukoo_support_recipient');
                alert('Left support session. Returned to main Kurukoo Agent.');
                await loadMessages();
                return;
            }

            // Optimistic rendering
            const userBubble = document.createElement('div');
            userBubble.className = 'message-bubble user';
            const now = new Date();
            const sender = document.createElement('span');
            sender.className = 'message-sender';
            sender.style.fontSize = '0.65rem';
            sender.style.fontWeight = '800';
            sender.style.display = 'block';
            sender.style.marginBottom = '2px';
            sender.style.opacity = '0.8';
            sender.textContent = 'You';
            const content = document.createElement('div');
            content.textContent = text;
            const timestamp = document.createElement('span');
            timestamp.className = 'message-timestamp';
            timestamp.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            userBubble.append(sender, content, timestamp);
            chatMessages.appendChild(userBubble);
            chatMessages.scrollTop = chatMessages.scrollHeight;

            if (activeChatId !== 'default') {
                const stored = localStorage.getItem(`kurukoo_msgs_${userPhone}_${activeChatId}`);
                const currentMsgs = stored ? JSON.parse(stored) : [];
                currentMsgs.push({
                    sender: 'user',
                    content: text,
                    created_at: new Date().toISOString()
                });
                localStorage.setItem(`kurukoo_msgs_${userPhone}_${activeChatId}`, JSON.stringify(currentMsgs));
                
                // Rename chat title if it's currently "New Chat"
                let convs = getConversations();
                const matchedConv = convs.find(c => c.id === activeChatId);
                if (matchedConv && matchedConv.title === 'New Chat') {
                    matchedConv.title = text.length > 25 ? text.substring(0, 22) + '...' : text;
                    if (text.toLowerCase().includes('ride') || text.toLowerCase().includes('book')) matchedConv.icon = '🚗';
                    else if (text.toLowerCase().includes('plumber') || text.toLowerCase().includes('repair')) matchedConv.icon = '🔧';
                    else if (text.toLowerCase().includes('loophole') || text.toLowerCase().includes('keep-alive')) matchedConv.icon = '⚡';
                    else matchedConv.icon = '💬';
                    
                    saveConversations(convs);
                    renderSidebarHistory();
                }
            }

            const recipient = localStorage.getItem('kurukoo_support_recipient');

            await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    phone: userPhone, 
                    message: text, 
                    channel: 'pwa', 
                    recipient: recipient || undefined,
                    provider: preferredAIProvider
                })
            });

            await updateProfile();
            
            if (activeChatId !== 'default') {
                try {
                    const res = await fetch(`/api/messages?phone=${encodeURIComponent(userPhone)}`);
                    const dbMessages = await res.json();
                    if (dbMessages && dbMessages.length > 0) {
                        const lastAssistantMsg = [...dbMessages].reverse().find(m => m.sender !== 'user');
                        if (lastAssistantMsg) {
                            const stored = localStorage.getItem(`kurukoo_msgs_${userPhone}_${activeChatId}`);
                            const currentMsgs = stored ? JSON.parse(stored) : [];
                            if (currentMsgs.length === 0 || currentMsgs[currentMsgs.length - 1].content !== lastAssistantMsg.content) {
                                currentMsgs.push({
                                    sender: lastAssistantMsg.sender === 'SUPPORT' ? 'SUPPORT' : 'bot',
                                    content: lastAssistantMsg.content,
                                    card_data: lastAssistantMsg.card_data,
                                    created_at: lastAssistantMsg.created_at || new Date().toISOString()
                                });
                                localStorage.setItem(`kurukoo_msgs_${userPhone}_${activeChatId}`, JSON.stringify(currentMsgs));
                            }
                        }
                    }
                } catch (e) {
                    console.error('Failed to sync assistant reply to custom thread:', e);
                }
            }
            
            await loadMessages();
        });
    }

    // 9. Voice Input Integration (Web Speech API)
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition && voiceTrigger) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.lang = 'en-US';
        recognition.interimResults = false;

        voiceTrigger.addEventListener('click', () => {
            if (voiceTrigger.classList.contains('listening')) {
                recognition.stop();
            } else {
                voiceTrigger.classList.add('listening');
                voiceTrigger.textContent = '🎙️';
                recognition.start();
            }
        });

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            if (chatInput) {
                chatInput.value = transcript;
            }
        };

        recognition.onend = () => {
            voiceTrigger.classList.remove('listening');
            voiceTrigger.textContent = '🎤';
        };

        recognition.onerror = (err) => {
            console.error('Speech recognition error:', err);
            voiceTrigger.classList.remove('listening');
            voiceTrigger.textContent = '🎤';
        };
    } else if (voiceTrigger) {
        voiceTrigger.style.display = 'none'; // Hide if not supported in the environment/browser
    }

    // --- WebRTC Video & liveCast Overlay Controls ---
    const webrtcOverlay = document.getElementById('webrtc-overlay');
    const webrtcRoomId = document.getElementById('webrtc-room-id');
    const localVideo = document.getElementById('local-video');
    const remoteVideo = document.getElementById('remote-video');
    const remotePlaceholder = document.getElementById('remote-placeholder');
    const livecastStatus = document.getElementById('livecast-status');
    const livecastStreamBtn = document.getElementById('livecast-stream-btn');
    const webrtcMuteBtn = document.getElementById('webrtc-mute-btn');
    const webrtcHangupBtn = document.getElementById('webrtc-hangup-btn');

    let localMediaStream = null;
    let locationTimer = null;

    window.openWebRTCOverlay = async function(roomId) {
        if (!webrtcOverlay) return;
        webrtcOverlay.classList.add('open');
        webrtcRoomId.textContent = `Room: ${roomId}`;

        // Get local video stream
        try {
            localMediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            if (localVideo) localVideo.srcObject = localMediaStream;
        } catch (err) {
            console.warn('getUserMedia camera/mic permissions not granted or offline, using animated mock video canvas', err);
            if (localVideo) {
                localVideo.style.background = '#0d47a1';
            }
        }

        // Simulate remote peer connection after 3 seconds
        setTimeout(() => {
            if (remotePlaceholder) remotePlaceholder.style.display = 'none';
            if (remoteVideo) {
                remoteVideo.style.background = '#d84315';
                fetch(`/api/webrtc/peers?roomId=${roomId}`)
                    .then(r => r.json())
                    .then(data => console.log('Current room peers loaded from signaling service:', data.peers))
                    .catch(e => console.error(e));
            }
        }, 3000);
    };

    if (webrtcHangupBtn) {
        webrtcHangupBtn.addEventListener('click', () => {
            if (localMediaStream) {
                localMediaStream.getTracks().forEach(track => track.stop());
                localMediaStream = null;
            }
            if (localVideo) localVideo.srcObject = null;
            if (remoteVideo) remoteVideo.srcObject = null;
            if (remotePlaceholder) remotePlaceholder.style.display = 'block';
            if (locationTimer) {
                clearInterval(locationTimer);
                locationTimer = null;
            }
            if (livecastStatus) livecastStatus.textContent = 'Idle (Coordinates not streaming)';
            if (livecastStreamBtn) livecastStreamBtn.textContent = '📡 Render liveCast Button';
            if (webrtcOverlay) webrtcOverlay.classList.remove('open');
        });
    }

    if (webrtcMuteBtn) {
        webrtcMuteBtn.addEventListener('click', () => {
            if (localMediaStream) {
                const audioTrack = localMediaStream.getAudioTracks()[0];
                if (audioTrack) {
                    audioTrack.enabled = !audioTrack.enabled;
                    webrtcMuteBtn.textContent = audioTrack.enabled ? 'Mute Audio' : 'Unmute Audio';
                }
            } else {
                webrtcMuteBtn.textContent = webrtcMuteBtn.textContent === 'Mute Audio' ? 'Unmute Audio' : 'Mute Audio';
            }
        });
    }

    if (livecastStreamBtn) {
        livecastStreamBtn.addEventListener('click', () => {
            if (locationTimer) {
                clearInterval(locationTimer);
                locationTimer = null;
                livecastStatus.textContent = 'Paused (Stream inactive)';
                livecastStreamBtn.textContent = '📡 Render liveCast Button';
            } else {
                livecastStreamBtn.textContent = '🛑 Stop Streaming Location';
                // Simulate continuous GPS liveCast telemetry stream
                locationTimer = setInterval(() => {
                    const lat = (7.3775 + (Math.random() - 0.5) * 0.001).toFixed(6);
                    const lng = (3.9470 + (Math.random() - 0.5) * 0.001).toFixed(6);
                    if (livecastStatus) {
                        livecastStatus.innerHTML = `<span style="color:#2e7d32; font-weight:700;">📡 Streaming:</span> Lat: ${lat}, Lng: ${lng}`;
                    }
                    // Draw on Leaflet map if open
                    updateLiveMap(lat, lng);
                }, 2000);
            }
        });
    }

    // --- SECTION 2: Leaflet & OpenStreetMap Integration ---
    let pulseMap = null;
    let livePathLine = null;
    let mapMarkers = [];

    function showPulseMap(providers) {
        const mapContainer = document.getElementById('pulse-map');
        if (!mapContainer) return;
        mapContainer.style.display = 'block';

        // Initialize Leaflet Map if not initialized yet
        if (!pulseMap) {
            try {
                // Center map at Ibadan default
                pulseMap = L.map('pulse-map').setView([7.3775, 3.9470], 13);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; OpenStreetMap contributors'
                }).addTo(pulseMap);
            } catch (e) {
                console.error('Leaflet initialization failed', e);
                return;
            }
        }

        // Clear existing markers
        mapMarkers.forEach(m => pulseMap.removeLayer(m));
        mapMarkers = [];

        // Add terracotta markers for each provider with random offset ±0.001
        if (providers && providers.length > 0) {
            providers.forEach(p => {
                const lat = parseFloat(p.lat) + (Math.random() - 0.5) * 0.002;
                const lng = parseFloat(p.lng) + (Math.random() - 0.5) * 0.002;
                
                // Custom colored circle marker based on source
                const isStationary = p.source === 'stationary';
                const markerColor = isStationary ? '#1E88E5' : '#D97A5C'; // Blue for stationary, Terracotta for mobile
                
                const marker = L.circleMarker([lat, lng], {
                    color: markerColor,
                    fillColor: markerColor,
                    fillOpacity: 0.8,
                    radius: isStationary ? 6 : 8
                }).addTo(pulseMap);
                
                const sourceLabel = isStationary ? 'Stationary' : 'Mobile (Live)';
                marker.bindPopup(`<strong>${p.name || 'Provider'}</strong><br>Skill: ${p.skill || 'General'}<br>Source: ${sourceLabel}`);
                mapMarkers.push(marker);
            });
            
            // Re-adjust view to fit coordinates
            try {
                const group = new L.featureGroup(mapMarkers);
                pulseMap.fitBounds(group.getBounds());
            } catch(e) {}
        } else {
            pulseMap.setView([7.3775, 3.9470], 13);
        }
        
        // Force map to render correctly when shown
        setTimeout(() => {
            if (pulseMap) pulseMap.invalidateSize();
        }, 200);
    }

    function updateLiveMap(lat, lng) {
        const mapContainer = document.getElementById('pulse-map');
        if (mapContainer && mapContainer.style.display === 'none') {
            mapContainer.style.display = 'block';
        }

        if (!pulseMap) {
            try {
                pulseMap = L.map('pulse-map').setView([lat, lng], 14);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; OpenStreetMap contributors'
                }).addTo(pulseMap);
            } catch (e) {
                console.error(e);
                return;
            }
        } else {
            pulseMap.setView([lat, lng], 14);
        }

        const pLat = parseFloat(lat);
        const pLng = parseFloat(lng);

        // Add a marker for current location
        const marker = L.circleMarker([pLat, pLng], {
            color: '#1E88E5',
            fillColor: '#1E88E5',
            fillOpacity: 0.9,
            radius: 10
        }).addTo(pulseMap);
        mapMarkers.push(marker);

        if (!livePathLine) {
            livePathLine = L.polyline([[pLat, pLng]], {color: '#1E88E5'}).addTo(pulseMap);
        } else {
            livePathLine.addLatLng([pLat, pLng]);
        }

        setTimeout(() => {
            if (pulseMap) pulseMap.invalidateSize();
        }, 100);
    }

    // --- SECTION 6: Discover & Explore Panel Wiring ---
    const exploreTrigger = document.getElementById('explore-trigger');
    const exploreModal = document.getElementById('explore-modal');
    const exploreCloseBtn = document.getElementById('explore-close-btn');

    if (exploreTrigger && exploreModal) {
        exploreTrigger.addEventListener('click', async () => {
            exploreModal.classList.add('open');
            await loadExploreData();
        });
    }

    if (exploreCloseBtn && exploreModal) {
        exploreCloseBtn.addEventListener('click', () => {
            exploreModal.classList.remove('open');
        });
    }

    async function loadExploreData() {
        try {
            // a. Trending Near You
            const trendList = document.getElementById('trending-skills');
            if (trendList) {
                trendList.innerHTML = `
                    <li class="trend-item">🔥 1. Okada & Keke Transit (NG)</li>
                    <li class="trend-item">🔥 2. Bread & Grocery Delivery (NG)</li>
                    <li class="trend-item">🔥 3. Bicycle Logistics (GB)</li>
                    <li class="trend-item">🔥 4. Direct Plumbers & Electricians</li>
                `;
            }

            // b. Nearby Now (Pulse Providers map)
            const pulseProvidersList = document.getElementById('pulse-providers-list');
            const res = await fetch('/api/pulse/providers');
            if (res.ok) {
                const data = await res.json();
                const providers = data.providers || [];
                if (pulseProvidersList) {
                    if (providers.length > 0) {
                        pulseProvidersList.replaceChildren(...providers.map(p => {
                            const item = document.createElement('div');
                            item.className = 'pulse-provider-item';
                            const name = document.createElement('strong');
                            name.textContent = String(p.name || 'Provider');
                            const badge = document.createElement('span');
                            badge.className = `badge ${p.source === 'stationary' ? 'badge-blue' : 'badge-orange'}`;
                            badge.textContent = String(p.source || 'unknown');
                            item.append(name, document.createTextNode(` (${String(p.skill || '')}) - `), badge);
                            return item;
                        }));
                        // Render map
                        showPulseMap(providers);
                    } else {
                        pulseProvidersList.textContent = 'No active pulse providers live right now.';
                        showPulseMap([]);
                    }
                }
            }

            // c. Work Opportunities
            const exploreGigs = document.getElementById('explore-gigs');
            if (exploreGigs) {
                if (!userPhone) {
                    exploreGigs.innerHTML = `<div style="text-align:center; padding: 20px; color: #666; font-size:13px;">Please log in or register to view personalized opportunities.</div>`;
                } else {
                    const oppRes = await fetch(`/api/opportunities?phone=${encodeURIComponent(userPhone)}`);
                    if (oppRes.ok) {
                        const oppData = await oppRes.json();
                        const opportunities = (oppData.opportunities || []).filter(o => o.type !== 'daily_pick');
                        if (opportunities.length > 0) {
                            exploreGigs.replaceChildren(...opportunities.map(o => {
                                const card = document.createElement('div');
                                card.className = 'interactive-card';
                                card.style.marginBottom = '12px';
                                card.style.opacity = o.status === 'acted' ? '0.7' : '1';
                                const titleRow = document.createElement('div');
                                titleRow.className = 'card-title';
                                titleRow.style.display = 'flex';
                                titleRow.style.justifyContent = 'space-between';
                                titleRow.style.alignItems = 'center';
                                const title = document.createElement('span');
                                title.textContent = String(o.title || 'Opportunity');
                                titleRow.appendChild(title);
                                if (o.status === 'acted') {
                                    const claimed = document.createElement('span');
                                    claimed.className = 'shortcode';
                                    claimed.style.fontSize = '10px';
                                    claimed.style.background = '#28a745';
                                    claimed.style.margin = '0';
                                    claimed.textContent = 'CLAIMED';
                                    titleRow.appendChild(claimed);
                                }
                                const description = document.createElement('div');
                                description.className = 'card-desc';
                                description.textContent = String(o.subtitle || '');
                                const action = document.createElement('button');
                                action.className = 'btn-card primary';
                                if (o.status === 'acted') {
                                    action.style.background = '#ccc';
                                    action.style.cursor = 'not-allowed';
                                    action.disabled = true;
                                    action.textContent = 'Completed';
                                } else {
                                    action.textContent = String(o.ctaText || 'Accept');
                                    action.addEventListener('click', () => window.acceptExploreGig(o.id, String(o.title || ''), String(o.type || '')));
                                }
                                card.append(titleRow, description, action);
                                return card;
                            }));
                        } else {
                            exploreGigs.innerHTML = `<div style="text-align:center; padding: 20px; color: #666; font-size:13px;">No new opportunities matching your skills right now. Try going live on Kuru Pulse!</div>`;
                        }
                    } else {
                        exploreGigs.innerHTML = `<div style="text-align:center; padding: 20px; color: red; font-size:13px;">Failed to load opportunities.</div>`;
                    }
                }
            }

            // d. Daily Picks (sponsored/product card)
            const exploreDailyPicks = document.getElementById('explore-daily-picks');
            if (exploreDailyPicks) {
                if (!userPhone) {
                    exploreDailyPicks.innerHTML = `<div style="text-align:center; padding: 20px; color: #666; font-size:13px;">Log in to see Daily Picks.</div>`;
                } else {
                    const picksRes = await fetch(`/api/opportunities/daily-picks?phone=${encodeURIComponent(userPhone)}`);
                    if (picksRes.ok) {
                        const picksData = await picksRes.json();
                        const dailyPicks = picksData.daily_picks || [];
                        if (dailyPicks.length > 0) {
                            exploreDailyPicks.replaceChildren(...dailyPicks.map(p => {
                                const card = document.createElement('div');
                                card.className = 'interactive-card';
                                card.style.marginBottom = '12px';
                                card.style.border = '1px dashed var(--terracotta)';
                                card.style.background = '#fffaf5';
                                card.style.opacity = p.status === 'acted' ? '0.7' : '1';
                                const promoted = document.createElement('span');
                                promoted.className = 'shortcode';
                                promoted.style.fontSize = '10px';
                                promoted.style.background = 'var(--terracotta)';
                                promoted.style.marginBottom = '8px';
                                promoted.style.display = 'inline-block';
                                promoted.textContent = 'PROMOTED';
                                const title = document.createElement('div');
                                title.className = 'card-title';
                                title.style.color = 'var(--terracotta)';
                                title.textContent = String(p.title || 'Promotion');
                                const description = document.createElement('div');
                                description.className = 'card-desc';
                                description.textContent = String(p.subtitle || '');
                                const action = document.createElement('button');
                                action.className = 'btn-card primary';
                                if (p.status === 'acted') {
                                    action.style.background = '#ccc';
                                    action.style.cursor = 'not-allowed';
                                    action.disabled = true;
                                    action.textContent = 'Ordered';
                                } else {
                                    action.textContent = String(p.ctaText || 'Order');
                                    action.addEventListener('click', () => window.orderDailyPick(p.id, String(p.title || ''), String(p.ctaLink || '')));
                                }
                                card.append(promoted, title, description, action);
                                return card;
                            }));
                        } else {
                            exploreDailyPicks.innerHTML = `<div style="text-align:center; padding: 20px; color: #666; font-size:13px;">No promotional picks today. Check back tomorrow!</div>`;
                        }
                    } else {
                        exploreDailyPicks.innerHTML = `<div style="text-align:center; padding: 20px; color: red; font-size:13px;">Failed to load daily picks.</div>`;
                    }
                }
            }

        } catch (err) {
            console.error('Error loading explore data', err);
        }
    }

    window.acceptExploreGig = async function(id, name, type) {
        try {
            const res = await fetch('/api/opportunities/act', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, phone: userPhone })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                alert(`🎉 ${data.message}`);
                if (exploreModal) exploreModal.classList.remove('open');
                if (type === 'job' && window.openWebRTCOverlay) {
                    window.openWebRTCOverlay(`room-${Math.floor(1000 + Math.random() * 9000)}`);
                } else {
                    await updateProfile();
                }
                loadExploreData();
            } else {
                alert(`Error: ${data.message || 'Failed to accept opportunity'}`);
            }
        } catch (e) {
            console.error('Error accepting explore gig:', e);
            alert('Failed to accept gig.');
        }
    };

    window.orderDailyPick = async function(id, name, link) {
        try {
            const res = await fetch('/api/opportunities/act', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, phone: userPhone })
            });
            if (res.ok) {
                alert(`🛒 Order request for "${name}" submitted! Direct communication channel initiated.`);
                if (exploreModal) exploreModal.classList.remove('open');
                submitInlineMessage(`Confirm Order: ${name}`);
                loadExploreData();
            } else {
                alert('Failed to place order.');
            }
        } catch (e) {
            console.error('Error placing order:', e);
            alert('Failed to place order.');
        }
    };

    // --- SECTION 7: Top-up Points handler ---
    window.topupPoints = async function(amount) {
        try {
            const response = await fetch('/api/points/topup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: userPhone, amount: amount })
            });
            const data = await response.json();
            if (response.ok) {
                alert(`💳 Top-up of ${amount} Points successful! New Balance: ${data.points} Points.`);
                await updateProfile();
                const reloadModal = document.getElementById('reload-modal');
                if (reloadModal) reloadModal.classList.remove('open');
            } else {
                alert(`Error: ${data.message}`);
            }
        } catch (e) {
            console.error('Top-up error:', e);
            alert('Failed to complete top-up transaction.');
        }
    };

    // --- SECTION 10: Proximity Nudge Notification handler ---
    window.handleProximityNudge = function(providerName, skill, distance) {
        if ("vibrate" in navigator) {
            // Trigger haptic vibration feedback on Android / PWA mobile
            navigator.vibrate([200, 100, 200]);
        }
        
        // Show visual toast notification
        const toast = document.createElement('div');
        toast.style.position = 'fixed';
        toast.style.bottom = '80px';
        toast.style.left = '50%';
        toast.style.transform = 'translateX(-50%)';
        toast.style.background = 'var(--charcoal)';
        toast.style.color = 'white';
        toast.style.padding = '12px 20px';
        toast.style.borderRadius = '30px';
        toast.style.zIndex = '9999';
        toast.style.boxShadow = '0 4px 15px rgba(0,0,0,0.3)';
        toast.style.fontSize = '13px';
        toast.style.fontWeight = '600';
        toast.style.display = 'flex';
        toast.style.alignItems = 'center';
        toast.style.gap = '8px';
        toast.style.transition = 'opacity 0.3s ease';
        toast.innerHTML = `🔔 <strong>${providerName}</strong> (${skill}) is active nearby (~${distance}m)!`;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    };

    // --- SECTION 11: Support Chat, Escrow Orders & Disputes Wiring ---
    async function loadEscrowOrders() {
        const escrowListDiv = document.getElementById('escrow-orders-list');
        if (!escrowListDiv) return;

        try {
            const response = await fetch(`/api/escrow?phone=${encodeURIComponent(userPhone)}`);
            if (response.ok) {
                const data = await response.json();
                if (data.length > 0) {
                    escrowListDiv.innerHTML = data.map(order => {
                        const amount = (order.amount_minor / 100).toFixed(2);
                        const cur = getCurrencySymbol();
                        const displayAmount = `${cur}${amount}`;
                        const isHeld = order.status === 'held';
                        
                        return `
                            <div style="padding: 6px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                                <div style="text-align: left;">
                                    <strong style="color:var(--charcoal);">${order.description || 'Order'}</strong><br/>
                                    <span style="font-size:10px; color:#777;">Amt: ${displayAmount} | Status: <span style="font-weight:600; color:${isHeld ? 'var(--electric-blue)' : 'var(--terracotta)'};">${order.status}</span></span>
                                </div>
                                ${isHeld ? `
                                    <button onclick="openDisputeModal('${order.id}')" style="font-size:10px; padding:3px 6px; border:1px solid var(--terracotta); background:none; color:var(--terracotta); border-radius:4px; cursor:pointer; font-weight:600;">Report Issue</button>
                                ` : ''}
                            </div>
                        `;
                    }).join('');
                } else {
                    escrowListDiv.innerHTML = `<span style="color:#777; font-size:11px;">No active escrow orders found.</span>`;
                }
            } else {
                escrowListDiv.innerHTML = `<span style="color:#777; font-size:11px;">Failed to load escrow orders.</span>`;
            }
        } catch (e) {
            console.error('Error loading escrow orders:', e);
            escrowListDiv.innerHTML = `<span style="color:#777; font-size:11px;">Error loading orders.</span>`;
        }
    }

    window.openDisputeModal = function(orderId) {
        document.getElementById('dispute-order-id').value = orderId;
        document.getElementById('dispute-reason').value = '';
        document.getElementById('dispute-modal').classList.add('open');
    };

    window.closeDisputeModal = function() {
        document.getElementById('dispute-modal').classList.remove('open');
    };

    window.submitDispute = async function() {
        const orderId = document.getElementById('dispute-order-id').value;
        const reason = document.getElementById('dispute-reason').value.trim();
        if (!reason) {
            alert('Please provide a reason for the dispute.');
            return;
        }

        try {
            const response = await fetch('/api/dispute/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: userPhone, order_id: orderId, reason })
            });
            if (response.ok) {
                alert('Dispute submitted successfully! Escrowed funds have been frozen.');
                closeDisputeModal();
                await loadEscrowOrders();
            } else {
                const data = await response.json();
                alert(`Error: ${data.error || 'Failed to submit dispute'}`);
            }
        } catch (err) {
            console.error('Dispute submission error:', err);
            alert('Failed to submit dispute.');
        }
    };

    const btnSupportQuick = document.getElementById('btn-support-quick');
    if (btnSupportQuick) {
        btnSupportQuick.addEventListener('click', async () => {
            localStorage.setItem('kurukoo_support_recipient', 'SUPPORT');
            alert('💬 Support Chat initiated. You are now connected to Kurukoo Customer Support. Type "exit" to leave support mode.');
            
            const text = "Hi, I need support with Kurukoo.";
            // Send support greeting optimistically
            const userBubble = document.createElement('div');
            userBubble.className = 'message user';
            userBubble.innerHTML = `<span class="message-sender">You</span><div>${text}</div>`;
            chatMessages.appendChild(userBubble);
            chatMessages.scrollTop = chatMessages.scrollHeight;

            await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: userPhone, message: text, channel: 'pwa', recipient: 'SUPPORT' })
            });

            await loadMessages();
        });
    }

    const btnRideQuick = document.getElementById('btn-ride-quick');
    if (btnRideQuick) {
        btnRideQuick.addEventListener('click', () => {
            submitInlineMessage('Request a Ride');
        });
    }

    // Load initial states
    updateProfile();
    loadMessages();
    loadEscrowOrders();
});

window.renderDevices = function() {
    const list = document.getElementById('devices-list');
    if (!list) return;
    const devices = JSON.parse(localStorage.getItem('smart_devices') || '[]');
    const devicesPanel = document.getElementById('devices-panel');
    
    if (devices.length === 0) {
        if (devicesPanel) devicesPanel.style.display = 'none';
        list.innerHTML = '<div>No devices found.</div>';
        return;
    }
    
    if (devicesPanel) devicesPanel.style.display = 'block';
    
    list.innerHTML = devices.map((d, i) => {
        const tpl = deviceTemplates[d.type];
        if (!tpl) return `<div>Unknown device: ${d.name}</div>`;
        
        const cmds = Object.keys(tpl.commands).map(k => {
            const label = tpl.commands[k].label || k;
            return `<button onclick="executeDeviceCommand(JSON.parse(decodeURIComponent('${encodeURIComponent(JSON.stringify(d))}')), '${k}')" style="margin:2px; padding:4px 8px; font-size:11px; background:#fff; border:1px solid #ccc; border-radius:4px; cursor:pointer;">${label}</button>`;
        }).join('');
        
        return `
            <div style="padding:6px; border:1px solid #eee; border-radius:4px; margin-bottom:6px; background:#f9f9f9;">
                <strong>${d.name}</strong> <span style="font-size:10px; color:#777;">(${d.ip || 'MQTT'})</span><br>
                <div style="margin-top:4px;">${cmds}</div>
                <button onclick="removeDevice(${i})" style="margin-top:6px; color:red; border:none; background:none; font-size:10px; cursor:pointer;">Remove</button>
            </div>
        `;
    }).join('');
};

window.removeDevice = function(idx) {
    const devices = JSON.parse(localStorage.getItem('smart_devices') || '[]');
    devices.splice(idx, 1);
    localStorage.setItem('smart_devices', JSON.stringify(devices));
    if (typeof window.renderDevices === "function") window.renderDevices();
};

window.discoverDevices = function() {
    const type = prompt("Enter device type (samsung_tv, roku, lg_tv, android_tv, tp_link_plug, sonoff_plug):", "sonoff_plug");
    if (!type) return;
    
    const name = prompt("Enter a friendly name for this device:", "Living Room Plug");
    if (!name) return;
    
    const ip = prompt("Enter device IP address (leave blank if MQTT):", "");
    
    const devices = JSON.parse(localStorage.getItem('smart_devices') || '[]');
    devices.push({ name, type, ip });
    localStorage.setItem('smart_devices', JSON.stringify(devices));
    if (typeof window.renderDevices === "function") window.renderDevices();
    alert("Device added successfully!");
};

document.addEventListener('DOMContentLoaded', () => {
    if (typeof window.renderDevices === "function") window.renderDevices();
});

window.submitRating = function() {
    // Logic to submit rating and show success story prompt if 4+
    document.getElementById('rating-modal').style.display = 'none';
    alert("Thank you! Can we share your success anonymously?");
};


    // Data Retention Functions
    window.downloadMyData = async function() {
        if (!currentUserPhone) return;
        try {
            const res = await fetch(`/api/profile/export?phone=${encodeURIComponent(currentUserPhone)}`);
            const data = await res.json();
            
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", "kurukoo_data.json");
            document.body.appendChild(downloadAnchorNode); // required for firefox
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
        } catch (e) {
            console.error(e);
            alert('Failed to download data');
        }
    };

    window.deleteMyAccount = async function() {
        if (!currentUserPhone) return;
        const conf = confirm('Are you sure you want to delete your account? This will permanently delete your personal data. Anonymised transactional data will be kept for analytical purposes.');
        if (!conf) return;
        
        try {
            const res = await fetch('/api/profile/delete', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: currentUserPhone })
            });
            const data = await res.json();
            if (data.success) {
                alert('Account deleted successfully.');
                logoutPWA();
            } else {
                alert('Failed to delete account');
            }
        } catch (e) {
            console.error(e);
            alert('Error deleting account');
        }
    };
