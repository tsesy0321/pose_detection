let logData = [];
let poseId = 1; // Default to Lunge

// Function to calculate angle between three points
function calculateAngle(a, b, c) {
  const vector1 = [a.x - b.x, a.y - b.y];
  const vector2 = [c.x - b.x, c.y - b.y];
  const dotProduct = vector1[0] * vector2[0] + vector1[1] * vector2[1];
  const magnitude1 = Math.sqrt(vector1[0] ** 2 + vector1[1] ** 2);
  const magnitude2 = Math.sqrt(vector2[0] ** 2 + vector2[1] ** 2);
  const angle = Math.acos(dotProduct / (magnitude1 * magnitude2)) * (180 / Math.PI);
  return angle;
}

// Function to detect lunge
function detectLunge(leftKneeAngle, rightKneeAngle) {
  if (leftKneeAngle > 80 && leftKneeAngle < 110 && rightKneeAngle > 80 && rightKneeAngle < 110) {
    return "Lunge Detected: Correct";
  } else {
    return "Incorrect Lunge or No Lunge";
  }
}

// Function to detect sit-up
function detectSitUp(leftKneeAngle, rightKneeAngle) {
  if (leftKneeAngle < 70 && rightKneeAngle < 70) {
    return "Sit-up Detected: Correct";
  } else {
    return "Incorrect Sit-Up or No Sit-Up";
  }
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
    console.error('Error accessing camera:', errs);
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
  });

  // Handle download button
  downloadBtn.addEventListener('click', () => {
    if (logData.length === 0) {
      alert('No data to download.');
      return;
    }
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Timestamp,Pose ID,Left Knee Angle,Right Knee Angle,Pose Status\n"
      + logData.map(row => `${row.timestamp},${row.poseId},${row.leftKneeAngle},${row.rightKneeAngle},${row.poseStatus}`).join("\n");
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

      // Calculate knee angles
      const leftKneeAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
      const rightKneeAngle = calculateAngle(rightHip, rightKnee, rightAnkle);

      let poseText = "";
      if (poseId === 1) { // Lunge
        poseText = detectLunge(leftKneeAngle, rightKneeAngle);
      } else if (poseId === 2) { // Sit-up
        poseText = detectSitUp(leftKneeAngle, rightKneeAngle);
      }

      // Display feedback
      feedbackDiv.textContent = `Left Knee: ${leftKneeAngle.toFixed(1)}°, Right Knee: ${rightKneeAngle.toFixed(1)}° - ${poseText}`;

      // Log data
      const timestamp = new Date().toISOString();
      logData.push({
        timestamp,
        poseId,
        leftKneeAngle: leftKneeAngle.toFixed(1),
        rightKneeAngle: rightKneeAngle.toFixed(1),
        poseStatus: poseText
      });
    } else {
      feedbackDiv.textContent = "No pose detected";
    }
  }
}

// Start the application
init();