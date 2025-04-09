let logData = [];
let poseId = 1; // Default to Lunge
let sitUpState = 'idle'; // For sit-up state tracking
let mode = 'live'; // 'live' or 'upload'
let processedFrames = []; // Store frames for video download

// Function to calculate angle between three points (from Python)
function calculateAngle(a, b, c) {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs(radians * (180.0 / Math.PI));
  if (angle > 180.0) {
    angle = 360 - angle;
  }
  return angle;
}

// Function to detect lunge (from Python)
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

  if (mode === 'live') {
    // Real-time sit-up detection with state machine
    if (leftKneeAngle < 70 && rightKneeAngle < 70 && torsoAngle > 60) {
      if (sitUpState === 'idle' || sitUpState === 'completed') {
        sitUpState = 'lying';
      }
    } else if (leftKneeAngle < 70 && rightKneeAngle < 70 && torsoAngle < 30) {
      if (sitUpState === 'lying') {
        sitUpState = 'sitting';
      }
    } else if (sitUpState === 'sitting' && torsoAngle > 60) {
      sitUpState = 'completed';
      feedback = "Sit-up Detected: Correct";
      setTimeout(() => { sitUpState = 'idle'; }, 1000);
    }

    if (sitUpState === 'lying') feedback = "Lie down detected, now sit up";
    else if (sitUpState === 'sitting') feedback = "Sitting up detected, now lie back down";
    else if (sitUpState === 'idle') feedback = "Start by lying down with knees bent";
  } else {
    // Uploaded video: static detection per frame (original Python logic)
    if (leftKneeAngle < 70 && rightKneeAngle < 70) {
      feedback = "Sit-up Detected: Correct";
    } else {
      feedback = "Incorrect Sit-up or No Sit-up";
    }
  }

  return feedback;
}

// Switch between live and upload modes
function switchMode(newMode) {
  mode = newMode;
  document.getElementById('live-container').style.display = mode === 'live' ? 'block' : 'none';
  document.getElementById('upload-container').style.display = mode === 'upload' ? 'block' : 'none';
  document.getElementById('download-video-btn').style.display = mode === 'upload' ? 'inline' : 'none';
  if (mode === 'live') startLiveMode();
  logData = []; // Clear log when switching modes
  processedFrames = []; // Clear processed frames
}

async function init() {
  const pose = new Pose({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
  });
  pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  // Start in live mode by default
  switchMode('live');

  // Event listeners
  document.getElementById('pose-select').addEventListener('change', (event) => {
    poseId = parseInt(event.target.value);
    if (poseId === 2 && mode === 'live') sitUpState = 'idle';
  });

  document.getElementById('download-btn').addEventListener('click', downloadLog);
  document.getElementById('download-video-btn').addEventListener('click', downloadVideo);
  document.getElementById('video-upload').addEventListener('change', (event) => processUploadedVideo(event, pose));

  function startLiveMode() {
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const feedbackDiv = document.getElementById('feedback');

    navigator.mediaDevices.getUserMedia({ video: true })
      .then(stream => {
        video.srcObject = stream;
        video.onloadedmetadata = () => {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          pose.onResults((results) => processFrame(results, ctx, feedbackDiv));
          async function processFrameLoop() {
            await pose.send({ image: video });
            requestAnimationFrame(processFrameLoop);
          }
          processFrameLoop();
        };
      })
      .catch(err => {
        console.error('Camera error:', err);
        feedbackDiv.textContent = 'Camera access required.';
      });
  }

  async function processUploadedVideo(event, pose) {
    const file = event.target.files[0];
    if (!file) return;

    const video = document.getElementById('output-video');
    const canvas = document.getElementById('output-canvas');
    const ctx = canvas.getContext('2d');
    const feedbackDiv = document.getElementById('upload-feedback');
    const url = URL.createObjectURL(file);

    video.src = url;
    video.onloadedmetadata = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      processedFrames = [];
      video.currentTime = 0;

      video.onplay = async () => {
        while (video.currentTime < video.duration) {
          await pose.send({ image: video });
          const results = await new Promise(resolve => pose.onResults(results => resolve(results)));
          const frame = processFrame(results, ctx, feedbackDiv, true);
          processedFrames.push(frame);
          video.currentTime += 1 / 30; // Assuming 30 FPS; adjust if needed
          await new Promise(resolve => setTimeout(resolve, 33)); // Simulate 30 FPS
        }
        video.pause();
        feedbackDiv.textContent = "Processing complete. Download the video.";
      };
      video.play();
    };
  }

  function processFrame(results, ctx, feedbackDiv, isUpload = false) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    if (results.poseLandmarks) {
      drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, { color: 'white', lineWidth: 4 });
      drawLandmarks(ctx, results.poseLandmarks, { color: 'white', fillColor: 'rgb(255,138,0)', radius: 5 });

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

      const leftKneeAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
      const rightKneeAngle = calculateAngle(rightHip, rightKnee, rightAnkle);
      const torsoAngle = calculateAngle(midShoulder, midHip, leftKnee);
      const legAngle = calculateAngle(leftKnee, midHip, rightKnee);

      let poseText = "";
      if (poseId === 1) {
        poseText = detectLunge(leftKneeAngle, rightKneeAngle, legAngle);
      } else if (poseId === 2) {
        poseText = detectSitUp(leftKneeAngle, rightKneeAngle, torsoAngle);
      }

      feedbackDiv.textContent = `Left Knee: ${leftKneeAngle.toFixed(1)}°, Right Knee: ${rightKneeAngle.toFixed(1)}°, Torso: ${torsoAngle.toFixed(1)}°, Leg: ${legAngle.toFixed(1)}° - ${poseText}`;

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

      if (isUpload) {
        ctx.font = "16px Arial";
        ctx.fillStyle = "white";
        ctx.fillText(`Left Knee: ${leftKneeAngle.toFixed(1)}°`, 50, 50);
        ctx.fillText(`Right Knee: ${rightKneeAngle.toFixed(1)}°`, 50, 80);
        ctx.fillText(poseText, 50, 110);
        return ctx.canvas.toDataURL('image/jpeg');
      }
    } else {
      feedbackDiv.textContent = "No pose detected";
      if (mode === 'live') sitUpState = 'idle';
      if (isUpload) return ctx.canvas.toDataURL('image/jpeg');
    }
  }

  function downloadLog() {
    if (logData.length === 0) {
      alert('No data to download.');
      return;
    }
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Timestamp,Pose ID,Left Knee Angle,Right Knee Angle,Torso Angle,Leg Angle,Pose Status\n"
      + logData.map(row => `${row.timestamp},${row.poseId},${row.leftKneeAngle},${row.rightKneeAngle},${row.torsoAngle},${row.legAngle},${row.poseStatus}`).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "pose_log.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function downloadVideo() {
    if (processedFrames.length === 0) {
      alert('No processed video to download.');
      return;
    }
    // Simple approach: Download as a series of images (video encoding in browser is complex)
    const zip = new JSZip();
    processedFrames.forEach((frame, index) => {
      zip.file(`frame_${index}.jpg`, frame.split(',')[1], { base64: true });
    });
    zip.generateAsync({ type: "blob" }).then(content => {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(content);
      link.download = "processed_video_frames.zip";
      link.click();
    });
  }
}

// Load JSZip for video frame download
const script = document.createElement('script');
script.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
script.onload = init;
document.head.appendChild(script);