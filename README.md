# EngiSphere

EngiSphere is an AI-assisted engineering project intelligence and management platform. It helps engineering teams manage projects, visualize project locations, analyze risks, control team access, and review reports from one integrated workspace.

---

## Features

- Secure login interface
- Project Command Center dashboard
- AI-assisted project setup workflow
- Project details and engineering profile pages
- Interactive Geospatial Radar using Leaflet and OpenStreetMap
- AI Solution Map with engineering recommendations
- AI EngiBot for project and risk-related questions
- Team Access with Admin, Engineer, and Viewer roles
- Reports and Documents Center
- Local data persistence using browser localStorage

---

## Main Modules

### Dashboard
Displays portfolio statistics, active projects, risk indicators, progress, open risks, and reports generated.

### Project Setup
Allows users to create engineering projects through a structured workflow including identity, scope, requirements, documents, feasibility, and report stages.

### Project Details
Shows project profile information such as status, location, type, risk score, budget, timeline, client, and executive summary.

### Geospatial Radar
Displays projects on an interactive map and connects project data with location-based visualization.

### AI Solution Map
Generates structured recommendations including diagnosis, root causes, immediate actions, technical recommendations, risk reduction, timeline recovery, and cost optimization.

### AI EngiBot
Provides engineering assistance for project summaries, risk questions, and portfolio analysis.

### Team Access
Manages approved users, pending requests, and role-based permissions.

### Reports Center
Provides generated reports, document overview, open risks, pending reviews, report preview, and recommendations.

---

## Technologies Used

- HTML
- CSS
- JavaScript
- Leaflet.js
- OpenStreetMap
- Browser localStorage
- Rule-based AI logic

---

## Example Test Project

**Jeddah Waterfront Mobility Program**

- Location: Jeddah, Saudi Arabia
- Type: Infrastructure
- Status: Active
- Risk Score: 72/100
- Budget: 85,000,000
- Client: Jeddah Municipality

This project appears across the Dashboard, Project Details, Geospatial Radar, AI Solution Map, and AI EngiBot.

---

## How to Run

Clone the repository:

```bash
git clone <repository-url>
```

Run a local server:

```bash
python3 -m http.server 8000
```

Open:

```text
http://127.0.0.1:8000
```

---

## Testing Summary

Tested workflows include:

- Login and access
- Project creation
- Dashboard update
- Project details display
- Map marker rendering
- AI Solution Map output
- AI EngiBot responses
- Team access approval
- Reports preview
- Data persistence after refresh

---

## Limitations

This is an MVP prototype. It currently uses localStorage instead of a backend database, and the AI logic is rule-based. Future versions can include backend APIs, database integration, secure authentication, real AI models, PDF export, and advanced GIS layers.

---

## Purpose

EngiSphere demonstrates how AI-assisted engineering analysis, geospatial visualization, access control, and reporting can be combined into one platform to support engineering project decision-making.

