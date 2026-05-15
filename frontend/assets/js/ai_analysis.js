/**
 * EngiSphere AI Analysis Engine (Rule-Based)
 * No external API — all logic runs locally using localStorage data.
 *
 * window.EngiSphereAIAnalysis
 */
window.EngiSphereAIAnalysis = (function () {
    "use strict";

    // ── Anti-spam: track last notification timestamps ──────────────────────
    const _notifCooldown = {};

    function _canNotify(key, minMs) {
        const last = _notifCooldown[key] || 0;
        if (Date.now() - last < minMs) return false;
        _notifCooldown[key] = Date.now();
        return true;
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    function _num(v, fallback) {
        const n = Number(v);
        return isNaN(n) ? (fallback ?? 0) : n;
    }

    function _str(v) { return String(v ?? "").toLowerCase().trim(); }

    function _daysSince(dateStr) {
        if (!dateStr) return 999;
        const diff = Date.now() - new Date(dateStr).getTime();
        return Math.max(0, Math.floor(diff / 86400000));
    }

    function _esc(v) {
        const d = document.createElement("div");
        d.textContent = String(v ?? "");
        return d.innerHTML;
    }

    function _mergeLocalProgress(project) {
        if (!project) return project;
        const id = project.id || project.project_id;
        if (!id) return project;
        try {
            const raw = localStorage.getItem("engisphere_project_progress");
            if (!raw) return project;
            const all = JSON.parse(raw);
            const local = all[id] || all[String(id)];
            if (!local) return project;
            return {
                ...project,
                progress:   local.progress   !== undefined ? local.progress   : project.progress,
                status:     local.status      || project.status,
                risk_level: local.risk_level  || project.risk_level,
                updated_at: local.updated_at  || project.updated_at
            };
        } catch (_) { return project; }
    }

    // ── Risk Score (0-100) ─────────────────────────────────────────────────

    function calculateRiskScore(project) {
        if (!project) return 50;
        const p    = _mergeLocalProgress(project);
        const risk = _str(p.risk_level);
        const stat = _str(p.status);
        const prog = Math.min(100, Math.max(0, _num(p.progress, 50)));
        const days = _daysSince(p.updated_at || p.created_at);

        let score = 0;

        // Risk level
        if (risk.includes("high"))   score += 35;
        else if (risk.includes("medium")) score += 20;
        else                              score += 5;

        // Progress
        if (prog <= 20)       score += 25;
        else if (prog <= 50)  score += 15;
        else if (prog <= 80)  score += 8;

        // Status
        if (stat.includes("pending"))        score += 20;
        else if (stat.includes("block") || stat.includes("delay")) score += 30;
        else if (stat.includes("progress") || stat.includes("active")) score += 8;
        else if (stat.includes("complet"))   score -= 20;

        // Staleness
        if (days >= 14) score += 20;
        else if (days >= 7) score += 10;

        return Math.min(100, Math.max(0, score));
    }

    // ── Health Status ──────────────────────────────────────────────────────

    function getHealthStatus(project) {
        const score = calculateRiskScore(project);
        if (score < 40)  return { label: "Healthy",   color: "#10b981", score };
        if (score <= 50) return { label: "Watch",     color: "#f59e0b", score };
        if (score <= 75) return { label: "At Risk",   color: "#f97316", score };
        return               { label: "Critical",  color: "#ef4444", score };
    }

    // ── Delay Probability ──────────────────────────────────────────────────

    function calculateDelayProbability(project) {
        const score = calculateRiskScore(project);
        if (score <= 20) return { label: "Low",       pct: 15,  color: "#10b981" };
        if (score <= 45) return { label: "Medium",    pct: 45,  color: "#f59e0b" };
        if (score <= 70) return { label: "High",      pct: 70,  color: "#f97316" };
        return               { label: "Very High", pct: 90,  color: "#ef4444" };
    }

    // ── Risk Factors ───────────────────────────────────────────────────────

    function getRiskFactors(project) {
        if (!project) return ["No project data available."];
        const p    = _mergeLocalProgress(project);
        const risk = _str(p.risk_level);
        const stat = _str(p.status);
        const prog = _num(p.progress, 0);
        const days = _daysSince(p.updated_at || p.created_at);
        const factors = [];

        if (risk.includes("high"))   factors.push("Project is classified as High Risk.");
        if (risk.includes("medium")) factors.push("Project carries Medium Risk exposure.");
        if (stat.includes("pending")) factors.push("Project status is Pending — blockers may exist.");
        if (stat.includes("block") || stat.includes("delay")) factors.push("Project is blocked or delayed.");
        if (prog < 25)  factors.push(`Low completion rate (${prog}%) — delivery is behind.`);
        else if (prog < 50) factors.push(`Progress at ${prog}% — below midpoint.`);
        if (days >= 14) factors.push(`No update in ${days} days — project may be stale.`);
        else if (days >= 7) factors.push(`Last update was ${days} days ago.`);
        if (!p.description) factors.push("No project description — documentation gap.");

        return factors.length ? factors : ["No significant risk factors detected."];
    }

    // ── Recommendations ────────────────────────────────────────────────────

    function getRecommendations(project) {
        if (!project) return ["Provide project data to generate recommendations."];
        const p    = _mergeLocalProgress(project);
        const risk = _str(p.risk_level);
        const stat = _str(p.status);
        const prog = _num(p.progress, 0);
        const days = _daysSince(p.updated_at || p.created_at);
        const recs = [];

        if (risk.includes("high"))
            recs.push("Assign a mitigation owner and review critical blockers within 24 hours.");
        if (stat.includes("pending"))
            recs.push("Identify approval dependencies and unblock pending decisions.");
        if (stat.includes("block") || stat.includes("delay"))
            recs.push("Escalate blockers to project sponsor and define a recovery plan.");
        if (prog < 25)
            recs.push("Break the project into smaller milestones and review weekly progress targets.");
        else if (prog < 50)
            recs.push("Review schedule, resource allocation, and planned deliverables.");
        if (prog >= 80 && !stat.includes("complet"))
            recs.push("Focus on closure checklist, final approvals, and handover readiness.");
        if (days >= 14)
            recs.push("Request an immediate status update from the project owner.");
        else if (days >= 7)
            recs.push("Schedule a quick status sync with the project team.");
        if (stat.includes("complet"))
            recs.push("Archive the project and generate a closure report.");

        return recs.length ? recs : ["Continue monitoring progress and keep status updated."];
    }

    // ── Executive Summary ──────────────────────────────────────────────────

    function generateExecutiveSummary(project) {
        if (!project) return "No project data available for analysis.";
        const p      = _mergeLocalProgress(project);
        const health = getHealthStatus(project);
        const delay  = calculateDelayProbability(project);
        const name   = p.title || p.name || `Project ${p.id || ""}`;
        const prog   = _num(p.progress, 0);
        const stat   = p.status || "Unknown";
        const risk   = p.risk_level || "Unknown";

        return `${name} is currently ${health.label} with a risk score of ${health.score}/100. ` +
               `Progress stands at ${prog}%, with a status of ${stat} and ${risk} risk level. ` +
               `The probability of delay is ${delay.label} (${delay.pct}%). ` +
               `${getRiskFactors(project).length > 1 ? getRiskFactors(project)[0] : ""} ` +
               `Immediate action: ${getRecommendations(project)[0]}`;
    }

    // ── Full Project Analysis Object ───────────────────────────────────────

    function analyzeProject(project) {
        if (!project) return null;
        const p       = _mergeLocalProgress(project);
        const health  = getHealthStatus(project);
        const delay   = calculateDelayProbability(project);
        const factors = getRiskFactors(project);
        const recs    = getRecommendations(project);
        const summary = generateExecutiveSummary(project);

        const result = {
            project:       p,
            health,
            riskScore:     health.score,
            delay,
            factors,
            recommendations: recs,
            summary,
            analyzedAt:    new Date().toISOString()
        };

        // ── Audit ──────────────────────────────────────────────────────────
        if (window.EngiSphereAudit) {
            window.EngiSphereAudit.logAuditEvent({
                action:      "ai_analysis_viewed",
                entity_type: "project",
                entity_id:   p.id,
                project_id:  p.id,
                message:     `AI Analysis: ${p.title || p.id} — ${health.label} (score ${health.score})`,
                severity:    health.score > 75 ? "danger" : health.score > 50 ? "warning" : "info"
            });
        }

        // ── Notifications (with spam guard: once per project per 60 min) ───
        const notifKey = `ai_${p.id}`;
        if ((health.label === "Critical" || health.label === "At Risk") && _canNotify(notifKey, 3600000)) {
            if (window.EngiSphereNotifications && window.EngiSphereNotifications.addNotification) {
                window.EngiSphereNotifications.addNotification({
                    type:      "high_risk_alert",
                    title:     `${health.label} Project Detected`,
                    message:   `${p.title || p.id}: Risk score ${health.score}/100. ${recs[0]}`,
                    severity:  "high",
                    projectId: p.id
                });
            }
        }

        return result;
    }

    // ── Portfolio Analysis ─────────────────────────────────────────────────

    function analyzeAllProjects(projects) {
        if (!Array.isArray(projects) || !projects.length) return [];
        return projects.map(analyzeProject).filter(Boolean);
    }

    // ── UI: render single project analysis ─────────────────────────────────

    function _ensureStyles() {
        if (document.getElementById("ai-analysis-styles")) return;
        const s = document.createElement("style");
        s.id = "ai-analysis-styles";
        s.textContent = `
            .aia-wrap { font-family: inherit; display: flex; flex-direction: column; gap: 18px; }
            .aia-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px,1fr)); gap: 14px; }
            .aia-card {
                border-radius: 14px; padding: 16px 18px;
                background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
            }
            .aia-card-label { font-size: 10px; font-weight: 800; text-transform: uppercase;
                              letter-spacing: 0.6px; color: var(--muted,#94a3b8); margin-bottom: 8px; }
            .aia-card-value { font-size: 26px; font-weight: 900; line-height: 1; }
            .aia-card-sub   { font-size: 11px; color: var(--muted,#94a3b8); margin-top: 5px; }
            .aia-badge {
                display: inline-block; padding: 5px 12px; border-radius: 999px;
                font-size: 12px; font-weight: 800; color: #fff;
            }
            .aia-summary {
                font-size: 13px; line-height: 1.7; color: var(--muted,#94a3b8);
                border-left: 3px solid var(--primary,#3b82f6); padding-left: 12px;
            }
            .aia-section-title {
                font-size: 12px; font-weight: 800; text-transform: uppercase;
                letter-spacing: 0.5px; color: var(--muted,#94a3b8); margin-bottom: 8px;
            }
            .aia-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 7px; }
            .aia-list li { font-size: 13px; color: var(--text,#f8fafc); display: flex; gap: 8px; align-items: flex-start; }
            .aia-list li::before { content: "→"; color: var(--primary,#3b82f6); flex-shrink: 0; font-weight: 800; }
            .aia-denied { padding: 16px; border-radius: 12px;
                          background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3);
                          color: #f87171; font-size: 13px; font-weight: 600; }
            /* Portfolio table */
            .aia-table { width: 100%; border-collapse: collapse; font-size: 12px; }
            .aia-table th { text-align: left; padding: 9px 10px; background: rgba(255,255,255,0.06);
                            color: var(--muted,#94a3b8); font-size: 10px; text-transform: uppercase; }
            .aia-table td { padding: 10px 10px; border-bottom: 1px solid rgba(255,255,255,0.05);
                            color: var(--text,#f8fafc); }
            .aia-table tr:last-child td { border-bottom: none; }
        `;
        document.head.appendChild(s);
    }

    function renderProjectAnalysis(container, project) {
        if (!container) return;
        _ensureStyles();

        // RBAC guard
        if (window.EngiSphereRBAC && !window.EngiSphereRBAC.hasPermission("view_ai_analysis")) {
            container.innerHTML = `<div class="aia-denied"><i class="fas fa-lock" style="margin-right:8px;"></i>You do not have permission to view AI Analysis.</div>`;
            return;
        }

        if (!project) {
            container.innerHTML = `<p style="color:var(--muted);font-size:13px;">No project data available.</p>`;
            return;
        }

        const result = analyzeProject(project);
        const { health, delay, factors, recommendations, summary } = result;

        const factorsHtml = factors.map(f => `<li>${_esc(f)}</li>`).join("");
        const recsHtml    = recommendations.map(r => `<li>${_esc(r)}</li>`).join("");

        container.innerHTML = `
<div class="aia-wrap">
  <div class="aia-cards">
    <div class="aia-card">
      <div class="aia-card-label">Health Status</div>
      <div class="aia-card-value">
        <span class="aia-badge" style="background:${health.color};">${_esc(health.label)}</span>
      </div>
    </div>
    <div class="aia-card">
      <div class="aia-card-label">Risk Score</div>
      <div class="aia-card-value" style="color:${health.color};">${health.score}</div>
      <div class="aia-card-sub">out of 100</div>
    </div>
    <div class="aia-card">
      <div class="aia-card-label">Delay Probability</div>
      <div class="aia-card-value" style="color:${delay.color};">${delay.pct}%</div>
      <div class="aia-card-sub">${_esc(delay.label)}</div>
    </div>
    <div class="aia-card">
      <div class="aia-card-label">Progress</div>
      <div class="aia-card-value" style="color:var(--primary,#3b82f6);">
        ${_num(_mergeLocalProgress(project).progress, 0)}%
      </div>
    </div>
  </div>

  <div>
    <div class="aia-section-title"><i class="fas fa-file-lines" style="margin-right:5px;"></i>Executive Summary</div>
    <div class="aia-summary">${_esc(summary)}</div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
    <div>
      <div class="aia-section-title"><i class="fas fa-triangle-exclamation" style="margin-right:5px;color:#f97316;"></i>Key Risk Factors</div>
      <ul class="aia-list">${factorsHtml}</ul>
    </div>
    <div>
      <div class="aia-section-title"><i class="fas fa-lightbulb" style="margin-right:5px;color:#f59e0b;"></i>Recommended Actions</div>
      <ul class="aia-list">${recsHtml}</ul>
    </div>
  </div>
</div>`;
    }

    // ── UI: portfolio view ─────────────────────────────────────────────────

    function renderPortfolioAnalysis(container, projects) {
        if (!container) return;
        _ensureStyles();

        // RBAC guard
        if (window.EngiSphereRBAC && !window.EngiSphereRBAC.hasPermission("view_ai_analysis")) {
            container.innerHTML = `<div class="aia-denied"><i class="fas fa-lock" style="margin-right:8px;"></i>Permission required: view_ai_analysis</div>`;
            return;
        }

        if (!Array.isArray(projects) || !projects.length) {
            container.innerHTML = `<p style="color:var(--muted);font-size:13px;text-align:center;padding:20px;">No projects available for analysis.</p>`;
            return;
        }

        const results = analyzeAllProjects(projects).sort((a, b) => b.riskScore - a.riskScore);
        const topProject = results[0];
        const criticalCnt = results.filter(r => r.health.label === "Critical").length;
        const atRiskCnt   = results.filter(r => r.health.label === "At Risk").length;
        const avgScore    = Math.round(results.reduce((s, r) => s + r.riskScore, 0) / results.length);

        const tableRows = results.map(r => {
            const p = r.project;
            return `
<tr>
  <td><strong>${_esc(p.title || p.name || p.id)}</strong></td>
  <td><span class="aia-badge" style="background:${r.health.color};font-size:10px;">${_esc(r.health.label)}</span></td>
  <td style="color:${r.health.color};font-weight:800;">${r.riskScore}</td>
  <td style="color:${r.delay.color};">${r.delay.pct}%</td>
  <td style="font-size:11px;color:var(--muted);">${_esc(r.recommendations[0])}</td>
</tr>`;
        }).join("");

        container.innerHTML = `
<div class="aia-wrap">
  <div class="aia-cards">
    <div class="aia-card">
      <div class="aia-card-label">Portfolio Avg Risk</div>
      <div class="aia-card-value" style="color:${avgScore > 60 ? "#ef4444" : avgScore > 40 ? "#f97316" : "#10b981"};">${avgScore}</div>
      <div class="aia-card-sub">out of 100</div>
    </div>
    <div class="aia-card">
      <div class="aia-card-label">Critical Projects</div>
      <div class="aia-card-value" style="color:${criticalCnt > 0 ? "#ef4444" : "#10b981"};">${criticalCnt}</div>
    </div>
    <div class="aia-card">
      <div class="aia-card-label">At-Risk Projects</div>
      <div class="aia-card-value" style="color:${atRiskCnt > 0 ? "#f97316" : "#10b981"};">${atRiskCnt}</div>
    </div>
    <div class="aia-card">
      <div class="aia-card-label">Top Priority</div>
      <div style="font-size:14px;font-weight:800;color:var(--text,#f8fafc);margin-top:4px;">
        ${_esc(topProject.project.title || topProject.project.name || "—")}
      </div>
      <div class="aia-card-sub">Highest risk score</div>
    </div>
  </div>

  <div>
    <div class="aia-section-title"><i class="fas fa-table" style="margin-right:5px;"></i>Project Intelligence Overview</div>
    <table class="aia-table">
      <thead>
        <tr>
          <th>Project</th><th>Health</th><th>Risk Score</th><th>Delay %</th><th>Top Recommendation</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
  </div>

  ${topProject ? `
  <div>
    <div class="aia-section-title"><i class="fas fa-radiation" style="margin-right:5px;color:#ef4444;"></i>
      Priority Alert — ${_esc(topProject.project.title || topProject.project.name)}
    </div>
    <div class="aia-summary">${_esc(topProject.summary)}</div>
  </div>` : ""}
</div>`;

        // System notification (once per session)
        if (_canNotify("portfolio_view", 1800000) && window.EngiSphereNotifications) {
            window.EngiSphereNotifications.addNotification({
                type:     "system",
                title:    "AI Portfolio Analysis",
                message:  `${results.length} projects analyzed. ${criticalCnt} critical, avg risk ${avgScore}/100.`,
                severity: criticalCnt > 0 ? "high" : "info"
            });
        }
    }

    // ── Public API ─────────────────────────────────────────────────────────

    return {
        analyzeProject,
        analyzeAllProjects,
        calculateRiskScore,
        calculateDelayProbability,
        getHealthStatus,
        getRiskFactors,
        getRecommendations,
        generateExecutiveSummary,
        renderProjectAnalysis,
        renderPortfolioAnalysis
    };
})();
