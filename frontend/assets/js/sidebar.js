/**
 * EngiSphere Sidebar Engine
 * Handles sidebar collapse/expand state and persistence.
 */
(function() {
    "use strict";

    const SIDEBAR_KEY = "engisphere_sidebar_collapsed";
    const COLLAPSED_CLASS = "sidebar-collapsed";

    /**
     * Applies the sidebar state to the body.
     */
    function applySidebarState(isCollapsed) {
        if (isCollapsed) {
            document.body.classList.add(COLLAPSED_CLASS);
        } else {
            document.body.classList.remove(COLLAPSED_CLASS);
        }
    }

    /**
     * Toggles the sidebar state.
     */
    window.toggleEngiSphereSidebar = function() {
        const isCollapsed = document.body.classList.toggle(COLLAPSED_CLASS);
        localStorage.setItem(SIDEBAR_KEY, isCollapsed);
        
        // Dispatch event for any components that need to know (like charts)
        window.dispatchEvent(new CustomEvent("engisphere-sidebar-toggled", { detail: { collapsed: isCollapsed } }));
    };

    // Alias for compatibility
    window.toggleSidebar = window.toggleEngiSphereSidebar;

    // Initialize sidebar state as soon as possible
    const savedState = localStorage.getItem(SIDEBAR_KEY);
    const isMobile = window.innerWidth <= 768;
    
    // Determine initial state: respect localStorage, default to expanded on desktop, collapsed on mobile
    const initialCollapsed = savedState === 'true' || (savedState === null && isMobile);
    
    // Apply immediately to body if it exists to prevent flicker
    if (document.body) {
        applySidebarState(initialCollapsed);
    } else {
        // Fallback for very early execution
        const observer = new MutationObserver(() => {
            if (document.body) {
                applySidebarState(initialCollapsed);
                observer.disconnect();
            }
        });
        observer.observe(document.documentElement, { childList: true });
    }

    // Global Logout Handler
    window.logoutEngiSphere = function() {
        if (window.Auth && typeof window.Auth.logout === "function") {
            window.Auth.logout();
        } else {
            localStorage.removeItem("engisphereCurrentUser");
            localStorage.removeItem("access_token");
            window.location.href = "login.html";
        }
    };

    // Alias for compatibility across different pages
    window.logout = window.logoutEngiSphere;

    // Attach to logout elements on DOMContentLoaded
    document.addEventListener("DOMContentLoaded", () => {
        const toggleBtn = document.getElementById('sidebarToggle');
        if (toggleBtn) {
            toggleBtn.onclick = window.toggleEngiSphereSidebar;
            
            // Set initial aria-label
            const isCollapsed = document.body.classList.contains(COLLAPSED_CLASS);
            toggleBtn.setAttribute('aria-label', isCollapsed ? "Expand sidebar" : "Collapse sidebar");
        }

        // Bind logout buttons (if any in sidebar/header)
        // Added .exit-link and .nav-link-exit for broader coverage
        document.querySelectorAll('#logoutBtn, .nav-link-exit, .exit-link, .nav-link-exit, [data-action="logout"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                window.logoutEngiSphere();
            });
        });

        // Global Sidebar Navigation Handler (Force navigation for non-logout links)
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', function (e) {
                // Skip logout links which are handled elsewhere
                if (this.classList.contains('exit-link') || this.classList.contains('nav-link-exit') || this.getAttribute('data-action') === 'logout') {
                    return;
                }

                const href = this.getAttribute('href');
                if (!href || href === '#' || href.startsWith('javascript:')) {
                    // Do nothing or prevent default if it's just a hash
                    if (href === '#') e.preventDefault();
                    return;
                }

                // If it's a real page link, force navigation to ensure it's not blocked
                if (href.endsWith('.html') || href.includes('.html?')) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log("[EngiSphere] Sidebar forcing navigation to:", href);
                    window.location.assign(href);
                }
            });
        });
        
        // Listen for toggles to update aria-label
        window.addEventListener("engisphere-sidebar-toggled", (e) => {
            const toggleBtn = document.getElementById('sidebarToggle');
            if (toggleBtn) {
                toggleBtn.setAttribute('aria-label', e.detail.collapsed ? "Expand sidebar" : "Collapse sidebar");
            }
            
            // Trigger a window resize event to help charts adjust
            window.dispatchEvent(new Event('resize'));
        });
    });

})();
