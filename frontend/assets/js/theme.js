/**
 * EngiSphere Unified Theme Engine
 * Manages Light/Dark mode across all pages using localStorage.
 */
(function() {
    "use strict";

    const THEME_KEY = "engisphere-theme";
    const DARK_CLASS = "dark-theme";
    const LIGHT_CLASS = "light-theme";

    /**
     * Applies the theme to the body and updates all toggle buttons.
     */
    function applyTheme(theme) {
        const isDark = theme === "dark";
        
        // Remove both classes first to avoid conflicts
        document.body.classList.remove(DARK_CLASS, LIGHT_CLASS);
        
        // Apply the correct class to both body and root
        document.body.classList.add(isDark ? DARK_CLASS : LIGHT_CLASS);
        document.documentElement.classList.remove(DARK_CLASS, LIGHT_CLASS);
        document.documentElement.classList.add(isDark ? DARK_CLASS : LIGHT_CLASS);
        
        // Update all theme toggle buttons on the page
        const toggles = document.querySelectorAll('.theme-toggle, #themeToggle, #themeToggleBtn, #themeToggleBtnDetails');
        toggles.forEach(btn => {
            if (isDark) {
                btn.innerHTML = '<i class="fas fa-sun"></i>';
                btn.setAttribute('aria-label', 'Switch to light mode');
            } else {
                btn.innerHTML = '<i class="fas fa-moon"></i>';
                btn.setAttribute('aria-label', 'Switch to dark mode');
            }
        });
    }

    /**
     * Toggles between dark and light themes.
     */
    window.toggleEngiSphereTheme = function() {
        const currentTheme = localStorage.getItem(THEME_KEY) || "dark";
        const newTheme = currentTheme === "dark" ? "light" : "dark";
        
        localStorage.setItem(THEME_KEY, newTheme);
        applyTheme(newTheme);

        // Notify other components
        window.dispatchEvent(new CustomEvent("engisphere-theme-changed", { detail: { theme: newTheme } }));
    };

    // Alias for compatibility
    window.toggleTheme = window.toggleEngiSphereTheme;

    // Initialize theme on page load
    document.addEventListener("DOMContentLoaded", () => {
        const savedTheme = localStorage.getItem(THEME_KEY) || "dark";
        applyTheme(savedTheme);
        
        // Auto-attach to buttons if they exist
        const toggles = document.querySelectorAll('.theme-toggle, #themeToggle, #themeToggleBtn, #themeToggleBtnDetails');
        toggles.forEach(btn => {
            btn.onclick = window.toggleEngiSphereTheme;
        });
    });

    // Run immediately if body exists (to prevent flash)
    if (document.body) {
        const savedTheme = localStorage.getItem(THEME_KEY) || "dark";
        const isDark = savedTheme === "dark";
        document.body.classList.add(isDark ? DARK_CLASS : LIGHT_CLASS);
    }
})();
