# 🚗 SmartDrive AI

An AI-powered Driving Test Evaluation & License Eligibility System that automates driving test assessment using Computer Vision and Machine Learning.

The system analyzes driving test videos, detects violations, calculates scores, determines pass/fail status, and allows candidates to view their results through a secure web portal.

---

## 📌 Features

### Candidate Portal

- Login using Application Number and Date of Birth
- View Driving Test Results
- View Pass/Fail Status
- Check License Eligibility
- View Detected Violations
- Watch Driving Test Video
- Download Evaluation Reports
- Receive AI-generated Feedback

### Admin Portal

- Secure Admin Login
- Add and Manage Candidates
- Upload Driving Test Videos
- View AI Evaluation Results
- Override AI Decisions
- Manage Pass/Fail Status
- Generate Reports
- Monitor Candidate Performance

### AI Features

- Vehicle Detection
- Lane Tracking
- Boundary Violation Detection
- Driving Behavior Analysis
- Automatic Score Calculation
- Pass/Fail Prediction
- AI Confidence Score
- Personalized Driving Recommendations

---

## 🏗 System Architecture

Candidate → Admin Uploads Video → AI Evaluation Engine → Result Generation → Database Storage → Candidate Dashboard

---

## 🛠 Tech Stack

### Frontend
- React.js
- Tailwind CSS
- Axios

### Backend
- Django
- Django REST Framework

### Database
- PostgreSQL

### AI & Computer Vision
- Python
- OpenCV
- YOLOv8
- Roboflow

### DevOps
- Docker
- GitHub Actions
- Nginx
- AWS EC2

---

## 📂 Project Structure

```text
smartdrive-ai/

frontend/
backend/
ai-engine/
datasets/
docs/

README.md
docker-compose.yml
```

---

## 🤖 AI Workflow

1. Admin uploads driving test video
2. AI detects vehicle movement
3. AI tracks lane position
4. AI identifies violations
5. Score is calculated
6. Pass/Fail result generated
7. Results stored in database
8. Candidate views results through dashboard

---

## 🚨 Supported Violations

- Boundary Crossing
- Lane Violation
- Wrong Indicator Usage
- Vehicle Stall
- Improper Reverse
- Unsafe Turning
- Excessive Speed

---

## 📊 Future Enhancements

- Real-Time Evaluation
- AI Chat Assistant
- SMS Notifications
- Email Notifications
- Multi-language Support
- QR Verification
- Mobile Application
- Driving Performance Heatmaps

---

## 🎯 Objective

To improve transparency, reduce manual errors, and provide a fair and automated driving test evaluation process using Artificial Intelligence.

---

## 👨‍💻 Developed By

Abhinand A

B.Tech Information Technology

Cochin University of Science and Technology (CUSAT)
