window.EngiSphereProgress = (function () {
    const STORAGE_KEY = "engisphere_project_progress";

    function getAllProjectProgress() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : {};
        } catch (e) {
            console.error("Failed to parse project progress", e);
            return {};
        }
    }

    function getProjectProgress(projectId) {
        if (!projectId) return null;
        const all = getAllProjectProgress();
        return all[projectId] || null;
    }

    function setProjectProgress(projectId, data, projectTitle) {
        if (!projectId) return;
        const all = getAllProjectProgress();
        const existing = all[projectId] || {};
        
        // Clamp progress
        let newProgress = data.progress !== undefined ? Number(data.progress) : existing.progress;
        if (!isNaN(newProgress)) {
            newProgress = Math.max(0, Math.min(100, newProgress));
        }

        const newStatus = data.status || existing.status;
        const newRisk = data.risk_level || existing.risk_level;
        
        const title = projectTitle || `Project ${projectId}`;

        // Audit Logging
        if (window.EngiSphereAudit) {
            if (newProgress !== existing.progress && newProgress !== undefined) {
                window.EngiSphereAudit.logAuditEvent({
                    action: "project_progress_updated",
                    entity_type: "project",
                    entity_id: projectId,
                    project_id: projectId,
                    message: `${title} progress updated to ${newProgress}%`,
                    severity: "success"
                });
            }
            if (newStatus && newStatus !== existing.status) {
                let severity = "info";
                if (newStatus.toLowerCase() === "completed") severity = "success";
                if (newStatus.toLowerCase() === "pending") severity = "warning";
                
                window.EngiSphereAudit.logAuditEvent({
                    action: "project_status_changed",
                    entity_type: "project",
                    entity_id: projectId,
                    project_id: projectId,
                    message: `${title} status changed to ${newStatus}`,
                    severity: severity
                });
            }
            if (newRisk && newRisk !== existing.risk_level) {
                let severity = "success"; // low
                if (newRisk.toLowerCase() === "medium") severity = "warning";
                if (newRisk.toLowerCase() === "high") severity = "danger";

                window.EngiSphereAudit.logAuditEvent({
                    action: "project_risk_changed",
                    entity_type: "project",
                    entity_id: projectId,
                    project_id: projectId,
                    message: `${title} risk level changed to ${newRisk}`,
                    severity: severity
                });
            }
        }

        all[projectId] = {
            project_id: projectId,
            progress: newProgress,
            status: newStatus,
            risk_level: newRisk,
            updated_at: new Date().toISOString(),
            updated_by: localStorage.getItem("user_email") || "User"
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
        
        if (window.EngiSphereNotifications && window.EngiSphereNotifications.refreshNotifications) {
            window.EngiSphereNotifications.refreshNotifications();
        }
    }

    function mergeProjectProgress(project) {
        if (!project || !project.id) return project;
        const local = getProjectProgress(project.id);
        if (local) {
            return {
                ...project,
                progress: local.progress !== undefined ? local.progress : project.progress,
                status: local.status || project.status,
                risk_level: local.risk_level || project.risk_level
            };
        }
        return project;
    }

    function renderProgressControl(containerId, project) {
        const container = document.getElementById(containerId);
        if (!container || !project || !project.id) return;

        const merged = mergeProjectProgress(project);
        const progress = merged.progress !== undefined ? merged.progress : 0;
        const status = (merged.status || "active").toLowerCase();
        const risk = (merged.risk_level || "low").toLowerCase();

        container.innerHTML = `
            <div class="card progress-control-card" style="margin-top:24px;">
                <div class="card-title">
                    <i class="fas fa-sliders-h" style="color: var(--primary);"></i>
                    Update Project State
                </div>
                <div style="display:grid; gap:16px; margin-top:16px;">
                    <div class="form-group">
                        <label style="display:block; font-size:12px; font-weight:800; color:var(--muted); margin-bottom:8px; text-transform:uppercase;">Progress (%)</label>
                        <input type="number" id="ctrlProgress" value="${progress}" min="0" max="100" style="width:100%; min-height:42px; border:1px solid var(--border); border-radius:12px; background:var(--bg); color:var(--text); padding:0 16px;">
                    </div>
                    <div class="form-group">
                        <label style="display:block; font-size:12px; font-weight:800; color:var(--muted); margin-bottom:8px; text-transform:uppercase;">Status</label>
                        <select id="ctrlStatus" style="width:100%; min-height:42px; border:1px solid var(--border); border-radius:12px; background:var(--bg); color:var(--text); padding:0 16px;">
                            <option value="Active" ${status === 'active' ? 'selected' : ''}>Active</option>
                            <option value="Pending" ${status === 'pending' ? 'selected' : ''}>Pending</option>
                            <option value="Completed" ${status === 'completed' ? 'selected' : ''}>Completed</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label style="display:block; font-size:12px; font-weight:800; color:var(--muted); margin-bottom:8px; text-transform:uppercase;">Risk Level</label>
                        <select id="ctrlRisk" style="width:100%; min-height:42px; border:1px solid var(--border); border-radius:12px; background:var(--bg); color:var(--text); padding:0 16px;">
                            <option value="Low" ${risk === 'low' ? 'selected' : ''}>Low Risk</option>
                            <option value="Medium" ${risk === 'medium' ? 'selected' : ''}>Medium Risk</option>
                            <option value="High" ${risk === 'high' ? 'selected' : ''}>High Risk</option>
                        </select>
                    </div>
                    <button id="ctrlSaveBtn" class="btn" style="background:var(--primary); color:#fff; border:none; padding:12px; border-radius:12px; font-weight:700; cursor:pointer;">
                        <i class="fas fa-save"></i> Save Updates
                    </button>
                </div>
            </div>
        `;

        document.getElementById("ctrlSaveBtn").addEventListener("click", () => {
            const p = document.getElementById("ctrlProgress").value;
            const s = document.getElementById("ctrlStatus").value;
            const r = document.getElementById("ctrlRisk").value;

            setProjectProgress(project.id, {
                progress: p,
                status: s,
                risk_level: r
            }, project.title || project.name);

            if (typeof showToast === 'function') {
                showToast("Project state updated successfully.", "success");
            } else if (typeof showToast === 'function' && document.getElementById("successToast")) {
                showToast("successToast", "Project state updated successfully.");
            } else {
                alert("Project state updated successfully.");
            }

            // Fire custom event to let the page refresh its UI
            window.dispatchEvent(new CustomEvent('engisphereProjectUpdated', { detail: { projectId: project.id } }));
        });
    }

    return {
        getProjectProgress,
        setProjectProgress,
        getAllProjectProgress,
        mergeProjectProgress,
        renderProgressControl
    };
})();
