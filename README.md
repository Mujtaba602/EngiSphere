# 🏗️ EngiSphere - Integrated Engineering Management System

EngiSphere is a professional software solution designed to bridge the gap between engineering firms and their clients. It provides a transparent, secure, and efficient environment for project tracking and management.

## ✨ Key Features
* **Secure Authentication:** Full JWT (JSON Web Token) implementation with password hashing (Bcrypt).
* **Engineer Dashboard:** Real-time project tracking, CRUD operations, and data visualization using Chart.js.
* **Client Portal:** A transparent view for clients to follow their project's progress and site reports.
* **AI Integration:** Includes **EngiBot** for engineering queries and **DevSpace** for system diagnostics.

## 🛠️ Tech Stack
* **Backend:** Python (FastAPI), SQLAlchemy, SQLite.
* **Frontend:** HTML5, CSS3, JavaScript (Vanilla).
* **Security:** OAuth2 with JWT, CORS Middleware.

## 🚀 MVP Features

The following features were developed and delivered as part of the final development sprint:

| Feature | Description |
|---|---|
| **Project Progress Tracking** | Real-time progress, status, and risk updates stored in localStorage with merge logic |
| **PDF Export Reports** | Professional A4-landscape PDF reports with project health and recommendations section |
| **RBAC (Frontend MVP)** | Role-based access control enforced at the UI layer for all major pages |
| **Notification Center** | In-app notification system with severity levels and anti-spam cooldowns |
| **AI Project Analysis** | Rule-based local AI engine: Risk Score, Health Status, Delay Probability, Recommendations |
| **Geospatial Radar** | Interactive Leaflet map with AI-colored markers, filter chips, and enriched popups |
| **Audit Log MVP** | Structured audit event logging for key user actions across the platform |
| **Dashboard Analytics** | Project Health Overview with executive summary, best/worst project cards, and AI indicators |

> **Security Notice:** RBAC is implemented at the **frontend MVP level**. Production deployment must enforce permissions in the **backend API** as well to ensure true security.

## 👥 Contributors
* **Mujtaba Mohammed** - Lead Software Engineer & CEO
* **Ahmedmutasim7** - Chief Technology Officer (CTO)
* **Azzam-249** - Head of Operations
* **AliMohammed49** - Lead Data Scientist