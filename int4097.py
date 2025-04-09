import cv2
import mediapipe as mp
import numpy as np
import pandas as pd
from datetime import datetime

# Initialize MediaPipe Pose and drawing utilities
mp_pose = mp.solutions.pose
pose = mp_pose.Pose(min_detection_confidence=0.5, min_tracking_confidence=0.5)
mp_drawing = mp.solutions.drawing_utils

# Function to calculate the angle between three points
def calculate_angle(a, b, c):
    a = np.array(a)
    b = np.array(b)
    c = np.array(c)
    radians = np.arctan2(c[1] - b[1], c[0] - b[0]) - np.arctan2(a[1] - b[1], a[0] - b[0])
    angle = np.abs(radians * 180.0 / np.pi)
    if angle > 180.0:
        angle = 360 - angle
    return angle

# Function to detect lunge
def detect_lunge(left_knee_angle, right_knee_angle, leg_angle):
    if 80 < left_knee_angle < 110 and 80 < right_knee_angle < 110:
        if 80 < leg_angle < 110:
            return "Lunge Detected: Correct", (0, 255, 0)  # Green for correct
        else:
            return "Lunge Detected but Legs Not Open Properly", (0, 255, 255)  # Yellow for warning
    else:
        return "Incorrect Lunge or No Lunge", (0, 0, 255)  # Red

# Function to detect sit-up
def detect_sit_up(left_knee_angle, right_knee_angle):
    if left_knee_angle < 70 and right_knee_angle < 70:
        return "Sit up Detected: Correct", (0, 255, 0)  # Green for correct
    else:
        return "Incorrect Sit Up or No Sit Up", (0, 0, 255)  # Red

# Ask user to select pose with input validation
print("Select pose: 1 for Lunge, 2 for Sit-up")
while True:
    try:
        pose_id = int(input())
        if pose_id in [1, 2]:
            break
        else:
            print("Please enter 1 or 2.")
    except ValueError:
        print("Invalid input. Please enter a number.")

# Initialize webcam capture
cap = cv2.VideoCapture(0)

# Check if webcam is opened successfully
if not cap.isOpened():
    print("Error: Could not open webcam.")
    exit()

# Log data list
log_data = []

# Instructions for quitting
print("Press 'q' to quit the program.")

# Main loop for real-time processing
while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        print("Error: Failed to capture frame.")
        break

    # Convert frame for MediaPipe processing
    image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    image.flags.writeable = False
    results = pose.process(image)
    image.flags.writeable = True
    image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)
    image_height, image_width, _ = image.shape

    # Default pose detection message and color
    pose_text = "No Pose Detected"
    color = (255, 255, 255)  # White
    left_knee_angle = None
    right_knee_angle = None

    # Process pose landmarks if detected
    if results.pose_landmarks:
        landmarks = results.pose_landmarks.landmark

        # Extract left leg landmarks
        left_hip = [landmarks[mp_pose.PoseLandmark.LEFT_HIP.value].x * image_width,
                    landmarks[mp_pose.PoseLandmark.LEFT_HIP.value].y * image_height]
        left_knee = [landmarks[mp_pose.PoseLandmark.LEFT_KNEE.value].x * image_width,
                     landmarks[mp_pose.PoseLandmark.LEFT_KNEE.value].y * image_height]
        left_ankle = [landmarks[mp_pose.PoseLandmark.LEFT_ANKLE.value].x * image_width,
                      landmarks[mp_pose.PoseLandmark.LEFT_ANKLE.value].y * image_height]

        # Extract right leg landmarks
        right_hip = [landmarks[mp_pose.PoseLandmark.RIGHT_HIP.value].x * image_width,
                     landmarks[mp_pose.PoseLandmark.RIGHT_HIP.value].y * image_height]
        right_knee = [landmarks[mp_pose.PoseLandmark.RIGHT_KNEE.value].x * image_width,
                      landmarks[mp_pose.PoseLandmark.RIGHT_KNEE.value].y * image_height]
        right_ankle = [landmarks[mp_pose.PoseLandmark.RIGHT_ANKLE.value].x * image_width,
                       landmarks[mp_pose.PoseLandmark.RIGHT_ANKLE.value].y * image_height]

        # Calculate knee angles
        left_knee_angle = calculate_angle(left_hip, left_knee, left_ankle)
        right_knee_angle = calculate_angle(right_hip, right_knee, right_ankle)

        # Determine pose based on user selection
        if pose_id == 1:  # Lunge detection
            mid_hip = [(left_hip[0] + right_hip[0]) / 2, (left_hip[1] + right_hip[1]) / 2]
            leg_angle = calculate_angle(left_knee, mid_hip, right_knee)
            pose_text, color = detect_lunge(left_knee_angle, right_knee_angle, leg_angle)
        elif pose_id == 2:  # Sit-up detection
            pose_text, color = detect_sit_up(left_knee_angle, right_knee_angle)

        # Draw pose landmarks on the frame
        mp_drawing.draw_landmarks(image, results.pose_landmarks, mp_pose.POSE_CONNECTIONS)

    # Annotate the frame with text
    cv2.putText(image, f"Left Knee Angle: {int(left_knee_angle) if left_knee_angle else 'N/A'}", (50, 50),
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2)
    cv2.putText(image, f"Right Knee Angle: {int(right_knee_angle) if right_knee_angle else 'N/A'}", (50, 80),
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2)
    cv2.putText(image, pose_text, (50, 110),
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2)
    cv2.putText(image, "Press 'q' to quit", (50, 140),
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)

    # Display the frame
    cv2.imshow('Pose Detection', image)

    # Log the data for each frame
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_entry = {
        "timestamp": timestamp,
        "pose_id": pose_id,
        "left_knee_angle": left_knee_angle,
        "right_knee_angle": right_knee_angle,
        "pose_status": pose_text
    }
    log_data.append(log_entry)

    # Check for 'q' key press to quit
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

# Release webcam and close windows
cap.release()
cv2.destroyAllWindows()

# Save log data to CSV
df = pd.DataFrame(log_data)
df.to_csv("pose_log.csv", index=False)
print("Log saved to pose_log.csv")