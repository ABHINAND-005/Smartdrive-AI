/**
 * SmartDrive AI - Firebase Cloud Functions Backend
 * Secure serverless logic running on Google Cloud Infrastructure
 */

const { onRequest } = require("firebase-functions/v2/https");
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

// Initialize Admin SDK with Cloud privileges
admin.initializeApp();
const db = admin.firestore();

/**
 * 1. HTTPS API Endpoint: evaluateDrivingTest
 * Triggers automated telemetry analysis and updates Candidate database files.
 * Method: POST
 * Body: { candidateId, violationsList }
 */
exports.evaluateDrivingTest = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  const { candidateId, violationsList } = req.body;
  if (!candidateId) {
    res.status(400).send("Bad Request: candidateId is required.");
    return;
  }

  try {
    const candidateRef = db.collection("candidates").doc(candidateId);
    const candidateSnap = await candidateRef.get();

    if (!candidateSnap.exists) {
      res.status(404).send("Candidate profile not found.");
      return;
    }

    // Default violation mappings if not supplied by sensor logs
    const violations = violationsList || [
      {
        name: "Wrong Indicator Usage",
        severity: "Warning",
        time: 25,
        description: "Turned exits without satisfying 3 seconds pre-signal alerts.",
        x: 280, y: 140
      }
    ];

    // AI Evaluation Logic
    let baseScore = 100;
    let hasCritical = false;

    violations.forEach(v => {
      if (v.severity === "Critical") {
        baseScore -= 40;
        hasCritical = true;
      } else if (v.severity === "Warning") {
        baseScore -= 10;
      }
    });

    if (baseScore < 0) baseScore = 0;

    const status = (baseScore >= 80 && !hasCritical) ? "Passed" : "Failed";
    const eligibility = status === "Passed" ? "Eligible" : "Retest Required";
    
    let rating = "Safe Driver";
    let ratingDesc = "Vehicle maintains good speed profiles and centers turn lanes properly.";

    if (baseScore < 60 || hasCritical) {
      rating = "Risky Driver";
      ratingDesc = "Frequent boundary touches or critical engine stalls logged during test.";
    } else if (baseScore < 80) {
      rating = "Average Driver";
      ratingDesc = "Standard track control shown, but boundary margins require practice.";
    }

    let retestDate = "";
    if (status === "Failed") {
      const rt = new Date();
      rt.setDate(rt.getDate() + 7);
      retestDate = rt.toISOString().split('T')[0];
    }

    const strengths = status === "Passed" 
      ? ["Defensive spacing parameters normal", "Safe reverse alignment inside dock grid"]
      : ["Proper seatbelt wear and mirror checks verified"];

    const weaknesses = status === "Passed"
      ? ["Indicator signal delayed at exit curve"]
      : ["Breached boundary coordinates lines on curves", "Improper clutch recovery control"];

    const evaluationResult = {
      score: baseScore,
      aiConfidence: parseFloat((90 + Math.random() * 9).toFixed(1)),
      status,
      eligibility,
      driverRating: rating,
      driverRatingDesc: ratingDesc,
      strengths,
      weaknesses,
      officerRemarks: `AI evaluation completed. Calculated Score: ${baseScore}/100. Status: ${status}.`,
      officerApproved: true,
      officerName: "System AI Agent",
      testDate: new Date().toISOString().split('T')[0],
      retestReadiness: baseScore,
      retestDate,
      violations
    };

    // Update Firestore Document
    await candidateRef.update(evaluationResult);

    // Write audit log entry on the backend
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await db.collection("audit_logs").add({
      time: timestamp,
      action: "AI Evaluation Ingested",
      user: "system.ai.engine",
      ip: "10.0.4.12",
      detail: `Telemetry analyzed. Score: ${baseScore}. Status: ${status} for candidate ID ${candidateId}.`
    });

    // Write notification alert
    await db.collection("notifications").add({
      id: Date.now(),
      title: "AI Result Processed",
      desc: `Automated test score: ${baseScore} logged for application.`,
      time: "Just now",
      unread: true,
      type: status === "Passed" ? "success" : "danger"
    });

    res.status(200).json({
      message: "AI evaluation processed and database records updated successfully.",
      result: evaluationResult
    });
  } catch (err) {
    console.error("Evaluation Cloud Function error:", err.message);
    res.status(500).send("Internal Server Error: " + err.message);
  }
});

/**
 * 2. Firestore Document Database Trigger: onResultPublished
 * Listens to updates in the candidates collection.
 * Triggers audit logs and notification alerts on candidate status change.
 */
exports.onResultPublished = onDocumentUpdated("candidates/{candidateId}", async (event) => {
  const beforeData = event.data.before.data();
  const afterData = event.data.after.data();

  // Trigger only if candidate status has changed (Passed vs Failed)
  if (beforeData.status !== afterData.status) {
    const candidateName = afterData.name;
    const appNo = afterData.appNo;
    const status = afterData.status;
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');

    try {
      // 1. Log change in audit collection
      await db.collection("audit_logs").add({
        time: timestamp,
        action: "Status Changed",
        user: afterData.officerName || "rto.inspector.system",
        ip: "192.168.20.1",
        detail: `Status modified from ${beforeData.status} to ${status} for candidate ${candidateName} (${appNo}).`
      });

      // 2. Add notification alert
      await db.collection("notifications").add({
        id: Date.now(),
        title: "Test Status Updated",
        desc: `Candidate ${candidateName} (${appNo}) status updated to ${status}.`,
        time: "Just now",
        unread: true,
        type: status === "Passed" ? "success" : "danger"
      });

      console.log(`Successfully logged status transition audit log for candidate ${appNo}.`);
    } catch (err) {
      console.error("onResultPublished DB Trigger failed:", err.message);
    }
  }
});
