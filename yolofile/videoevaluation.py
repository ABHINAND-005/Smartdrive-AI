import cv2
import numpy as np
from ultralytics import YOLO
from shapely.geometry import Polygon
import firebase_admin
from firebase_admin import credentials, firestore
import datetime
import os

# ==========================================
# FIREBASE SETUP
# ==========================================
print("[INFO] Connecting to Firebase Database...")
try:
    if not firebase_admin._apps:
        cred = credentials.Certificate("firebase_key.json") 
        firebase_admin.initialize_app(cred)
    db = firestore.client() 
    firebase_active = True
    print("[SUCCESS] Firebase connected!")
except Exception as e:
    print(f"[WARNING] Firebase setup failed. Saving locally only. Error: {e}")
    firebase_active = False

# ==========================================
# CONFIGURATION
# ==========================================
MODEL_PATH = "best.pt" 
CAR_CLASS_ID = 0      
TRACK_CLASS_ID = 1    
SAFETY_THRESHOLD = 95.0  
EXIT_FRAME_BUFFER = 30 

# Wrap the engine in a callable function for the backend
def evaluate_rto_video(video_path, candidate_id):
    print(f"[INFO] Loading optimized PyTorch model...")
    model = YOLO(MODEL_PATH, task="segment")
    
    print(f"[INFO] Opening video: {video_path}")
    cap = cv2.VideoCapture(video_path)

    if not cap.isOpened():
        return {"error": f"CRITICAL FAILURE: Could not open '{video_path}'!"}

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
    COOLDOWN_FRAMES = 45 
    early_exit_foul_active = False

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret: 
            break
            
        frame_h, frame_w = frame.shape[:2]
        inside_percentage = 100.0 
        in_safe_zone = False 

        if boundary_foul_cooldown > 0:
            boundary_foul_cooldown -= 1

        results = model(frame, verbose=False, device=0)
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

        cv2.imshow("Automated H-Track License Engine", frame)
        if cv2.waitKey(1) & 0xFF == ord('q'): break

    cap.release()
    cv2.destroyAllWindows()

    if not final_result:
        final_result = "INCOMPLETE (Aborted)"

    # UPLOAD TO CLOUD DATABASE (FIREBASE)
    if firebase_active:
        print("[FIREBASE] Uploading final scorecard to the cloud...")
        doc_ref = db.collection('license_tests').document()
        doc_ref.set({
            'candidate_id': candidate_id,
            'final_result': final_result,
            'total_score': total_score,
            'ai_confidence': round(avg_confidence, 1),
            'violations': violation_counts,
            'test_date': datetime.datetime.now()
        })

    # Return the metrics back to the web backend
    return {
        "candidate_id": candidate_id,
        "final_result": final_result,
        "total_score": total_score,
        "ai_confidence": round(avg_confidence, 1),
        "violations": violation_counts
    }