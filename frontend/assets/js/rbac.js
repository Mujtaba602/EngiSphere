/**
 * EngiSphere RBAC — Role-Based Access Control (Frontend Layer)
 *
 * ⚠️  IMPORTANT: This is a frontend-only enforcement layer.
 *     It reads the user role from localStorage / the backend /users/me response.
 *     For production security, ALL permission checks MUST also be enforced
 *     on the backend (FastAPI middleware / dependency injection).
 *
 * Storage keys used:
 *   engisphereUsers        — Master list of users and their status
 *   engisphereCurrentUser  — Currently logged in user session
 *   engisphere_projects    — Master list of projects
 */

window.EngiSphereRBAC = (function () {
    "use strict";

    // ── Role definitions ───────────────────────────────────────────────────

    const ROLES = ["admin", "project_manager", "engineer", "viewer", "client"];

    const PERMISSIONS = {
        admin: [
            "view_dashboard",
            "manage_projects",
            "update_project_progress",
            "manage_team",
            "view_reports",
            "export_pdf",
            "view_audit_log",
            "manage_permissions",
            "view_map",
            "view_ai_analysis"
        ],
        project_manager: [
            "view_dashboard",
            "manage_projects",
            "update_project_progress",
            "manage_team",
            "view_reports",
            "export_pdf",
            "view_audit_log",
            "view_map",
            "view_ai_analysis"
        ],
        engineer: [
            "view_dashboard",
            "update_project_progress",
            "view_reports",
            "view_map",
            "view_ai_analysis"
        ],
        viewer: [
            "view_dashboard",
            "view_reports",
            "view_map"
        ],
        client: [
            "view_reports",
            "view_map"
        ]
    };

    // Pages → required permissions
    const PAGE_PERMISSIONS = {
        "index.html":          "view_dashboard",
        "reports.html":        "view_reports",
        "project_details.html":"view_dashboard",
        "team_access.html":    "manage_team",
        "solutions.html":      "view_ai_analysis",
        "ai_chat.html":        "view_ai_analysis",
        "settings.html":       "view_dashboard",
        "profile.html":        "view_dashboard"
    };

    // ── User / role resolution ─────────────────────────────────────────────

    function getCurrentUser() {
        if (window.Auth && typeof window.Auth.getCurrentUser === "function") {
            return window.Auth.getCurrentUser();
        }
        try {
            const raw = localStorage.getItem("engisphereCurrentUser");
            if (raw) return JSON.parse(raw);
        } catch (_) { /* ignore */ }
        return null;
    }

    function getCurrentRole() {
        const user = getCurrentUser();
        if (user && user.role) {
            return user.role.toLowerCase();
        }
        return null; // not logged in
    }

    function _mapAccessLevel(level) {
        const map = {
            "admin":           "admin",
            "manager":         "project_manager",
            "project manager": "project_manager",
            "engineer":        "engineer",
            "viewer":          "viewer",
            "client":          "client"
        };
        return map[String(level).toLowerCase()] || null;
    }

    // ── Permission checks ──────────────────────────────────────────────────

    function hasPermission(permission) {
        const role = getCurrentRole();
        if (!role) return false;
        const perms = PERMISSIONS[role] || [];
        return perms.includes(permission);
    }

    function hasAnyPermission(permissionsArray) {
        return permissionsArray.some(hasPermission);
    }

    function canAccessPage(pageName) {
        // Strip path → just the filename
        const name = pageName.split("/").pop().split("?")[0].toLowerCase();
        const required = PAGE_PERMISSIONS[name];
        if (!required) return true; // no guard defined → open
        return hasPermission(required);
    }

    // ── Guards ─────────────────────────────────────────────────────────────

    /**
     * requirePermission(permission, options)
     * - If user has the permission: returns true.
     * - Otherwise: shows toast/alert, logs audit event, fires notification,
     *   and optionally redirects.
     *
     * options = { redirect: "login.html", silent: false }
     */
    function requirePermission(permission, options = {}) {
        if (hasPermission(permission)) return true;

        const role = getCurrentRole() || "unauthenticated";
        const msg  = "You do not have permission to perform this action.";

        if (!options.silent) {
            if (typeof window.showToast === "function") {
                window.showToast(msg, "error");
            } else {
                alert(msg);
            }
        }

        _logUnauthorizedAccess(permission, role);

        if (options.redirect) {
            setTimeout(() => { window.location.href = options.redirect; }, 800);
        }

        return false;
    }

    function logUnauthorizedAccess(permission) {
        _logUnauthorizedAccess(permission, getCurrentRole() || "unauthenticated");
    }

    function _logUnauthorizedAccess(permission, role) {
        const detail = `Unauthorized access attempt — permission: ${permission}, role: ${role}`;

        // Audit
        if (window.EngiSphereAudit && window.EngiSphereAudit.logAuditEvent) {
            window.EngiSphereAudit.logAuditEvent({
                action:      "unauthorized_access",
                entity_type: "permission",
                message:     detail,
                severity:    "danger"
            });
        }

        // Notification
        if (window.EngiSphereNotifications && window.EngiSphereNotifications.addNotification) {
            window.EngiSphereNotifications.addNotification({
                type:     "unauthorized_access",
                title:    "Access Denied",
                message:  `Permission required: ${permission}`,
                severity: "high"
            });
        }

        console.warn(`[RBAC] ${detail}`);
    }

    // ── DOM guards ─────────────────────────────────────────────────────────

    /**
     * applyPermissionGuards()
     * Reads [data-require-permission] attributes on any element and
     * hides/disables those the current user cannot access.
     *
     * Usage in HTML:
     *   <button data-require-permission="export_pdf">Export PDF</button>
     *   <div data-require-permission="manage_team" data-guard-action="hide">...</div>
     *
     * data-guard-action: "hide" (default) | "disable"
     */
    function applyPermissionGuards() {
        document.querySelectorAll("[data-require-permission]").forEach(el => {
            const permission = el.getAttribute("data-require-permission");
            const action     = el.getAttribute("data-guard-action") || "hide";

            if (!hasPermission(permission)) {
                if (action === "disable") {
                    el.disabled = true;
                    el.title    = "You do not have permission for this action.";
                    el.style.opacity = "0.45";
                    el.style.cursor  = "not-allowed";
                } else {
                    el.style.display = "none";
                }
            }
        });
    }

    // ── Page-level guard ──────────────────────────────────────────────────

    /**
     * guardCurrentPage(options)
     * Call once per page. If the user cannot access the current page,
     * redirect to login (or a "forbidden" message).
     */
    function guardCurrentPage(options = {}) {
        const page   = window.location.pathname.split("/").pop() || "index.html";
        const access = canAccessPage(page);

        if (!access) {
            const role = getCurrentRole() || "unauthenticated";
            console.warn(`[RBAC] Access denied to "${page}" for role "${role}".`);

            _logUnauthorizedAccess("page:" + page, role);

            if (options.redirect !== false) {
                window.location.href = options.redirect || "login.html";
            }
            return false;
        }
        return true;
    }

    // ── Role helpers ───────────────────────────────────────────────────────

    function setRole(role) {
        const r = String(role || "").toLowerCase();
        if (ROLES.includes(r)) {
            localStorage.setItem("engisphere_role", r);
        }
    }

    function getRoleLabel(role) {
        const labels = {
            admin:           "Administrator",
            project_manager: "Project Manager",
            engineer:        "Engineer",
            viewer:          "Viewer",
            client:          "Client"
        };
        return labels[role] || role || "Unknown";
    }

    function getAllRoles()       { return [...ROLES]; }
    function getAllPermissions() { return { ...PERMISSIONS }; }

    // ── Auto-init ──────────────────────────────────────────────────────────

    document.addEventListener("DOMContentLoaded", function () {
        applyPermissionGuards();
    });

    // ── Public API ─────────────────────────────────────────────────────────

    return {
        getCurrentUser,
        getCurrentRole,
        hasPermission,
        hasAnyPermission,
        canAccessPage,
        requirePermission,
        logUnauthorizedAccess,
        applyPermissionGuards,
        guardCurrentPage,
        setRole,
        getRoleLabel,
        getAllRoles,
        getAllPermissions,
        ROLES,
        PERMISSIONS
    };
})();
