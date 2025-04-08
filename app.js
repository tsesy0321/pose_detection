let logData = [];
let poseId = 1; // Default to Lunge
let sitUpState = 'idle'; // States: 'idle', 'lying', 'sitting', 'completed'

// Function to calculate angle between three points (ported from Python)
function calculateAngle(a, b, c) {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs(radians * (180.0 / Math.PI));
  if (angle > 180.0) {
    angle = 360 - angle;
  }
  return angle;
}

// Function to detect lunge (ported from Python)
function detectLunge(leftKneeAngle, rightKneeAngle, legAngle) {
  if (leftKneeAngle > 80 && leftKneeAngle < 110 && rightKneeAngle > 80 && rightKneeAngle < 110) {
    if (legAngle > 80 && legAngle < 110) {
      return "Lunge Detected: Correct";
    } else {
      return "Lunge Detected but Legs Not Open Properly";
    }
  } else {
    return "Incorrect Lunge or No Lunge";
  }
}

// Function to detect sit-up (improved with state tracking)
function detectSitUp(leftKneeAngle, rightKneeAngle, torsoAngle) {
  let feedback = "Keep going...";

  // Update sit-up state based on angles
  if (leftKneeAngle < 70 && rightKneeAngle < 70 && torsoAngle > 60) {
    // Lying down position
    if (sitUpState === 'idle' || sitUpState === 'completed') {
      sitUpState = 'lying';
    }
  } else if (leftKneeAngle < 70 && rightKneeAngle < 70 && torsoAngle < 30) {
    // Sitting up position
    if (sitUpState === 'lying') {
      sitUpState = 'sitting';
    }
  } else if (sitUpState === 'sitting' && torsoAngle > 60) {
    // Back to lying down after sitting up
    sitUpState = 'completed';
    feedback = "Sit-up Detected: Correct";
    setTimeout(() => { sitUpState = 'idle'; }, 1000); // Reset after 1 second
  }

  // Provide real-time feedback
  if (sitUpState === 'lying') {
    feedback = "Lie down detected, now sit up";
  } else if (sitUpState === 'sitting') {
    feedback = "Sitting up detected, now lie back down";
  } else if (sitUpState === 'idle') {
    feedback = "Start by lying down with knees bent";
  }

  return feedback;
}

async function init() {
  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const feedbackDiv = document.getElementById('feedback');
  const poseSelect = document.getElementById('pose-select');
  const downloadBtn = document.getElementById('download-btn');

  // Request camera access
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
  } catch (err) {
    console.error('Error accessing camera:', err);
    feedbackDiv.textContent = 'Camera access is required for pose detection.';
    return;
  }

  // Wait for video to be ready
  video.onloadedmetadata = () => {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Initialize MediaPipe Pose
    const pose = new Pose({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    });
    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    pose.onResults(onResults);

    // Process video frames
    async function processFrame() {
      await pose.send({ image: video });
      requestAnimationFrame(processFrame);
    }

    processFrame();
  };

  // Handle pose selection
  poseSelect.addEventListener('change', (event) => {
    poseId = parseInt(event.target.value);
    if (poseId === 2) sitUpState = 'idle'; // Reset sit-up state when switching
  });

  // Handle download button
  downloadBtn.addEventListener('click', () => {
    if (logData.length === 0) {
      alert('No data to download.');
      return;
    }
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Timestamp,Pose ID,Left Knee Angle,Right Knee Angle,Torso Angle,Leg Angle,Pose Status\n"
      + logData.map(row => `${row.timestamp},${row.poseId},${row.leftKneeAngle},${row.rightKneeAngle},${row.torsoAngle || ''},${row.legAngle || ''},${row.poseStatus}`).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "pose_log.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  // Handle detection results
  function onResults(results) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (results.poseLandmarks) {
      drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, { color: 'white', lineWidth: 4 });
      drawLandmarks(ctx, results.poseLandmarks, { color: 'white', fillColor: 'rgb(255,138,0)', radius: 5 });

      // Extract landmarks
      const landmarks = results.poseLandmarks;
      const leftHip = landmarks[23];
      const leftKnee = landmarks[25];
      const leftAnkle = landmarks[27];
      const rightHip = landmarks[24];
      const rightKnee = landmarks[26];
      const rightAnkle = landmarks[28];
      const leftShoulder = landmarks[11];
      const rightShoulder = landmarks[12];
      const midHip = { x: (leftHip.x + rightHip.x) / 2, y: (leftHip.y + rightHip.y) / 2 };
      const midShoulder = { x: (leftShoulder.x + rightShoulder.x) / 2, y: (leftShoulder.y + rightShoulder.y) / 2 };

      // Calculate angles
      const leftKneeAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
      const rightKneeAngle = calculateAngle(rightHip, rightKnee, rightAnkle);
      const torsoAngle = calculateAngle(midShoulder, midHip, leftKnee); // For sit-up
      const legAngle = calculateAngle(leftKnee, midHip, rightKnee); // For lunge

      let poseText = "";
      if (poseId === 1) { // Lunge
        poseText = detectLunge(leftKneeAngle, rightKneeAngle, legAngle);
      } else if (poseId === 2) { // Sit-up
        poseText = detectSitUp(leftKneeAngle, rightKneeAngle, torsoAngle);
      }

      // Display feedback
      feedbackDiv.textContent = `Left Knee: ${leftKneeAngle.toFixed(1)}°, Right Knee: ${rightKneeAngle.toFixed(1)}°, Torso: ${torsoAngle.toFixed(1)}°, Leg: ${legAngle.toFixed(1)}° - ${poseText}`;

      // Log data
      const timestamp = new Date().toISOString();
      logData.push({
        timestamp,
        poseId,
        leftKneeAngle: leftKneeAngle.toFixed(1),
        rightKneeAngle: rightKneeAngle.toFixed(1),
        torsoAngle: torsoAngle.toFixed(1),
        legAngle: legAngle.toFixed(1),
        poseStatus: poseText
      });
    } else {
      feedbackDiv.textContent = "No pose detected";
      sitUpState = 'idle'; // Reset if no pose detected
    }
  }
}

// Start the application
init();