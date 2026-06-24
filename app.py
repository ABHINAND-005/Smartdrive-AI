from __future__ import annotations

import json
import os
import sys
import time
from copy import deepcopy
from pathlib import Path
from werkzeug.utils import secure_filename

# --- AI Engine Imports ---
import cv2
import numpy as np
from ultralytics import YOLO
from shapely.geometry import Polygon

# --- Firebase & Flask Imports ---
import firebase_admin
from firebase_admin import credentials, firestore
from flask import Flask, jsonify, request, send_from_directory, Response
from flask_cors import CORS

BASE_DIR = Path(__file__).resolve().parent

# Temporary folder for local video processing
UPLOAD_FOLDER = BASE_DIR / "temp_uploads"
UPLOAD_FOLDER.mkdir(exist_ok=True)

DEFAULT_CANDIDATES = []
DEFAULT_AUDIT_LOGS = []
DEFAULT_NOTIFICATIONS = []

app = Flask(__name__, static_folder=str(BASE_DIR), static_url_path="")
CORS(app)

# GLOBAL VARIABLE FOR WEB STREAMING
CURRENT_EVAL_FRAME = None

# ==========================================
# FIREBASE UTILS
# ==========================================
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

def resize_with_aspect_ratio(frame, max_display_height=600):
    """Resizes the frame to fit within the screen while maintaining aspect ratio."""
    height, width = frame.shape[:2]
    
    # Calculate scale factor
    scale = max_display_height / height
    new_width = int(width * scale)
    new_height = int(height * scale)
    
    return cv2.resize(frame, (new_width, new_height), interpolation=cv2.INTER_AREA)

# ==========================================
# UNIFIED AI EVALUATION ENGINE
# ==========================================
def evaluate_rto_video(video_path, candidate_id):
    global CURRENT_EVAL_FRAME
    
    print(f"[INFO] Loading optimized PyTorch model...")
    # Make sure best.pt is in the same folder as app.py
    model = YOLO("best.pt", task="segment") 
    
    print(f"[INFO] Opening video: {video_path}")
    cap = cv2.VideoCapture(video_path)

    if not cap.isOpened():
        return {"error": f"CRITICAL FAILURE: Could not open '{video_path}'!"}

    CAR_CLASS_ID = 0      
    TRACK_CLASS_ID = 1    
    SAFETY_THRESHOLD = 95.0  
    EXIT_FRAME_BUFFER = 30 

    static_track_poly = None
    frozen_track_coords = None
    track_min_x = track_min_y = track_max_x = track_max_y = 0
    track_w = track_h = 0

    test_state = "WAITING"   
    final_result = ""        
    exit_counter = 0  
    active_gate = None
    
    expected_path = []
    path_taken = []
    
    total_score = 100
    violation_counts = {}   
    confidence_sum = 0.0    
    confidence_count = 0
    avg_confidence = 0.0
    
    boundary_foul_cooldown = 0
    COOLDOWN_FRAMES = 90 
    early_exit_foul_active = False

    # ANTI-LAG: Frame Skipping Setup
    frame_count = 0
    frame_skip = 1 # Processes every 2nd frame (doubles stream speed)

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret: 
            break
            
        frame_count += 1
        
        # ANTI-LAG: Skip frames to keep real-time stream fast
        if frame_count % frame_skip != 0:
            continue
            
        frame_h, frame_w = frame.shape[:2]
        inside_percentage = 100.0 
        in_safe_zone = False 

        if boundary_foul_cooldown > 0:
            boundary_foul_cooldown -= 1

        # ANTI-LAG: Lower imgsz to 480 to speed up GPU/CPU evaluation
        results = model(frame, verbose=False, device=0, imgsz=480) 
        detected_cars = []

        for result in results:
            if result.masks is not None:
                for mask_coords, box in zip(result.masks.xy, result.boxes):
                    class_id = int(box.cls[0])
                    conf = float(box.conf[0]) 
                    
                    if class_id == TRACK_CLASS_ID and static_track_poly is None:
                        if len(mask_coords) >= 3: 
                            static_track_poly = Polygon(mask_coords)
                            frozen_track_coords = np.array(mask_coords, dtype=np.int32)
                            track_min_x, track_min_y, track_max_x, track_max_y = static_track_poly.bounds
                            track_w = track_max_x - track_min_x
                            track_h = track_max_y - track_min_y
                    
                    elif class_id == CAR_CLASS_ID:
                        if len(mask_coords) >= 3:
                            car_p = Polygon(mask_coords)
                            if car_p.is_valid and car_p.area > 0:
                                detected_cars.append({
                                    'poly': car_p,
                                    'coords': np.array(mask_coords, dtype=np.int32),
                                    'center': car_p.centroid,
                                    'conf': conf
                                })

        if static_track_poly is not None:
            cv2.polylines(frame, [frozen_track_coords], isClosed=True, color=(255, 0, 0), thickness=2)
            
            active_car = None
            max_overlap_area = 0
            for car in detected_cars:
                overlap = car['poly'].intersection(static_track_poly).area
                if overlap > max_overlap_area:
                    max_overlap_area = overlap
                    active_car = car

            if active_car is not None:
                inside_percentage = (max_overlap_area / active_car['poly'].area) * 100
                car_cx = active_car['center'].x
                car_cy = active_car['center'].y
                
                confidence_sum += active_car['conf']
                confidence_count += 1
                avg_confidence = (confidence_sum / confidence_count) * 100
                
                cv2.polylines(frame, [active_car['coords']], isClosed=True, color=(0, 255, 255), thickness=2)
                
                on_left_half = car_cx < (track_min_x + track_w * 0.5)
                on_top_half = car_cy < (track_min_y + track_h * 0.5)

                if test_state == "WAITING":
                    if inside_percentage > 5.0:
                        test_state = "ENTERING"
                        
                        if car_cy < (track_min_y + track_h * 0.25): active_gate = "TOP_LEFT" if on_left_half else "TOP_RIGHT"
                        elif car_cy > (track_max_y - track_h * 0.25): active_gate = "BOTTOM_LEFT" if on_left_half else "BOTTOM_RIGHT"
                        elif car_cx < (track_min_x + track_w * 0.25): active_gate = "LEFT_TOP" if on_top_half else "LEFT_BOTTOM"
                        elif car_cx > (track_max_x - track_w * 0.25): active_gate = "RIGHT_TOP" if on_top_half else "RIGHT_BOTTOM"
                        
                        start_corner = ""
                        if active_gate in ["TOP_LEFT", "LEFT_TOP"]: start_corner = "TL"
                        elif active_gate in ["TOP_RIGHT", "RIGHT_TOP"]: start_corner = "TR"
                        elif active_gate in ["BOTTOM_LEFT", "LEFT_BOTTOM"]: start_corner = "BL"
                        elif active_gate in ["BOTTOM_RIGHT", "RIGHT_BOTTOM"]: start_corner = "BR"

                        is_horizontal_H = track_w > track_h
                        
                        if is_horizontal_H:
                            if start_corner == "BL": expected_path = ["BL", "BR", "TL", "TR", "BL"]
                            elif start_corner == "BR": expected_path = ["BR", "BL", "TR", "TL", "BR"]
                            elif start_corner == "TL": expected_path = ["TL", "TR", "BL", "BR", "TL"]
                            elif start_corner == "TR": expected_path = ["TR", "TL", "BR", "BL", "TR"]
                        else:
                            if start_corner == "BL": expected_path = ["BL", "TL", "BR", "TR", "BL"]
                            elif start_corner == "BR": expected_path = ["BR", "TR", "BL", "TL", "BR"]
                            elif start_corner == "TL": expected_path = ["TL", "BL", "TR", "BR", "TL"]
                            elif start_corner == "TR": expected_path = ["TR", "BR", "TL", "BL", "TR"]
                        
                        if expected_path: path_taken.append(expected_path[0])

                elif test_state == "ENTERING":
                    if inside_percentage >= SAFETY_THRESHOLD:
                        test_state = "IN_PROGRESS"
                        exit_counter = 0

                elif test_state == "IN_PROGRESS":
                    is_left = car_cx < (track_min_x + track_w * 0.40)
                    is_right = car_cx > (track_max_x - track_w * 0.40)
                    is_top = car_cy < (track_min_y + track_h * 0.40)
                    is_bottom = car_cy > (track_max_y - track_h * 0.40)

                    current_checkpoint = None
                    if is_top and is_left: current_checkpoint = "TL"
                    elif is_top and is_right: current_checkpoint = "TR"
                    elif is_bottom and is_left: current_checkpoint = "BL"
                    elif is_bottom and is_right: current_checkpoint = "BR"

                    if current_checkpoint and len(path_taken) > 0 and current_checkpoint != path_taken[-1]:
                        path_taken.append(current_checkpoint)
                        if path_taken != expected_path[:len(path_taken)]:
                            violation_counts["Wrong Sequence (-30)"] = violation_counts.get("Wrong Sequence (-30)", 0) + 1
                            total_score -= 30

                    in_safe_zone = False
                    if active_gate == "TOP_LEFT": in_safe_zone = (car_cy < (track_min_y + track_h * 0.35)) and on_left_half
                    elif active_gate == "TOP_RIGHT": in_safe_zone = (car_cy < (track_min_y + track_h * 0.35)) and not on_left_half
                    elif active_gate == "BOTTOM_LEFT": in_safe_zone = (car_cy > (track_max_y - track_h * 0.35)) and on_left_half
                    elif active_gate == "BOTTOM_RIGHT": in_safe_zone = (car_cy > (track_max_y - track_h * 0.35)) and not on_left_half
                    elif active_gate == "LEFT_TOP": in_safe_zone = (car_cx < (track_min_x + track_w * 0.35)) and on_top_half
                    elif active_gate == "LEFT_BOTTOM": in_safe_zone = (car_cx < (track_min_x + track_w * 0.35)) and not on_top_half
                    elif active_gate == "RIGHT_TOP": in_safe_zone = (car_cx > (track_max_x - track_w * 0.35)) and on_top_half
                    elif active_gate == "RIGHT_BOTTOM": in_safe_zone = (car_cx > (track_max_x - track_w * 0.35)) and not on_top_half

                    if inside_percentage < SAFETY_THRESHOLD:
                        if not in_safe_zone:
                            if boundary_foul_cooldown == 0:
                                violation_counts["Boundary Crossed (-10)"] = violation_counts.get("Boundary Crossed (-10)", 0) + 1
                                total_score -= 10
                                boundary_foul_cooldown = COOLDOWN_FRAMES  
                        else:
                            if len(path_taken) < len(expected_path):
                                if not early_exit_foul_active:
                                    violation_counts["Exited Early (-50)"] = violation_counts.get("Exited Early (-50)", 0) + 1
                                    total_score -= 50
                                    early_exit_foul_active = True
                    
                    if inside_percentage <= 2.0:
                        exit_counter += 1
                        if exit_counter >= EXIT_FRAME_BUFFER:
                            test_state = "FINISHED"
                            final_result = "PASSED" if total_score >= 80 else "FAILED"
                    else:
                        exit_counter = 0 

            else:
                if test_state == "IN_PROGRESS":
                    exit_counter += 1
                    if exit_counter >= EXIT_FRAME_BUFFER:
                        test_state = "FINISHED"
                        final_result = "PASSED" if total_score >= 80 else "FAILED"
        
        # UI Rendering
        score_color = (0, 255, 0) if total_score >= 80 else (0, 0, 255)
        cv2.putText(frame, f"SCORE: {total_score}/100", (40, 50), cv2.FONT_HERSHEY_DUPLEX, 1.2, score_color, 3)
        cv2.putText(frame, f"AI CONFIDENCE: {avg_confidence:.1f}%", (40, 85), cv2.FONT_HERSHEY_DUPLEX, 0.7, (200, 200, 200), 2)
        
        if len(violation_counts) > 0:
            cv2.putText(frame, "VIOLATION BREAKDOWN:", (frame_w - 400, 50), cv2.FONT_HERSHEY_DUPLEX, 0.7, (0, 0, 255), 2)
            y_offset = 85
            for violation, count in violation_counts.items():
                multiplier_text = f" x{count}" if count > 1 else ""
                cv2.putText(frame, f"- {violation}{multiplier_text}", (frame_w - 400, y_offset), cv2.FONT_HERSHEY_DUPLEX, 0.6, (0, 0, 255), 2)
                y_offset += 30

        if test_state == "WAITING":
            cv2.putText(frame, "STATUS: WAITING", (40, 130), cv2.FONT_HERSHEY_DUPLEX, 0.8, (0, 255, 255), 2)
        elif test_state == "ENTERING":
            cv2.putText(frame, f"STATUS: ENTERING ({active_gate})", (40, 130), cv2.FONT_HERSHEY_DUPLEX, 0.8, (255, 150, 0), 2)
        elif test_state == "IN_PROGRESS" or test_state == "FINISHED":
            if len(expected_path) > 0:
                cv2.putText(frame, f"REQUIRED: {' -> '.join(expected_path)}", (40, frame_h - 70), cv2.FONT_HERSHEY_DUPLEX, 0.7, (255, 255, 255), 2)
                cv2.putText(frame, f"CURRENT:  {' -> '.join(path_taken)}", (40, frame_h - 30), cv2.FONT_HERSHEY_DUPLEX, 0.7, (0, 255, 255), 2)

            if test_state == "IN_PROGRESS":
                if len(violation_counts) > 0:
                    cv2.putText(frame, "STATUS: FOUL RECORDED", (40, 130), cv2.FONT_HERSHEY_DUPLEX, 0.8, (0, 0, 255), 2)
                elif in_safe_zone and inside_percentage < SAFETY_THRESHOLD:
                    cv2.putText(frame, f"STATUS: EXITING ({active_gate})", (40, 130), cv2.FONT_HERSHEY_DUPLEX, 0.8, (255, 150, 0), 2)
                else:
                    cv2.putText(frame, "STATUS: TRACKING CLEAN", (40, 130), cv2.FONT_HERSHEY_DUPLEX, 0.8, (0, 255, 0), 2)
                    
            elif test_state == "FINISHED":
                result_color = (0, 255, 0) if final_result == "PASSED" else (0, 0, 255)
                cv2.putText(frame, f"FINAL RESULT: {final_result}", (40, 130), cv2.FONT_HERSHEY_DUPLEX, 1.5, result_color, 4)
        
        display_frame = resize_with_aspect_ratio(frame, max_display_height=600)
        
        # Save the frame to the global variable for the web stream
        CURRENT_EVAL_FRAME = display_frame.copy()
        
        # ANTI-LAG: Tiny sleep to allow Flask streaming thread to grab the image
        time.sleep(0.005) 

    cap.release()

    if not final_result:
        final_result = "INCOMPLETE (Aborted)"

    # Clear the stream when done
    CURRENT_EVAL_FRAME = None

    return {
        "candidate_id": candidate_id,
        "final_result": final_result,
        "total_score": total_score,
        "ai_confidence": round(avg_confidence, 1) if confidence_count > 0 else 0.0,
        "violations": violation_counts
    }

# ==========================================
# WEB STREAMING ENDPOINTS
# ==========================================
def generate_live_frames():
    """Generator function that yields frames to the web browser."""
    global CURRENT_EVAL_FRAME
    while True:
        if CURRENT_EVAL_FRAME is not None:
            # Encode the frame in JPEG format
            ret, buffer = cv2.imencode('.jpg', CURRENT_EVAL_FRAME)
            if ret:
                frame_bytes = buffer.tobytes()
                # Yield the multipart response frame
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        else:
            # If no frame is currently being processed, yield a blank frame or wait
            time.sleep(0.1)

@app.route("/api/video_stream")
def video_stream():
    """Route to stream the live evaluation to the frontend."""
    return Response(generate_live_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

# ==========================================
# FLASK WEB ENDPOINTS
# ==========================================
@app.route("/api/evaluate", methods=["POST"])
def run_evaluation():
    if 'video' not in request.files:
        return json_response({'error': 'No video file provided'}, 400)
    
    file = request.files['video']
    candidate_id = request.form.get('candidate_id', 'UNKNOWN_CANDIDATE')

    if file.filename == '':
        return json_response({'error': 'Empty filename'}, 400)

    filename = secure_filename(file.filename)
    video_path = UPLOAD_FOLDER / filename
    file.save(str(video_path))

    try:
        print(f"[BACKEND] Starting AI evaluation for {candidate_id}...")
        
        # This will block and run the evaluation. 
        # While it runs, the frames are sent to CURRENT_EVAL_FRAME for the stream.
        results = evaluate_rto_video(str(video_path), candidate_id)
        
        if video_path.exists():
            video_path.unlink()

        return json_response({'success': True, 'results': results})

    except Exception as e:
        if video_path.exists():
            video_path.unlink()
        return json_response({'success': False, 'error': str(e)}, 500)

@app.get("/api/candidates")
def get_candidates():
    return jsonify(collection_items("candidates", descending=False))

@app.post("/api/candidates")
def create_candidate():
    db = get_firestore_db()
    if db is None:
        return json_response({"error": "Firestore not configured."}, 503)

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
        return json_response({"error": "Firestore not configured."}, 503)

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
        return json_response({"error": "Firestore not configured."}, 503)

    doc_ref = db.collection("candidates").document(candidate_id)
    snapshot = doc_ref.get()

    if not snapshot.exists:
        return json_response({"error": "Candidate not found"}, 404)

    payload = request.get_json(silent=True) or {}
    current = snapshot.to_dict() or {}
    current.update({
        "name": payload.get("name", current.get("name")),
        "appNo": payload.get("appNo", current.get("appNo")),
        "dob": payload.get("dob", current.get("dob")),
        "llNo": payload.get("llNo", current.get("llNo")),
        "mobile": payload.get("mobile", current.get("mobile")),
        "email": payload.get("email", current.get("email")),
        "testDate": payload.get("testDate", current.get("testDate")),
    })
    current["id"] = candidate_id
    current["sortOrder"] = current.get("sortOrder", now_ms())
    doc_ref.set(current)
    return json_response({"message": "Candidate registry updated successfully"})

@app.delete("/api/candidates/<candidate_id>")
def delete_candidate(candidate_id: str):
    db = get_firestore_db()
    if db is None:
        return json_response({"error": "Firestore not configured."}, 503)

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
        return json_response({"error": "Firestore not configured."}, 503)

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
        return json_response({"error": "Firestore not configured."}, 503)

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
        return json_response({"error": "Firestore not configured."}, 503)

    notifications = db.collection("notifications").stream()
    batch = db.batch()
    for notification in notifications:
        batch.update(notification.reference, {"unread": False})

    batch.commit()
    return json_response({"message": "All notifications marked as read"})

@app.get("/api/health")
def health_check():
    return json_response({
        "status": "ok",
        "firestore": bool(get_firestore_db()),
    })

@app.route("/", defaults={"path": "index.html"})
@app.route("/<path:path>")
def serve_frontend(path: str):
    target = BASE_DIR / path
    if target.is_file():
        return send_from_directory(BASE_DIR, path)
    return send_from_directory(BASE_DIR, "index.html")

if __name__ == "__main__":
    print("="*50)
    print("🚀 SMART RTO UNIFIED ENGINE STARTING ON PORT 5000...")
    print("Ensure best.pt is placed in the same folder as app.py")
    print("="*50)
    # THREADED MUST BE TRUE FOR THE VIDEO STREAM TO WORK SIMULTANEOUSLY!
    app.run(host="127.0.0.1", port=5000, debug=True, threaded=True, use_reloader=False)