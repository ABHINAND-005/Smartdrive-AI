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
  candidates: [],
  audit_logs: [],
  notifications: [
    { id: 1, title: "Result Published", desc: "Your driving evaluation result is now available.", time: "2 hours ago", unread: true, type: "success" },
    { id: 2, title: "License Approved", desc: "Digital verification badge generated successfully.", time: "1 day ago", unread: false, type: "primary" },
    { id: 3, title: "Identity Verified", desc: "Aadhaar and Learner details verified by OCR parser.", time: "2 days ago", unread: false, type: "info" }
  ]
};

const PROJECT_ID = 'smartdrive-ai-b723c';
const https = require('https');

// Helper to convert standard flat JSON to Firestore REST fields format
function toFirestoreFields(obj) {
  const fields = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      fields[key] = { stringValue: value };
    } else if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        fields[key] = { integerValue: String(value) };
      } else {
        fields[key] = { doubleValue: value };
      }
    } else if (typeof value === 'boolean') {
      fields[key] = { booleanValue: value };
    } else if (Array.isArray(value)) {
      fields[key] = {
        arrayValue: {
          values: value.map(item => {
            if (typeof item === 'object' && item !== null) {
              return { mapValue: { fields: toFirestoreFields(item) } };
            } else if (typeof item === 'string') {
              return { stringValue: item };
            } else if (typeof item === 'number') {
              return Number.isInteger(item) ? { integerValue: String(item) } : { doubleValue: item };
            } else if (typeof item === 'boolean') {
              return { booleanValue: item };
            }
            return { stringValue: '' };
          })
        }
      };
    } else if (typeof value === 'object' && value !== null) {
      fields[key] = { mapValue: { fields: toFirestoreFields(value) } };
    }
  }
  return fields;
}

// Helper to convert Firestore REST fields back to standard JSON
function fromFirestoreFields(fields) {
  if (!fields) return {};
  const obj = {};
  for (const [key, valObj] of Object.entries(fields)) {
    if ('stringValue' in valObj) {
      obj[key] = valObj.stringValue;
    } else if ('integerValue' in valObj) {
      obj[key] = parseInt(valObj.integerValue, 10);
    } else if ('doubleValue' in valObj) {
      obj[key] = parseFloat(valObj.doubleValue);
    } else if ('booleanValue' in valObj) {
      obj[key] = valObj.booleanValue;
    } else if ('arrayValue' in valObj) {
      const values = valObj.arrayValue.values || [];
      obj[key] = values.map(item => {
        if ('mapValue' in item) {
          return fromFirestoreFields(item.mapValue.fields);
        } else if ('stringValue' in item) {
          return item.stringValue;
        } else if ('integerValue' in item) {
          return parseInt(item.integerValue, 10);
        } else if ('doubleValue' in item) {
          return parseFloat(item.doubleValue);
        } else if ('booleanValue' in item) {
          return item.booleanValue;
        }
        return null;
      });
    } else if ('mapValue' in valObj) {
      obj[key] = fromFirestoreFields(valObj.mapValue.fields);
    }
  }
  return obj;
}

// HTTPS REST request helper for Firestore
function requestFirestore(method, pathUrl, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'firestore.googleapis.com',
      port: 443,
      path: pathUrl,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data ? JSON.parse(data) : null);
        } else {
          reject(new Error(`Status ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', err => reject(err));
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
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
      res.setHeader('Content-Type', 'application/json');

      // 1. GET /api/candidates
      if (parts[2] === 'candidates' && req.method === 'GET' && !parts[3]) {
        const pathUrl = `/v1/projects/${PROJECT_ID}/databases/(default)/documents/candidates`;
        requestFirestore('GET', pathUrl)
          .then(data => {
            const documents = data.documents || [];
            const list = documents.map(doc => {
              const id = doc.name.split('/').pop();
              return { id, ...fromFirestoreFields(doc.fields) };
            });
            res.writeHead(200);
            res.end(JSON.stringify(list));
          })
          .catch(err => {
            res.writeHead(500);
            res.end(JSON.stringify({ error: err.message }));
          });
        return;
      }

      // 2. POST /api/candidates
      if (parts[2] === 'candidates' && req.method === 'POST') {
        const c = parsedBody;
        const id = c.id || String(Date.now());
        c.id = id;
        const pathUrl = `/v1/projects/${PROJECT_ID}/databases/(default)/documents/candidates/${id}`;
        const bodyObj = { fields: toFirestoreFields(c) };
        requestFirestore('PATCH', pathUrl, bodyObj)
          .then(() => {
            res.writeHead(201);
            res.end(JSON.stringify({ id, message: "Candidate registered successfully" }));
          })
          .catch(err => {
            res.writeHead(500);
            res.end(JSON.stringify({ error: err.message }));
          });
        return;
      }

      // 3. PUT /api/candidates/:id/result
      if (parts[2] === 'candidates' && parts[3] && parts[4] === 'result' && req.method === 'PUT') {
        const id = parts[3];
        const updatedInfo = parsedBody;
        const getUrl = `/v1/projects/${PROJECT_ID}/databases/(default)/documents/candidates/${id}`;
        
        requestFirestore('GET', getUrl)
          .then(doc => {
            const currentObj = fromFirestoreFields(doc.fields);
            const merged = { ...currentObj, ...updatedInfo };
            const bodyObj = { fields: toFirestoreFields(merged) };
            return requestFirestore('PATCH', getUrl, bodyObj);
          })
          .then(() => {
            res.writeHead(200);
            res.end(JSON.stringify({ message: "Candidate evaluation score saved and published" }));
          })
          .catch(err => {
            res.writeHead(500);
            res.end(JSON.stringify({ error: err.message }));
          });
        return;
      }

      // 4. PUT /api/candidates/:id
      if (parts[2] === 'candidates' && parts[3] && req.method === 'PUT') {
        const id = parts[3];
        const updatedDemographics = parsedBody;
        const getUrl = `/v1/projects/${PROJECT_ID}/databases/(default)/documents/candidates/${id}`;
        
        requestFirestore('GET', getUrl)
          .then(doc => {
            const currentObj = fromFirestoreFields(doc.fields);
            const merged = {
              ...currentObj,
              name: updatedDemographics.name,
              appNo: updatedDemographics.appNo,
              dob: updatedDemographics.dob,
              llNo: updatedDemographics.llNo,
              mobile: updatedDemographics.mobile,
              email: updatedDemographics.email,
              testDate: updatedDemographics.testDate
            };
            const bodyObj = { fields: toFirestoreFields(merged) };
            return requestFirestore('PATCH', getUrl, bodyObj);
          })
          .then(() => {
            res.writeHead(200);
            res.end(JSON.stringify({ message: "Candidate registry updated successfully" }));
          })
          .catch(err => {
            res.writeHead(500);
            res.end(JSON.stringify({ error: err.message }));
          });
        return;
      }

      // 5. DELETE /api/candidates/:id
      if (parts[2] === 'candidates' && parts[3] && req.method === 'DELETE') {
        const id = parts[3];
        const pathUrl = `/v1/projects/${PROJECT_ID}/databases/(default)/documents/candidates/${id}`;
        requestFirestore('DELETE', pathUrl)
          .then(() => {
            res.writeHead(200);
            res.end(JSON.stringify({ message: "Candidate registry deleted successfully" }));
          })
          .catch(err => {
            res.writeHead(500);
            res.end(JSON.stringify({ error: err.message }));
          });
        return;
      }

      // 6. GET /api/audit-logs
      if (parts[2] === 'audit-logs' && req.method === 'GET') {
        const pathUrl = `/v1/projects/${PROJECT_ID}/databases/(default)/documents/audit_logs`;
        requestFirestore('GET', pathUrl)
          .then(data => {
            const documents = data.documents || [];
            const list = documents.map(doc => fromFirestoreFields(doc.fields));
            res.writeHead(200);
            res.end(JSON.stringify(list));
          })
          .catch(err => {
            res.writeHead(500);
            res.end(JSON.stringify({ error: err.message }));
          });
        return;
      }

      // 7. POST /api/audit-logs
      if (parts[2] === 'audit-logs' && req.method === 'POST') {
        const logObj = parsedBody;
        const id = String(Date.now()) + Math.floor(Math.random() * 1000);
        const pathUrl = `/v1/projects/${PROJECT_ID}/databases/(default)/documents/audit_logs/${id}`;
        const bodyObj = { fields: toFirestoreFields(logObj) };
        requestFirestore('PATCH', pathUrl, bodyObj)
          .then(() => {
            res.writeHead(201);
            res.end(JSON.stringify({ message: "Audit log entry created" }));
          })
          .catch(err => {
            res.writeHead(500);
            res.end(JSON.stringify({ error: err.message }));
          });
        return;
      }

      // 8. GET /api/notifications
      if (parts[2] === 'notifications' && req.method === 'GET') {
        const pathUrl = `/v1/projects/${PROJECT_ID}/databases/(default)/documents/notifications`;
        requestFirestore('GET', pathUrl)
          .then(data => {
            const documents = data.documents || [];
            const list = documents.map(doc => fromFirestoreFields(doc.fields));
            res.writeHead(200);
            res.end(JSON.stringify(list));
          })
          .catch(err => {
            res.writeHead(500);
            res.end(JSON.stringify({ error: err.message }));
          });
        return;
      }

      // 9. POST /api/notifications
      if (parts[2] === 'notifications' && req.method === 'POST') {
        const n = parsedBody;
        const id = n.id || Date.now();
        n.id = id;
        const pathUrl = `/v1/projects/${PROJECT_ID}/databases/(default)/documents/notifications/${id}`;
        const bodyObj = { fields: toFirestoreFields(n) };
        requestFirestore('PATCH', pathUrl, bodyObj)
          .then(() => {
            res.writeHead(201);
            res.end(JSON.stringify({ message: "Notification alert created" }));
          })
          .catch(err => {
            res.writeHead(500);
            res.end(JSON.stringify({ error: err.message }));
          });
        return;
      }

      // 10. PUT /api/notifications/read
      if (parts[2] === 'notifications' && parts[3] === 'read' && req.method === 'PUT') {
        const pathUrl = `/v1/projects/${PROJECT_ID}/databases/(default)/documents/notifications`;
        requestFirestore('GET', pathUrl)
          .then(data => {
            const documents = data.documents || [];
            const updatePromises = documents.map(doc => {
              const docId = doc.name.split('/').pop();
              const currentObj = fromFirestoreFields(doc.fields);
              currentObj.unread = false;
              const updateUrl = `/v1/projects/${PROJECT_ID}/databases/(default)/documents/notifications/${docId}`;
              const bodyObj = { fields: toFirestoreFields(currentObj) };
              return requestFirestore('PATCH', updateUrl, bodyObj);
            });
            return Promise.all(updatePromises);
          })
          .then(() => {
            res.writeHead(200);
            res.end(JSON.stringify({ message: "All notifications marked as read" }));
          })
          .catch(err => {
            res.writeHead(500);
            res.end(JSON.stringify({ error: err.message }));
          });
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
  console.log(`Connected to Cloud Firestore Database: ${PROJECT_ID}`);
});
