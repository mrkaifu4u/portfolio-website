/**
 * Admin Panel Dashboard Logic
 * Mohamad Kaifoddin Portfolio Website Database Integration
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log("Admin Panel script loaded. Initializing DOM selectors...");

    const loadingOverlay = document.getElementById('loadingOverlay');
    const loginSection = document.getElementById('loginSection');
    const dashboardSection = document.getElementById('dashboardSection');
    
    // Login form elements
    const loginForm = document.getElementById('loginForm');
    const loginEmailInput = document.getElementById('loginEmail');
    const loginPasswordInput = document.getElementById('loginPassword');
    const loginEmailError = document.getElementById('loginEmailError');
    const loginPasswordError = document.getElementById('loginPasswordError');
    const loginBtn = document.getElementById('loginBtn');
    const loginSpinner = document.getElementById('loginSpinner');
    const loginAlert = document.getElementById('loginAlert');
    
    // Dashboard form elements
    const dashboardForm = document.getElementById('dashboardForm');
    const navbarLogoInput = document.getElementById('navbarLogo');
    const portfolioNameInput = document.getElementById('portfolioName');
    const resumeLinkInput = document.getElementById('resumeLink');
    const instagramLinkInput = document.getElementById('instagramLink');
    const linkedinLinkInput = document.getElementById('linkedinLink');
    const githubLinkInput = document.getElementById('githubLink');
    const xLinkInput = document.getElementById('xLink');
    const phoneInput = document.getElementById('phone');
    const locationInput = document.getElementById('location');
    
    // Dashboard error inputs
    const logoError = document.getElementById('logoError');
    const nameError = document.getElementById('nameError');
    const resumeError = document.getElementById('resumeError');
    const instagramError = document.getElementById('instagramError');
    const linkedinError = document.getElementById('linkedinError');
    const githubError = document.getElementById('githubError');
    const xError = document.getElementById('xError');
    const phoneError = document.getElementById('phoneError');
    const locationError = document.getElementById('locationError');
    
    const updateBtn = document.getElementById('updateBtn');
    const updateSpinner = document.getElementById('updateSpinner');
    const dashboardAlert = document.getElementById('dashboardAlert');
    const lastUpdatedSpan = document.getElementById('lastUpdated');
    const logoutBtn = document.getElementById('logoutBtn');
    
    if (!loadingOverlay || !loginSection || !dashboardSection || !loginForm || !dashboardForm || !navbarLogoInput) {
        console.error("Critical Error: One or more DOM layout components are missing in admin.html!");
        return;
    }

    let sessionToken = sessionStorage.getItem('adminToken');
    console.log("Initial sessionStorage token search:", sessionToken ? "Token found" : "Token missing");

    function showLoader() {
        console.log("Showing loading overlay...");
        loadingOverlay.classList.remove('hidden');
    }
    
    function hideLoader() {
        console.log("Hiding loading overlay...");
        loadingOverlay.classList.add('hidden');
    }
    
    async function checkRoute() {
        console.log("Checking route... Pathname:", window.location.pathname, "Hash:", window.location.hash);
        const path = window.location.pathname;
        const hash = window.location.hash;
        const hasToken = !!sessionStorage.getItem('adminToken');
        
        const isDashboardRoute = path === '/admin/dashboard' || hash === '#dashboard';
        
        if (isDashboardRoute) {
            if (!hasToken) {
                console.log("Access denied to dashboard: Token missing. Redirecting to login page...");
                if (hash === '#dashboard') {
                    window.location.hash = '';
                } else if (window.location.protocol !== 'file:') {
                    try {
                        history.replaceState(null, '', '/admin');
                    } catch (e) {
                        console.warn("History replaceState failed:", e);
                    }
                }
                showLogin();
                hideLoader();
            } else {
                console.log("Token exists. Loading dashboard data...");
                await loadDashboardData();
            }
        } else {
            if (hasToken) {
                console.log("Token exists. Redirecting from login page to dashboard...");
                if (hash) {
                    window.location.hash = '#dashboard';
                } else if (window.location.protocol !== 'file:') {
                    try {
                        history.replaceState(null, '', '/admin/dashboard');
                    } catch (e) {
                        console.warn("History replaceState failed:", e);
                    }
                }
                await loadDashboardData();
            } else {
                console.log("Token missing. Showing login form...");
                if (window.location.protocol !== 'file:' && path.endsWith('admin.html')) {
                    try {
                        history.replaceState(null, '', '/admin');
                    } catch (e) {
                        console.warn("History replaceState failed:", e);
                    }
                }
                showLogin();
                hideLoader();
            }
        }
    }
    
    function showLogin() {
        console.log("Rendering Login Section...");
        loginSection.style.display = 'block';
        dashboardSection.style.display = 'none';
        setTimeout(() => loginSection.classList.add('card-visible'), 50);
    }
    
    function showDashboard() {
        console.log("Rendering Dashboard Section...");
        loginSection.classList.remove('card-visible');
        setTimeout(() => {
            loginSection.style.display = 'none';
            dashboardSection.style.display = 'block';
            setTimeout(() => dashboardSection.classList.add('card-visible'), 50);
        }, 300);
    }
    
    async function loadDashboardData() {
        showLoader();
        console.log("Loading dashboard data from database...");
        try {
            console.log("Calling getAdminData API...");
            
            // Build response wrapper matching the exact property chain requested
            const response = {
                data: await Api.getAdminData(sessionToken)
            };
            console.log("Admin data received successfully:", response.data);
            
            // Exact property-name-based mappings (no indexes, no arrays, no Object.values)
            navbarLogoInput.value = response.data.navbarLogo || '';
            portfolioNameInput.value = response.data.portfolioName || '';
            resumeLinkInput.value = response.data.resumeLink || '';
            instagramLinkInput.value = response.data.instagramLink || '';
            linkedinLinkInput.value = response.data.linkedinLink || '';
            githubLinkInput.value = response.data.githubLink || '';
            xLinkInput.value = response.data.xLink || '';
            phoneInput.value = response.data.phone || '';
            locationInput.value = response.data.location || '';
            
            if (response.data.updatedAt) {
                lastUpdatedSpan.textContent = `Last updated: ${response.data.updatedAt}`;
            } else {
                lastUpdatedSpan.textContent = 'Last updated: Never';
            }
            
            showDashboard();
            console.log("Dashboard initialized successfully.");
        } catch (err) {
            console.error('Failed to load dashboard data:', err);
            sessionStorage.removeItem('adminToken');
            showLogin();
            dashboardAlert.textContent = "Session expired or connection failed: " + err.message;
            dashboardAlert.className = 'message-alert error';
            dashboardAlert.style.display = 'block';
        } finally {
            hideLoader();
        }
    }
    
    function validateInput(inputEl, errorEl, condition, message) {
        if (condition) {
            errorEl.textContent = message;
            errorEl.style.display = 'block';
            inputEl.style.borderColor = 'var(--secondary)';
            return false;
        } else {
            errorEl.style.display = 'none';
            inputEl.style.borderColor = 'var(--glass-border)';
            return true;
        }
    }
    
    function isValidUrl(string) {
        try {
            const url = new URL(string);
            return url.protocol === "http:" || url.protocol === "https:";
        } catch (_) {
            return false;
        }
    }
    
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log("Login form submit event triggered.");
            
            const email = loginEmailInput.value.trim();
            const password = loginPasswordInput.value.trim();
            
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            const isEmailValid = validateInput(loginEmailInput, loginEmailError, !emailRegex.test(email), 'Please enter a valid email address.');
            const isPasswordValid = validateInput(loginPasswordInput, loginPasswordError, password.length === 0, 'Password is required.');
            
            if (!isEmailValid || !isPasswordValid) {
                console.log("Form verification rejected: validation failed.");
                return;
            }
            
            loginBtn.disabled = true;
            loginSpinner.style.display = 'inline-block';
            loginAlert.style.display = 'none';
            showLoader();
            
            try {
                console.log("Calling login API endpoint...");
                const response = await Api.login(email, password);
                console.log("Login API result:", response);
                
                if (response.success) {
                    console.log("Login successful. Saving session token...");
                    sessionStorage.setItem('adminToken', response.token);
                    sessionToken = response.token;
                    
                    const hash = window.location.hash;
                    if (hash) {
                        window.location.hash = '#dashboard';
                    } else if (window.location.protocol !== 'file:') {
                        try {
                            history.pushState(null, '', '/admin/dashboard');
                        } catch (e) {
                            console.warn("History pushState failed:", e);
                        }
                    }
                    
                    await loadDashboardData();
                    loginForm.reset();
                } else {
                    throw new Error(response.message || 'Invalid Email or Password');
                }
            } catch (error) {
                console.error('Login request failed:', error);
                loginAlert.textContent = error.message || 'Invalid Email or Password.';
                loginAlert.className = 'message-alert error';
                loginAlert.style.display = 'block';
            } finally {
                loginBtn.disabled = false;
                loginSpinner.style.display = 'none';
                hideLoader();
            }
        });
    }
    
    if (dashboardForm) {
        dashboardForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log("Dashboard update event triggered.");
            
            // Trim every input value by element id
            const navbarLogo = document.getElementById("navbarLogo").value.trim();
            const portfolioName = document.getElementById("portfolioName").value.trim();
            const resumeLink = document.getElementById("resumeLink").value.trim();
            const instagramLink = document.getElementById("instagramLink").value.trim();
            const linkedinLink = document.getElementById("linkedinLink").value.trim();
            const githubLink = document.getElementById("githubLink").value.trim();
            const xLink = document.getElementById("xLink").value.trim();
            const phone = document.getElementById("phone").value.trim();
            const location = document.getElementById("location").value.trim();
            
            // Validate every field (show field specific alerts if empty)
            if (!navbarLogo) {
                alert("Navbar Logo is empty");
                return;
            }
            if (!portfolioName) {
                alert("Portfolio Name is empty");
                return;
            }
            if (!resumeLink) {
                alert("Resume Link is empty");
                return;
            }
            if (!instagramLink) {
                alert("Instagram Link is empty");
                return;
            }
            if (!linkedinLink) {
                alert("LinkedIn Link is empty");
                return;
            }
            if (!githubLink) {
                alert("GitHub Link is empty");
                return;
            }
            if (!xLink) {
                alert("X Link is empty");
                return;
            }
            if (!phone) {
                alert("Phone is empty");
                return;
            }
            if (!location) {
                alert("Location is empty");
                return;
            }
            
            // Validate URL syntax formats (display specific element errors)
            const isResumeValid = validateInput(resumeLinkInput, resumeError, !isValidUrl(resumeLink), 'Please enter a valid URL.');
            const isInstagramValid = validateInput(instagramLinkInput, instagramError, !isValidUrl(instagramLink), 'Please enter a valid URL.');
            const isLinkedinValid = validateInput(linkedinLinkInput, linkedinError, !isValidUrl(linkedinLink), 'Please enter a valid URL.');
            const isGithubValid = validateInput(githubLinkInput, githubError, !isValidUrl(githubLink), 'Please enter a valid URL.');
            const isXValid = validateInput(xLinkInput, xError, !isValidUrl(xLink), 'Please enter a valid URL.');
            
            if (!isResumeValid || !isInstagramValid || !isLinkedinValid || !isGithubValid || !isXValid) {
                console.log("Form verification rejected: invalid URL strings.");
                return;
            }
            
            // Disable button & show spinner
            updateBtn.disabled = true;
            updateSpinner.style.display = 'inline-block';
            dashboardAlert.style.display = 'none';
            showLoader();
            
            // Construct payload EXACTLY as expected by backend
            const payload = {
                action: "updateAdmin",
                token: sessionToken,
                navbarLogo,
                portfolioName,
                resumeLink,
                instagramLink,
                linkedinLink,
                githubLink,
                xLink,
                phone,
                location
            };
            
            // Print payload to console before fetch execution
            console.log("Payload:", payload);
            
            try {
                console.log("Calling update settings API...");
                // Submit directly to request channel using the compiled payload layout
                const response = await Api.request(payload);
                console.log("Update settings API response:", response);
                
                if (response.success) {
                    console.log("Settings saved successfully.");
                    dashboardAlert.textContent = 'Settings Updated Successfully';
                    dashboardAlert.className = 'message-alert success';
                    dashboardAlert.style.display = 'block';
                    lastUpdatedSpan.textContent = `Last updated: ${response.updatedAt}`;
                    
                    dashboardAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    
                    setTimeout(() => {
                        dashboardAlert.style.display = 'none';
                        dashboardAlert.className = 'message-alert';
                    }, 5000);
                } else {
                    throw new Error(response.message || 'Update failed.');
                }
            } catch (error) {
                console.error('Update settings failed:', error);
                dashboardAlert.textContent = error.message || 'Session expired or configuration is invalid. Please log in again.';
                dashboardAlert.className = 'message-alert error';
                dashboardAlert.style.display = 'block';
                
                if (error.message.includes('Unauthorized') || error.message.includes('session')) {
                    setTimeout(() => logout(), 2000);
                }
            } finally {
                // Re-enable button & hide spinner
                updateBtn.disabled = false;
                updateSpinner.style.display = 'none';
                hideLoader();
            }
        });
    }
    
    function logout() {
        console.log("Admin log out triggered.");
        sessionStorage.removeItem('adminToken');
        sessionToken = null;
        dashboardForm.reset();
        dashboardAlert.className = 'message-alert';
        dashboardAlert.style.display = 'none';
        
        dashboardSection.classList.remove('card-visible');
        setTimeout(() => {
            dashboardSection.style.display = 'none';
            const hash = window.location.hash;
            if (hash) {
                window.location.hash = '';
            } else if (window.location.protocol !== 'file:') {
                try {
                    history.pushState(null, '', '/admin');
                } catch (e) {
                    console.warn("History pushState failed:", e);
                }
            }
            showLogin();
        }, 300);
    }
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }
    
    window.addEventListener('popstate', () => {
        console.log("Browser back/forward navigation triggered routing check.");
        checkRoute();
    });
    
    console.log("Initializing route check...");
    checkRoute();
});
