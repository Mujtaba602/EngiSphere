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

    // Attach to button on DOMContentLoaded
    document.addEventListener("DOMContentLoaded", () => {
        const toggleBtn = document.getElementById('sidebarToggle');
        if (toggleBtn) {
            toggleBtn.onclick = window.toggleEngiSphereSidebar;
            
            // Set initial aria-label
            const isCollapsed = document.body.classList.contains(COLLAPSED_CLASS);
            toggleBtn.setAttribute('aria-label', isCollapsed ? "Expand sidebar" : "Collapse sidebar");
        }
        
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
