let logData = [];
let poseId = 1; // Default to Lunge
<<<<<<< HEAD
let sitUpState = 'idle';
let mode = 'live';
let poseInstance = null;
let liveStream = null;

function calculateAngle(a, b, c) {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs(radians * (180.0 / Math.PI));
  if (angle > 180.0) angle = 360 - angle;
  return angle;
}

function detectLunge(leftKneeAngle, rightKneeAngle, legAngle) {
  if (leftKneeAngle > 80 && leftKneeAngle < 110 && rightKneeAngle > 80 && rightKneeAngle < 110) {
    return legAngle > 80 && legAngle < 110 ? "Lunge Detected: Correct" : "Lunge Detected but Legs Not Open Properly";
  }
  return "Incorrect Lunge or No Lunge";
}

function detectSitUp(leftKneeAngle, rightKneeAngle, torsoAngle) {
  let feedback = "Keep going...";
  if (mode === 'live') {
    if (leftKneeAngle < 70 && rightKneeAngle < 70 && torsoAngle > 60) {
      if (sitUpState === 'idle' || sitUpState === 'completed') sitUpState = 'lying';
    } else if (leftKneeAngle < 70 && rightKneeAngle < 70 && torsoAngle < 30) {
      if (sitUpState === 'lying') sitUpState = 'sitting';
    } else if (sitUpState === 'sitting' && torsoAngle > 60) {
      sitUpState = 'completed';
      feedback = "Sit-up Detected: Correct";
      setTimeout(() => sitUpState = 'idle', 1000);
    }
    if (sitUpState === 'lying') feedback = "Lie down detected, now sit up";
    else if (sitUpState === 'sitting') feedback = "Sitting up detected, now lie back down";
    else if (sitUpState === 'idle') feedback = "Start by lying down with knees bent";
  } else {
    feedback = (leftKneeAngle < 70 && rightKneeAngle < 70) ? "Sit-up Detected: Correct" : "Incorrect Sit-up or No Sit-up";
  }
  return feedback;
}

function processFrame(results, ctx, feedbackDiv) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  if (results.poseLandmarks) {
    drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, { color: 'white', lineWidth: 4 });
    drawLandmarks(ctx, results.poseLandmarks, { color: 'white', fillColor: 'rgb(255,138,0)', radius: 5 });

    const landmarks = results.poseLandmarks;
    const leftHip = landmarks[23], leftKnee = landmarks[25], leftAnkle = landmarks[27];
    const rightHip = landmarks[24], rightKnee = landmarks[26], rightAnkle = landmarks[28];
    const leftShoulder = landmarks[11], rightShoulder = landmarks[12];
    const midHip = { x: (leftHip.x + rightHip.x) / 2, y: (leftHip.y + rightHip.y) / 2 };
    const midShoulder = { x: (leftShoulder.x + rightShoulder.x) / 2, y: (leftShoulder.y + rightShoulder.y) / 2 };

    const leftKneeAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
    const rightKneeAngle = calculateAngle(rightHip, rightKnee, rightAnkle);
    const torsoAngle = calculateAngle(midShoulder, midHip, leftKnee);
    const legAngle = calculateAngle(leftKnee, midHip, rightKnee);

    let poseText = poseId === 1 ? detectLunge(leftKneeAngle, rightKneeAngle, legAngle) : detectSitUp(leftKneeAngle, rightKneeAngle, torsoAngle);
    feedbackDiv.textContent = `Left Knee: ${leftKneeAngle.toFixed(1)}°, Right Knee: ${rightKneeAngle.toFixed(1)}°, Torso: ${torsoAngle.toFixed(1)}°, Leg: ${legAngle.toFixed(1)}° - ${poseText}`;

    logData.push({
      timestamp: new Date().toISOString(),
      poseId,
      leftKneeAngle: leftKneeAngle.toFixed(1),
      rightKneeAngle: rightKneeAngle.toFixed(1),
      torsoAngle: torsoAngle.toFixed(1),
      legAngle: legAngle.toFixed(1),
      poseStatus: poseText
    });
  } else {
    feedbackDiv.textContent = "No pose detected";
    if (mode === 'live') sitUpState = 'idle';
  }
}

function startLiveMode(pose) {
=======
let sitUpState = 'idle'; // States: 'idle', 'lying', 'sitting', 'completed'
let sitUpHistory = []; // Store recent frames for sit-up detection

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

// Function to detect sit-up (now tracks full cycle)
function detectSitUp(leftKneeAngle, rightKneeAngle, torsoAngle) {
  let feedback = "Keep going...";

  // Update sit-up state based on angles
  if (leftKneeAngle < 70 && rightKneeAngle < 70 && torsoAngle > 60) {
    // Lying down position (torso flat)
    if (sitUpState === 'idle' || sitUpState === 'completed') {
      sitUpState = 'lying';
    }
  } else if (leftKneeAngle < 70 && rightKneeAngle < 70 && torsoAngle < 30) {
    // Sitting up position (torso upright)
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
>>>>>>> fa1d6057b0fc41526a816b837d5fc361fe675da0
  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const feedbackDiv = document.getElementById('feedback');
<<<<<<< HEAD

  navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
      liveStream = stream;
      video.srcObject = stream;
      video.onloadedmetadata = () => {
        video.play();
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        pose.onResults(results => processFrame(results, ctx, feedbackDiv));
        async function processLoop() {
          if (mode !== 'live') return;
          await pose.send({ image: video });
          requestAnimationFrame(processLoop);
        }
        processLoop();
      };
    })
    .catch(err => {
      console.error('Camera error:', err);
      feedbackDiv.textContent = 'Camera access required.';
    });
}

function processUploadedVideo(event, pose) {
  const file = event.target.files[0];
  if (!file) return;
  const video = document.getElementById('output-video');
  const canvas = document.getElementById('output-canvas');
  const ctx = canvas.getContext('2d');
  const feedbackDiv = document.getElementById('upload-feedback');

  video.src = URL.createObjectURL(file);
  video.onloadedmetadata = () => {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    pose.onResults(results => processFrame(results, ctx, feedbackDiv));
    video.onplay = () => {
      async function processLoop() {
        if (video.paused || video.ended || mode !== 'upload') return;
        await pose.send({ image: video });
        requestAnimationFrame(processLoop);
      }
      processLoop();
    };
  };
}

function switchMode(newMode) {
  if (mode === newMode) return;
  mode = newMode;
  logData = [];
  document.getElementById('live-container').style.display = mode === 'live' ? 'block' : 'none';
  document.getElementById('upload-container').style.display = mode === 'upload' ? 'block' : 'none';
  if (mode === 'live' && liveStream) {
    liveStream.getTracks().forEach(track => track.stop());
    liveStream = null;
  }
  if (mode === 'live' && poseInstance) startLiveMode(poseInstance);
}

function downloadLog() {
  if (!logData.length) return alert('No data to download.');
  const csv = "Timestamp,Pose ID,Left Knee Angle,Right Knee Angle,Torso Angle,Leg Angle,Pose Status\n" +
    logData.map(row => `${row.timestamp},${row.poseId},${row.leftKneeAngle},${row.rightKneeAngle},${row.torsoAngle},${row.legAngle},${row.poseStatus}`).join("\n");
  const link = document.createElement("a");
  link.href = "data:text/csv;charset=utf-8," + encodeURI(csv);
  link.download = "pose_log.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

async function init() {
  poseInstance = new Pose({
    locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
  });
  poseInstance.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });
  await poseInstance.initialize();

  switchMode('live');
  document.getElementById('pose-select').addEventListener('change', e => {
    poseId = parseInt(e.target.value);
    if (poseId === 2 && mode === 'live') sitUpState = 'idle';
  });
  document.getElementById('download-btn').addEventListener('click', downloadLog);
  document.getElementById('video-upload').addEventListener('change', e => processUploadedVideo(e, poseInstance));
}

init().catch(console.error);
=======
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
      + "Timestamp,Pose ID,Left Knee Angle,Right Knee Angle,Torso Angle,Pose Status\n"
      + logData.map(row => `${row.timestamp},${row.poseId},${row.leftKneeAngle},${row.rightKneeAngle},${row.torsoAngle},${row.poseStatus}`).join("\n");
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
      const torsoAngle = calculateAngle(midShoulder, midHip, leftKnee); // Angle between shoulders and hips

      let poseText = "";
      if (poseId === 1) { // Lunge
        poseText = detectLunge(leftKneeAngle, rightKneeAngle);
      } else if (poseId === 2) { // Sit-up
        poseText = detectSitUp(leftKneeAngle, rightKneeAngle, torsoAngle);
      }

      // Display feedback
      feedbackDiv.textContent = `Left Knee: ${leftKneeAngle.toFixed(1)}°, Right Knee: ${rightKneeAngle.toFixed(1)}°, Torso: ${torsoAngle.toFixed(1)}° - ${poseText}`;

      // Log data
      const timestamp = new Date().toISOString();
      logData.push({
        timestamp,
        poseId,
        leftKneeAngle: leftKneeAngle.toFixed(1),
        rightKneeAngle: rightKneeAngle.toFixed(1),
        torsoAngle: torsoAngle.toFixed(1),
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
>>>>>>> fa1d6057b0fc41526a816b837d5fc361fe675da0
