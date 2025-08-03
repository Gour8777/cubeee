// src/camera.js
import React, { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import CubeRecognition from './components/CubeRecognition.js';

const Camera = ({ onCubeCaptured, captureProgress, setCaptureProgress }) => {
  const webcamRef = useRef(null);
  const [capturedFaces, setCapturedFaces] = useState({});
  
  // Safety check to ensure capturedFaces is always an object
  const safeCapturedFaces = typeof capturedFaces === 'object' && capturedFaces !== null ? capturedFaces : {};
  const [currentFaceIndex, setCurrentFaceIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [cameraPermission, setCameraPermission] = useState('prompt');
  const [isCameraReady, setIsCameraReady] = useState(false);

  const videoConstraints = {
    width: { ideal: 640, min: 480 },
    height: { ideal: 480, min: 480 },
    facingMode: 'user', // Changed from 'environment' to 'user' for better compatibility
    focusMode: 'continuous',
    exposureMode: 'continuous',
    whiteBalanceMode: 'continuous'
  };

  const handleUserMedia = useCallback(() => {
    console.log('Camera access granted successfully');
    setCameraError(null);
    setCameraPermission('granted');
    setIsCameraReady(true);
  }, []);

  const handleUserMediaError = useCallback((error) => {
    console.error('Camera access error:', error);
    setCameraPermission('denied');
    setIsCameraReady(false);
    
    if (error.name === 'NotAllowedError') {
      setCameraError('Camera access denied. Please allow camera permissions and refresh the page.');
    } else if (error.name === 'NotFoundError') {
      setCameraError('No camera found. Please connect a camera and refresh the page.');
    } else if (error.name === 'NotReadableError') {
      setCameraError('Camera is in use by another application. Please close other camera apps and refresh.');
    } else {
      setCameraError(`Camera error: ${error.message}. Please refresh the page and try again.`);
    }
  }, []);

  const requestCameraPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop()); // Stop the test stream
      setCameraPermission('granted');
      setCameraError(null);
      console.log('Camera permission granted');
    } catch (error) {
      console.error('Failed to get camera permission:', error);
      setCameraPermission('denied');
      setCameraError('Camera permission denied. Please allow camera access in your browser settings.');
    }
  };

  // Auto-request camera permission on component mount
  useEffect(() => {
    const checkCameraPermission = async () => {
      try {
        if (navigator.permissions) {
          const permission = await navigator.permissions.query({ name: 'camera' });
          setCameraPermission(permission.state);
          
          if (permission.state === 'granted') {
            setIsCameraReady(true);
          }
        }
      } catch (error) {
        console.log('Permission API not supported, will request camera access');
      }
    };

    checkCameraPermission();
  }, []);

  const handleSaveFace = (faceData) => {
    if (isProcessing) return;
    
    console.log('handleSaveFace called with:', faceData);
    console.log('faceData type:', typeof faceData);
    
    // Handle both old format (array) and new format (object)
    let colors, faceIndex, alignmentScore, confidence;
    
    if (Array.isArray(faceData)) {
      // Old format - just colors array
      colors = faceData;
      faceIndex = currentFaceIndex;
      alignmentScore = 0;
      confidence = 0;
    } else if (faceData && typeof faceData === 'object' && faceData.colors) {
      // New format - faceData object
      colors = faceData.colors;
      faceIndex = faceData.faceIndex !== undefined ? faceData.faceIndex : currentFaceIndex;
      alignmentScore = faceData.alignmentScore || 0;
      confidence = faceData.confidence || 0;
    } else {
      console.error('Invalid face data format:', faceData);
      return;
    }
    
    // Ensure colors is a valid array
    if (!Array.isArray(colors) || colors.length === 0) {
      console.error('Invalid face colors data:', colors);
      return;
    }

    setIsProcessing(true);
    
    // Map face colors to the current face (matching FACE_CAPTURE_SEQUENCE order)
    const faceNames = ['front', 'left', 'back', 'right', 'up', 'down'];
    const currentFaceName = faceNames[currentFaceIndex];
    
    console.log('=== FACE SAVE DEBUG ===');
    console.log('Current face index:', currentFaceIndex);
    console.log('Current face name:', currentFaceName);
    console.log('Face names array:', faceNames);
    console.log('Saving face:', currentFaceName, 'with data:', colors);
    console.log('Alignment score:', alignmentScore, 'Confidence:', confidence);
    console.log('========================');
    
    setCapturedFaces(prev => {
      const safePrev = typeof prev === 'object' && prev !== null ? prev : {};
      const newFaces = {
        ...safePrev,
        [currentFaceName]: {
          colors: colors,
          faceIndex: faceIndex,
          alignmentScore: alignmentScore,
          confidence: confidence,
          timestamp: faceData.timestamp || Date.now(),
          faceMapping: faceData.faceMapping || {}
        }
      };
      console.log('Updated capturedFaces:', newFaces);
      
      // Special debug for right face
      if (currentFaceName === 'right') {
        console.log('🔍 RIGHT FACE DEBUG:');
        console.log('Previous faces:', safePrev);
        console.log('New right face data:', newFaces.right);
        console.log('Colors array length:', colors.length);
        console.log('Colors array:', colors);
      }
      
      return newFaces;
    });

    // Update progress
    const newProgress = currentFaceIndex + 1;
    setCaptureProgress(newProgress);

    // Check if all faces are captured
    if (newProgress === 6) {
      // All faces captured, create final cube data
      console.log('All faces captured! Creating final cube data...');
      
      // Get the updated captured faces after the current save
      setCapturedFaces(prev => {
        const updatedFaces = {
          ...prev,
          [currentFaceName]: {
            colors: colors,
            faceIndex: faceIndex,
            alignmentScore: alignmentScore,
            confidence: confidence,
            timestamp: faceData.timestamp || Date.now(),
            faceMapping: faceData.faceMapping || {}
          }
        };
        
        console.log('Final captured faces:', updatedFaces);
        
        // Create final cube data using all captured faces
        const cubeData = {
          front: updatedFaces.front || { colors: [] },
          back: updatedFaces.back || { colors: [] },
          up: updatedFaces.up || { colors: [] },
          down: updatedFaces.down || { colors: [] },
          left: updatedFaces.left || { colors: [] },
          right: updatedFaces.right || { colors: [] },
          timestamp: new Date().toISOString()
        };

        console.log('Final cube data:', cubeData);

        setTimeout(() => {
          onCubeCaptured(cubeData);
          setIsProcessing(false);
        }, 1000);
        
        return updatedFaces;
      });
      
      return; // Exit early since we're handling the callback inside setCapturedFaces
    } else {
      // Move to next face
      setTimeout(() => {
        setCurrentFaceIndex(newProgress);
        setIsProcessing(false);
      }, 1000);
    }
  };

  const retryCurrentFace = () => {
    // Reset current face capture
    const faceNames = ['front', 'left', 'back', 'right', 'up', 'down'];
    const currentFaceName = faceNames[currentFaceIndex];
    
    console.log('Retrying face:', currentFaceName);
    
    setCapturedFaces(prev => {
      const safePrev = typeof prev === 'object' && prev !== null ? prev : {};
      const newFaces = { ...safePrev };
      delete newFaces[currentFaceName];
      console.log('Updated capturedFaces after retry:', newFaces);
      return newFaces;
    });
    
    // Reset progress for current face
    setCaptureProgress(Math.max(0, currentFaceIndex));
  };

  const resetCapture = () => {
    setCapturedFaces({});
    setCurrentFaceIndex(0);
    setCaptureProgress(0);
    setIsProcessing(false);
  };

  const FACE_ORDER = [
    {
      name: 'Front (F)',
      instruction: 'Show the FRONT face facing the camera',
      description: 'This is the face that points directly toward you',
      rotation: 'No rotation needed - face the camera directly',
      tips: ['Hold the cube with the front face parallel to the camera', 'Ensure all 9 squares are clearly visible in the grid']
    },
    {
      name: 'Left (L)',
      instruction: 'Rotate the cube 90° ANTI-CLOCKWISE to show the LEFT face',
      description: 'Turn the cube 90° counter-clockwise (to your left) around the vertical axis',
      rotation: 'Anti-clockwise 90° around Y-axis (vertical rotation to the left)',
      tips: ['Keep the cube centered in the camera view', 'Rotate the entire cube, not just your hand', 'The left face should now be facing the camera']
    },
    {
      name: 'Back (B)',
      instruction: 'Rotate the cube 90° ANTI-CLOCKWISE again to show the BACK face',
      description: 'Turn the cube another 90° counter-clockwise from the left position',
      rotation: 'Anti-clockwise 90° around Y-axis (from left position)',
      tips: ['This is the face opposite to your original front face', 'Keep the cube steady and well-lit', 'All 9 squares should be clearly visible']
    },
    {
      name: 'Right (R)',
      instruction: 'Rotate the cube 90° ANTI-CLOCKWISE once more to show the RIGHT face',
      description: 'Turn the cube another 90° counter-clockwise from the back position',
      rotation: 'Anti-clockwise 90° around Y-axis (from back position)',
      tips: ['This completes the side face sequence', 'The right face should now be facing the camera', 'Maintain consistent lighting and positioning']
    },
    {
      name: 'Up (U)',
      instruction: 'Tilt the cube UPWARD to show the TOP face',
      description: 'Tilt the cube forward so the top face faces the camera',
      rotation: 'Forward tilt around X-axis (horizontal rotation upward)',
      tips: ['Hold the cube at a 45° angle pointing upward', 'The top face should be parallel to the camera', 'Keep the cube centered and well-lit from above']
    },
    {
      name: 'Down (D)',
      instruction: 'Tilt the cube DOWNWARD to show the BOTTOM face',
      description: 'Tilt the cube backward so the bottom face faces the camera',
      rotation: 'Backward tilt around X-axis (horizontal rotation downward)',
      tips: ['Hold the cube at a 45° angle pointing downward', 'The bottom face should be parallel to the camera', 'Ensure good lighting reaches the bottom face']
    }
  ];

  return (
    <div className="camera-capture">
      <div className="capture-header">
        <h2 className="capture-title">Cube Face Capture</h2>
        <div className="capture-status">
          <span className="status-dot"></span>
          <span>Ready to capture: {FACE_ORDER[currentFaceIndex]?.name || 'Loading...'}</span>
        </div>
      </div>

      <div className="capture-content">
        <div className="webcam-feed">
          <h3>📷 Current Face: {FACE_ORDER[currentFaceIndex]?.name || 'Loading...'}</h3>
          <div className="webcam-container">
            {!isCameraReady ? (
              <div className="camera-placeholder">
                <div className="camera-placeholder-content">
                  <div className="camera-icon">📷</div>
                  <h3>Camera Not Ready</h3>
                  <p>Please allow camera access to continue</p>
                  {cameraPermission === 'denied' && (
                    <button 
                      onClick={requestCameraPermission}
                      className="camera-permission-button"
                    >
                      🔓 Request Camera Access
                    </button>
                  )}
                  {cameraPermission === 'prompt' && (
                    <p className="camera-hint">Camera permission will be requested automatically...</p>
                  )}
                </div>
              </div>
            ) : (
              <Webcam
                ref={webcamRef}
                audio={false}
                videoConstraints={videoConstraints}
                onUserMedia={handleUserMedia}
                onUserMediaError={handleUserMediaError}
                className="webcam-video"
                mirrored={true}
                screenshotFormat="image/jpeg"
                screenshotQuality={1}
                forceScreenshotSourceSize={true}
              />
            )}
          </div>
          <div className="capture-instructions">
            <div className="step-indicator">
              <span className="step-number">Step {currentFaceIndex + 1}/6</span>
              <span className="current-face">{FACE_ORDER[currentFaceIndex]?.name || 'Loading...'}</span>
            </div>
            <p className="instruction-text">{FACE_ORDER[currentFaceIndex]?.instruction || 'Please wait...'}</p>
            <p className="rotation-guide"><em>{FACE_ORDER[currentFaceIndex]?.rotation || 'Please wait...'}</em></p>
            {FACE_ORDER[currentFaceIndex]?.tips && (
              <div className="tips-container">
                <h4>💡 Tips:</h4>
                <ul>
                  {FACE_ORDER[currentFaceIndex].tips.map((tip, index) => (
                    <li key={index}>{tip}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="recognition-section">
          <CubeRecognition
            videoRef={webcamRef}
            onSaveFace={handleSaveFace}
            faceIndex={currentFaceIndex}
            isProcessing={isProcessing}
          />
        </div>
      </div>

      {cameraError && (
        <div className="error-message">
          <p>⚠️ {cameraError}</p>
        </div>
      )}

      <div className="progress-section">
        <div className="progress-header">
          <h4>🎯 Capture Progress</h4>
          <span className="progress-status">{captureProgress} of 6 faces captured</span>
        </div>
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${(captureProgress / 6) * 100}%` }}
          ></div>
        </div>
        <div className="progress-details">
          <p>Current: {FACE_ORDER[currentFaceIndex]?.name || 'Loading...'}</p>
          <p>Next: {currentFaceIndex < 5 ? FACE_ORDER[currentFaceIndex + 1]?.name : 'Complete!'}</p>
        </div>
      </div>

      <div className="captured-faces-preview">
        {FACE_ORDER.map((face, index) => {
          const faceNames = ['front', 'left', 'back', 'right', 'up', 'down'];
          const faceKey = faceNames[index];
          
          // Use safe capturedFaces
          const faceData = safeCapturedFaces[faceKey];
          const isCaptured = faceData && Array.isArray(faceData) && faceData.length > 0;
          
          return (
            <div 
              key={index} 
              className={`face-preview ${isCaptured ? 'captured' : ''}`}
            >
              <div className="face-label">{face.name}</div>
              <div className={`face-placeholder ${isCaptured ? 'captured' : ''}`}>
                {isCaptured ? '✓' : index + 1}
              </div>
            </div>
          );
        })}
      </div>

      <div className="action-buttons">
        <button onClick={retryCurrentFace} className="retry-button">
          🔄 Retry Current Face
        </button>
        <button onClick={resetCapture} className="reset-button">
          🗑️ Reset All
        </button>
      </div>
    </div>
  );
};

export default Camera; 