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
    const VERSION_KEY = "engisphere_notifications_version";
    const CURRENT_VERSION = "2";
    const MAX_STORED = 50;

    // ── Demo Seeding (Phase 6E) ───────────────────────────────────────────
    
    function _seedDemoData() {
        const stored = localStorage.getItem(NOTIF_KEY);
        if (stored && JSON.parse(stored).length > 0) return;

        const demoNotifs = [
            {
                id: "demo_1",
                type: "high_risk_alert",
                severity: "high",
                projectId: 1,
                projectTitle: "Dubai Smart Bridge",
                title: "High risk project detected",
                message: "Dubai Smart Bridge has a risk score of 51/100 and requires immediate management review.",
                createdAt: new Date().toISOString(),
                read: false,
                target: "project-profile",
                riskScore: 51
            },
            {
                id: "demo_2",
                type: "system",
                severity: "warning",
                projectId: 2,
                projectTitle: "Riyadh Metro Expansion",
                title: "Task structure missing",
                message: "Riyadh Metro Expansion needs defined milestones to improve delivery visibility.",
                createdAt: new Date(Date.now() - 3600000).toISOString(),
                read: false,
                target: "project-profile"
            },
            {
                id: "demo_3",
                type: "high_risk_alert",
                severity: "high",
                projectId: 3,
                projectTitle: "Doha Energy Control Center",
                title: "High risk project detected",
                message: "Doha Energy Control Center has been flagged for analysis due to budget variance.",
                createdAt: new Date(Date.now() - 7200000).toISOString(),
                read: false,
                target: "ai-radar",
                riskScore: 50
            },
            {
                id: "demo_4",
                type: "ai",
                severity: "success",
                projectId: 4,
                projectTitle: "Riyadh Business Innovation Tower",
                title: "AI analysis completed",
                message: "Operational feasibility for the Business Innovation Tower has been calculated.",
                createdAt: new Date(Date.now() - 86400000).toISOString(),
                read: true,
                target: "ai-radar"
            },
            {
                id: "demo_5",
                type: "project",
                severity: "info",
                projectId: 1,
                projectTitle: "Dubai Smart Bridge",
                title: "Project details opened",
                message: "User 'Manager' accessed the project profile for Dubai Smart Bridge.",
                createdAt: new Date(Date.now() - 172800000).toISOString(),
                read: true,
                target: "project-profile"
            }
        ];
        _save(demoNotifs);
    }
    _seedDemoData();

    // ── Migration / Reset (Phase 4 Hard Fix) ───────────────────────────────
    
    (function _migrate() {
        try {
            const storedVersion = localStorage.getItem(VERSION_KEY);
            if (storedVersion !== CURRENT_VERSION) {
                // Clear old notification spam keys
                const keysToClear = [
                    "engisphere_notifications",
                    "engisphere_dashboard_notifications",
                    "engisphere_notification_cache",
                    "engisphere_notifications_read_at"
                ];
                keysToClear.forEach(k => localStorage.removeItem(k));
                
                // We keep read_ids and cleared_ids for now as they are set-based
                localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
                console.log(`Notification system migrated to v${CURRENT_VERSION}`);
            }
        } catch (e) {
            console.error("Migration failed", e);
        }
    })();

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

    // ── Persistence Helpers (Phase 4) ────────────────────────────────────────
    
    function _getReadIds() {
        try {
            const raw = localStorage.getItem("engisphere_notifications_read_ids");
            return new Set(raw ? JSON.parse(raw) : []);
        } catch (_) { return new Set(); }
    }

    function _saveReadIds(ids) {
        localStorage.setItem("engisphere_notifications_read_ids", JSON.stringify(Array.from(ids)));
    }

    function _getClearedIds() {
        try {
            const raw = localStorage.getItem("engisphere_notifications_cleared_ids");
            return new Set(raw ? JSON.parse(raw) : []);
        } catch (_) { return new Set(); }
    }

    function _saveClearedIds(ids) {
        localStorage.setItem("engisphere_notifications_cleared_ids", JSON.stringify(Array.from(ids)));
    }

    // ── Smart Notification Logic (Phase 4) ──────────────────────────────────
    
    /**
     * buildSmartNotifications(projects)
     * Generates a normalized, deduplicated list of intelligent notifications
     * based on project state and existing alerts.
     */
    function buildSmartNotifications(projects = []) {
        const smartNotifs = [];
        const clearedIds = _getClearedIds();
        const readIds = _getReadIds();
        
        // 1. Project-State Intelligence (Priority-based, max ONE per project)
        projects.forEach(p => {
            const merged = window.EngiSphereProgress ? window.EngiSphereProgress.mergeProjectProgress(p) : p;
            const status = String(merged.status || "").toLowerCase();
            const projectId = merged.id;
            const projectName = merged.title || "Untitled Project";

            // SKIP completed projects for automated risk/status alerts
            if (status === "completed" || status === "done") return;

            let analysis = null;
            if (window.EngiSphereAIAnalysis) {
                analysis = window.EngiSphereAIAnalysis.analyzeProject(merged);
            }
            const riskScore = analysis ? analysis.riskScore : 0;
            const hasTasks = merged.tasks && merged.tasks.length > 0;

            let projectNotif = null;

            // Priority 1: High Risk
            if (riskScore >= 50) {
                projectNotif = {
                    id: `smart_risk_high_${projectId}`,
                    stableKey: `risk:${projectId}:high`,
                    type: "high_risk_alert",
                    severity: "high",
                    projectId: projectId,
                    title: "High risk project detected",
                    message: `${projectName} has a risk score of ${riskScore}/100 and requires management review.`,
                    createdAt: new Date().toISOString()
                };
            } 
            // Priority 2: Missing Task Structure
            else if ((status === "active" || status === "in progress") && !hasTasks) {
                projectNotif = {
                    id: `smart_task_missing_${projectId}`,
                    stableKey: `task_missing:${projectId}`,
                    type: "system",
                    severity: "warning",
                    projectId: projectId,
                    title: "Task structure missing",
                    message: `${projectName} needs defined milestones to improve delivery visibility.`,
                    createdAt: new Date().toISOString()
                };
            }
            // Priority 3: Pending Planning
            else if (status === "pending") {
                projectNotif = {
                    id: `smart_status_pending_${projectId}`,
                    stableKey: `status_pending:${projectId}`,
                    type: "status_update",
                    severity: "info",
                    projectId: projectId,
                    title: "Pending project awaiting planning",
                    message: `${projectName} requires planning confirmation before execution.`,
                    createdAt: new Date().toISOString()
                };
            }
            // Priority 4: Moderate Risk
            else if (riskScore >= 35) {
                projectNotif = {
                    id: `smart_risk_mod_${projectId}`,
                    stableKey: `risk:${projectId}:mod`,
                    type: "risk_update",
                    severity: "warning",
                    projectId: projectId,
                    title: "Project risk monitoring",
                    message: `${projectName} shows moderate risk. Monitor schedule and ownership.`,
                    createdAt: new Date().toISOString()
                };
            }

            if (projectNotif && !clearedIds.has(projectNotif.id)) {
                smartNotifs.push({
                    ...projectNotif,
                    read: readIds.has(projectNotif.id)
                });
            }
        });

        // 2. Load existing rich notifications
        const rich = _load();
        
        // 3. Merge & Deduplicate with Stable Keys
        const combined = [...smartNotifs, ...rich];
        const unique = [];
        const seenKeys = new Map(); // key -> notification object

        combined.forEach(n => {
            // Generate stable key if not present
            // For risk, we use a bucketed score or priority level
            let key = n.stableKey;
            if (!key) {
                if (n.type === "high_risk_alert" || n.type === "risk_update") {
                    // Risk Bucket: round to nearest 5 for some stability but allowing updates
                    const scoreMatch = n.message.match(/(\d+)\/100/);
                    const score = scoreMatch ? scoreMatch[1] : "0";
                    key = `risk:${n.projectId || n.title}:${score}`;
                } else {
                    key = n.projectId ? `${n.type}:${n.projectId}` : n.id;
                }
            }

            if (!clearedIds.has(n.id)) {
                const existing = seenKeys.get(key);
                // Keep the newest one by timestamp
                if (!existing || new Date(n.createdAt) > new Date(existing.createdAt)) {
                    seenKeys.set(key, {
                        ...n,
                        read: n.read || readIds.has(n.id)
                    });
                }
            }
        });

        const result = Array.from(seenKeys.values());
        result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        return result;
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
        return _getMergedNotifications();
    }

    function getUnreadNotifications() {
        return _getMergedNotifications().filter(n => !n.read);
    }

    function markNotificationAsRead(id) {
        const readIds = _getReadIds();
        readIds.add(id);
        _saveReadIds(readIds);
        
        const notifications = _load().map(n => n.id === id ? { ...n, read: true } : n);
        _save(notifications);
        refreshNotifications();
    }

    function markAllNotificationsAsRead() {
        // We use the current smart notifications as the baseline
        const projects = window.EngiSphereProjects || [];
        const currentNotifs = buildSmartNotifications(projects);
        
        const readIds = _getReadIds();
        currentNotifs.forEach(n => readIds.add(n.id));
        _saveReadIds(readIds);

        const notifications = _load().map(n => ({ ...n, read: true }));
        _save(notifications);
        
        localStorage.setItem(READ_KEY, Date.now().toString());
        refreshNotifications();
    }

    function clearNotifications() {
        const projects = window.EngiSphereProjects || [];
        const currentNotifs = buildSmartNotifications(projects);
        
        const clearedIds = _getClearedIds();
        currentNotifs.forEach(n => clearedIds.add(n.id));
        _saveClearedIds(clearedIds);

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
        const projects = window.EngiSphereProjects || [];
        const smart = buildSmartNotifications(projects);
        return limit ? smart.slice(0, limit) : smart;
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
                background: #ffffff; border: 1px solid #e2e8f0;
                border-radius: 16px; box-shadow: 0 18px 40px rgba(15, 23, 42, 0.12);
                z-index: 1000; display: none; flex-direction: column; overflow: hidden;
            }
            body.dark-theme .notif-dropdown {
                background: var(--sidebar, #0f172a); border: 1px solid rgba(255,255,255,0.1);
                box-shadow: 0 20px 40px rgba(0,0,0,0.4);
            }
            .notif-dropdown.show { display: flex; }
            .notif-header {
                padding: 14px 18px; border-bottom: 1px solid #f1f5f9;
                display: flex; align-items: center; justify-content: space-between; gap: 8px;
            }
            body.dark-theme .notif-header { border-bottom: 1px solid rgba(255,255,255,0.08); }
            .notif-header h4 { margin: 0; font-size: 14px; font-weight: 800; color: #0f172a; flex: 1; }
            body.dark-theme .notif-header h4 { color: #fff; }
            .notif-header-actions { display: flex; gap: 10px; align-items: center; }
            .notif-action-btn {
                background: transparent; border: none; color: var(--primary);
                font-size: 11px; cursor: pointer; font-weight: 700; white-space: nowrap;
            }
            .notif-action-btn:hover { text-decoration: underline; }
            .notif-body { max-height: 380px; overflow-y: auto; padding: 0; margin: 0; list-style: none; }
            .notif-item {
                padding: 14px 18px; border-bottom: 1px solid #f1f5f9;
                display: flex; gap: 12px; align-items: flex-start; cursor: pointer; transition: 0.2s;
            }
            body.dark-theme .notif-item { border-bottom: 1px solid rgba(255,255,255,0.05); }
            .notif-item:last-child { border-bottom: none; }
            .notif-item:hover { background: #f8fafc; }
            body.dark-theme .notif-item:hover { background: rgba(255,255,255,0.04); }
            .notif-item.unread { background: rgba(37, 99, 235, 0.03); }
            .notif-icon {
                width: 34px; height: 34px; border-radius: 10px; display: flex;
                align-items: center; justify-content: center; flex-shrink: 0;
            }
            .notif-content { flex: 1; min-width: 0; }
            .notif-title { font-size: 12px; font-weight: 800; color: #0f172a; margin-bottom: 3px; }
            body.dark-theme .notif-title { color: #fff; }
            .notif-msg { font-size: 12px; color: #64748b; line-height: 1.5; margin-bottom: 4px; }
            body.dark-theme .notif-msg { color: #94a3b8; }
            .notif-time { font-size: 10px; color: #94a3b8; font-weight: 600; }
            .notif-unread-dot {
                display: inline-block; width: 6px; height: 6px; border-radius: 50%;
                background: #3b82f6; margin-left: 6px;
            }
            .notif-footer {
                padding: 12px; text-align: center; border-top: 1px solid #f1f5f9;
            }
            body.dark-theme .notif-footer { border-top: 1px solid rgba(255,255,255,0.08); }
            .notif-view-all {
                font-size: 12px; font-weight: 800; color: var(--primary); text-decoration: none;
            }
            .notif-empty { padding: 40px 20px; text-align: center; color: #64748b; font-size: 13px; font-weight: 600; }
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
        return `notifications.html?id=${notif.id}`;
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
                            <button class="notif-action-btn" id="notifClearBtn" type="button" style="color:#ef4444">Clear</button>
                        </div>
                    </div>
                    <ul class="notif-body" id="notifList"></ul>
                    <div class="notif-footer">
                        <a href="notifications.html" class="notif-view-all">View all notifications</a>
                    </div>
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
        
        // Broadcast update to other dashboard components
        window.dispatchEvent(new CustomEvent('engisphereNotificationsUpdated'));
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
        relativeTime: _relativeTime,

        // Exposed for testing
        TYPES
    };
})();
