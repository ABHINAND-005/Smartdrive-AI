# 🚗 SmartDrive AI

An AI-powered Driving Test Evaluation & License Eligibility System that automates driving test assessment using Computer Vision and Machine Learning telemetry.

The system analyzes driving test videos, detects violations, calculates scores, determines pass/fail status, and allows candidates to view their results through a secure web portal.

---

## 📌 Features

### Candidate Portal
* Login using Application Number and Date of Birth
* View Driving Test Results & Pass/Fail Status
* Check License Eligibility with secure QR verification
* View Detected Violations mapped to timestamps
* Download Evaluation Reports (print layout optimization)
* Receive AI-generated feedback & driving recommendations
* Multi-language support (English & Malayalam)
* Personal Profile & Interface settings (Theme toggling, alerts sync)

### Admin Portal
* Secure Admin Login
* Add, Search, and Manage Candidates (CRUD Registry)
* Upload Driving Test Videos telemetry simulation
* View AI Evaluation Results & real-time system terminal logs console
* Override AI Decisions with custom officer remarks
* Monitor Candidate Performance & driving analytics
* Track test failure hotspots with SVG track diagrams

### AI & Simulation Features
* Lane tracking & Boundary crossing detection
* Driving behavior analytics & automatic score calculations
* Pass/Fail predictions with AI confidence intervals

---

## 🏗 System Architecture

Candidate → Admin Uploads Video Telemetry → AI Evaluation Engine → Result Generation → Database Storage (Firebase/Local DB) → Dynamic Candidate Dashboard (Single Page App Shell)

---

## 🛠 Tech Stack

### Frontend
* **Core**: Vanilla HTML5, Vanilla JavaScript (ES6 Modules, Canvas API, Fetch API)
* **Styling**: Vanilla CSS3 (Custom properties/CSS variables, high-contrast dark theme, grid-layouts, and CSS animations)
* **Visuals & Utilities**: Chart.js (CDN), QRious.js (CDN), FontAwesome (CDN)

### Backend & API
* **Local Server**: Node.js (Zero-dependency http and FS-based REST API router)

### Database
* **Offline Mode**: Simulated JSON database (`database.json` and `localStorage` collections)
* **Cloud Mode**: Live Google Firebase Cloud Firestore integration

---

## 📂 Project Structure

```text
smartdrive-ai/
├── pages/                 # Unified HTML Page templates containing embedded specific styles
│   ├── landing.html
│   ├── user-login.html
│   ├── admin-login.html
│   ├── candidate-dashboard.html
│   ├── candidate-results.html
│   ├── candidate-feedback.html
│   ├── candidate-eligibility.html
│   ├── admin-dashboard.html
│   ├── admin-candidates.html
│   ├── admin-video-evaluation.html
│   ├── admin-result-override.html
│   ├── admin-reports-analytics.html
│   ├── admin-audit-logs.html
│   └── profile-settings.html
├── index.html             # Lightweight Layout Skeleton & Master Shell
├── styles.css             # Root stylesheet (globals, variables, layouts, sidebar, widgets)
├── app.js                 # JS App logic & dynamic template loading engine
├── server.js              # Zero-dependency local Node.js HTTP/API server
├── database.json          # Simulated database storage
├── firestore.rules        # Security rules for optional Firebase integration
└── README.md              # Project documentation
```

---

## 🤖 AI Workflow

1. Admin uploads driving test video telemetry
2. AI detects vehicle movement & tracks lane position coordinates
3. AI identifies violations & compiles event logs
4. Test score is calculated and results are stored in the database
5. RTO Officer reviews logs & signs off or overrides the result
6. Candidate logs into dashboard to view dynamic results, watch path animations, and download reports

---

## 🚨 Supported Violations

* Boundary Crossing (guideline touches)
* Lane Discipline Violation
* Wrong Indicator Usage
* Vehicle Stall (engine speed stalls)
* Improper Reverse alignment
* Unsafe Turning radius
* Excessive Speed

---

## 📊 Future Enhancements

* Real-Time Video Stream Evaluation via WebRTC
* Direct SMS & Email notification gateway integrations
* Full Mobile Application shell using Cordova/Capacitor
* Hardware interface synchronization with RTO track sensors

---

## 🎯 Objective

To improve transparency, reduce manual errors, and provide a fair and automated driving test evaluation process using Artificial Intelligence.
