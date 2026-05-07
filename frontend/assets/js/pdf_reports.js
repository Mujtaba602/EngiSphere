(function () {
    "use strict";

    const PROGRESS_KEY = "engisphere_project_progress";

    function safeParse(value, fallback) {
        try {
            return value ? JSON.parse(value) : fallback;
        } catch (error) {
            console.warn("[PDF Reports] Failed to parse JSON:", error);
            return fallback;
        }
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }
function normalizeId(value) {
    return String(value ?? "").trim();
}

function getStoredProjectName(projectId) {
    const normalizedProjectId = normalizeId(projectId);

    const possibleKeys = [
        "engisphere_projects",
        "projects",
        "engisphere_all_projects",
        "engisphere_project_list",
    ];

    for (const key of possibleKeys) {
        const value = safeParse(localStorage.getItem(key), null);

        if (!value) continue;

        const projects = Array.isArray(value)
            ? value
            : Array.isArray(value.projects)
              ? value.projects
              : Array.isArray(value.data)
                ? value.data
                : [];

        const matchedProject = projects.find((project) => {
            const candidateIds = [
                project.id,
                project.project_id,
                project.projectId,
                project._id,
            ].map(normalizeId);

            return candidateIds.includes(normalizedProjectId);
        });

        if (matchedProject) {
            return (
                matchedProject.name ||
                matchedProject.project_name ||
                matchedProject.projectName ||
                matchedProject.title ||
                matchedProject.project_title ||
                ""
            );
        }
    }

    return "";
}

function getProjectNameFromAudit(projectId, auditEvents) {
    if (!auditEvents || !auditEvents.length) return "";

    const projectIdText = normalizeId(projectId);

    const projectMessages = auditEvents
        .map((event) =>
            String(
                event.message ||
                    event.action ||
                    event.event ||
                    event.description ||
                    ""
            )
        )
        .filter(Boolean);

    for (const message of projectMessages) {
        const detailsMatch = message.match(/project details opened:\s*(.+)$/i);
        if (detailsMatch && detailsMatch[1]) {
            return detailsMatch[1].trim();
        }

        const radarMatch = message.match(/AI Radar loaded project:\s*(.+)$/i);
        if (radarMatch && radarMatch[1]) {
            return radarMatch[1].trim();
        }
    }

    return projectIdText ? `Project ${projectIdText}` : "Unknown Project";
}

function resolveProjectName(projectId, item, auditEvents) {
    return (
        item.project_name ||
        item.projectName ||
        item.name ||
        item.title ||
        getStoredProjectName(projectId) ||
        getProjectNameFromAudit(projectId, auditEvents) ||
        `Project ${projectId}`
    );
}

function getProjectProgressRows(auditEvents = []) {
    const data = safeParse(localStorage.getItem(PROGRESS_KEY), {});

    return Object.entries(data).map(([id, item]) => {
        const projectId = item.project_id || item.projectId || id;

        return {
            id,
            project_id: projectId,
            project_name: resolveProjectName(projectId, item, auditEvents),
            progress: Number(item.progress || 0),
            status: item.status || "Unknown",
            risk_level: item.risk_level || item.riskLevel || "Unknown",
            updated_at: item.updated_at || item.updatedAt || "",
            updated_by: item.updated_by || item.updatedBy || "Unknown",
        };
    });
}

    function getAuditEvents() {
        const candidates = [];

        for (let index = 0; index < localStorage.length; index += 1) {
            const key = localStorage.key(index);

            if (!key) continue;

            const lowerKey = key.toLowerCase();

            if (lowerKey.includes("audit")) {
                const value = safeParse(localStorage.getItem(key), null);

                if (Array.isArray(value)) {
                    candidates.push(...value);
                }
            }
        }

        return candidates.slice(-10).reverse();
    }

    function getSummary(rows) {
        const summary = {
            total: rows.length,
            averageProgress: 0,
            highRisk: 0,
            mediumRisk: 0,
            lowRisk: 0,
            pending: 0,
            completed: 0,
            inProgress: 0,
        };

        if (!rows.length) return summary;

        const totalProgress = rows.reduce((sum, row) => sum + Number(row.progress || 0), 0);
        summary.averageProgress = Math.round(totalProgress / rows.length);

        rows.forEach((row) => {
            const risk = String(row.risk_level || "").toLowerCase();
            const status = String(row.status || "").toLowerCase();

            if (risk.includes("high")) summary.highRisk += 1;
            else if (risk.includes("medium")) summary.mediumRisk += 1;
            else if (risk.includes("low")) summary.lowRisk += 1;

            if (status.includes("pending")) summary.pending += 1;
            else if (status.includes("complete")) summary.completed += 1;
            else if (status.includes("progress") || status.includes("active")) summary.inProgress += 1;
        });

        return summary;
    }

    function formatDate(value) {
        if (!value) return "N/A";

        try {
            return new Date(value).toLocaleString();
        } catch {
            return value;
        }
    }

    // ── Project Health helpers ──────────────────────────────────────────────

    function getRiskPriority(row) {
        const risk   = String(row.risk_level || "").toLowerCase();
        const status = String(row.status     || "").toLowerCase();
        const prog   = Number(row.progress   || 0);

        if (risk.includes("high"))        return "high";
        if (status.includes("pending"))   return "medium";
        if (prog < 50)                    return "medium";
        if (prog >= 80)                   return "medium";
        return "normal";
    }

    function getProjectIssue(row) {
        const risk   = String(row.risk_level || "").toLowerCase();
        const status = String(row.status     || "").toLowerCase();
        const prog   = Number(row.progress   || 0);

        if (risk.includes("high"))
            return "High risk level requires immediate mitigation review.";
        if (status.includes("pending"))
            return "Project is pending and may require unblock actions.";
        if (prog < 50)
            return "Progress is below expected delivery level.";
        if (prog >= 80)
            return "Project is close to completion and needs final delivery focus.";
        return "No critical issues detected at this time.";
    }

    function getRecommendedAction(row) {
        const risk   = String(row.risk_level || "").toLowerCase();
        const status = String(row.status     || "").toLowerCase();
        const prog   = Number(row.progress   || 0);

        if (risk.includes("high"))
            return "Review risks, assign mitigation owner, and define recovery actions.";
        if (status.includes("pending"))
            return "Confirm blocker reason, update next milestone, and assign responsible owner.";
        if (prog < 50)
            return "Review schedule, resource allocation, and planned deliverables.";
        if (prog >= 80)
            return "Focus on closure checklist, final approvals, and handover readiness.";
        return "Continue monitoring progress and keep status updated.";
    }

    function getPriorityLabel(row) {
        const p = getRiskPriority(row);
        return p === "high" ? "High" : p === "medium" ? "Medium" : "Normal";
    }

    function getProjectHealthSummary(rows) {
        const hasHighRisk  = rows.some((r) => String(r.risk_level || "").toLowerCase().includes("high"));
        const hasPending   = rows.some((r) => String(r.status     || "").toLowerCase().includes("pending"));
        const avgProgress  = rows.length
            ? Math.round(rows.reduce((s, r) => s + Number(r.progress || 0), 0) / rows.length)
            : 0;

        if (hasHighRisk)  return { label: "Needs Attention", note: "High risk project(s) require immediate action" };
        if (hasPending)   return { label: "Monitor Closely",  note: "Pending project(s) may need unblock decisions"  };
        if (avgProgress >= 80) return { label: "Strong",      note: "Portfolio above 80% with no critical risks"     };
        return               { label: "Stable",            note: "All projects progressing within acceptable range" };
    }

    function renderProjectInsightsHtml(rows) {
        if (!rows.length) {
            return `<p class="insight-empty">No project data available to generate insights.</p>`;
        }

        const health      = getProjectHealthSummary(rows);
        const highRiskCnt = rows.filter((r) => String(r.risk_level || "").toLowerCase().includes("high")).length;
        const pendingCnt  = rows.filter((r) => String(r.status     || "").toLowerCase().includes("pending")).length;

        // Priority project: High Risk first → then least progress
        const priorityProject = [...rows].sort((a, b) => {
            const aHigh = String(a.risk_level || "").toLowerCase().includes("high") ? 0 : 1;
            const bHigh = String(b.risk_level || "").toLowerCase().includes("high") ? 0 : 1;
            if (aHigh !== bHigh) return aHigh - bHigh;
            return Number(a.progress || 0) - Number(b.progress || 0);
        })[0];

        const insightCards = `
<div class="insight-grid">
    <div class="insight-card">
        <div class="insight-label">Overall Health</div>
        <div class="insight-value">${escapeHtml(health.label)}</div>
        <div class="insight-note">${escapeHtml(health.note)}</div>
    </div>
    <div class="insight-card">
        <div class="insight-label">Priority Project</div>
        <div class="insight-value">${escapeHtml(priorityProject.project_name || priorityProject.project_id)}</div>
        <div class="insight-note">${escapeHtml(getPriorityLabel(priorityProject))} priority &mdash; ${escapeHtml(priorityProject.progress)}% complete</div>
    </div>
    <div class="insight-card">
        <div class="insight-label">High Risk Projects</div>
        <div class="insight-value">${highRiskCnt}</div>
        <div class="insight-note">${highRiskCnt === 0 ? "No high-risk items" : "Require immediate attention"}</div>
    </div>
    <div class="insight-card">
        <div class="insight-label">Pending Projects</div>
        <div class="insight-value">${pendingCnt}</div>
        <div class="insight-note">${pendingCnt === 0 ? "No blocked items" : "May require unblock decisions"}</div>
    </div>
</div>`;

        const actionRows = rows
            .slice()
            .sort((a, b) => {
                const order = { high: 0, medium: 1, normal: 2 };
                return (order[getRiskPriority(a)] ?? 2) - (order[getRiskPriority(b)] ?? 2);
            })
            .map((row) => {
                const priorityVal = getPriorityLabel(row);
                const badgeCls    = priorityVal === "High" ? "badge badge-high" : priorityVal === "Medium" ? "badge badge-medium" : "badge badge-low";
                return `
<tr>
    <td><strong>${escapeHtml(row.project_name || row.project_id)}</strong></td>
    <td><span class="${badgeCls}">${escapeHtml(priorityVal)}</span></td>
    <td>${escapeHtml(getProjectIssue(row))}</td>
    <td>${escapeHtml(getRecommendedAction(row))}</td>
</tr>`;
            })
            .join("");

        const actionTable = `
<table class="action-table">
    <thead>
        <tr>
            <th>Project</th>
            <th>Priority</th>
            <th>Key Issue</th>
            <th>Recommended Action</th>
        </tr>
    </thead>
    <tbody>${actionRows}</tbody>
</table>`;

        return insightCards + actionTable;
    }

    // ── Main HTML builder ───────────────────────────────────────────────────

function buildReportHtml() {
    const auditEvents = getAuditEvents();
    const rows = getProjectProgressRows(auditEvents);
        const summary = getSummary(rows);
        const generatedAt = new Date().toLocaleString();

        const rowsHtml = rows.length
            ? rows
                  .map(
                      (row) => `
 <tr>
    <td>${escapeHtml(row.project_id)}</td>
    <td>${escapeHtml(row.project_name)}</td>
    <td>${escapeHtml(row.progress)}%</td>
    <td>${escapeHtml(row.status)}</td>
    <td>${escapeHtml(row.risk_level)}</td>
    <td>${escapeHtml(formatDate(row.updated_at))}</td>
    <td>${escapeHtml(row.updated_by)}</td>
</tr>
                    `
                  )
                  .join("")
            : `
                <tr>
                    <td colspan="7" class="empty-row">No project progress data found.</td>
                </tr>
            `;

        const insightsHtml = renderProjectInsightsHtml(rows);

        return `
            <div id="engisphere-pdf-report">
                <style>
/* ── Base ── */
#engisphere-pdf-report {
    width: 1280px;
    min-height: 820px;
    background: #ffffff;
    color: #111827;
    padding: 36px 52px 40px;
    font-family: Arial, sans-serif;
    font-size: 13px;
    box-sizing: border-box;
}

/* ── Header ── */
#engisphere-pdf-report .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    border-bottom: 3px solid #2563eb;
    padding-bottom: 14px;
    margin-bottom: 22px;
}

#engisphere-pdf-report .header-left .brand {
    font-size: 26px;
    font-weight: 800;
    color: #1d4ed8;
    letter-spacing: 0.6px;
    line-height: 1;
}

#engisphere-pdf-report .header-left .subtitle {
    margin-top: 5px;
    color: #475569;
    font-size: 13px;
    font-weight: 600;
}

#engisphere-pdf-report .header-right {
    text-align: right;
    color: #64748b;
    font-size: 11px;
    line-height: 1.6;
}

/* ── Section titles ── */
#engisphere-pdf-report h2 {
    font-size: 15px;
    font-weight: 800;
    margin: 22px 0 10px;
    color: #0f172a;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-left: 4px solid #2563eb;
    padding-left: 10px;
}

#engisphere-pdf-report .section-subtitle {
    font-size: 12px;
    color: #6b7280;
    margin: -6px 0 12px;
}

/* ── Executive Summary Cards ── */
#engisphere-pdf-report .summary-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin: 12px 0 24px;
}

#engisphere-pdf-report .summary-card {
    border: 1px solid #dbe3ef;
    border-radius: 12px;
    padding: 16px 18px;
    background: #f8fafc;
}

#engisphere-pdf-report .summary-label {
    color: #64748b;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
}

#engisphere-pdf-report .summary-value {
    color: #0f172a;
    font-size: 28px;
    font-weight: 800;
    line-height: 1.1;
}

/* ── Project Details Table ── */
#engisphere-pdf-report table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 10px;
    font-size: 13px;
}

#engisphere-pdf-report th {
    background: #0f172a;
    color: #ffffff;
    text-align: left;
    padding: 11px 10px;
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.4px;
}

#engisphere-pdf-report td {
    border: 1px solid #e2e8f0;
    padding: 11px 10px;
    vertical-align: middle;
    line-height: 1.4;
}

#engisphere-pdf-report tr:nth-child(even) td {
    background: #f8fafc;
}

#engisphere-pdf-report .empty-row {
    text-align: center;
    color: #6b7280;
    padding: 20px;
}

/* ── Badges ── */
#engisphere-pdf-report .badge {
    display: inline-block;
    padding: 4px 9px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 800;
    white-space: nowrap;
}

#engisphere-pdf-report .badge-high {
    color: #991b1b;
    background: #fee2e2;
}

#engisphere-pdf-report .badge-medium,
#engisphere-pdf-report .badge-pending {
    color: #92400e;
    background: #fef3c7;
}

#engisphere-pdf-report .badge-low,
#engisphere-pdf-report .badge-completed {
    color: #166534;
    background: #dcfce7;
}

#engisphere-pdf-report .badge-progress {
    color: #1e40af;
    background: #dbeafe;
}

#engisphere-pdf-report .badge-default {
    color: #374151;
    background: #f3f4f6;
}

/* ── Insight Cards ── */
#engisphere-pdf-report .insight-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin: 12px 0 22px;
}

#engisphere-pdf-report .insight-card {
    border: 1px solid #cfe1f7;
    border-radius: 12px;
    padding: 16px 18px;
    background: #eff6ff;
}

#engisphere-pdf-report .insight-label {
    color: #1d4ed8;
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    margin-bottom: 8px;
}

#engisphere-pdf-report .insight-value {
    color: #0f172a;
    font-size: 22px;
    font-weight: 800;
    line-height: 1.2;
}

#engisphere-pdf-report .insight-note {
    color: #475569;
    font-size: 11px;
    margin-top: 8px;
}

#engisphere-pdf-report .insight-empty {
    text-align: center;
    color: #6b7280;
    font-size: 13px;
    padding: 18px;
}

/* ── Action Table ── */
#engisphere-pdf-report .action-table th {
    background: #1e3a8a;
    color: #ffffff;
    padding: 10px 12px;
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
}

#engisphere-pdf-report .action-table td {
    font-size: 12px;
    padding: 10px 12px;
    border: 1px solid #cfe1f7;
    vertical-align: top;
    line-height: 1.45;
}

#engisphere-pdf-report .action-table tr:nth-child(even) td {
    background: #f0f9ff;
}

#engisphere-pdf-report .action-table td:last-child {
    width: 42%;
}

/* ── Footer ── */
#engisphere-pdf-report .footer {
    margin-top: 28px;
    padding-top: 12px;
    border-top: 1px solid #e2e8f0;
    color: #94a3b8;
    font-size: 11px;
    display: flex;
    justify-content: space-between;
}
                </style>

                <div class="header">
                    <div class="header-left">
                        <div class="brand">ENGISPHERE</div>
                        <div class="subtitle">Project Progress Executive Report</div>
                    </div>
                    <div class="header-right">
                        <div>Generated: ${escapeHtml(generatedAt)}</div>
                        <div>EngiSphere &mdash; Internal Use Only</div>
                    </div>
                </div>

                <h2>Executive Summary</h2>

                <div class="summary-grid">
                    <div class="summary-card">
                        <div class="summary-label">Tracked Projects</div>
                        <div class="summary-value">${summary.total}</div>
                    </div>
                    <div class="summary-card">
                        <div class="summary-label">Average Progress</div>
                        <div class="summary-value">${summary.averageProgress}%</div>
                    </div>
                    <div class="summary-card">
                        <div class="summary-label">High Risk</div>
                        <div class="summary-value">${summary.highRisk}</div>
                    </div>
                    <div class="summary-card">
                        <div class="summary-label">Pending</div>
                        <div class="summary-value">${summary.pending}</div>
                    </div>
                </div>

                <h2>Project Progress Details</h2>

                <table>
                    <thead>
                        <tr>
                            <th>Project ID</th>
                            <th>Project Name</th>
                            <th>Progress</th>
                            <th>Status</th>
                            <th>Risk Level</th>
                            <th>Updated At</th>
                            <th>Updated By</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>

                <h2>Project Health &amp; Recommendations</h2>
                <p class="section-subtitle">Automated insights based on current project data</p>
                ${insightsHtml}

                <div class="footer">
                    <span>Generated locally from EngiSphere browser data.</span>
                    <span>CONFIDENTIAL &mdash; For Internal Use Only</span>
                </div>
            </div>
        `;
    }

    function createReportContainer(html) {
        const wrapper = document.createElement("div");
        wrapper.style.position = "fixed";
        wrapper.style.left = "-99999px";
        wrapper.style.top = "0";
        wrapper.style.zIndex = "-1";
        wrapper.innerHTML = html;
        document.body.appendChild(wrapper);
        return wrapper;
    }

    function fallbackPrint(html) {
        const printWindow = window.open("", "_blank");

        if (!printWindow) {
            alert("Popup blocked. Please allow popups to print the report.");
            return;
        }

        printWindow.document.open();
        printWindow.document.write(`
            <!doctype html>
            <html>
                <head>
                    <title>EngiSphere PDF Report</title>
                </head>
                <body>
                    ${html}
                    <script>
                        window.onload = function () {
                            window.print();
                        };
                    <\/script>
                </body>
            </html>
        `);
        printWindow.document.close();
    }

    async function downloadWorkspaceReport() {
        const html = buildReportHtml();

        if (!window.html2canvas || !window.jspdf || !window.jspdf.jsPDF) {
            console.warn("[PDF Reports] html2canvas or jsPDF not loaded. Falling back to print.");
            fallbackPrint(html);
            return;
        }

        const button = document.querySelector("[data-engisphere-pdf-export]");
        const originalButtonText = button ? button.textContent : "";

        try {
            if (button) {
                button.disabled = true;
                button.textContent = "Generating PDF...";
            }

            const wrapper = createReportContainer(html);
            const reportElement = wrapper.querySelector("#engisphere-pdf-report");

            const canvas = await window.html2canvas(reportElement, {
                scale: 1.8,
                backgroundColor: "#ffffff",
                useCORS: true,
                logging: false,
            });

            const imageData = canvas.toDataURL("image/jpeg", 0.88);
            const pdf = new window.jspdf.jsPDF("l", "mm", "a4");

            const pageWidth  = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin     = 8;
            const imageWidth  = pageWidth - margin * 2;
            const imageHeight = (canvas.height * imageWidth) / canvas.width;

            let heightLeft = imageHeight;
            let position   = margin;

            pdf.addImage(imageData, "JPEG", margin, position, imageWidth, imageHeight, undefined, "FAST");
            heightLeft -= pageHeight - margin * 2;

            while (heightLeft > 0) {
                position = heightLeft - imageHeight + margin;
                pdf.addPage();
                pdf.addImage(imageData, "JPEG", margin, position, imageWidth, imageHeight, undefined, "FAST");
                heightLeft -= pageHeight - margin * 2;
            }

            const datePart = new Date().toISOString().slice(0, 10);
            pdf.save(`engisphere-project-report-${datePart}.pdf`);

            wrapper.remove();

            if (window.showToast) {
                window.showToast("PDF report generated successfully.", "success");
            }
        } catch (error) {
            console.error("[PDF Reports] Failed to generate PDF:", error);
            alert("Failed to generate PDF report. Check Console for details.");
        } finally {
            if (button) {
                button.disabled = false;
                button.textContent = originalButtonText || "Export PDF Report";
            }
        }
    }

    function insertExportButton() {
        if (document.querySelector("[data-engisphere-pdf-export]")) return;

        const button = document.createElement("button");
        button.type = "button";
        button.textContent = "Export PDF Report";
        button.setAttribute("data-engisphere-pdf-export", "true");

        button.style.border = "0";
        button.style.borderRadius = "10px";
        button.style.padding = "10px 14px";
        button.style.background = "#2563eb";
        button.style.color = "#ffffff";
        button.style.fontWeight = "700";
        button.style.cursor = "pointer";
        button.style.margin = "10px 0";

        button.addEventListener("click", downloadWorkspaceReport);

        const target =
            document.querySelector(".page-header") ||
            document.querySelector(".content-header") ||
            document.querySelector(".reports-header") ||
            document.querySelector("main") ||
            document.body;

        if (target === document.body || target.tagName.toLowerCase() === "main") {
            target.prepend(button);
        } else {
            target.appendChild(button);
        }
    }

    window.EngiSpherePDFReports = {
        downloadWorkspaceReport,
        buildReportHtml,
    };

    document.addEventListener("DOMContentLoaded", function () {
        const path = window.location.pathname.toLowerCase();

        if (path.includes("reports.html")) {
            insertExportButton();
        }
    });
})();
