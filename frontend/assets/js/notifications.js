window.EngiSphereNotifications = (function () {
    const READ_KEY = "engisphere_notification_read_at";

    function getLogs() {
        if (window.EngiSphereAudit && window.EngiSphereAudit.getAuditLogs) {
            return window.EngiSphereAudit.getAuditLogs();
        }
        try {
            const data = localStorage.getItem("engisphere_audit_logs");
            return data ? JSON.parse(data) : [];
        } catch (e) {
            return [];
        }
    }

    function getImportantLogs() {
        const importantActions = [
            "ai_radar_opened",
            "ai_radar_project_loaded",
            "project_created",
            "project_updated",
            "project_deleted",
            "project_details_opened",
            "reports_loaded",
            "team_member_invited",
            "pdf_export_clicked",
            "dashboard_loaded"
        ];
        return getLogs().filter(log => importantActions.includes(log.action));
    }

    function getUnreadCount() {
        const readAt = localStorage.getItem(READ_KEY) || 0;
        const readTimestamp = Number(readAt);
        const logs = getImportantLogs();
        return logs.filter(log => new Date(log.created_at).getTime() > readTimestamp).length;
    }

    function markAllAsRead() {
        localStorage.setItem(READ_KEY, Date.now().toString());
        refreshNotifications();
    }

    function escapeHtml(text) {
        const div = document.createElement("div");
        div.textContent = String(text ?? "");
        return div.innerHTML;
    }

    let currentContainerId = null;
    let isDropdownOpen = false;

    function initNotificationCenter(containerId) {
        currentContainerId = containerId;
        const container = document.getElementById(containerId);
        if (!container) return;

        // Apply styles if not already added
        if (!document.getElementById("notificationStyles")) {
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
                    min-width: 14px; height: 14px; display: flex; align-items: center; justify-content: center;
                    border: 2px solid var(--bg); padding: 0 3px;
                }
                .notif-dropdown {
                    position: absolute; top: 100%; right: 0; margin-top: 10px; width: 320px;
                    background: var(--panel, #1e293b); border: 1px solid var(--border, rgba(255,255,255,0.1));
                    border-radius: 12px; box-shadow: var(--shadow, 0 10px 25px rgba(0,0,0,0.5));
                    z-index: 1000; display: none; flex-direction: column; overflow: hidden;
                    backdrop-filter: blur(10px);
                }
                .notif-dropdown.show { display: flex; }
                .notif-header {
                    padding: 12px 16px; border-bottom: 1px solid var(--border, rgba(255,255,255,0.1));
                    display: flex; align-items: center; justify-content: space-between;
                }
                .notif-header h4 { margin: 0; font-size: 14px; color: var(--text, #fff); }
                .notif-read-all {
                    background: transparent; border: none; color: var(--primary, #3b82f6);
                    font-size: 12px; cursor: pointer; font-weight: 600;
                }
                .notif-read-all:hover { text-decoration: underline; }
                .notif-body { max-height: 340px; overflow-y: auto; padding: 0; margin: 0; list-style: none; }
                .notif-item {
                    padding: 12px 16px; border-bottom: 1px solid var(--border, rgba(255,255,255,0.05));
                    display: flex; gap: 12px; align-items: flex-start;
                }
                .notif-item:last-child { border-bottom: none; }
                .notif-icon {
                    width: 28px; height: 28px; border-radius: 50%; display: flex;
                    align-items: center; justify-content: center; flex-shrink: 0;
                }
                .notif-content { flex: 1; min-width: 0; }
                .notif-msg { font-size: 13px; color: var(--text, #fff); line-height: 1.4; margin-bottom: 4px; }
                .notif-time { font-size: 11px; color: var(--muted, #94a3b8); }
                .notif-empty { padding: 20px; text-align: center; color: var(--muted); font-size: 13px; }
            `;
            document.head.appendChild(style);
        }

        renderHTML(container);
        setupEvents();
    }

    function renderHTML(container) {
        const count = getUnreadCount();
        const badgeHtml = count > 0 ? `<span class="notif-badge">${count > 99 ? '99+' : count}</span>` : '';
        
        container.innerHTML = `
            <div class="notif-wrapper" id="notifWrapper">
                <button class="notif-bell" id="notifBellBtn" type="button" aria-label="Notifications">
                    <i class="far fa-bell"></i>
                    ${badgeHtml}
                </button>
                <div class="notif-dropdown" id="notifDropdown">
                    <div class="notif-header">
                        <h4>Notifications</h4>
                        <button class="notif-read-all" id="notifReadAllBtn" type="button">Mark all as read</button>
                    </div>
                    <ul class="notif-body" id="notifList"></ul>
                </div>
            </div>
        `;
    }

    function getRelativeTime(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffSecs = Math.floor(diffMs / 1000);
        const diffMins = Math.floor(diffSecs / 60);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffSecs < 60) return "Just now";
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays === 1) return "Yesterday";
        return date.toLocaleDateString();
    }

    function getSeverityProps(severity) {
        switch (severity) {
            case 'success': return { color: 'var(--success, #10b981)', icon: 'fa-check' };
            case 'warning': return { color: 'var(--warning, #f59e0b)', icon: 'fa-exclamation' };
            case 'danger': return { color: 'var(--danger, #ef4444)', icon: 'fa-times' };
            default: return { color: 'var(--primary, #3b82f6)', icon: 'fa-info' };
        }
    }

    function populateList() {
        const list = document.getElementById("notifList");
        if (!list) return;

        const logs = getImportantLogs().slice(0, 8);
        if (logs.length === 0) {
            list.innerHTML = `<li class="notif-empty">No notifications yet.</li>`;
            return;
        }

        const readAt = localStorage.getItem(READ_KEY) || 0;
        const readTimestamp = Number(readAt);

        list.innerHTML = logs.map(log => {
            const props = getSeverityProps(log.severity);
            const time = getRelativeTime(log.created_at);
            const isUnread = new Date(log.created_at).getTime() > readTimestamp;
            const unreadDot = isUnread ? `<span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:var(--primary); margin-left:6px;"></span>` : '';

            return `
                <li class="notif-item" style="${isUnread ? 'background: rgba(255,255,255,0.02);' : ''}">
                    <div class="notif-icon" style="background: ${props.color}15; color: ${props.color};">
                        <i class="fas ${props.icon} fa-sm"></i>
                    </div>
                    <div class="notif-content">
                        <div class="notif-msg">${escapeHtml(log.message)}${unreadDot}</div>
                        <div class="notif-time">${time}</div>
                    </div>
                </li>
            `;
        }).join("");
    }

    function setupEvents() {
        const bellBtn = document.getElementById("notifBellBtn");
        const dropdown = document.getElementById("notifDropdown");
        const readAllBtn = document.getElementById("notifReadAllBtn");

        if (bellBtn) {
            bellBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                isDropdownOpen = !isDropdownOpen;
                dropdown.classList.toggle("show", isDropdownOpen);
                if (isDropdownOpen) populateList();
            });
        }

        if (readAllBtn) {
            readAllBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                markAllAsRead();
            });
        }

        document.addEventListener("click", (e) => {
            if (isDropdownOpen && !e.target.closest("#notifWrapper")) {
                isDropdownOpen = false;
                dropdown.classList.remove("show");
            }
        });
    }

    function refreshNotifications() {
        if (!currentContainerId) return;
        const container = document.getElementById(currentContainerId);
        if (container) {
            renderHTML(container);
            setupEvents();
            if (isDropdownOpen) {
                document.getElementById("notifDropdown").classList.add("show");
                populateList();
            }
        }
    }

    return {
        initNotificationCenter,
        refreshNotifications
    };
})();
