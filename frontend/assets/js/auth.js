/**
 * EngiSphere Auth — Frontend-only localStorage User Workflow
 * 
 * Storage keys:
 *   engisphereUsers        — Array of all user objects
 *   engisphereCurrentUser  — Currently logged-in user object
 */

const Auth = (function() {
    "use strict";

    const USERS_KEY = "engisphereUsers";
    const SESSION_KEY = "engisphereCurrentUser";

    const DEFAULT_USERS = [
        {
            id: "USR-ADMIN-001",
            fullName: "Amina Al Mansoori",
            email: "admin@engisphere.com",
            password: "admin123",
            organization: "EngiSphere",
            role: "Admin",
            status: "approved",
            assignedProjects: ["PRJ-0001", "PRJ-0002", "PRJ-0003", "PRJ-0004", "PRJ-0005"],
            createdAt: new Date().toISOString()
        },
        {
            id: "USR-ENG-001",
            fullName: "Faisal Al Harbi",
            email: "engineer@engisphere.com",
            password: "engineer123",
            organization: "EngiSphere",
            role: "Engineer",
            status: "approved",
            assignedProjects: ["PRJ-0001", "PRJ-0002"],
            createdAt: new Date().toISOString()
        },
        {
            id: "USR-VIEW-001",
            fullName: "Khalid Al Rashid",
            email: "viewer@engisphere.com",
            password: "viewer123",
            organization: "Riyadh Metro Authority",
            role: "Viewer",
            status: "approved",
            assignedProjects: ["PRJ-0002"],
            createdAt: new Date().toISOString()
        }
    ];

    // Initialize users if not exists
    function init() {
        if (!localStorage.getItem(USERS_KEY)) {
            localStorage.setItem(USERS_KEY, JSON.stringify(DEFAULT_USERS));
        }
    }

    function getUsers() {
        init();
        return JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
    }

    function saveUsers(users) {
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
    }

    function getCurrentUser() {
        const raw = localStorage.getItem(SESSION_KEY);
        return raw ? JSON.parse(raw) : null;
    }

    function login(email, password) {
        const users = getUsers();
        const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

        if (!user || user.password !== password) {
            throw new Error("Invalid email or password.");
        }

        if (user.status === "pending") {
            throw new Error("Your account is pending admin approval.");
        }
        if (user.status === "rejected") {
            throw new Error("Your access request was rejected.");
        }
        if (user.status === "disabled") {
            throw new Error("Your account has been disabled.");
        }

        localStorage.setItem(SESSION_KEY, JSON.stringify(user));
        return user;
    }

    function logout() {
        localStorage.removeItem(SESSION_KEY);
        // Also clear legacy keys just in case
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_email");
        localStorage.removeItem("engisphere_role");
        localStorage.removeItem("engisphere_user");
        window.location.href = "login.html";
    }

    function register(userData) {
        const users = getUsers();
        if (users.find(u => u.email.toLowerCase() === userData.email.toLowerCase())) {
            throw new Error("Email already registered.");
        }

        const newUser = {
            id: "USR-" + Math.random().toString(36).substr(2, 9).toUpperCase(),
            ...userData,
            status: "pending",
            assignedProjects: [],
            createdAt: new Date().toISOString()
        };

        users.push(newUser);
        saveUsers(users);
        return newUser;
    }

    function guardPage() {
        const path = window.location.pathname.split("/").pop() || "index.html";
        const isAuthPage = path === "login.html" || path === "register.html";
        const user = getCurrentUser();

        if (!user) {
            if (!isAuthPage) {
                window.location.href = "login.html";
                return false;
            }
            return true;
        }

        // Re-verify status from the latest users list
        const users = getUsers();
        const latestUser = users.find(u => u.id === user.id);
        
        if (!latestUser || latestUser.status !== "approved") {
            localStorage.removeItem(SESSION_KEY);
            if (!isAuthPage) {
                window.location.href = "login.html";
                return false;
            }
            return true;
        }

        // If logged in and on auth page, go to home
        if (isAuthPage) {
            window.location.href = "home.html";
            return false;
        }

        // Check project access if applicable
        const urlParams = new URLSearchParams(window.location.search);
        const projectId = urlParams.get("project");
        if (projectId && latestUser.role !== "Admin") {
            if (!latestUser.assignedProjects.includes(projectId)) {
                if (latestUser.assignedProjects.length > 0) {
                    window.location.href = `${path}?project=${latestUser.assignedProjects[0]}`;
                } else {
                    window.location.href = "index.html";
                }
                return false;
            }
        }

        return true;
    }

    function requireAdmin() {
        const user = getCurrentUser();
        const path = window.location.pathname.split("/").pop() || "index.html";
        
        if (!user || user.role !== "Admin") {
            if (path !== "index.html") {
                window.location.href = "index.html";
                return false;
            }
        }
        return true;
    }

    init();

    return {
        getUsers,
        saveUsers,
        getCurrentUser,
        login,
        logout,
        register,
        guardPage,
        requireAdmin
    };
})();
