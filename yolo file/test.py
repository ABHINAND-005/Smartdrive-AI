import cv2
import numpy as np
from ultralytics import YOLO
from shapely.geometry import Polygon

# ==========================================
# CONFIGURATION
# ==========================================
MODEL_PATH = "best.pt" 
VIDEO_PATH = "h1.mp4"

CAR_CLASS_ID = 0      
TRACK_CLASS_ID = 1    
SAFETY_THRESHOLD = 95.0  

# Number of frames to wait before ending the test when car leaves
EXIT_FRAME_BUFFER = 30 
# ==========================================

def main():
    print("[INFO] Loading optimized PyTorch model...")
    model = YOLO(MODEL_PATH, task="segment")
    
    print(f"[INFO] Opening video: {VIDEO_PATH}")
    cap = cv2.VideoCapture(VIDEO_PATH)

    # --- Explicit error check for the video file ---
    if not cap.isOpened():
        print(f"\n[ERROR] CRITICAL FAILURE: Could not open '{VIDEO_PATH}'!")
        print("Please ensure the video file is in the exact same folder as this script")
        print("and that the filename is spelled correctly.\n")
        return

    static_track_poly = None
    frozen_track_coords = None
    track_min_x = track_min_y = track_max_x = track_max_y = 0
    track_w = track_h = 0

    test_state = "WAITING"   
    foul_committed = False   
    foul_reason = ""
    final_result = ""        
    exit_counter = 0  
    
    active_gate = None
    
    # Official RTO Path Tracking
    expected_path = []
    path_taken = []

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret: 
            print("[INFO] Video playback finished.")
            break

        # Dropped-frame UI protections
        inside_percentage = 100.0 
        in_safe_zone = False 

        # GPU Accelerated Detection
        results = model(frame, verbose=False, device=0)
        detected_cars = []

        for result in results:
            if result.masks is not None:
                for mask_coords, box in zip(result.masks.xy, result.boxes):
                    class_id = int(box.cls[0])
                    
                    # 1. AUTO-DETECT AND LOCK TRACK GEOMETRY
                    if class_id == TRACK_CLASS_ID and static_track_poly is None:
                        if len(mask_coords) >= 3: 
                            static_track_poly = Polygon(mask_coords)
                            frozen_track_coords = np.array(mask_coords, dtype=np.int32)
                            
                            track_min_x, track_min_y, track_max_x, track_max_y = static_track_poly.bounds
                            track_w = track_max_x - track_min_x
                            track_h = track_max_y - track_min_y
                            print("[SUCCESS] Track mathematically locked!")
                    
                    # 2. COLLECT CARS
                    elif class_id == CAR_CLASS_ID:
                        if len(mask_coords) >= 3:
                            car_p = Polygon(mask_coords)
                            if car_p.is_valid and car_p.area > 0:
                                detected_cars.append({
                                    'poly': car_p,
                                    'coords': np.array(mask_coords, dtype=np.int32),
                                    'center': car_p.centroid 
                                })

        # ==========================================
        # RTO PATH & WALL FOUL LOGIC
        # ==========================================
        if static_track_poly is not None:
            # Draw the frozen track boundary in Blue
            cv2.polylines(frame, [frozen_track_coords], isClosed=True, color=(255, 0, 0), thickness=2)
            
            # Find the active test car (ignores background traffic)
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
                
                # Draw the active car boundary in Yellow
                cv2.polylines(frame, [active_car['coords']], isClosed=True, color=(0, 255, 255), thickness=2)
                
                on_left_half = car_cx < (track_min_x + track_w * 0.5)
                on_top_half = car_cy < (track_min_y + track_h * 0.5)

                # --- STATE: WAITING ---
                if test_state == "WAITING":
                    if inside_percentage > 5.0:
                        test_state = "ENTERING"
                        
                        # Identify starting gate
                        if car_cy < (track_min_y + track_h * 0.15): active_gate = "TOP_LEFT" if on_left_half else "TOP_RIGHT"
                        elif car_cy > (track_max_y - track_h * 0.15): active_gate = "BOTTOM_LEFT" if on_left_half else "BOTTOM_RIGHT"
                        elif car_cx < (track_min_x + track_w * 0.15): active_gate = "LEFT_TOP" if on_top_half else "LEFT_BOTTOM"
                        elif car_cx > (track_max_x - track_w * 0.15): active_gate = "RIGHT_TOP" if on_top_half else "RIGHT_BOTTOM"
                        
                        # Standardize starting position to a generic Corner (TL, TR, BL, BR)
                        start_corner = ""
                        if active_gate in ["TOP_LEFT", "LEFT_TOP"]: start_corner = "TL"
                        elif active_gate in ["TOP_RIGHT", "RIGHT_TOP"]: start_corner = "TR"
                        elif active_gate in ["BOTTOM_LEFT", "LEFT_BOTTOM"]: start_corner = "BL"
                        elif active_gate in ["BOTTOM_RIGHT", "RIGHT_BOTTOM"]: start_corner = "BR"

                        # Determine track orientation to generate correct driving sequence
                        is_horizontal_H = track_w > track_h
                        
                        if is_horizontal_H:
                            # Legs go Left <-> Right
                            if start_corner == "BL": expected_path = ["BL", "BR", "TL", "TR", "BL"]
                            elif start_corner == "BR": expected_path = ["BR", "BL", "TR", "TL", "BR"]
                            elif start_corner == "TL": expected_path = ["TL", "TR", "BL", "BR", "TL"]
                            elif start_corner == "TR": expected_path = ["TR", "TL", "BR", "BL", "TR"]
                        else:
                            # Legs go Top <-> Bottom
                            if start_corner == "BL": expected_path = ["BL", "TL", "BR", "TR", "BL"]
                            elif start_corner == "BR": expected_path = ["BR", "TR", "BL", "TL", "BR"]
                            elif start_corner == "TL": expected_path = ["TL", "BL", "TR", "BR", "TL"]
                            elif start_corner == "TR": expected_path = ["TR", "BR", "TL", "BL", "TR"]
                        
                        if expected_path: path_taken.append(expected_path[0])

                # --- STATE: ENTERING ---
                elif test_state == "ENTERING":
                    if inside_percentage >= SAFETY_THRESHOLD:
                        test_state = "IN_PROGRESS"
                        exit_counter = 0

                # --- STATE: IN PROGRESS ---
                elif test_state == "IN_PROGRESS":
                    
                    # 1. SEQUENCE TRACKING WITH DEADZONES
                    # Center 20% is a neutral zone to prevent false-positives when driving straight!
                    is_left = car_cx < (track_min_x + track_w * 0.40)
                    is_right = car_cx > (track_max_x - track_w * 0.40)
                    is_top = car_cy < (track_min_y + track_h * 0.40)
                    is_bottom = car_cy > (track_max_y - track_h * 0.40)

                    current_checkpoint = None
                    if is_top and is_left: current_checkpoint = "TL"
                    elif is_top and is_right: current_checkpoint = "TR"
                    elif is_bottom and is_left: current_checkpoint = "BL"
                    elif is_bottom and is_right: current_checkpoint = "BR"

                    # If car entered a new valid checkpoint corner
                    if current_checkpoint and len(path_taken) > 0 and current_checkpoint != path_taken[-1]:
                        path_taken.append(current_checkpoint)
                        
                        # CRITERIA 1 CHECK: Did they drive to the wrong corner?
                        if path_taken != expected_path[:len(path_taken)]:
                            foul_committed = True
                            if not foul_reason: foul_reason = "WRONG DIRECTION SEQUENCE"

                    # 2. WALL COLLISION TRACKING
                    # The ONLY allowed safe space to drop below 95% is the extreme 15% edge of the STARTING gate
                    in_safe_zone = False
                    if active_gate == "TOP_LEFT": in_safe_zone = (car_cy < (track_min_y + track_h * 0.15)) and on_left_half
                    elif active_gate == "TOP_RIGHT": in_safe_zone = (car_cy < (track_min_y + track_h * 0.15)) and not on_left_half
                    elif active_gate == "BOTTOM_LEFT": in_safe_zone = (car_cy > (track_max_y - track_h * 0.15)) and on_left_half
                    elif active_gate == "BOTTOM_RIGHT": in_safe_zone = (car_cy > (track_max_y - track_h * 0.15)) and not on_left_half
                    elif active_gate == "LEFT_TOP": in_safe_zone = (car_cx < (track_min_x + track_w * 0.15)) and on_top_half
                    elif active_gate == "LEFT_BOTTOM": in_safe_zone = (car_cx < (track_min_x + track_w * 0.15)) and not on_top_half
                    elif active_gate == "RIGHT_TOP": in_safe_zone = (car_cx > (track_max_x - track_w * 0.15)) and on_top_half
                    elif active_gate == "RIGHT_BOTTOM": in_safe_zone = (car_cx > (track_max_x - track_w * 0.15)) and not on_top_half

                    if inside_percentage < SAFETY_THRESHOLD:
                        if not in_safe_zone:
                            # CRITERIA 2 CHECK: Hit a wall outside the gate!
                            foul_committed = True
                            if not foul_reason: foul_reason = "BOUNDARY CROSSED (HIT WALL)"
                        else:
                            # They are at the entry door. Have they visited all 4 prongs?
                            if len(path_taken) < len(expected_path):
                                foul_committed = True
                                if not foul_reason: foul_reason = "EXITED BEFORE COMPLETING TEST"
                    
                    # 3. TEST EXIT CHECK
                    if inside_percentage <= 2.0:
                        exit_counter += 1
                        if exit_counter >= EXIT_FRAME_BUFFER:
                            test_state = "FINISHED"
                            final_result = "FAILED" if foul_committed else "PASSED"
                    else:
                        exit_counter = 0 

            else:
                # If car leaves the frame completely while in progress
                if test_state == "IN_PROGRESS":
                    exit_counter += 1
                    if exit_counter >= EXIT_FRAME_BUFFER:
                        test_state = "FINISHED"
                        final_result = "FAILED" if foul_committed else "PASSED"

        # ==========================================
        # UI RENDERING
        # ==========================================
        if test_state == "WAITING":
            cv2.putText(frame, "STATUS: WAITING", (40, 50), cv2.FONT_HERSHEY_DUPLEX, 1.0, (0, 255, 255), 2)
            
        elif test_state == "ENTERING":
            cv2.putText(frame, f"STATUS: ENTERING ({active_gate})", (40, 50), cv2.FONT_HERSHEY_DUPLEX, 1.0, (255, 150, 0), 2)
            
        elif test_state == "IN_PROGRESS" or test_state == "FINISHED":
            
            # --- Draw the RTO Sequence Dashboard ---
            if len(expected_path) > 0:
                expected_str = " -> ".join(expected_path)
                taken_str = " -> ".join(path_taken)
                
                cv2.putText(frame, f"REQUIRED: {expected_str}", (40, 100), cv2.FONT_HERSHEY_DUPLEX, 0.7, (255, 255, 255), 2)
                cv2.putText(frame, f"CURRENT:  {taken_str}", (40, 130), cv2.FONT_HERSHEY_DUPLEX, 0.7, (0, 255, 255), 2)

            if foul_committed:
                cv2.putText(frame, f"FOUL: {foul_reason}", (40, 50), cv2.FONT_HERSHEY_DUPLEX, 1.2, (0, 0, 255), 3)
                cv2.rectangle(frame, (0, 0), (frame.shape[1], frame.shape[0]), (0, 0, 255), 10)
            else:
                if test_state == "IN_PROGRESS":
                    if in_safe_zone and inside_percentage < SAFETY_THRESHOLD:
                        cv2.putText(frame, f"STATUS: COMPLETING TEST ({active_gate})", (40, 50), cv2.FONT_HERSHEY_DUPLEX, 1.0, (255, 150, 0), 2)
                    else:
                        cv2.putText(frame, f"VERDICT: CLEAN ({inside_percentage:.1f}%)", (40, 50), cv2.FONT_HERSHEY_DUPLEX, 1.0, (0, 255, 0), 2)
                elif test_state == "FINISHED":
                    color = (0, 255, 0) if final_result == "PASSED" else (0, 0, 255)
                    cv2.putText(frame, f"FINAL RESULT: {final_result}", (40, 60), cv2.FONT_HERSHEY_DUPLEX, 2.0, color, 5)

        cv2.imshow("Automated H-Track License Engine", frame)
        if cv2.waitKey(1) & 0xFF == ord('q'): break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()