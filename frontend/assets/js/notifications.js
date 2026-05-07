/**
 * EngiSphere Notification Center
 *
 * Dual-channel system:
 *   1. "Rich notifications" — stored in localStorage via addNotification()
 *      Used by RBAC, PDF export, progress updates, etc.
 *   2. "Audit-based notifications" — legacy bridge: reads audit logs and
 *      surfaces important ones in the dropdown (backwards-compatible).
 *
 * Storage keys:
 *   engisphere_notifications  — rich notification objects
 *   engisphere_notification_read_at — timestamp of "mark all read"
 */
window.EngiSphereNotifications = (function () {
    "use strict";

    const NOTIF_KEY  = "engisphere_notifications";
    const READ_KEY   = "engisphere_notification_read_at";
    const MAX_STORED = 50;

    // ── Notification types ─────────────────────────────────────────────────
    const TYPES = [
        "progress_update",
        "risk_update",
        "status_update",
        "team_assignment",
        "pdf_export",
        "unauthorized_access",
        "high_risk_alert",
        "system"
    ];

    // ── Storage helpers ────────────────────────────────────────────────────

    function _load() {
        try {
            const raw = localStorage.getItem(NOTIF_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (_) { return []; }
    }

    function _save(notifications) {
        try {
            localStorage.setItem(NOTIF_KEY, JSON.stringify(notifications.slice(0, MAX_STORED)));
        } catch (_) { /* storage full */ }
    }

    // ── Public CRUD API ────────────────────────────────────────────────────

    /**
     * addNotification(notification)
     * notification = { type, title, message, severity, projectId }
     * Returns the created notification object.
     */
    function addNotification(notification) {
        const notifications = _load();
        const entry = {
            id:        "notif_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
            type:      notification.type      || "system",
            title:     notification.title     || "Notification",
            message:   notification.message   || "",
            severity:  notification.severity  || "info",    // info | success | warning | high | danger
            projectId: notification.projectId || null,
            createdAt: new Date().toISOString(),
            read:      false
        };
        notifications.unshift(entry);
        _save(notifications);

        // Refresh UI if open
        refreshNotifications();
        return entry;
    }

    function getNotifications() {
        return _load();
    }

    function getUnreadNotifications() {
        return _load().filter(n => !n.read);
    }

    function markNotificationAsRead(id) {
        const notifications = _load().map(n => n.id === id ? { ...n, read: true } : n);
        _save(notifications);
        refreshNotifications();
    }

    function markAllNotificationsAsRead() {
        const notifications = _load().map(n => ({ ...n, read: true }));
        _save(notifications);
        // Also bump the legacy timestamp for audit-based items
        localStorage.setItem(READ_KEY, Date.now().toString());
        refreshNotifications();
    }

    function clearNotifications() {
        _save([]);
        localStorage.removeItem(READ_KEY);
        refreshNotifications();
    }

    // ── Convenience trigger functions ──────────────────────────────────────

    function notifyProgressUpdate(projectName, progress, projectId) {
        addNotification({
            type:      "progress_update",
            title:     "Progress Updated",
            message:   `${projectName} progress updated to ${progress}%`,
            severity:  "success",
            projectId: projectId
        });
    }

    function notifyRiskAlert(projectName, riskLevel, projectId) {
        addNotification({
            type:      riskLevel && riskLevel.toLowerCase() === "high" ? "high_risk_alert" : "risk_update",
            title:     riskLevel === "High" ? "⚠ High Risk Alert" : "Risk Level Updated",
            message:   `${projectName} risk level changed to ${riskLevel}`,
            severity:  riskLevel && riskLevel.toLowerCase() === "high" ? "high" : "warning",
            projectId: projectId
        });
    }

    function notifyStatusUpdate(projectName, status, projectId) {
        addNotification({
            type:      "status_update",
            title:     "Status Changed",
            message:   `${projectName} status changed to ${status}`,
            severity:  status && status.toLowerCase() === "completed" ? "success" : "info",
            projectId: projectId
        });
    }

    function notifyPdfExport() {
        addNotification({
            type:     "pdf_export",
            title:    "PDF Exported",
            message:  "Project progress report was exported successfully.",
            severity: "success"
        });
    }

    function notifyTeamAssignment(memberName, projectName) {
        addNotification({
            type:    "team_assignment",
            title:   "Team Assignment",
            message: `${memberName} was assigned to ${projectName}`,
            severity:"info"
        });
    }

    function notifyUnauthorizedAccess(permission) {
        addNotification({
            type:     "unauthorized_access",
            title:    "Access Denied",
            message:  `Unauthorized attempt — permission required: ${permission}`,
            severity: "high"
        });
    }

    // ── Legacy audit bridge ────────────────────────────────────────────────
    // Keeps backward compatibility: reads audit logs to surface items in
    // the dropdown when no rich notifications exist.

    function _getAuditLogs() {
        if (window.EngiSphereAudit && window.EngiSphereAudit.getAuditLogs) {
            return window.EngiSphereAudit.getAuditLogs();
        }
        try {
            const raw = localStorage.getItem("engisphere_audit_logs");
            return raw ? JSON.parse(raw) : [];
        } catch (_) { return []; }
    }

    const _IMPORTANT_AUDIT_ACTIONS = [
        "project_created", "project_updated", "project_deleted",
        "team_member_invited",
        "pdf_export_clicked",
        "project_progress_updated",
        "project_status_changed",
        "project_risk_changed",
        "ai_radar_opened", "ai_radar_project_loaded",
        "ai_analysis_completed",
        "unauthorized_access"
    ];

    function _getImportantAuditLogs() {
        return _getAuditLogs().filter(l => _IMPORTANT_AUDIT_ACTIONS.includes(l.action));
    }

    function _auditLogToNotif(log) {
        return {
            id:        log.id,
            type:      log.action,
            title:     _auditActionTitle(log.action),
            message:   _auditMessage(log),
            severity:  log.severity || "info",
            projectId: log.project_id || log.entity_id || null,
            createdAt: log.created_at,
            read:      false,
            _isAudit:  true
        };
    }

    function _auditActionTitle(action) {
        const map = {
            project_progress_updated: "Progress Updated",
            project_status_changed:   "Status Changed",
            project_risk_changed:     "Risk Updated",
            project_created:          "Project Created",
            project_updated:          "Project Updated",
            project_deleted:          "Project Deleted",
            team_member_invited:      "Team Invitation",
            pdf_export_clicked:       "PDF Exported",
            ai_radar_opened:          "AI Radar",
            ai_radar_project_loaded:  "AI Radar",
            ai_analysis_completed:    "AI Analysis",
            unauthorized_access:      "Access Denied"
        };
        return map[action] || "Event";
    }

    function _auditMessage(log) {
        if (log.action === "ai_radar_opened" || log.action === "ai_radar_project_loaded") {
            const m = log.message.match(/:\s*(.*)/);
            return m ? `AI Radar is ready for ${m[1]}` : log.message;
        }
        if (log.action === "team_member_invited") {
            const m = log.message.match(/:\s*(.*)/);
            return m ? `Team invitation sent to ${m[1]}` : log.message;
        }
        return log.message;
    }

    // ── Merged notifications list ──────────────────────────────────────────
    // Merges rich notifications + important audit log events, deduped by id.

    function _getMergedNotifications(limit) {
        const rich  = _load();
        const audit = _getImportantAuditLogs().map(_auditLogToNotif);
        const readAt = Number(localStorage.getItem(READ_KEY) || 0);

        // Mark audit items as read if timestamp is older than readAt
        const markedAudit = audit.map(n => ({
            ...n,
            read: new Date(n.createdAt).getTime() <= readAt
        }));

        // Merge, deduplicate by id, sort newest first
        const combined = [...rich, ...markedAudit];
        const seen = new Set();
        const unique = combined.filter(n => {
            if (seen.has(n.id)) return false;
            seen.add(n.id);
            return true;
        });

        unique.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        return limit ? unique.slice(0, limit) : unique;
    }

    function _getUnreadCount() {
        return _getMergedNotifications().filter(n => !n.read).length;
    }

    // ── UI rendering ───────────────────────────────────────────────────────

    let currentContainerId = null;
    let isDropdownOpen     = false;

    function initNotificationCenter(containerId) {
        currentContainerId = containerId;
        const container = document.getElementById(containerId);
        if (!container) return;

        _ensureStyles();
        _renderHTML(container);
        _setupEvents();
    }

    function _ensureStyles() {
        if (document.getElementById("notificationStyles")) return;
        const style = document.createElement("style");
        style.id = "notificationStyles";
        style.innerHTML = `
            .notif-wrapper { position: relative; display: inline-flex; align-items: center; }
            .notif-bell {
                background: transparent; border: none; color: var(--muted);
                font-size: 18px; cursor: pointer; padding: 8px; position: relative;
                transition: color 0.2s; display: flex; align-items: center; justify-content: center;
            }
            .notif-bell:hover { color: var(--text); }
            .notif-badge {
                position: absolute; top: 4px; right: 4px; background: var(--danger, #ef4444);
                color: #fff; font-size: 9px; font-weight: bold; border-radius: 50%;
                min-width: 14px; height: 14px; display: flex; align-items: center;
                justify-content: center; border: 2px solid var(--bg); padding: 0 3px;
            }
            .notif-dropdown {
                position: absolute; top: 100%; right: 0; margin-top: 10px; width: 340px;
                background: var(--panel, #1e293b); border: 1px solid var(--border, rgba(255,255,255,0.1));
                border-radius: 12px; box-shadow: var(--shadow, 0 10px 25px rgba(0,0,0,0.5));
                z-index: 1000; display: none; flex-direction: column; overflow: hidden;
                backdrop-filter: blur(10px);
            }
            .notif-dropdown.show { display: flex; }
            .notif-header {
                padding: 12px 16px; border-bottom: 1px solid var(--border, rgba(255,255,255,0.1));
                display: flex; align-items: center; justify-content: space-between; gap: 8px;
            }
            .notif-header h4 { margin: 0; font-size: 14px; color: var(--text, #fff); flex: 1; }
            .notif-header-actions { display: flex; gap: 8px; align-items: center; }
            .notif-action-btn {
                background: transparent; border: none; color: var(--primary, #3b82f6);
                font-size: 11px; cursor: pointer; font-weight: 600; white-space: nowrap;
            }
            .notif-action-btn:hover { text-decoration: underline; }
            .notif-action-btn.danger { color: var(--danger, #ef4444); }
            .notif-body { max-height: 360px; overflow-y: auto; padding: 0; margin: 0; list-style: none; }
            .notif-item {
                padding: 12px 16px; border-bottom: 1px solid var(--border, rgba(255,255,255,0.05));
                display: flex; gap: 12px; align-items: flex-start; cursor: pointer; transition: background 0.2s;
            }
            .notif-item:last-child { border-bottom: none; }
            .notif-item:hover { background: rgba(255,255,255,0.04) !important; }
            .notif-item.unread { background: rgba(59,130,246,0.05); }
            .notif-icon {
                width: 30px; height: 30px; border-radius: 50%; display: flex;
                align-items: center; justify-content: center; flex-shrink: 0;
            }
            .notif-content { flex: 1; min-width: 0; }
            .notif-title { font-size: 12px; font-weight: 700; color: var(--text, #fff); margin-bottom: 2px; }
            .notif-msg { font-size: 12px; color: var(--muted, #94a3b8); line-height: 1.4; margin-bottom: 4px; }
            .notif-time { font-size: 10px; color: var(--muted, #94a3b8); }
            .notif-unread-dot {
                display: inline-block; width: 6px; height: 6px; border-radius: 50%;
                background: var(--primary, #3b82f6); margin-left: 6px; flex-shrink: 0;
            }
            .notif-arrow { color: var(--muted); align-self: center; margin-left: 4px; flex-shrink: 0; }
            .notif-empty { padding: 24px 16px; text-align: center; color: var(--muted); font-size: 13px; }
        `;
        document.head.appendChild(style);
    }

    function _escapeHtml(text) {
        const div = document.createElement("div");
        div.textContent = String(text ?? "");
        return div.innerHTML;
    }

    function _relativeTime(dateString) {
        if (!dateString) return "";
        const diff = Date.now() - new Date(dateString).getTime();
        const secs  = Math.floor(diff / 1000);
        const mins  = Math.floor(secs / 60);
        const hours = Math.floor(mins / 60);
        const days  = Math.floor(hours / 24);
        if (secs  < 60)  return "Just now";
        if (mins  < 60)  return `${mins}m ago`;
        if (hours < 24)  return `${hours}h ago`;
        if (days  === 1) return "Yesterday";
        return new Date(dateString).toLocaleDateString();
    }

    function _severityProps(severity) {
        switch (String(severity).toLowerCase()) {
            case "success":  return { color: "var(--success,  #10b981)", icon: "fa-check" };
            case "warning":  return { color: "var(--warning,  #f59e0b)", icon: "fa-exclamation" };
            case "high":
            case "danger":   return { color: "var(--danger,   #ef4444)", icon: "fa-shield-virus" };
            default:         return { color: "var(--primary,  #3b82f6)", icon: "fa-info" };
        }
    }

    function _notifUrl(notif) {
        const id = notif.projectId;
        switch (notif.type) {
            case "progress_update":
            case "status_update":
            case "risk_update":
            case "high_risk_alert":
                return id ? `project_details.html?projectId=${id}` : "project_details.html";
            case "pdf_export":
            case "pdf_export_clicked":
                return "reports.html";
            case "team_assignment":
            case "team_member_invited":
                return "team_access.html";
            case "unauthorized_access":
                return null;
            case "ai_radar_opened":
            case "ai_radar_project_loaded":
            case "ai_analysis_completed":
                return id ? `solutions.html?projectId=${id}` : "solutions.html";
            default:
                return null;
        }
    }

    function _renderHTML(container) {
        const count    = _getUnreadCount();
        const badgeHtml = count > 0
            ? `<span class="notif-badge">${count > 99 ? "99+" : count}</span>`
            : "";

        container.innerHTML = `
            <div class="notif-wrapper" id="notifWrapper">
                <button class="notif-bell" id="notifBellBtn" type="button" aria-label="Notifications">
                    <i class="far fa-bell"></i>
                    ${badgeHtml}
                </button>
                <div class="notif-dropdown" id="notifDropdown">
                    <div class="notif-header">
                        <h4>Notifications</h4>
                        <div class="notif-header-actions">
                            <button class="notif-action-btn" id="notifReadAllBtn" type="button">Mark all read</button>
                            <button class="notif-action-btn danger" id="notifClearBtn" type="button">Clear</button>
                        </div>
                    </div>
                    <ul class="notif-body" id="notifList"></ul>
                </div>
            </div>
        `;
    }

    function _populateList() {
        const list = document.getElementById("notifList");
        if (!list) return;

        const items = _getMergedNotifications(8);
        if (!items.length) {
            list.innerHTML = `<li class="notif-empty">No notifications yet.</li>`;
            return;
        }

        list.innerHTML = items.map(n => {
            const props = _severityProps(n.severity);
            const url   = _notifUrl(n);
            const unreadDot = !n.read ? `<span class="notif-unread-dot"></span>` : "";
            return `
                <li class="notif-item ${!n.read ? "unread" : ""}"
                    style="${!n.read ? "background: rgba(59,130,246,0.06);" : ""}"
                    data-notif-id="${_escapeHtml(n.id)}"
                    data-notif-url="${url ? _escapeHtml(url) : ""}">
                    <div class="notif-icon" style="background:${props.color}15; color:${props.color};">
                        <i class="fas ${props.icon} fa-sm"></i>
                    </div>
                    <div class="notif-content">
                        <div class="notif-title">${_escapeHtml(n.title)}${unreadDot}</div>
                        <div class="notif-msg">${_escapeHtml(n.message)}</div>
                        <div class="notif-time">${_relativeTime(n.createdAt)}</div>
                    </div>
                    ${url ? `<div class="notif-arrow"><i class="fas fa-chevron-right fa-xs"></i></div>` : ""}
                </li>
            `;
        }).join("");
    }

    function _setupEvents() {
        const bellBtn    = document.getElementById("notifBellBtn");
        const dropdown   = document.getElementById("notifDropdown");
        const readAllBtn = document.getElementById("notifReadAllBtn");
        const clearBtn   = document.getElementById("notifClearBtn");

        if (bellBtn) {
            bellBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                isDropdownOpen = !isDropdownOpen;
                dropdown.classList.toggle("show", isDropdownOpen);
                if (isDropdownOpen) _populateList();
            });
        }

        if (readAllBtn) {
            readAllBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                markAllNotificationsAsRead();
            });
        }

        if (clearBtn) {
            clearBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                clearNotifications();
            });
        }

        if (dropdown) {
            dropdown.addEventListener("click", (e) => {
                const item = e.target.closest(".notif-item");
                if (!item) return;
                const id  = item.getAttribute("data-notif-id");
                const url = item.getAttribute("data-notif-url");
                if (id) markNotificationAsRead(id);
                if (url) {
                    isDropdownOpen = false;
                    dropdown.classList.remove("show");
                    window.location.href = url;
                }
            });
        }

        document.addEventListener("click", (e) => {
            if (isDropdownOpen && !e.target.closest("#notifWrapper")) {
                isDropdownOpen = false;
                if (dropdown) dropdown.classList.remove("show");
            }
        });
    }

    // ── Render standalone notification list (full page) ────────────────────

    function renderNotifications(containerId) {
        const container = document.getElementById(containerId || "notifFullList");
        if (!container) return;

        const all = _getMergedNotifications();
        if (!all.length) {
            container.innerHTML = `<p style="text-align:center; color:var(--muted); padding:32px;">No notifications.</p>`;
            return;
        }

        container.innerHTML = all.map(n => {
            const props = _severityProps(n.severity);
            const url   = _notifUrl(n);
            return `
                <div style="display:flex; gap:14px; padding:14px 0; border-bottom:1px solid var(--border); align-items:flex-start;">
                    <div style="width:36px; height:36px; border-radius:50%; background:${props.color}15;
                                color:${props.color}; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                        <i class="fas ${props.icon}"></i>
                    </div>
                    <div style="flex:1; min-width:0;">
                        <div style="font-size:13px; font-weight:700; color:var(--text); margin-bottom:3px;">
                            ${_escapeHtml(n.title)}
                            ${!n.read ? `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--primary);margin-left:6px;"></span>` : ""}
                        </div>
                        <div style="font-size:12px; color:var(--muted); margin-bottom:4px;">${_escapeHtml(n.message)}</div>
                        <div style="font-size:11px; color:var(--muted);">${_relativeTime(n.createdAt)}</div>
                    </div>
                    ${url ? `<a href="${_escapeHtml(url)}" style="color:var(--primary); font-size:12px; white-space:nowrap; align-self:center;">View →</a>` : ""}
                </div>
            `;
        }).join("");
    }

    // ── Refresh helper (called by other modules) ───────────────────────────

    function refreshNotifications() {
        if (!currentContainerId) return;
        const container = document.getElementById(currentContainerId);
        if (!container) return;
        const wasOpen = isDropdownOpen;
        _renderHTML(container);
        _setupEvents();
        if (wasOpen) {
            const dd = document.getElementById("notifDropdown");
            if (dd) {
                dd.classList.add("show");
                _populateList();
            }
        }
    }

    // ── Public API ─────────────────────────────────────────────────────────

    return {
        // Core CRUD
        addNotification,
        getNotifications,
        getUnreadNotifications,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        clearNotifications,

        // Convenience triggers
        notifyProgressUpdate,
        notifyRiskAlert,
        notifyStatusUpdate,
        notifyPdfExport,
        notifyTeamAssignment,
        notifyUnauthorizedAccess,

        // UI
        initNotificationCenter,
        refreshNotifications,
        renderNotifications,

        // Exposed for testing
        TYPES
    };
})();
