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

    function getProjectProgressRows() {
        const data = safeParse(localStorage.getItem(PROGRESS_KEY), {});
        return Object.entries(data).map(([id, item]) => ({
            id,
            project_id: item.project_id || id,
            progress: Number(item.progress || 0),
            status: item.status || "Unknown",
            risk_level: item.risk_level || "Unknown",
            updated_at: item.updated_at || "",
            updated_by: item.updated_by || "Unknown",
        }));
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

    function buildReportHtml() {
        const rows = getProjectProgressRows();
        const auditEvents = getAuditEvents();
        const summary = getSummary(rows);
        const generatedAt = new Date().toLocaleString();

        const rowsHtml = rows.length
            ? rows
                  .map(
                      (row) => `
                        <tr>
                            <td>${escapeHtml(row.project_id)}</td>
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
                    <td colspan="6" class="empty-row">No project progress data found.</td>
                </tr>
            `;

        const auditHtml = auditEvents.length
            ? auditEvents
                  .map((event) => {
                      const message =
                          event.message ||
                          event.action ||
                          event.event ||
                          event.description ||
                          JSON.stringify(event);

                      const time =
                          event.timestamp ||
                          event.created_at ||
                          event.time ||
                          event.date ||
                          "";

                      return `
                        <li>
                            <strong>${escapeHtml(formatDate(time))}</strong>
                            <span>${escapeHtml(message)}</span>
                        </li>
                    `;
                  })
                  .join("")
            : `<li>No audit events found.</li>`;

        return `
            <div id="engisphere-pdf-report">
                <style>
                    #engisphere-pdf-report {
                        width: 900px;
                        padding: 32px;
                        background: #ffffff;
                        color: #111827;
                        font-family: Arial, Helvetica, sans-serif;
                        line-height: 1.45;
                    }

                    #engisphere-pdf-report .header {
                        border-bottom: 3px solid #2563eb;
                        padding-bottom: 18px;
                        margin-bottom: 24px;
                    }

                    #engisphere-pdf-report .brand {
                        font-size: 28px;
                        font-weight: 800;
                        color: #1d4ed8;
                        letter-spacing: 0.5px;
                    }

                    #engisphere-pdf-report .subtitle {
                        margin-top: 6px;
                        color: #4b5563;
                        font-size: 14px;
                    }

                    #engisphere-pdf-report h2 {
                        font-size: 18px;
                        margin: 26px 0 12px;
                        color: #111827;
                    }

                    #engisphere-pdf-report .summary-grid {
                        display: grid;
                        grid-template-columns: repeat(4, 1fr);
                        gap: 12px;
                        margin-bottom: 22px;
                    }

                    #engisphere-pdf-report .summary-card {
                        border: 1px solid #e5e7eb;
                        border-radius: 10px;
                        padding: 14px;
                        background: #f9fafb;
                    }

                    #engisphere-pdf-report .summary-card .label {
                        font-size: 12px;
                        color: #6b7280;
                        margin-bottom: 6px;
                    }

                    #engisphere-pdf-report .summary-card .value {
                        font-size: 24px;
                        font-weight: 800;
                        color: #111827;
                    }

                    #engisphere-pdf-report table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 10px;
                        font-size: 12px;
                    }

                    #engisphere-pdf-report th {
                        background: #1f2937;
                        color: #ffffff;
                        text-align: left;
                        padding: 10px;
                    }

                    #engisphere-pdf-report td {
                        border: 1px solid #e5e7eb;
                        padding: 9px;
                        vertical-align: top;
                    }

                    #engisphere-pdf-report tr:nth-child(even) td {
                        background: #f9fafb;
                    }

                    #engisphere-pdf-report .empty-row {
                        text-align: center;
                        color: #6b7280;
                        padding: 18px;
                    }

                    #engisphere-pdf-report ul {
                        padding-left: 18px;
                        font-size: 12px;
                    }

                    #engisphere-pdf-report li {
                        margin-bottom: 8px;
                    }

                    #engisphere-pdf-report li span {
                        display: block;
                        color: #374151;
                        margin-top: 2px;
                    }

                    #engisphere-pdf-report .footer {
                        margin-top: 32px;
                        padding-top: 14px;
                        border-top: 1px solid #e5e7eb;
                        color: #6b7280;
                        font-size: 11px;
                    }
                </style>

                <div class="header">
                    <div class="brand">ENGISPHERE</div>
                    <div class="subtitle">Project Progress PDF Report</div>
                    <div class="subtitle">Generated at: ${escapeHtml(generatedAt)}</div>
                </div>

                <h2>Executive Summary</h2>

                <div class="summary-grid">
                    <div class="summary-card">
                        <div class="label">Tracked Projects</div>
                        <div class="value">${summary.total}</div>
                    </div>

                    <div class="summary-card">
                        <div class="label">Average Progress</div>
                        <div class="value">${summary.averageProgress}%</div>
                    </div>

                    <div class="summary-card">
                        <div class="label">High Risk</div>
                        <div class="value">${summary.highRisk}</div>
                    </div>

                    <div class="summary-card">
                        <div class="label">Pending</div>
                        <div class="value">${summary.pending}</div>
                    </div>
                </div>

                <h2>Project Progress Details</h2>

                <table>
                    <thead>
                        <tr>
                            <th>Project ID</th>
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

                <h2>Recent Audit Events</h2>
                <ul>
                    ${auditHtml}
                </ul>

                <div class="footer">
                    This report was generated locally from EngiSphere browser data.
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
                scale: 2,
                backgroundColor: "#ffffff",
                useCORS: true,
            });

            const imageData = canvas.toDataURL("image/png");
            const pdf = new window.jspdf.jsPDF("p", "mm", "a4");

            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 10;
            const imageWidth = pageWidth - margin * 2;
            const imageHeight = (canvas.height * imageWidth) / canvas.width;

            let heightLeft = imageHeight;
            let position = margin;

            pdf.addImage(imageData, "PNG", margin, position, imageWidth, imageHeight);
            heightLeft -= pageHeight - margin * 2;

            while (heightLeft > 0) {
                position = heightLeft - imageHeight + margin;
                pdf.addPage();
                pdf.addImage(imageData, "PNG", margin, position, imageWidth, imageHeight);
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
