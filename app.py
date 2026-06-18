from __future__ import annotations

import json
import os
import time
from copy import deepcopy
from pathlib import Path

import firebase_admin
from firebase_admin import credentials, firestore
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS


BASE_DIR = Path(__file__).resolve().parent

DEFAULT_CANDIDATES = []
DEFAULT_AUDIT_LOGS = []
DEFAULT_NOTIFICATIONS = []


app = Flask(__name__, static_folder=str(BASE_DIR), static_url_path="")
CORS(app)


def now_ms() -> int:
    return int(time.time() * 1000)


def load_firebase_credentials():
    raw_credentials = os.getenv("FIREBASE_CREDENTIALS") or os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    if not raw_credentials:
        return None

    if raw_credentials.strip().startswith("{"):
        return credentials.Certificate(json.loads(raw_credentials))

    return credentials.Certificate(raw_credentials)


def get_firestore_db():
    if not os.getenv("FIREBASE_CREDENTIALS") and not os.getenv("GOOGLE_APPLICATION_CREDENTIALS"):
        return None

    if not firebase_admin._apps:
        cred = load_firebase_credentials()
        if cred is None:
            return None
        firebase_admin.initialize_app(cred)

    return firestore.client()


def collection_items(collection_name: str, descending: bool = False) -> list[dict]:
    db = get_firestore_db()
    if db is None:
        return []

    docs = db.collection(collection_name).stream()
    items = []

    for doc in docs:
        item = doc.to_dict() or {}
        item.setdefault("id", doc.id)
        items.append(item)

    items.sort(key=lambda item: item.get("sortOrder", 0), reverse=descending)
    return items


def json_response(payload, status: int = 200):
    return app.response_class(
        response=json.dumps(payload, ensure_ascii=False),
        status=status,
        mimetype="application/json",
    )


def ensure_seeded() -> None:
    db = get_firestore_db()
    if db is None:
        return

    if not list(db.collection("candidates").limit(1).stream()):
        for index, candidate in enumerate(DEFAULT_CANDIDATES, start=1):
            payload = {**candidate, "id": str(candidate.get("id", index)), "sortOrder": index}
            db.collection("candidates").document(payload["id"]).set(payload)

    if not list(db.collection("audit_logs").limit(1).stream()):
        total = len(DEFAULT_AUDIT_LOGS)
        for index, entry in enumerate(DEFAULT_AUDIT_LOGS):
            payload = {**entry, "id": entry.get("id", str(index + 1)), "sortOrder": total - index}
            db.collection("audit_logs").document(str(payload["id"])).set(payload)

    if not list(db.collection("notifications").limit(1).stream()):
        total = len(DEFAULT_NOTIFICATIONS)
        for index, entry in enumerate(DEFAULT_NOTIFICATIONS):
            payload = {**entry, "id": entry.get("id", index + 1), "sortOrder": total - index}
            db.collection("notifications").document(str(payload["id"])).set(payload)


@app.get("/api/candidates")
def get_candidates():
    return jsonify(collection_items("candidates", descending=False))


@app.post("/api/candidates")
def create_candidate():
    db = get_firestore_db()
    if db is None:
        return json_response({"error": "Firestore credentials are not configured. Set FIREBASE_CREDENTIALS or GOOGLE_APPLICATION_CREDENTIALS."}, 503)

    payload = request.get_json(silent=True) or {}
    candidate = deepcopy(payload)
    candidate_id = str(now_ms())
    candidate["id"] = candidate_id
    candidate["sortOrder"] = now_ms()
    db.collection("candidates").document(candidate_id).set(candidate)
    return json_response({"id": candidate_id, "message": "Candidate registered successfully"}, 201)


@app.put("/api/candidates/<candidate_id>/result")
def update_candidate_result(candidate_id: str):
    db = get_firestore_db()
    if db is None:
        return json_response({"error": "Firestore credentials are not configured. Set FIREBASE_CREDENTIALS or GOOGLE_APPLICATION_CREDENTIALS."}, 503)

    doc_ref = db.collection("candidates").document(candidate_id)
    snapshot = doc_ref.get()

    if not snapshot.exists:
        return json_response({"error": "Candidate not found"}, 404)

    payload = request.get_json(silent=True) or {}
    current = snapshot.to_dict() or {}
    updated = {**current, **payload, "id": candidate_id, "sortOrder": current.get("sortOrder", now_ms())}
    doc_ref.set(updated)
    return json_response({"message": "Candidate evaluation score saved and published"})


@app.put("/api/candidates/<candidate_id>")
def update_candidate(candidate_id: str):
    db = get_firestore_db()
    if db is None:
        return json_response({"error": "Firestore credentials are not configured. Set FIREBASE_CREDENTIALS or GOOGLE_APPLICATION_CREDENTIALS."}, 503)

    doc_ref = db.collection("candidates").document(candidate_id)
    snapshot = doc_ref.get()

    if not snapshot.exists:
        return json_response({"error": "Candidate not found"}, 404)

    payload = request.get_json(silent=True) or {}
    current = snapshot.to_dict() or {}
    current.update(
        {
            "name": payload.get("name", current.get("name")),
            "appNo": payload.get("appNo", current.get("appNo")),
            "dob": payload.get("dob", current.get("dob")),
            "llNo": payload.get("llNo", current.get("llNo")),
            "mobile": payload.get("mobile", current.get("mobile")),
            "email": payload.get("email", current.get("email")),
            "testDate": payload.get("testDate", current.get("testDate")),
        }
    )
    current["id"] = candidate_id
    current["sortOrder"] = current.get("sortOrder", now_ms())
    doc_ref.set(current)
    return json_response({"message": "Candidate registry updated successfully"})


@app.delete("/api/candidates/<candidate_id>")
def delete_candidate(candidate_id: str):
    db = get_firestore_db()
    if db is None:
        return json_response({"error": "Firestore credentials are not configured. Set FIREBASE_CREDENTIALS or GOOGLE_APPLICATION_CREDENTIALS."}, 503)

    doc_ref = db.collection("candidates").document(candidate_id)

    if not doc_ref.get().exists:
        return json_response({"error": "Candidate not found"}, 404)

    doc_ref.delete()
    return json_response({"message": "Candidate registry deleted successfully"})


@app.get("/api/audit-logs")
def get_audit_logs():
    return jsonify(collection_items("audit_logs", descending=True))


@app.post("/api/audit-logs")
def create_audit_log():
    db = get_firestore_db()
    if db is None:
        return json_response({"error": "Firestore credentials are not configured. Set FIREBASE_CREDENTIALS or GOOGLE_APPLICATION_CREDENTIALS."}, 503)

    payload = request.get_json(silent=True) or {}
    log_id = str(now_ms())
    payload = deepcopy(payload)
    payload["id"] = payload.get("id", log_id)
    payload["sortOrder"] = now_ms()
    db.collection("audit_logs").document(log_id).set(payload)
    return json_response({"message": "Audit log entry created"}, 201)


@app.get("/api/notifications")
def get_notifications():
    return jsonify(collection_items("notifications", descending=True))


@app.post("/api/notifications")
def create_notification():
    db = get_firestore_db()
    if db is None:
        return json_response({"error": "Firestore credentials are not configured. Set FIREBASE_CREDENTIALS or GOOGLE_APPLICATION_CREDENTIALS."}, 503)

    payload = request.get_json(silent=True) or {}
    notification_id = int(now_ms())
    payload = deepcopy(payload)
    payload["id"] = notification_id
    payload["sortOrder"] = now_ms()
    db.collection("notifications").document(str(notification_id)).set(payload)
    return json_response({"message": "Notification alert created"}, 201)


@app.put("/api/notifications/read")
def mark_notifications_read():
    db = get_firestore_db()
    if db is None:
        return json_response({"error": "Firestore credentials are not configured. Set FIREBASE_CREDENTIALS or GOOGLE_APPLICATION_CREDENTIALS."}, 503)

    notifications = db.collection("notifications").stream()
    batch = db.batch()

    for notification in notifications:
        batch.update(notification.reference, {"unread": False})

    batch.commit()
    return json_response({"message": "All notifications marked as read"})


@app.get("/api/health")
def health_check():
    return json_response(
        {
            "status": "ok",
            "firestore": bool(get_firestore_db()),
        }
    )


@app.route("/", defaults={"path": "index.html"})
@app.route("/<path:path>")
def serve_frontend(path: str):
    target = BASE_DIR / path
    if target.is_file():
        return send_from_directory(BASE_DIR, path)
    return send_from_directory(BASE_DIR, "index.html")


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=3000, debug=True)