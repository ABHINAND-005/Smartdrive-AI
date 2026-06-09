/**
 * SmartDrive AI - Zero-Dependency Local Backend Server
 * Uses standard Node.js libraries only (runs completely offline without npm install)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const DB_FILE = path.join(__dirname, 'database.json');

// Default Seed Data
const defaultDb = {
  candidates: [
    {
      id: "1",
      name: "Abhinand S",
      appNo: "APP-2026-001",
      dob: "2000-01-01",
      llNo: "KL-14/10452/2026",
      mobile: "9447201045",
      email: "abhinand.s@gmail.com",
      testDate: "2026-06-08",
      score: 88,
      aiConfidence: 96.5,
      status: "Passed",
      eligibility: "Eligible",
      officerRemarks: "Candidate demonstrates stable lane behavior and vehicle control. All minimal boundary touches corrected swiftly. Approved.",
      officerName: "Inspector K. Raghavan",
      officerApproved: true,
      driverRating: "Safe Driver",
      driverRatingDesc: "Candidate shows high vehicle control stability and defensive driving habits.",
      strengths: ["Maintains accurate centering inside test lane grid", "Smooth steering wheel movement during the curve", "Correct indicator engagement prior to turning"],
      weaknesses: ["Slight delay in restoring steering output after parking merge"],
      retestReadiness: 92,
      retestDate: "",
      violations: [
        {
          name: "Lane Boundary Touch",
          severity: "Warning",
          time: 14,
          description: "Left front tire breached yellow guideline coordinates temporarily during the curve loop.",
          x: 210, y: 90
        }
      ]
    },
    {
      id: "2",
      name: "Meera Nair",
      appNo: "APP-2026-002",
      dob: "1998-05-15",
      llNo: "KL-14/09845/2026",
      mobile: "9845620145",
      email: "meera.nair@yahoo.com",
      testDate: "2026-06-07",
      score: 45,
      aiConfidence: 92.4,
      status: "Failed",
      eligibility: "Retest Required",
      officerRemarks: "Critical boundaries crossed twice on left corners. Engine stalled in box parking grid. Retest recommended after mandatory road practice.",
      officerName: "Inspector K. Raghavan",
      officerApproved: true,
      driverRating: "Risky Driver",
      driverRatingDesc: "Frequent boundary drifts and engine stalls show insufficient maneuver practice.",
      strengths: ["Proper seatbelt wear and look-around scans verified"],
      weaknesses: ["Crossed outer boundary lines during tight turns", "Improper brake balance control resulting in vehicle stall"],
      retestReadiness: 48,
      retestDate: "2026-06-15",
      violations: [
        {
          name: "Lane Boundary Touch",
          severity: "Warning",
          time: 8,
          description: "Left tire crossed lateral limits at 8s.",
          x: 100, y: 160
        },
        {
          name: "Vehicle Stall",
          severity: "Critical",
          time: 18,
          description: "Vehicle remained stationary with zero engine speed in parking grid for 7 seconds.",
          x: 300, y: 130
        },
        {
          name: "Wrong Indicator Usage",
          severity: "Warning",
          time: 25,
          description: "Turned into exit lane without activating side indicators.",
          x: 280, y: 140
        }
      ]
    },
    {
      id: "3",
      name: "Rahul K",
      appNo: "APP-2026-003",
      dob: "2001-11-20",
      llNo: "KL-14/11054/2026",
      mobile: "9048756321",
      email: "rahul.k@outlook.com",
      testDate: "2026-06-09",
      score: 95,
      aiConfidence: 98.2,
      status: "Passed",
      eligibility: "Eligible",
      officerRemarks: "Flawless boundary scores. Perfect reverse parking execution.",
      officerName: "Inspector A. Prasad",
      officerApproved: true,
      driverRating: "Safe Driver",
      driverRatingDesc: "Superior coordinate alignment and timely signaling alerts.",
      strengths: ["Zero boundary drifts logged", "Flawless lane docking", "Immediate indicator transitions"],
      weaknesses: [],
      retestReadiness: 98,
      retestDate: "",
      violations: []
    },
    {
      id: "4",
      name: "Sneha Joseph",
      appNo: "APP-2026-004",
      dob: "1999-08-30",
      llNo: "KL-14/08451/2026",
      mobile: "8596041235",
      email: "sneha.j@gmail.com",
      testDate: "2026-06-05",
      score: 62,
      aiConfidence: 94.0,
      status: "Failed",
      eligibility: "Retest Required",
      officerRemarks: "Overspeeding in curves. Retest scheduled.",
      officerName: "Inspector A. Prasad",
      officerApproved: true,
      driverRating: "Average Driver",
      driverRatingDesc: "General stability matches standard thresholds, but speed limits breached.",
      strengths: ["Accurate reverse path tracking lines"],
      weaknesses: ["Breached speed limits on turns"],
      retestReadiness: 65,
      retestDate: "2026-06-12",
      violations: [
        {
          name: "Overspeeding",
          severity: "Warning",
          time: 12,
          description: "Exceeded 20 km/h limit in turn radius.",
          x: 100, y: 100
        },
        {
          name: "Unsafe Turn",
          severity: "Warning",
          time: 22,
          description: "Turned curve with excessive steering momentum.",
          x: 380, y: 90
        }
      ]
    }
  ],
  audit_logs: [
    { time: "2026-06-08 18:32:05", action: "Officer Authenticated", user: "rto.officer.01", ip: "192.168.1.45", detail: "Successful portal login session." },
    { time: "2026-06-08 17:15:12", action: "Result Published", user: "rto.officer.01", ip: "192.168.1.45", detail: "Published Passed result for APP-2026-001." },
    { time: "2026-06-08 14:02:45", action: "Video Telemetry Ingested", user: "rto.officer.02", ip: "192.168.1.48", detail: "Uploaded coordinate logs for APP-2026-002." }
  ],
  notifications: [
    { id: 1, title: "Result Published", desc: "Your driving evaluation result is now available.", time: "2 hours ago", unread: true, type: "success" },
    { id: 2, title: "License Approved", desc: "Digital verification badge generated successfully.", time: "1 day ago", unread: false, type: "primary" },
    { id: 3, title: "Identity Verified", desc: "Aadhaar and Learner details verified by OCR parser.", time: "2 days ago", unread: false, type: "info" }
  ]
};

// Database Read/Write Helpers
function readDb() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultDb, null, 2));
    return defaultDb;
  }
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return defaultDb;
  }
}

function writeDb(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// Router Server
const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle options preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Parse body
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', () => {
    let parsedBody = {};
    if (body) {
      try {
        parsedBody = JSON.parse(body);
      } catch (err) {
        console.error("Error parsing JSON body:", err.message);
      }
    }

    const urlPath = req.url.split('?')[0];
    const parts = urlPath.split('/');

    // API Routing
    if (parts[1] === 'api') {
      const dbData = readDb();
      res.setHeader('Content-Type', 'application/json');

      // 1. GET /api/candidates
      if (parts[2] === 'candidates' && req.method === 'GET' && !parts[3]) {
        res.writeHead(200);
        res.end(JSON.stringify(dbData.candidates));
        return;
      }

      // 2. POST /api/candidates
      if (parts[2] === 'candidates' && req.method === 'POST') {
        const c = parsedBody;
        c.id = String(Date.now());
        dbData.candidates.push(c);
        writeDb(dbData);
        res.writeHead(201);
        res.end(JSON.stringify({ id: c.id, message: "Candidate registered successfully" }));
        return;
      }

      // 3. PUT /api/candidates/:id/result
      if (parts[2] === 'candidates' && parts[3] && parts[4] === 'result' && req.method === 'PUT') {
        const id = parts[3];
        const updatedInfo = parsedBody;
        const index = dbData.candidates.findIndex(item => item.id === id);
        
        if (index >= 0) {
          dbData.candidates[index] = {
            ...dbData.candidates[index],
            ...updatedInfo
          };
          writeDb(dbData);
          res.writeHead(200);
          res.end(JSON.stringify({ message: "Candidate evaluation score saved and published" }));
        } else {
          res.writeHead(404);
          res.end(JSON.stringify({ error: "Candidate not found" }));
        }
        return;
      }

      // 4. PUT /api/candidates/:id
      if (parts[2] === 'candidates' && parts[3] && req.method === 'PUT') {
        const id = parts[3];
        const updatedDemographics = parsedBody;
        const index = dbData.candidates.findIndex(item => item.id === id);
        
        if (index >= 0) {
          dbData.candidates[index] = {
            ...dbData.candidates[index],
            name: updatedDemographics.name,
            appNo: updatedDemographics.appNo,
            dob: updatedDemographics.dob,
            llNo: updatedDemographics.llNo,
            mobile: updatedDemographics.mobile,
            email: updatedDemographics.email,
            testDate: updatedDemographics.testDate
          };
          writeDb(dbData);
          res.writeHead(200);
          res.end(JSON.stringify({ message: "Candidate registry updated successfully" }));
        } else {
          res.writeHead(404);
          res.end(JSON.stringify({ error: "Candidate not found" }));
        }
        return;
      }

      // 5. DELETE /api/candidates/:id
      if (parts[2] === 'candidates' && parts[3] && req.method === 'DELETE') {
        const id = parts[3];
        const index = dbData.candidates.findIndex(item => item.id === id);
        
        if (index >= 0) {
          dbData.candidates.splice(index, 1);
          writeDb(dbData);
          res.writeHead(200);
          res.end(JSON.stringify({ message: "Candidate registry deleted successfully" }));
        } else {
          res.writeHead(404);
          res.end(JSON.stringify({ error: "Candidate not found" }));
        }
        return;
      }

      // 6. GET /api/audit-logs
      if (parts[2] === 'audit-logs' && req.method === 'GET') {
        res.writeHead(200);
        res.end(JSON.stringify(dbData.audit_logs));
        return;
      }

      // 7. POST /api/audit-logs
      if (parts[2] === 'audit-logs' && req.method === 'POST') {
        dbData.audit_logs.unshift(parsedBody);
        writeDb(dbData);
        res.writeHead(201);
        res.end(JSON.stringify({ message: "Audit log entry created" }));
        return;
      }

      // 8. GET /api/notifications
      if (parts[2] === 'notifications' && req.method === 'GET') {
        res.writeHead(200);
        res.end(JSON.stringify(dbData.notifications));
        return;
      }

      // 9. POST /api/notifications
      if (parts[2] === 'notifications' && req.method === 'POST') {
        const n = parsedBody;
        n.id = Date.now();
        dbData.notifications.unshift(n);
        writeDb(dbData);
        res.writeHead(201);
        res.end(JSON.stringify({ message: "Notification alert created" }));
        return;
      }

      // 10. PUT /api/notifications/read
      if (parts[2] === 'notifications' && parts[3] === 'read' && req.method === 'PUT') {
        dbData.notifications.forEach(n => n.unread = false);
        writeDb(dbData);
        res.writeHead(200);
        res.end(JSON.stringify({ message: "All notifications marked as read" }));
        return;
      }

      // Fallback API route
      res.writeHead(404);
      res.end(JSON.stringify({ error: "API route not found" }));
      return;
    }

    // Static Webpage Routing
    let filePath = path.join(__dirname, urlPath === '/' ? 'index.html' : urlPath);
    const ext = path.extname(filePath);
    
    // Set appropriate content type
    let contentType = 'text/html';
    if (ext === '.css') contentType = 'text/css';
    else if (ext === '.js') contentType = 'application/javascript';
    else if (ext === '.json') contentType = 'application/json';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.jpg') contentType = 'image/jpeg';
    else if (ext === '.svg') contentType = 'image/svg+xml';

    fs.readFile(filePath, (err, content) => {
      if (err) {
        if (err.code === 'ENOENT') {
          res.writeHead(404, { 'Content-Type': 'text/html' });
          res.end('<h1>404 File Not Found</h1>', 'utf-8');
        } else {
          res.writeHead(500);
          res.end(`Server Error: ${err.code}`);
        }
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content, 'utf-8');
      }
    });
  });
});

server.listen(PORT, () => {
  console.log(`SmartDrive AI Server running locally at http://localhost:${PORT}`);
});
