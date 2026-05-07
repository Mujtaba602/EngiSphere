window.EngiSphereAudit = (function () {
    const STORAGE_KEY = "engisphere_audit_logs";
    const MAX_LOGS = 100;
    const DEBOUNCE_TIME = 5000;

    function getAuditLogs() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error("[Audit] Error parsing logs", e);
            return [];
        }
    }

    function saveAuditLogs(logs) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
        } catch (e) {
            console.error("[Audit] Error saving logs", e);
        }
    }

    function clearAuditLogs() {
        localStorage.removeItem(STORAGE_KEY);
        console.log("[Audit] Logs cleared");
    }

    function logAuditEvent(event) {
        if (!event || !event.action || !event.message) return;

        const logs = getAuditLogs();
        const now = new Date().getTime();

        // Check for duplicates in the last 5 seconds
        const isDuplicate = logs.some(log => {
            if (log.action === event.action &&
                log.entity_id === event.entity_id &&
                log.message === event.message) {
                const logTime = new Date(log.created_at).getTime();
                return (now - logTime) < DEBOUNCE_TIME;
            }
            return false;
        });

        if (isDuplicate) return;

        const newLog = {
            id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            action: event.action,
            entity_type: event.entity_type || 'unknown',
            entity_id: event.entity_id || null,
            project_id: event.project_id || null,
            message: event.message,
            severity: event.severity || 'info', // info, success, warning, danger
            user: event.user || 'System',
            metadata: event.metadata || {},
            created_at: new Date().toISOString()
        };

        logs.unshift(newLog); // Newest first

        if (logs.length > MAX_LOGS) {
            logs.pop(); // Remove oldest
        }

        saveAuditLogs(logs);
        console.log(`[Audit] Event logged: ${newLog.message}`);
    }

    function escapeHtml(text) {
        const div = document.createElement("div");
        div.textContent = String(text ?? "");
        return div.innerHTML;
    }

    function renderRecentActivity(containerId, limit = 5) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const logs = getAuditLogs().slice(0, limit);

        if (logs.length === 0) {
            container.innerHTML = `
                <div style="padding: 20px; text-align: center; color: var(--muted); font-size: 13px; border: 1px dashed var(--border); border-radius: 12px;">
                    No activity recorded yet.
                </div>
            `;
            return;
        }

        const getSeverityColor = (severity) => {
            switch (severity) {
                case 'success': return 'var(--success, #10b981)';
                case 'warning': return 'var(--warning, #f59e0b)';
                case 'danger': return 'var(--danger, #ef4444)';
                default: return 'var(--primary, #3b82f6)';
            }
        };

        const getSeverityIcon = (severity) => {
            switch (severity) {
                case 'success': return 'fa-check-circle';
                case 'warning': return 'fa-exclamation-triangle';
                case 'danger': return 'fa-shield-virus';
                default: return 'fa-info-circle';
            }
        };

        const html = logs.map(log => {
            const date = new Date(log.created_at);
            const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' - ' + date.toLocaleDateString([], { month: 'short', day: 'numeric' });
            const color = getSeverityColor(log.severity);
            const icon = getSeverityIcon(log.severity);

            return `
                <div style="display: flex; gap: 14px; padding: 12px 0; border-bottom: 1px solid var(--border);">
                    <div style="flex-shrink: 0; width: 32px; height: 32px; border-radius: 50%; background: ${color}15; border: 1px solid ${color}30; display: flex; align-items: center; justify-content: center; color: ${color};">
                        <i class="fas ${icon}" style="font-size: 12px;"></i>
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-size: 13px; color: var(--text); font-weight: 600; margin-bottom: 3px; line-height: 1.4;">
                            ${escapeHtml(log.message)}
                        </div>
                        <div style="font-size: 11px; color: var(--muted); display: flex; gap: 10px;">
                            <span><i class="far fa-clock" style="margin-right:4px;"></i>${timeStr}</span>
                            ${log.entity_type ? `<span style="text-transform: capitalize;">• ${escapeHtml(log.entity_type)}</span>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = `<div style="display: flex; flex-direction: column;">${html}</div>`;
        console.log(`[Audit] Loaded logs: ${logs.length} rendered into #${containerId}`);
    }

    return {
        logAuditEvent,
        getAuditLogs,
        renderRecentActivity,
        clearAuditLogs
    };
})();
