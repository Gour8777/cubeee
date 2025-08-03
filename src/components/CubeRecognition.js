// src/components/CubeRecognition.js
import React, { useRef, useEffect, useState } from 'react';

// Global OpenCV loading state to prevent multiple loads
let opencvLoadingPromise = null;
let opencvLoaded = false;
let opencvInitialized = false;
let opencvFailed = false; // Track if OpenCV failed to load

// Global function to check if OpenCV is ready
const isOpenCVReady = () => {
  return !opencvFailed && opencvLoaded && opencvInitialized && window.cv;
};

const CubeRecognition = ({ videoRef, onSaveFace, faceIndex, isProcessing }) => {
  const canvasRef = useRef(null);
  const [faceColors, setFaceColors] = useState([[]]);
  const [detectionQuality, setDetectionQuality] = useState(0);
  const [processingFrame, setProcessingFrame] = useState(false);
  const [cubeDetected, setCubeDetected] = useState(false);
  const [cubeBounds, setCubeBounds] = useState(null);
  const [processingError, setProcessingError] = useState(null);
  const [mirrorMode, setMirrorMode] = useState(true);
  const [opencvReady, setOpencvReady] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [alignmentScore, setAlignmentScore] = useState(0);
  const [debugMode, setDebugMode] = useState(false);
  const [colorCalibration, setColorCalibration] = useState(false);
  const [calibrationData, setCalibrationData] = useState(null);
  const [opencvError, setOpencvError] = useState(null);
  const [performanceStats, setPerformanceStats] = useState({
    fps: 0,
    processingTime: 0,
    frameCount: 0
  });
  const [totalConfidence, setTotalConfidence] = useState(0);

  // Face capture sequence with detailed instructions
  const FACE_CAPTURE_SEQUENCE = [
    {
      name: 'Front (F)',
      instruction: 'Show the FRONT face facing the camera',
      description: 'This is the face that points directly toward you',
      tips: ['Hold the cube with the front face parallel to the camera', 'Ensure all 9 squares are clearly visible'],
      rotation: 'No rotation needed - this is your starting position'
    },
    {
      name: 'Left (L)',
      instruction: 'Rotate the cube 90° ANTI-CLOCKWISE to show the LEFT face',
      description: 'Turn the cube 90° counter-clockwise (to your left) around the vertical axis',
      tips: [
        'Keep the cube centered in the camera view',
        'Rotate the entire cube, not just your hand',
        'The left face should now be facing the camera'
      ],
      rotation: 'Anti-clockwise 90° around Y-axis (vertical rotation to the left)'
    },
    {
      name: 'Back (B)',
      instruction: 'Rotate the cube 90° ANTI-CLOCKWISE again to show the BACK face',
      description: 'Turn the cube another 90° counter-clockwise from the left position',
      tips: [
        'This is the face opposite to your original front face',
        'Keep the cube steady and well-lit',
        'All 9 squares should be clearly visible'
      ],
      rotation: 'Anti-clockwise 90° around Y-axis (from left position)'
    },
    {
      name: 'Right (R)',
      instruction: 'Rotate the cube 90° ANTI-CLOCKWISE once more to show the RIGHT face',
      description: 'Turn the cube another 90° counter-clockwise from the back position',
      tips: [
        'This completes the side face sequence',
        'The right face should now be facing the camera',
        'Maintain consistent lighting and positioning'
      ],
      rotation: 'Anti-clockwise 90° around Y-axis (from back position)'
    },
    {
      name: 'Up (U)',
      instruction: 'Tilt the cube UPWARD to show the TOP face',
      description: 'Tilt the cube forward so the top face faces the camera',
      tips: [
        'Hold the cube at a 45° angle pointing upward',
        'The top face should be parallel to the camera',
        'Keep the cube centered and well-lit from above'
      ],
      rotation: 'Forward tilt around X-axis (horizontal rotation upward)'
    },
    {
      name: 'Down (D)',
      instruction: 'Tilt the cube DOWNWARD to show the BOTTOM face',
      description: 'Tilt the cube backward so the bottom face faces the camera',
      tips: [
        'Hold the cube at a 45° angle pointing downward',
        'The bottom face should be parallel to the camera',
        'Ensure good lighting reaches the bottom face'
      ],
      rotation: 'Backward tilt around X-axis (horizontal rotation downward)'
    }
  ];
  

  // Ultra-precise color detection with refined HSV thresholds
  const rgbToHsv = (r, g, b) => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s, v = max;
    const d = max - min;
    s = max === 0 ? 0 : d / max;
    
    if (d !== 0) {
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else if (max === b) h = (r - g) / d + 4;
      h *= 60;
    }
    return [h, s * 255, v * 255];
  };

  // Convert RGB to LAB color space for better perceptual matching
  const rgbToLab = (r, g, b) => {
    // First convert RGB to XYZ
    let r_norm = r / 255;
    let g_norm = g / 255;
    let b_norm = b / 255;
    
    // Apply gamma correction
    r_norm = r_norm > 0.04045 ? Math.pow((r_norm + 0.055) / 1.055, 2.4) : r_norm / 12.92;
    g_norm = g_norm > 0.04045 ? Math.pow((g_norm + 0.055) / 1.055, 2.4) : g_norm / 12.92;
    b_norm = b_norm > 0.04045 ? Math.pow((b_norm + 0.055) / 1.055, 2.4) : b_norm / 12.92;
    
    // Convert to XYZ
    const x = r_norm * 0.4124 + g_norm * 0.3576 + b_norm * 0.1805;
    const y = r_norm * 0.2126 + g_norm * 0.7152 + b_norm * 0.0722;
    const z = r_norm * 0.0193 + g_norm * 0.1192 + b_norm * 0.9505;
    
    // Convert XYZ to LAB
    const x_norm = x / 0.95047;
    const y_norm = y / 1.00000;
    const z_norm = z / 1.08883;
    
    const fx = x_norm > 0.008856 ? Math.pow(x_norm, 1/3) : (7.787 * x_norm) + (16 / 116);
    const fy = y_norm > 0.008856 ? Math.pow(y_norm, 1/3) : (7.787 * y_norm) + (16 / 116);
    const fz = z_norm > 0.008856 ? Math.pow(z_norm, 1/3) : (7.787 * z_norm) + (16 / 116);
    
    const l = (116 * fy) - 16;
    const a = 500 * (fx - fy);
    const b_lab = 200 * (fy - fz);
    
    return [l, a, b_lab];
  };

  // Create basic grid for fallback detection
  const createBasicGrid = (width, height) => {
    const gridSize = Math.min(width, height) * 0.4;
    const centerX = width / 2;
    const centerY = height / 2;
    const gridX = centerX - gridSize / 2;
    const gridY = centerY - gridSize / 2;
    
    return {
      x: gridX,
      y: gridY,
      width: gridSize,
      height: gridSize,
      area: gridSize * gridSize,
      method: 'basic-grid'
    };
  };

  // Advanced grid-based detection with OpenCV.js
  const detectCubeWithOpenCV = (ctx, width, height) => {
    if (!isOpenCVReady()) {
      return createBasicGrid(width, height);
    }

    try {
      // Convert canvas to OpenCV Mat
      const imageData = ctx.getImageData(0, 0, width, height);
      const src = window.cv.matFromImageData(imageData);
      
      // Convert to HSV color space
      const hsv = new window.cv.Mat();
      window.cv.cvtColor(src, hsv, window.cv.COLOR_RGBA2RGB);
      window.cv.cvtColor(hsv, hsv, window.cv.COLOR_RGB2HSV);
      
      // Create masks for cube colors
      const masks = [];
      const colorRanges = [
        { name: 'white', lower: [0, 0, 140], upper: [180, 30, 255] },
        { name: 'red', lower: [0, 50, 50], upper: [10, 255, 255] },
        { name: 'orange', lower: [10, 50, 50], upper: [25, 255, 255] },
        { name: 'yellow', lower: [25, 50, 50], upper: [35, 255, 255] },
        { name: 'green', lower: [35, 50, 50], upper: [85, 255, 255] },
        { name: 'blue', lower: [85, 50, 50], upper: [130, 255, 255] }
      ];
      
      colorRanges.forEach(range => {
        const mask = new window.cv.Mat();
        const lower = new window.cv.Mat(hsv.rows, hsv.cols, hsv.type(), range.lower[0], range.lower[1], range.lower[2], 0);
        const upper = new window.cv.Mat(hsv.rows, hsv.cols, hsv.type(), range.upper[0], range.upper[1], range.upper[2], 0);
        window.cv.inRange(hsv, lower, upper, mask);
        masks.push(mask);
        lower.delete();
        upper.delete();
      });
      
      // Combine all masks
      const combinedMask = new window.cv.Mat();
      window.cv.bitwise_or(masks[0], masks[1], combinedMask);
      for (let i = 2; i < masks.length; i++) {
        const temp = new window.cv.Mat();
        window.cv.bitwise_or(combinedMask, masks[i], temp);
        combinedMask.delete();
        combinedMask = temp;
      }
      
      // Find contours
      const contours = new window.cv.MatVector();
      const hierarchy = new window.cv.Mat();
      window.cv.findContours(combinedMask, contours, hierarchy, window.cv.RETR_EXTERNAL, window.cv.CHAIN_APPROX_SIMPLE);
      
      // Find the largest contour (likely the cube)
      let maxArea = 0;
      let bestContour = null;
      
      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i);
        const area = window.cv.contourArea(contour);
        if (area > maxArea && area > 1000) {
          maxArea = area;
          bestContour = contour;
        }
      }
      
      // Clean up OpenCV objects
      src.delete();
      hsv.delete();
      masks.forEach(mask => mask.delete());
      combinedMask.delete();
      contours.delete();
      hierarchy.delete();
      
      if (bestContour) {
        const boundingRect = window.cv.boundingRect(bestContour);
        return {
          x: boundingRect.x,
          y: boundingRect.y,
          width: boundingRect.width,
          height: boundingRect.height,
          area: boundingRect.width * boundingRect.height,
          method: 'opencv-contour'
        };
      }
      
    } catch (error) {
      console.error('OpenCV detection error:', error);
    }
    
    return createBasicGrid(width, height);
  };

  // Optimized frame processing - NO BUFFERING with performance improvements
  const processFrame = () => {
    // Prevent multiple simultaneous processing
    if (processingFrame || isProcessing) {
      return;
    }

    const startTime = performance.now();
    setProcessingFrame(true);
    
    try {
      const videoEl = videoRef.current?.video;
      
      if (!videoEl || videoEl.readyState !== 4) {
        setProcessingFrame(false);
        return;
      }

      const width = videoEl.videoWidth;
      const height = videoEl.videoHeight;
      
      if (width === 0 || height === 0) {
        setProcessingFrame(false);
        return;
      }

      const canvas = canvasRef.current;
      if (!canvas) {
        setProcessingFrame(false);
        return;
      }

      const ctx = canvas.getContext('2d');
      
      // Set canvas size only if changed (performance optimization)
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      // Clear canvas efficiently
      ctx.clearRect(0, 0, width, height);

      // Draw video frame
      ctx.drawImage(videoEl, 0, 0, width, height);

      // Apply mirror effect if needed
      if (mirrorMode) {
        ctx.save();
        ctx.scale(-1, 1);
        ctx.translate(-width, 0);
        ctx.drawImage(videoEl, 0, 0, width, height);
        ctx.restore();
      }

      // Create simple grid (cached calculation for performance)
      const gridSize = Math.min(width, height) * 0.4;
      const centerX = width / 2;
      const centerY = height / 2;
      const gridX = centerX - gridSize / 2;
      const gridY = centerY - gridSize / 2;
      
      const gridBounds = {
        x: gridX,
        y: gridY,
        width: gridSize,
        height: gridSize,
        area: gridSize * gridSize,
        method: 'optimized-grid'
      };
      
      setCubeBounds(gridBounds);
      setCubeDetected(true);
      
      // Analyze colors with reduced sampling for better performance
      const colorAnalysis = analyzeColorsOptimized(ctx, gridBounds);
      const { colors, validDetections, alignmentScore } = colorAnalysis;
      
      setDetectionQuality(alignmentScore);
      setAlignmentScore(alignmentScore);
      
      if (Array.isArray(colors)) {
        setFaceColors(colors);
      } else {
        setFaceColors([[]]);
      }
      
      // Draw grid and colors efficiently
      drawSimpleGrid(ctx, gridBounds, alignmentScore);
      drawSimpleColors(ctx, gridBounds, colors);
      
      // Only draw debug info if enabled (performance optimization)
      if (debugMode) {
        debugColorInfo(ctx, gridBounds);
      }
      
      // Update performance stats
      const processingTime = performance.now() - startTime;
      setPerformanceStats(prev => ({
        fps: Math.round(1000 / processingTime),
        processingTime: Math.round(processingTime),
        frameCount: prev.frameCount + 1
      }));
      
    } catch (error) {
      console.error('Frame processing error:', error);
      setProcessingError(error.message);
    } finally {
      setProcessingFrame(false);
    }
  };

  // Color consistency check for better accuracy
  const validateColorConsistency = (colors) => {
    if (!Array.isArray(colors) || colors.length === 0) return colors;
    
    const colorCounts = {};
    const validColors = ['red', 'orange', 'yellow', 'green', 'blue', 'white'];
    
    // Count each color
    colors.flat().forEach(color => {
      if (validColors.includes(color)) {
        colorCounts[color] = (colorCounts[color] || 0) + 1;
      }
    });
    
    // Check for impossible color distributions
    const totalValidColors = Object.values(colorCounts).reduce((sum, count) => sum + count, 0);
    
    // If we have too many of one color (more than 6), it might be wrong
    for (const [color, count] of Object.entries(colorCounts)) {
      if (count > 6) {
        // This color appears too many times, might be misdetected
        console.log(`Warning: ${color} appears ${count} times, might be misdetected`);
      }
    }
    
    // If we have too few colors (less than 3 different colors), might be wrong
    const uniqueColors = Object.keys(colorCounts).length;
    if (uniqueColors < 3 && totalValidColors > 5) {
      console.log(`Warning: Only ${uniqueColors} unique colors detected, might be wrong`);
    }
    
    return colors;
  };

  // Ultra-accurate color analysis with consistency validation
  const analyzeColorsUltraAccurate = (ctx, gridBounds) => {
    if (!gridBounds) return { colors: [], validDetections: 0, alignmentScore: 0 };
    
    const { x, y, width: gridWidth, height: gridHeight } = gridBounds;
    const faceletSize = gridWidth / 3;
    
    const colors = [];
    let validDetections = 0;
    let totalConfidence = 0;
    
    for (let row = 0; row < 3; row++) {
      const rowColors = [];
      for (let col = 0; col < 3; col++) {
        const actualCol = mirrorMode ? (2 - col) : col;
        const centerX = x + (actualCol * faceletSize) + (faceletSize / 2);
        const centerY = y + (row * faceletSize) + (faceletSize / 2);
        
        // Multi-point sampling for better accuracy
        const colorSample = sampleColorEdgeAware(ctx, centerX, centerY, faceletSize);
        
        if (colorSample) {
          const { r, g, b } = colorSample;
          const cubeColor = detectColorWithCorrection(r, g, b);
          const confidence = getColorConfidenceUltraAccurate(cubeColor, r, g, b);
          
          if (cubeColor !== 'unknown' && confidence > 0.5) {
            validDetections++;
            totalConfidence += confidence;
          }
          rowColors.push(cubeColor);
        } else {
          rowColors.push('unknown');
        }
      }
      colors.push(rowColors);
    }
    
    // Validate and correct color consistency
    let validatedColors = validateAndCorrectColors(colors);
    
    // Additional validation for color confusion (white/yellow, orange/red)
    validatedColors = validateColorConfusion(validatedColors);
    
    // Additional validation for blue/yellow confusion
    validatedColors = validateBlueYellowConfusion(validatedColors);
    
    const alignmentScore = calculateAlignmentScore(validDetections, totalConfidence, validatedColors);
    
    // Update total confidence for the component
    setTotalConfidence(totalConfidence);
    
    return { colors: validatedColors, validDetections, alignmentScore };
  };

  // Enhanced multi-point color sampling with clustering for better accuracy
  const sampleColorMultiPoint = (ctx, centerX, centerY, faceletSize) => {
    const sampleRadius = Math.max(3, faceletSize / 6);
    const samples = [];
    const colorVotes = { red: 0, orange: 0, yellow: 0, green: 0, blue: 0, white: 0, unknown: 0 };
    
    // Sample more points in a larger area for better accuracy
    for (let dx = -sampleRadius; dx <= sampleRadius; dx += 1) {
      for (let dy = -sampleRadius; dy <= sampleRadius; dy += 1) {
        const x = Math.floor(centerX + dx);
        const y = Math.floor(centerY + dy);
        
        if (x >= 0 && x < ctx.canvas.width && y >= 0 && y < ctx.canvas.height) {
          try {
            const imageData = ctx.getImageData(x, y, 1, 1).data;
            const sample = {
              r: imageData[0],
              g: imageData[1],
              b: imageData[2]
            };
            samples.push(sample);
            
            // Vote for color detection
            const detectedColor = detectColorWithCorrection(sample.r, sample.g, sample.b);
            colorVotes[detectedColor]++;
          } catch (error) {
            // Skip invalid samples
          }
        }
      }
    }
    
    if (samples.length === 0) return null;
    
    // Try clustering first for better accuracy
    const clusteredColor = detectColorByClustering(samples);
    if (clusteredColor !== 'unknown') {
      // Use the center of the largest cluster
      const largestCluster = findLargestCluster(samples);
      if (largestCluster) {
        return largestCluster.center;
      }
    }
    
    // Find the most voted color
    let maxVotes = 0;
    let dominantColor = 'unknown';
    for (const [color, votes] of Object.entries(colorVotes)) {
      if (votes > maxVotes && color !== 'unknown') {
        maxVotes = votes;
        dominantColor = color;
      }
    }
    
    // If majority of samples agree on a color, use that color
    if (maxVotes > samples.length * 0.3) {
      // Return the dominant color's average RGB values
      const dominantSamples = samples.filter(sample => {
                    const detectedColor = detectColorWithCorrection(sample.r, sample.g, sample.b);
        return detectedColor === dominantColor;
      });
      
      if (dominantSamples.length > 0) {
        const dominantAvg = dominantSamples.reduce((acc, sample) => {
          acc.r += sample.r;
          acc.g += sample.g;
          acc.b += sample.b;
          return acc;
        }, { r: 0, g: 0, b: 0 });
        
        return {
          r: Math.round(dominantAvg.r / dominantSamples.length),
          g: Math.round(dominantAvg.g / dominantSamples.length),
          b: Math.round(dominantAvg.b / dominantSamples.length)
        };
      }
    }
    
    // Fallback to overall average
    const avgColor = samples.reduce((acc, sample) => {
      acc.r += sample.r;
      acc.g += sample.g;
      acc.b += sample.b;
      return acc;
    }, { r: 0, g: 0, b: 0 });
    
    return {
      r: Math.round(avgColor.r / samples.length),
      g: Math.round(avgColor.g / samples.length),
      b: Math.round(avgColor.b / samples.length)
    };
  };

  // Edge-aware color sampling for better accuracy
  const sampleColorEdgeAware = (ctx, centerX, centerY, faceletSize) => {
    const sampleRadius = Math.max(3, faceletSize / 6);
    const samples = [];
    
    // Sample points avoiding edges
    for (let dx = -sampleRadius + 2; dx <= sampleRadius - 2; dx += 1) {
      for (let dy = -sampleRadius + 2; dy <= sampleRadius - 2; dy += 1) {
        const x = Math.floor(centerX + dx);
        const y = Math.floor(centerY + dy);
        
        if (x >= 0 && x < ctx.canvas.width && y >= 0 && y < ctx.canvas.height) {
          try {
            const imageData = ctx.getImageData(x, y, 1, 1).data;
            const sample = {
              r: imageData[0],
              g: imageData[1],
              b: imageData[2]
            };
            
            // Check for edge pixels (high contrast with neighbors)
            const isEdge = checkForEdge(ctx, x, y);
            if (!isEdge) {
              samples.push(sample);
            }
          } catch (error) {
            // Skip invalid samples
          }
        }
      }
    }
    
    // If we don't have enough non-edge samples, fall back to regular sampling
    if (samples.length < 5) {
      return sampleColorMultiPoint(ctx, centerX, centerY, faceletSize);
    }
    
    // Use clustering on edge-aware samples
    const clusteredColor = detectColorByClustering(samples);
    if (clusteredColor !== 'unknown') {
      const largestCluster = findLargestCluster(samples);
      if (largestCluster) {
        return largestCluster.center;
      }
    }
    
    // Fallback to average of edge-aware samples
    const avgColor = samples.reduce((acc, sample) => {
      acc.r += sample.r;
      acc.g += sample.g;
      acc.b += sample.b;
      return acc;
    }, { r: 0, g: 0, b: 0 });
    
    return {
      r: Math.round(avgColor.r / samples.length),
      g: Math.round(avgColor.g / samples.length),
      b: Math.round(avgColor.b / samples.length)
    };
  };

  // Helper function to check if a pixel is on an edge (high contrast with neighbors)
  const checkForEdge = (ctx, x, y) => {
    try {
      const radius = 2;
      const centerPixel = ctx.getImageData(x, y, 1, 1).data;
      const centerBrightness = (centerPixel[0] + centerPixel[1] + centerPixel[2]) / 3;
      
      let neighborCount = 0;
      let totalBrightnessDiff = 0;
      
      // Check neighboring pixels in a small radius
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          if (dx === 0 && dy === 0) continue; // Skip center pixel
          
          const nx = x + dx;
          const ny = y + dy;
          
          // Check bounds
          if (nx >= 0 && nx < ctx.canvas.width && ny >= 0 && ny < ctx.canvas.height) {
            const neighborPixel = ctx.getImageData(nx, ny, 1, 1).data;
            const neighborBrightness = (neighborPixel[0] + neighborPixel[1] + neighborPixel[2]) / 3;
            const brightnessDiff = Math.abs(centerBrightness - neighborBrightness);
            
            totalBrightnessDiff += brightnessDiff;
            neighborCount++;
          }
        }
      }
      
      if (neighborCount === 0) return false;
      
      const avgBrightnessDiff = totalBrightnessDiff / neighborCount;
      const edgeThreshold = 30; // Threshold for edge detection
      
      return avgBrightnessDiff > edgeThreshold;
    } catch (error) {
      return false; // If there's an error, assume it's not an edge
    }
  };

  // Helper function to find the largest cluster
  const findLargestCluster = (samples) => {
    if (!samples || samples.length === 0) return null;
    
    const clusters = {};
    const clusterThreshold = 50;
    
    samples.forEach(sample => {
      let assigned = false;
      
      for (const clusterId in clusters) {
        const clusterCenter = clusters[clusterId].center;
        const distance = Math.sqrt(
          Math.pow(sample.r - clusterCenter.r, 2) +
          Math.pow(sample.g - clusterCenter.g, 2) +
          Math.pow(sample.b - clusterCenter.b, 2)
        );
        
        if (distance < clusterThreshold) {
          clusters[clusterId].samples.push(sample);
          const totalSamples = clusters[clusterId].samples.length;
          clusters[clusterId].center = {
            r: Math.round(clusters[clusterId].samples.reduce((sum, s) => sum + s.r, 0) / totalSamples),
            g: Math.round(clusters[clusterId].samples.reduce((sum, s) => sum + s.g, 0) / totalSamples),
            b: Math.round(clusters[clusterId].samples.reduce((sum, s) => sum + s.b, 0) / totalSamples)
          };
          assigned = true;
          break;
        }
      }
      
      if (!assigned) {
        const clusterId = Object.keys(clusters).length;
        clusters[clusterId] = {
          center: { r: sample.r, g: sample.g, b: sample.b },
          samples: [sample]
        };
      }
    });
    
    // Find the largest cluster
    let largestCluster = null;
    let maxSize = 0;
    
    for (const clusterId in clusters) {
      if (clusters[clusterId].samples.length > maxSize) {
        maxSize = clusters[clusterId].samples.length;
        largestCluster = clusters[clusterId];
      }
    }
    
    return largestCluster && maxSize >= samples.length * 0.3 ? largestCluster : null;
  };

  // Adaptive color calibration based on lighting conditions
  const getAdaptiveThresholds = () => {
    if (!calibrationData) return null;
    
    const { rgb } = calibrationData;
    const brightness = (rgb.r + rgb.g + rgb.b) / 3;
    
    // Adjust thresholds based on overall brightness
    const brightnessFactor = brightness / 128; // Normalize to 0-2 range
    
    return {
      // Adjust saturation thresholds based on lighting
      saturationMultiplier: brightnessFactor > 1.5 ? 0.8 : brightnessFactor < 0.8 ? 1.2 : 1.0,
      // Adjust value thresholds based on lighting
      valueMultiplier: brightnessFactor > 1.5 ? 0.9 : brightnessFactor < 0.8 ? 1.1 : 1.0,
      // Adjust RGB thresholds based on lighting
      rgbMultiplier: brightnessFactor > 1.5 ? 0.9 : brightnessFactor < 0.8 ? 1.1 : 1.0
    };
  };

  // Enhanced color distance-based detection with improved reference colors
  const detectColorByDistance = (r, g, b) => {
    // Enhanced reference colors for Rubik's Cube with multiple variations
    const referenceColors = [
      // White variations
      { color: 'white', r: 255, g: 255, b: 255, weight: 1.0 },
      { color: 'white', r: 240, g: 240, b: 240, weight: 0.9 },
      { color: 'white', r: 220, g: 220, b: 220, weight: 0.8 },
      
      // Red variations
      { color: 'red', r: 255, g: 0, b: 0, weight: 1.0 },
      { color: 'red', r: 220, g: 20, b: 20, weight: 0.9 },
      { color: 'red', r: 200, g: 30, b: 30, weight: 0.8 },
      
      // Orange variations
      { color: 'orange', r: 255, g: 165, b: 0, weight: 1.0 },
      { color: 'orange', r: 255, g: 140, b: 0, weight: 0.9 },
      { color: 'orange', r: 220, g: 120, b: 0, weight: 0.8 },
      
      // Yellow variations
      { color: 'yellow', r: 255, g: 255, b: 0, weight: 1.0 },
      { color: 'yellow', r: 255, g: 240, b: 0, weight: 0.9 },
      { color: 'yellow', r: 220, g: 220, b: 0, weight: 0.8 },
      
      // Green variations
      { color: 'green', r: 0, g: 255, b: 0, weight: 1.0 },
      { color: 'green', r: 20, g: 220, b: 20, weight: 0.9 },
      { color: 'green', r: 30, g: 200, b: 30, weight: 0.8 },
      
      // Blue variations
      { color: 'blue', r: 0, g: 0, b: 255, weight: 1.0 },
      { color: 'blue', r: 20, g: 20, b: 220, weight: 0.9 },
      { color: 'blue', r: 30, g: 30, b: 200, weight: 0.8 }
    ];
    
    let minDistance = Infinity;
    let bestColor = 'unknown';
    let bestConfidence = 0;
    
    // Calculate weighted distance to each reference color
    for (const ref of referenceColors) {
      const distance = Math.sqrt(
        Math.pow(r - ref.r, 2) + 
        Math.pow(g - ref.g, 2) + 
        Math.pow(b - ref.b, 2)
      );
      
      const weightedDistance = distance / ref.weight;
      
      if (weightedDistance < minDistance) {
        minDistance = weightedDistance;
        bestColor = ref.color;
        bestConfidence = Math.max(0, 1 - (distance / 200)); // Normalize confidence
      }
    }
    
    // Only return the color if it's close enough and has good confidence
    const maxDistance = 180; // Increased threshold for better detection
    return minDistance < maxDistance ? bestColor : 'unknown';
  };

  // Enhanced color clustering for better accuracy
  const detectColorByClustering = (samples) => {
    if (!samples || samples.length === 0) return 'unknown';
    
    // Group samples by color similarity
    const clusters = {};
    const clusterThreshold = 50; // Distance threshold for clustering
    
    samples.forEach(sample => {
      let assigned = false;
      
      for (const clusterId in clusters) {
        const clusterCenter = clusters[clusterId].center;
        const distance = Math.sqrt(
          Math.pow(sample.r - clusterCenter.r, 2) +
          Math.pow(sample.g - clusterCenter.g, 2) +
          Math.pow(sample.b - clusterCenter.b, 2)
        );
        
        if (distance < clusterThreshold) {
          clusters[clusterId].samples.push(sample);
          // Update cluster center
          const totalSamples = clusters[clusterId].samples.length;
          clusters[clusterId].center = {
            r: Math.round(clusters[clusterId].samples.reduce((sum, s) => sum + s.r, 0) / totalSamples),
            g: Math.round(clusters[clusterId].samples.reduce((sum, s) => sum + s.g, 0) / totalSamples),
            b: Math.round(clusters[clusterId].samples.reduce((sum, s) => sum + s.b, 0) / totalSamples)
          };
          assigned = true;
          break;
        }
      }
      
      if (!assigned) {
        const clusterId = Object.keys(clusters).length;
        clusters[clusterId] = {
          center: { r: sample.r, g: sample.g, b: sample.b },
          samples: [sample]
        };
      }
    });
    
    // Find the largest cluster
    let largestCluster = null;
    let maxSize = 0;
    
    for (const clusterId in clusters) {
      if (clusters[clusterId].samples.length > maxSize) {
        maxSize = clusters[clusterId].samples.length;
        largestCluster = clusters[clusterId];
      }
    }
    
    if (largestCluster && maxSize >= samples.length * 0.3) {
      const center = largestCluster.center;
      return detectColorWithCorrection(center.r, center.g, center.b);
    }
    
    return 'unknown';
  };

  // Ultra-accurate color detection with improved thresholds
  const detectColorUltraAccurate = (r, g, b) => {
    const [h, s, v] = rgbToHsv(r, g, b);
    const [l, a, b_lab] = rgbToLab(r, g, b);
    
    // Get adaptive thresholds
    const adaptiveThresholds = getAdaptiveThresholds();
    const satMult = adaptiveThresholds?.saturationMultiplier || 1.0;
    const valMult = adaptiveThresholds?.valueMultiplier || 1.0;
    const rgbMult = adaptiveThresholds?.rgbMultiplier || 1.0;

    // Enhanced HSV detection with better color boundaries
    // WHITE - Very lenient for white detection
    if (v > 200 * valMult && s < 50 * satMult) {
      if (Math.abs(r - g) < 30 * rgbMult && Math.abs(g - b) < 30 * rgbMult && Math.abs(r - b) < 30 * rgbMult) {
        return 'white';
      }
    }

    // RED - Very restrictive red detection to avoid orange confusion
    if ((h < 5 || h > 355) && s > 160 * satMult && v > 120 * valMult) {
      if (r > g * 2.0 * rgbMult && r > b * 2.0 * rgbMult && g < 80 * rgbMult) {
        return 'red';
      }
    }

    // ORANGE - Very specific orange detection with strict differentiation from red
    if (h >= 15 && h <= 40 && s > 120 * satMult && v > 100 * valMult) {
      if (r > g * 1.05 * rgbMult && g > b * 1.2 * rgbMult && r - g < 50 && g > 100 * rgbMult) {
        return 'orange';
      }
    }

    // YELLOW - Much more lenient yellow detection
    if (h >= 45 && h <= 75 && s > 80 * satMult && v > 150 * valMult) {
      if (r > 150 * rgbMult && g > 150 * rgbMult && b < 100 * rgbMult) {
        return 'yellow';
      }
    }

    // GREEN - Improved green detection
    if (h >= 75 && h <= 165 && s > 80 * satMult && v > 80 * valMult) {
      if (g > r * 1.3 * rgbMult && g > b * 1.3 * rgbMult) {
        return 'green';
      }
    }

    // BLUE - Enhanced blue detection
    if (h >= 200 && h <= 280 && s > 80 * satMult && v > 80 * valMult) {
      if (b > r * 1.3 * rgbMult && b > g * 1.3 * rgbMult) {
        return 'blue';
      }
    }

    // LAB color space detection for difficult cases
    const labColor = detectColorLAB(l, a, b_lab);
    if (labColor !== 'unknown') return labColor;
    
    // Special orange detection for difficult cases
    const orangeCheck = detectOrangeSpecial(r, g, b, h, s, v);
    if (orangeCheck === 'orange') return 'orange';
    
    // Color distance-based detection as final fallback
    const distanceColor = detectColorByDistance(r, g, b);
    if (distanceColor !== 'unknown') return distanceColor;

    // Final fallback to pure RGB detection
    return detectColorRGB(r, g, b);
  };

  // Enhanced LAB color space detection for better accuracy
  const detectColorLAB = (l, a, b) => {
    // WHITE - High lightness, low chroma
    if (l > 85 && Math.abs(a) < 15 && Math.abs(b) < 15) {
      return 'white';
    }

    // RED - Very high positive a (red-green axis), very restrictive
    if (a > 40 && l > 40 && b < 10) {
      return 'red';
    }

    // ORANGE - High positive a and b (red-green and yellow-blue axes), very specific
    if (a > 25 && b > 25 && l > 55 && a < 35) {
      return 'orange';
    }

    // YELLOW - High positive b (yellow-blue axis), moderate a
    if (b > 30 && Math.abs(a) < 25 && l > 60) {
      return 'yellow';
    }

    // GREEN - High negative a (green-red axis)
    if (a < -20 && l > 40) {
      return 'green';
    }

    // BLUE - High negative b (blue-yellow axis)
    if (b < -20 && l > 40) {
      return 'blue';
    }

    return 'unknown';
  };

  // Special orange detection function for difficult cases
  const detectOrangeSpecial = (r, g, b, h, s, v) => {
    // Very specific orange detection using multiple criteria
    const isOrangeHue = h >= 15 && h <= 40;
    const isOrangeSaturation = s > 120 && s < 200;
    const isOrangeValue = v > 100 && v < 200;
    const isOrangeRGB = r > 120 && g > 80 && b < 80 && r > g && g > b;
    const isOrangeRatio = r - g < 50 && g - b > 20;
    const isOrangeBrightness = (r + g + b) / 3 > 120;
    
    // All criteria must be met for orange
    if (isOrangeHue && isOrangeSaturation && isOrangeValue && 
        isOrangeRGB && isOrangeRatio && isOrangeBrightness) {
      return 'orange';
    }
    
    return 'unknown';
  };

  // Enhanced RGB-based color detection with improved ratios
  const detectColorRGB = (r, g, b) => {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;
    const sum = r + g + b;
    const avg = sum / 3;

    // WHITE - High values, low difference
    if (avg > 200 && diff < 40) {
      return 'white';
    }

    // BLACK - Low values
    if (avg < 50) {
      return 'unknown';
    }

    // RED - Very restrictive red detection
    if (r > 150 && r > g * 2.2 && r > b * 2.2 && g < 70) {
      return 'red';
    }

    // ORANGE - Very specific orange detection
    if (r > 120 && g > 100 && b < 80 && r > g && g > b && r - g < 40 && g > 100) {
      return 'orange';
    }

    // YELLOW - High red and green, low blue
    if (r > 140 && g > 140 && b < 100 && Math.abs(r - g) < 50) {
      return 'yellow';
    }

    // GREEN - High green component
    if (g > 120 && g > r * 1.3 && g > b * 1.3) {
      return 'green';
    }

    // BLUE - High blue component
    if (b > 120 && b > r * 1.3 && b > g * 1.3) {
      return 'blue';
    }

    return 'unknown';
  };

  // Advanced confidence calculation for multi-color-space detection
  const getColorConfidenceUltraAccurate = (color, r, g, b) => {
    if (color === 'unknown') return 0;
    
    const [h, s, v] = rgbToHsv(r, g, b);
    const [l, a, b_lab] = rgbToLab(r, g, b);
    
    // Calculate multiple confidence scores
    const hsvConfidence = getHSVConfidence(color, h, s, v);
    const rgbConfidence = getRGBConfidence(color, r, g, b);
    const labConfidence = getLABConfidence(color, l, a, b_lab);
    const distanceConfidence = getDistanceConfidence(color, r, g, b);
    
    // Weighted average of all confidence scores with emphasis on RGB and distance
    return (hsvConfidence * 0.25 + rgbConfidence * 0.35 + labConfidence * 0.15 + distanceConfidence * 0.25);
  };

  // Distance-based confidence calculation
  const getDistanceConfidence = (color, r, g, b) => {
    const referenceColors = {
      white: { r: 255, g: 255, b: 255 },
      red: { r: 255, g: 0, b: 0 },
      orange: { r: 255, g: 165, b: 0 },
      yellow: { r: 255, g: 255, b: 0 },
      green: { r: 0, g: 255, b: 0 },
      blue: { r: 0, g: 0, b: 255 }
    };
    
    const ref = referenceColors[color];
    if (!ref) return 0;
    
    const distance = Math.sqrt(
      Math.pow(r - ref.r, 2) + 
      Math.pow(g - ref.g, 2) + 
      Math.pow(b - ref.b, 2)
    );
    
    // Normalize distance to confidence (0-1)
    const maxDistance = 200;
    return Math.max(0, 1 - (distance / maxDistance));
  };

  // Enhanced HSV confidence calculation with better thresholds
  const getHSVConfidence = (color, h, s, v) => {
    if (color === 'unknown') return 0;
    
    switch (color) {
      case 'white':
        // High confidence for white when value is high and saturation is low
        if (v > 220 && s < 30) return 0.95;
        if (v > 200 && s < 50) return 0.85;
        if (v > 180 && s < 70) return 0.75;
        return Math.max(0, (v - 150) / 100) * (1 - s / 255);
        
      case 'red':
        // High confidence for red in both red ranges, more restrictive
        if ((h < 8 || h > 352) && s > 140 && v > 120) return 0.95;
        if ((h < 12 || h > 348) && s > 120 && v > 100) return 0.85;
        if ((h < 15 || h > 345) && s > 100 && v > 80) return 0.75;
        return Math.max(0, Math.min(s / 255, v / 255));
        
      case 'orange':
        // High confidence for orange in the orange range
        if (h >= 12 && h <= 42 && s > 140 && v > 140) return 0.95;
        if (h >= 10 && h <= 45 && s > 120 && v > 120) return 0.85;
        if (h >= 8 && h <= 50 && s > 100 && v > 100) return 0.75;
        return Math.max(0, Math.min(s / 255, v / 255));
        
      case 'yellow':
        // High confidence for yellow
        if (h >= 45 && h <= 75 && s > 100 && v > 180) return 0.95;
        if (h >= 40 && h <= 80 && s > 80 && v > 160) return 0.85;
        if (h >= 35 && h <= 85 && s > 60 && v > 140) return 0.75;
        return Math.max(0, Math.min(s / 255, v / 255));
        
      case 'green':
        // High confidence for green
        if (h >= 75 && h <= 165 && s > 100 && v > 100) return 0.95;
        if (h >= 70 && h <= 170 && s > 80 && v > 80) return 0.85;
        if (h >= 65 && h <= 175 && s > 60 && v > 60) return 0.75;
        return Math.max(0, Math.min(s / 255, v / 255));
        
      case 'blue':
        // High confidence for blue
        if (h >= 200 && h <= 280 && s > 100 && v > 100) return 0.95;
        if (h >= 190 && h <= 290 && s > 80 && v > 80) return 0.85;
        if (h >= 180 && h <= 300 && s > 60 && v > 60) return 0.75;
        return Math.max(0, Math.min(s / 255, v / 255));
        
      default:
        return 0;
    }
  };

  // Enhanced RGB confidence calculation with better thresholds
  const getRGBConfidence = (color, r, g, b) => {
    if (color === 'unknown') return 0;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;
    const sum = r + g + b;
    const avg = sum / 3;
    
    switch (color) {
      case 'white':
        // High confidence for white when values are high and similar
        if (avg > 220 && diff < 30) return 0.95;
        if (avg > 200 && diff < 40) return 0.85;
        if (avg > 180 && diff < 50) return 0.75;
        return Math.max(0, (avg - 150) / 100) * (1 - diff / 255);
        
      case 'red':
        // High confidence for red when red is dominant
        if (r > 180 && r > g * 1.6 && r > b * 1.6) return 0.95;
        if (r > 150 && r > g * 1.4 && r > b * 1.4) return 0.85;
        if (r > 120 && r > g * 1.2 && r > b * 1.2) return 0.75;
        return Math.max(0, (r - 100) / 100) * Math.min(r / g, r / b);
        
      case 'orange':
        // High confidence for orange when red and green are high, blue is low
        if (r > 140 && g > 100 && b < 70 && r > g && g > b) return 0.95;
        if (r > 120 && g > 80 && b < 80 && r > g && g > b) return 0.85;
        if (r > 100 && g > 60 && b < 90 && r > g && g > b) return 0.75;
        return Math.max(0, Math.min((r - 80) / 80, (g - 40) / 80)) * (1 - b / 255);
        
      case 'yellow':
        // High confidence for yellow when red and green are high and similar
        if (r > 160 && g > 160 && b < 90 && Math.abs(r - g) < 30) return 0.95;
        if (r > 140 && g > 140 && b < 100 && Math.abs(r - g) < 40) return 0.85;
        if (r > 120 && g > 120 && b < 110 && Math.abs(r - g) < 50) return 0.75;
        return Math.max(0, Math.min((r - 100) / 80, (g - 100) / 80)) * (1 - Math.abs(r - g) / 255);
        
      case 'green':
        // High confidence for green when green is dominant
        if (g > 180 && g > r * 1.6 && g > b * 1.6) return 0.95;
        if (g > 150 && g > r * 1.4 && g > b * 1.4) return 0.85;
        if (g > 120 && g > r * 1.2 && g > b * 1.2) return 0.75;
        return Math.max(0, (g - 100) / 100) * Math.min(g / r, g / b);
        
      case 'blue':
        // High confidence for blue when blue is dominant
        if (b > 180 && b > r * 1.6 && b > g * 1.6) return 0.95;
        if (b > 150 && b > r * 1.4 && b > g * 1.4) return 0.85;
        if (b > 120 && b > r * 1.2 && b > g * 1.2) return 0.75;
        return Math.max(0, (b - 100) / 100) * Math.min(b / r, b / g);
        
      default:
        return 0;
    }
  };

  // Enhanced LAB confidence calculation with better thresholds
  const getLABConfidence = (color, l, a, b) => {
    if (color === 'unknown') return 0;
    
    switch (color) {
      case 'white':
        // High confidence for white when lightness is high and chroma is low
        if (l > 90 && Math.abs(a) < 10 && Math.abs(b) < 10) return 0.95;
        if (l > 85 && Math.abs(a) < 15 && Math.abs(b) < 15) return 0.85;
        if (l > 80 && Math.abs(a) < 20 && Math.abs(b) < 20) return 0.75;
        return Math.max(0, (l - 70) / 30) * (1 - (Math.abs(a) + Math.abs(b)) / 100);
        
      case 'red':
        // High confidence for red when a is high positive
        if (a > 40 && l > 50) return 0.95;
        if (a > 30 && l > 40) return 0.85;
        if (a > 20 && l > 30) return 0.75;
        return Math.max(0, (a - 10) / 40) * (l / 100);
        
      case 'orange':
        // High confidence for orange when both a and b are positive
        if (a > 25 && b > 25 && l > 60) return 0.95;
        if (a > 20 && b > 20 && l > 50) return 0.85;
        if (a > 15 && b > 15 && l > 40) return 0.75;
        return Math.max(0, Math.min((a - 5) / 30, (b - 5) / 30)) * (l / 100);
        
      case 'yellow':
        // High confidence for yellow when b is high positive and a is moderate
        if (b > 40 && Math.abs(a) < 20 && l > 70) return 0.95;
        if (b > 30 && Math.abs(a) < 25 && l > 60) return 0.85;
        if (b > 20 && Math.abs(a) < 30 && l > 50) return 0.75;
        return Math.max(0, (b - 10) / 40) * (1 - Math.abs(a) / 50) * (l / 100);
        
      case 'green':
        // High confidence for green when a is high negative
        if (a < -30 && l > 50) return 0.95;
        if (a < -20 && l > 40) return 0.85;
        if (a < -10 && l > 30) return 0.75;
        return Math.max(0, (-a - 5) / 35) * (l / 100);
        
      case 'blue':
        // High confidence for blue when b is high negative
        if (b < -30 && l > 50) return 0.95;
        if (b < -20 && l > 40) return 0.85;
        if (b < -10 && l > 30) return 0.75;
        return Math.max(0, (-b - 5) / 35) * (l / 100);
        
      default:
        return 0;
    }
  };

  // Enhanced grid drawing with better visual feedback
  const drawSimpleGrid = (ctx, gridBounds, alignmentScore) => {
    if (!gridBounds) return;
    
    const { x, y, width: gridWidth, height: gridHeight } = gridBounds;
    
    // Dynamic border color based on alignment
    let borderColor = '#ff0000'; // Red for poor alignment
    if (alignmentScore > 80) {
      borderColor = '#00ff00'; // Green for good alignment
    } else if (alignmentScore > 50) {
      borderColor = '#ffff00'; // Yellow for medium alignment
    }
    
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, gridWidth, gridHeight);
    
    // Draw internal grid lines
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    
    const faceletSize = gridWidth / 3;
    
    // Vertical lines
    for (let i = 1; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(x + i * faceletSize, y);
      ctx.lineTo(x + i * faceletSize, y + gridHeight);
      ctx.stroke();
    }
    
    // Horizontal lines
    for (let i = 1; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(x, y + i * faceletSize);
      ctx.lineTo(x + gridWidth, y + i * faceletSize);
      ctx.stroke();
    }
    
    // Draw alignment score with better visibility
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(x, y - 30, gridWidth, 25);
    ctx.font = 'bold 16px Arial';
    ctx.fillStyle = borderColor;
    ctx.textAlign = 'center';
    ctx.fillText(`Alignment: ${Math.round(alignmentScore)}%`, x + gridWidth / 2, y - 10);
  };

  // Enhanced color drawing with confidence indicators
  const drawSimpleColors = (ctx, gridBounds, colors) => {
    if (!gridBounds || !Array.isArray(colors)) return;
    
    const { x, y, width: gridWidth, height: gridHeight } = gridBounds;
    const faceletSize = gridWidth / 3;
    
    colors.forEach((row, rowIndex) => {
      row.forEach((color, colIndex) => {
        const actualCol = mirrorMode ? (2 - colIndex) : colIndex;
        const centerX = x + (actualCol * faceletSize) + (faceletSize / 2);
        const centerY = y + (rowIndex * faceletSize) + (faceletSize / 2);
        
        // Sample color for confidence calculation
        const colorSample = sampleColorMultiPoint(ctx, centerX, centerY, faceletSize);
        let confidence = 0;
        
        if (colorSample) {
          confidence = getColorConfidenceUltraAccurate(color, colorSample.r, colorSample.g, colorSample.b);
        }
        
        // Draw color circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, faceletSize / 6, 0, 2 * Math.PI);
        ctx.fillStyle = getColorHex(color);
        ctx.fill();
        
        // Draw confidence-based border
        let borderColor = '#ff0000'; // Red for low confidence
        if (confidence > 0.6) {
          borderColor = '#00ff00'; // Green for high confidence
        } else if (confidence > 0.4) {
          borderColor = '#ffff00'; // Yellow for medium confidence
        }
        
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw color label
        ctx.font = 'bold 12px Arial';
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        const label = color.toUpperCase().substring(0, 1);
        ctx.strokeText(label, centerX - 4, centerY + 4);
        ctx.fillText(label, centerX - 4, centerY + 4);
        
        // Draw confidence percentage
        if (confidence > 0) {
          ctx.font = '8px Arial';
          ctx.fillStyle = borderColor;
          ctx.textAlign = 'center';
          ctx.fillText(`${Math.round(confidence * 100)}%`, centerX, centerY - faceletSize / 6 - 5);
        }
      });
    });
  };

  // Debug function to show detailed color information
  const debugColorInfo = (ctx, gridBounds) => {
    if (!debugMode || !gridBounds) return;
    
    const { x, y, width: gridWidth, height: gridHeight } = gridBounds;
    const faceletSize = gridWidth / 3;
    
    // Sample center of each facelet and show RGB/HSV values
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const actualCol = mirrorMode ? (2 - col) : col;
        const centerX = x + (actualCol * faceletSize) + (faceletSize / 2);
        const centerY = y + (row * faceletSize) + (faceletSize / 2);
        
        const colorSample = sampleColorMultiPoint(ctx, centerX, centerY, faceletSize);
        
        if (colorSample) {
          const { r, g, b } = colorSample;
          const [h, s, v] = rgbToHsv(r, g, b);
          const detectedColor = detectColorUltraAccurate(r, g, b);
          const confidence = getColorConfidenceUltraAccurate(detectedColor, r, g, b);
          
          // Draw debug info
          const debugX = x + gridWidth + 10;
          const debugY = y + (row * 3 + col) * 20;
          
          ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
          ctx.fillRect(debugX, debugY, 200, 18);
          ctx.font = '10px Arial';
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'left';
          ctx.fillText(`[${row},${col}] RGB(${r},${g},${b}) HSV(${Math.round(h)},${Math.round(s)},${Math.round(v)}) ${detectedColor} ${Math.round(confidence * 100)}%`, debugX + 5, debugY + 12);
        }
      }
    }
  };

  // Load OpenCV.js with singleton pattern to prevent multiple loads
  useEffect(() => {
    const loadOpenCV = async () => {
      // If already loaded, just set ready state
      if (isOpenCVReady()) {
        setOpencvReady(true);
        return;
      }

      // If OpenCV failed to load previously, don't try again
      if (opencvFailed) {
        setOpencvReady(false);
        setOpencvError('OpenCV failed to load. Using fallback detection.');
        return;
      }

      // If already loading, wait for the existing promise
      if (opencvLoadingPromise) {
        try {
          await opencvLoadingPromise;
          setOpencvReady(true);
          return;
        } catch (error) {
          console.error('OpenCV loading failed:', error);
          return;
        }
      }

      // Create new loading promise
      opencvLoadingPromise = new Promise((resolve, reject) => {
        // Check if OpenCV is already available
        if (window.cv) {
          opencvLoaded = true;
          opencvInitialized = true;
          resolve();
          return;
        }

        // Check if script is already being loaded
        const existingScript = document.querySelector('script[src*="opencv.js"]');
        if (existingScript) {
          // Wait for existing script to load
          existingScript.addEventListener('load', () => {
            if (window.cv) {
              window.cv['onRuntimeInitialized'] = () => {
                opencvLoaded = true;
                opencvInitialized = true;
                resolve();
              };
            } else {
              reject(new Error('OpenCV failed to initialize'));
            }
          });
          return;
        }

        // Load OpenCV script
        const script = document.createElement('script');
        script.src = 'https://docs.opencv.org/4.5.4/opencv.js';
        script.async = true;
        script.onload = () => {
          if (window.cv) {
            window.cv['onRuntimeInitialized'] = () => {
              opencvLoaded = true;
              opencvInitialized = true;
              resolve();
            };
          } else {
            reject(new Error('OpenCV failed to initialize'));
          }
        };
        script.onerror = () => {
          reject(new Error('Failed to load OpenCV script'));
        };
        document.head.appendChild(script);
      });

      try {
        await opencvLoadingPromise;
        setOpencvReady(isOpenCVReady());
        setOpencvError(null); // Clear any previous errors
      } catch (error) {
        console.error('Failed to load OpenCV.js:', error);
        opencvFailed = true; // Mark OpenCV as failed
        setOpencvError('Failed to load OpenCV.js. Using fallback detection.');
        setOpencvReady(false);
        opencvLoadingPromise = null; // Reset for retry
      }
    };

    loadOpenCV();

    // Cleanup function
    return () => {
      // Don't reset global state on unmount to prevent reloading
      // The global state should persist across component re-renders
    };
  }, []);

  // Initialize canvas with grid even without video
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = 480;
    const height = 480;
    
    canvas.width = width;
    canvas.height = height;
    
    // Draw initial grid
    const gridSize = Math.min(width, height) * 0.4;
    const centerX = width / 2;
    const centerY = height / 2;
    const gridX = centerX - gridSize / 2;
    const gridY = centerY - gridSize / 2;
    
    const gridBounds = {
      x: gridX,
      y: gridY,
      width: gridSize,
      height: gridSize,
      area: gridSize * gridSize,
      method: 'perfect-square-grid'
    };
    setCubeBounds(gridBounds);
    setCubeDetected(true);
    
    // Draw placeholder background
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(0, 0, width, height);
    
    // Draw grid overlay
    drawSimpleGrid(ctx, gridBounds, 0);
    
    // Draw instruction text overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(10, height - 120, 620, 110);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Arial';
    ctx.fillText('🎯 Position your Rubik\'s Cube in the center grid!', 20, height - 100);
    ctx.font = '14px Arial';
    ctx.fillText('• Align each face square with a numbered grid cell (1-9)', 20, height - 80);
    ctx.fillText('• Keep the cube face parallel to the camera', 20, height - 60);
    ctx.fillText('• Wait for camera feed to appear...', 20, height - 40);
    ctx.fillText('• Grid will overlay on live video when ready', 20, height - 20);
  }, []);

  // Optimized processing loop - NO BUFFERING with adaptive frame rate
  useEffect(() => {
    if (!videoRef?.current?.video || isProcessing) return;

    // Use requestAnimationFrame for smooth operation with adaptive frame limiting
    let animationId;
    let lastFrameTime = 0;
    let targetFPS = 15; // Start with 15 FPS
    let frameInterval = 1000 / targetFPS;
    let performanceHistory = [];

    const processFrameOptimized = (currentTime) => {
      // Adaptive frame rate based on performance
      if (performanceStats.processingTime > 50) {
        targetFPS = Math.max(8, targetFPS - 1); // Reduce FPS if slow
      } else if (performanceStats.processingTime < 30 && targetFPS < 20) {
        targetFPS = Math.min(20, targetFPS + 0.5); // Increase FPS if fast
      }

      // Frame rate limiting
      if (currentTime - lastFrameTime < frameInterval) {
        animationId = requestAnimationFrame(processFrameOptimized);
        return;
      }

      if (videoRef?.current?.video && !isProcessing && !processingFrame) {
        processFrame();
        lastFrameTime = currentTime;
      }

      animationId = requestAnimationFrame(processFrameOptimized);
    };

    animationId = requestAnimationFrame(processFrameOptimized);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [videoRef, isProcessing, mirrorMode, opencvReady, faceIndex, performanceStats.processingTime]);

  const isFaceValid = () => {
    console.log('=== FACE VALIDATION DEBUG ===');
    console.log('faceIndex:', faceIndex);
    console.log('cubeDetected:', cubeDetected);
    console.log('faceColors:', faceColors);
    console.log('alignmentScore:', alignmentScore);
    
    if (!cubeDetected) {
      console.log('❌ Face validation failed: cube not detected');
      return false;
    }
    if (!Array.isArray(faceColors) || faceColors.length === 0) {
      console.log('❌ Face validation failed: no face colors');
      return false;
    }
    
    const validColors = faceColors.flat().filter(color => color !== 'unknown');
    const totalColors = faceColors.flat().length;
    const colorDetectionRate = validColors.length / totalColors;
    
    console.log('Valid colors:', validColors.length);
    console.log('Total colors:', totalColors);
    console.log('Color detection rate:', colorDetectionRate);
    console.log('Alignment score:', alignmentScore);
    
    // More lenient validation for right face (index 5) due to common issues
    let isValid;
    if (faceIndex === 5) { // Right face
      console.log('🔧 Using lenient validation for right face');
      isValid = validColors.length >= 4 && alignmentScore > 30 && colorDetectionRate > 0.4;
    } else {
      isValid = validColors.length >= 6 && alignmentScore > 50 && colorDetectionRate > 0.6;
    }
    
    console.log('Face validation result:', isValid);
    console.log('=============================');
    
    return isValid;
  };

  // Enhanced save function with proper 3D cube mapping
  const handleSave = () => {
    console.log('handleSave called - checking face validity...');
    console.log('faceColors:', faceColors);
    console.log('alignmentScore:', alignmentScore);
    console.log('totalConfidence:', totalConfidence);
    
    if (!isFaceValid()) {
      console.log('Face validation failed');
      alert('Please ensure all colors are detected correctly before saving. Current alignment: ' + Math.round(alignmentScore) + '%');
      return;
    }

    // Validate that we have a complete face
    const flatColors = faceColors.flat();
    const validColors = flatColors.filter(color => color !== 'unknown');
    
    console.log('Valid colors count:', validColors.length);
    
    if (validColors.length < 6) {
      console.log('Not enough colors detected');
      alert('Please ensure at least 6 colors are detected. Currently detected: ' + validColors.length + '/9');
      return;
    }

    // Create properly formatted face data for 3D cube mapping
    const faceData = {
      faceIndex: faceIndex,
      colors: faceColors,
      alignmentScore: alignmentScore,
      confidence: totalConfidence / 9,
      timestamp: Date.now(),
      faceMapping: {
        front: faceIndex === 0,
        back: faceIndex === 1,
        up: faceIndex === 2,
        down: faceIndex === 3,
        left: faceIndex === 4,
        right: faceIndex === 5
      }
    };

    console.log('=== CUBE RECOGNITION SAVE DEBUG ===');
    console.log('Current faceIndex:', faceIndex);
    console.log('Face colors:', faceColors);
    console.log('Face mapping:', faceData.faceMapping);
    console.log('Is this the right face?', faceIndex === 5);
    console.log('Colors array length:', faceColors.length);
    console.log('Flat colors:', faceColors.flat());
    console.log('Valid colors count:', validColors.length);
    console.log('Saving face data for 3D cube mapping:', faceData);
    console.log('onSaveFace callback exists:', !!onSaveFace);
    console.log('=====================================');
    
    if (onSaveFace) {
      console.log('Calling onSaveFace with faceData...');
      onSaveFace(faceData);
      console.log('onSaveFace called successfully');
    } else {
      console.error('onSaveFace callback is not provided!');
    }
  };

  const toggleMirror = () => {
    setMirrorMode(!mirrorMode);
  };

  const toggleDebug = () => {
    setDebugMode(!debugMode);
  };

  const getCurrentFaceInfo = () => {
    // Ensure faceIndex is a valid number
    const validFaceIndex = typeof faceIndex === 'number' && faceIndex >= 0 && faceIndex < FACE_CAPTURE_SEQUENCE.length 
      ? faceIndex 
      : 0;
    
    return FACE_CAPTURE_SEQUENCE[validFaceIndex] || {
      name: 'Unknown Face',
      instruction: 'Please wait...',
      description: 'Loading face information...',
      tips: ['Please wait for face detection to initialize']
    };
  };

  // Color calibration for different lighting conditions
  const calibrateColors = () => {
    if (!videoRef?.current?.video) return;
    
    const videoEl = videoRef.current.video;
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = videoEl.videoWidth;
    const height = videoEl.videoHeight;
    
    if (width === 0 || height === 0) return;
    
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(videoEl, 0, 0, width, height);
    
    // Sample center of frame for calibration
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);
    
    try {
      const imageData = ctx.getImageData(centerX, centerY, 1, 1).data;
      const [h, s, v] = rgbToHsv(imageData[0], imageData[1], imageData[2]);
      
      setCalibrationData({
        rgb: { r: imageData[0], g: imageData[1], b: imageData[2] },
        hsv: { h: Math.round(h), s: Math.round(s), v: Math.round(v) },
        timestamp: Date.now()
      });
      
      console.log('Color calibration data:', {
        rgb: { r: imageData[0], g: imageData[1], b: imageData[2] },
        hsv: { h: Math.round(h), s: Math.round(s), v: Math.round(v) }
      });
    } catch (error) {
      console.error('Calibration error:', error);
    }
  };

  // Color correction for lighting variations
  const correctColorForLighting = (r, g, b) => {
    // Calculate average brightness
    const avg = (r + g + b) / 3;
    
    // If too dark, boost the values
    if (avg < 100) {
      const boost = 150 / avg;
      return {
        r: Math.min(255, Math.round(r * boost)),
        g: Math.min(255, Math.round(g * boost)),
        b: Math.min(255, Math.round(b * boost))
      };
    }
    
    // If too bright, reduce the values
    if (avg > 200) {
      const reduce = 180 / avg;
      return {
        r: Math.max(0, Math.round(r * reduce)),
        g: Math.max(0, Math.round(g * reduce)),
        b: Math.max(0, Math.round(b * reduce))
      };
    }
    
    return { r, g, b };
  };

  // Revolutionary color detection with lighting correction and calibration
  const detectColorWithCorrection = (r, g, b) => {
    // Apply color calibration first
    const calibrated = applyColorCalibration(r, g, b);
    
    // Apply color correction
    const corrected = correctColorForLighting(calibrated.r, calibrated.g, calibrated.b);
    
    // Try revolutionary detection first (most accurate)
    let color = detectColorRevolutionary(corrected.r, corrected.g, corrected.b);
    
    // If unknown, try with calibrated values
    if (color === 'unknown') {
      color = detectColorRevolutionary(calibrated.r, calibrated.g, calibrated.b);
    }
    
    // If still unknown, try with original values
    if (color === 'unknown') {
      color = detectColorRevolutionary(r, g, b);
    }
    
    // If still unknown, try advanced detection
    if (color === 'unknown') {
      color = detectColorAdvanced(corrected.r, corrected.g, corrected.b);
    }
    
    // If still unknown, try neural detection
    if (color === 'unknown') {
      color = detectColorNeural(corrected.r, corrected.g, corrected.b);
    }
    
    // Final fallback
    if (color === 'unknown') {
      color = detectColorUltraAccurate(r, g, b);
    }
    
    return color;
  };

  // Color validation and correction for impossible combinations
  const validateAndCorrectColors = (colors) => {
    if (!Array.isArray(colors) || colors.length === 0) return colors;
    
    const colorCounts = {};
    const validColors = ['red', 'orange', 'yellow', 'green', 'blue', 'white'];
    
    // Count each color
    colors.flat().forEach(color => {
      if (validColors.includes(color)) {
        colorCounts[color] = (colorCounts[color] || 0) + 1;
      }
    });
    
    // Check for impossible distributions and correct them
    const totalValidColors = Object.values(colorCounts).reduce((sum, count) => sum + count, 0);
    
    // If we have too many of one color (more than 6), it might be wrong
    for (const [color, count] of Object.entries(colorCounts)) {
      if (count > 6) {
        console.log(`Warning: ${color} appears ${count} times, attempting correction`);
        
        // Try to correct by changing some instances to similar colors
        if (color === 'yellow' && count > 6) {
          // Change some yellows to orange if orange count is low
          if ((colorCounts['orange'] || 0) < 3) {
            let changed = 0;
            for (let i = 0; i < colors.length && changed < count - 6; i++) {
              for (let j = 0; j < colors[i].length && changed < count - 6; j++) {
                if (colors[i][j] === 'yellow') {
                  colors[i][j] = 'orange';
                  changed++;
                }
              }
            }
          }
        } else if (color === 'orange' && count > 6) {
          // Change some oranges to red if red count is low
          if ((colorCounts['red'] || 0) < 3) {
            let changed = 0;
            for (let i = 0; i < colors.length && changed < count - 6; i++) {
              for (let j = 0; j < colors[i].length && changed < count - 6; j++) {
                if (colors[i][j] === 'orange') {
                  colors[i][j] = 'red';
                  changed++;
                }
              }
            }
          }
        }
      }
    }
    
    // If we have too few colors (less than 3 different colors), might be wrong
    const uniqueColors = Object.keys(colorCounts).length;
    if (uniqueColors < 3 && totalValidColors > 5) {
      console.log(`Warning: Only ${uniqueColors} unique colors detected, might need recalibration`);
    }
    
    return colors;
  };

  // Machine learning-inspired color detection with neural network-like approach
  const detectColorNeural = (r, g, b) => {
    const [h, s, v] = rgbToHsv(r, g, b);
    const [l, a, b_lab] = rgbToLab(r, g, b);
    
    // Calculate color scores for each color using multiple features
    const colorScores = { white: 0, red: 0, orange: 0, yellow: 0, green: 0, blue: 0 };
    
    // Feature 1: HSV-based scoring
    if (h >= 40 && h <= 80 && s > 60 && v > 140) {
      colorScores.yellow += Math.min(s / 255, v / 255) * 2;
    }
    
    // Feature 2: RGB-based scoring
    if (r > 120 && g > 120 && b < 110 && Math.abs(r - g) < 50) {
      colorScores.yellow += Math.min((r - 100) / 80, (g - 100) / 80) * 1.5;
    }
    
    // Feature 3: LAB-based scoring
    // White
    if (l > 80 && Math.abs(a) < 20 && Math.abs(b) < 20) {
      colorScores.white += (l - 80) / 20 * (1 - (Math.abs(a) + Math.abs(b)) / 100) * 1.5;
    }
    
    // Red
    if (a > 20 && l > 40) {
      colorScores.red += (a - 10) / 40 * (l / 100) * 1.5;
    }
    
    // Orange
    if (a > 15 && b > 15 && l > 50) {
      colorScores.orange += Math.min((a - 5) / 30, (b - 5) / 30) * (l / 100) * 1.5;
    }
    
    // Yellow
    if (b > 20 && Math.abs(a) < 30 && l > 60) {
      colorScores.yellow += (b - 10) / 40 * (1 - Math.abs(a) / 50) * (l / 100) * 1.5;
    }
    
    // Green
    if (a < -15 && l > 40) {
      colorScores.green += (-a - 5) / 35 * (l / 100) * 1.5;
    }
    
    // Blue
    if (b < -15 && l > 40) {
      colorScores.blue += (-b - 5) / 35 * (l / 100) * 1.5;
    }
    
    // Find the color with the highest score
    let bestColor = 'unknown';
    let bestScore = 0;
    
    for (const [color, score] of Object.entries(colorScores)) {
      if (score > bestScore) {
        bestScore = score;
        bestColor = color;
      }
    }
    
    // Only return a color if the score is high enough
    return bestScore > 1.0 ? bestColor : 'unknown';
  };

  // Optimized color analysis with reduced sampling for better performance
  const analyzeColorsOptimized = (ctx, gridBounds) => {
    if (!gridBounds) return { colors: [], validDetections: 0, alignmentScore: 0 };
    
    const { x, y, width: gridWidth, height: gridHeight } = gridBounds;
    const faceletSize = gridWidth / 3;
    
    const colors = [];
    let validDetections = 0;
    let totalConfidence = 0;
    
    for (let row = 0; row < 3; row++) {
      const rowColors = [];
      for (let col = 0; col < 3; col++) {
        const actualCol = mirrorMode ? (2 - col) : col;
        const centerX = x + (actualCol * faceletSize) + (faceletSize / 2);
        const centerY = y + (row * faceletSize) + (faceletSize / 2);
        
        // Optimized sampling with fewer points for better performance
        const colorSample = sampleColorOptimized(ctx, centerX, centerY, faceletSize);
        
        if (colorSample) {
          const { r, g, b } = colorSample;
          const cubeColor = detectColorWithCorrection(r, g, b);
          const confidence = getColorConfidenceRevolutionary(cubeColor, r, g, b);
          
          if (cubeColor !== 'unknown' && confidence > 0.3) { // Lowered threshold for better detection
            validDetections++;
            totalConfidence += confidence;
          }
          rowColors.push(cubeColor);
        } else {
          rowColors.push('unknown');
        }
      }
      colors.push(rowColors);
    }
    
    // Validate and correct color consistency
    let validatedColors = validateAndCorrectColors(colors);
    
    // Additional validation for color confusion (white/yellow, orange/red)
    validatedColors = validateColorConfusion(validatedColors);
    
    // Additional validation for blue/yellow confusion
    validatedColors = validateBlueYellowConfusion(validatedColors);
    
    const alignmentScore = Math.min(100, (validDetections / 9) * 100 + (totalConfidence / 9) * 30);
    
    return { colors: validatedColors, validDetections, alignmentScore };
  };

  // Optimized color sampling with fewer points for better performance
  const sampleColorOptimized = (ctx, centerX, centerY, faceletSize) => {
    const sampleRadius = Math.max(2, faceletSize / 8); // Reduced radius for performance
    const samples = [];
    const colorVotes = { red: 0, orange: 0, yellow: 0, green: 0, blue: 0, white: 0, unknown: 0 };
    
    // Sample fewer points with larger steps for better performance
    for (let dx = -sampleRadius; dx <= sampleRadius; dx += 2) { // Step by 2
      for (let dy = -sampleRadius; dy <= sampleRadius; dy += 2) { // Step by 2
        const x = Math.floor(centerX + dx);
        const y = Math.floor(centerY + dy);
        
        if (x >= 0 && x < ctx.canvas.width && y >= 0 && y < ctx.canvas.height) {
          try {
            const imageData = ctx.getImageData(x, y, 1, 1).data;
            const sample = {
              r: imageData[0],
              g: imageData[1],
              b: imageData[2]
            };
            samples.push(sample);
            
            // Vote for color detection
            const detectedColor = detectColorWithCorrection(sample.r, sample.g, sample.b);
            colorVotes[detectedColor]++;
          } catch (error) {
            // Skip invalid samples
          }
        }
      }
    }
    
    if (samples.length === 0) return null;
    
    // Find the most voted color
    let maxVotes = 0;
    let dominantColor = 'unknown';
    for (const [color, votes] of Object.entries(colorVotes)) {
      if (votes > maxVotes && color !== 'unknown') {
        maxVotes = votes;
        dominantColor = color;
      }
    }
    
    // If majority of samples agree on a color, use that color
    if (maxVotes > samples.length * 0.25) { // Lowered threshold for better detection
      // Return the dominant color's average RGB values
      const dominantSamples = samples.filter(sample => {
        const detectedColor = detectColorWithCorrection(sample.r, sample.g, sample.b);
        return detectedColor === dominantColor;
      });
      
      if (dominantSamples.length > 0) {
        const dominantAvg = dominantSamples.reduce((acc, sample) => {
          acc.r += sample.r;
          acc.g += sample.g;
          acc.b += sample.b;
          return acc;
        }, { r: 0, g: 0, b: 0 });
        
        return {
          r: Math.round(dominantAvg.r / dominantSamples.length),
          g: Math.round(dominantAvg.g / dominantSamples.length),
          b: Math.round(dominantAvg.b / dominantSamples.length)
        };
      }
    }
    
    // Fallback to overall average
    const avgColor = samples.reduce((acc, sample) => {
      acc.r += sample.r;
      acc.g += sample.g;
      acc.b += sample.b;
      return acc;
    }, { r: 0, g: 0, b: 0 });
    
    return {
      r: Math.round(avgColor.r / samples.length),
      g: Math.round(avgColor.g / samples.length),
      b: Math.round(avgColor.b / samples.length)
    };
  };

  // Optimized confidence calculation for better performance
  const getColorConfidenceOptimized = (color, r, g, b) => {
    if (color === 'unknown') return 0;
    
    const [h, s, v] = rgbToHsv(r, g, b);
    const [l, a, b_lab] = rgbToLab(r, g, b);
    
    // Simplified confidence calculation for better performance
    let confidence = 0;
    
    switch (color) {
      case 'white':
        confidence = (v > 200 ? 0.8 : v / 250) * (s < 50 ? 1.0 : 50 / s);
        break;
      case 'red':
        confidence = ((h < 15 || h > 345) ? 0.8 : 0.3) * (s > 80 ? 0.8 : s / 100) * (v > 80 ? 0.8 : v / 100);
        break;
      case 'orange':
        confidence = (h >= 10 && h <= 45 ? 0.8 : 0.3) * (s > 100 ? 0.8 : s / 125) * (v > 100 ? 0.8 : v / 125);
        break;
      case 'yellow':
        confidence = (h >= 40 && h <= 80 ? 0.8 : 0.3) * (s > 60 ? 0.8 : s / 75) * (v > 140 ? 0.8 : v / 175);
        break;
      case 'green':
        confidence = (h >= 70 && h <= 170 ? 0.8 : 0.3) * (s > 80 ? 0.8 : s / 100) * (v > 80 ? 0.8 : v / 100);
        break;
      case 'blue':
        confidence = (h >= 190 && h <= 290 ? 0.8 : 0.3) * (s > 80 ? 0.8 : s / 100) * (v > 80 ? 0.8 : v / 100);
        break;
      default:
        confidence = 0;
    }
    
    return Math.min(1.0, confidence);
  };

  // Advanced color detection with improved blue detection and color boundaries
  const detectColorAdvanced = (r, g, b) => {
    const [h, s, v] = rgbToHsv(r, g, b);
    const [l, a, b_lab] = rgbToLab(r, g, b);
    
    // Calculate color scores for each color using multiple features
    const colorScores = {
      white: 0,
      red: 0,
      orange: 0,
      yellow: 0,
      green: 0,
      blue: 0
    };
    
    // Feature 1: Enhanced HSV-based scoring with better blue detection
    // White
    if (v > 200 && s < 50) {
      colorScores.white += (v - 200) / 55 * (1 - s / 255) * 2;
    }
    
    // Red (both red ranges)
    if ((h < 15 || h > 345) && s > 80 && v > 80) {
      colorScores.red += Math.min(s / 255, v / 255) * 2;
    }
    
    // Orange
    if (h >= 10 && h <= 45 && s > 100 && v > 100) {
      colorScores.orange += Math.min(s / 255, v / 255) * 2;
    }
    
    // Yellow - More restrictive to avoid blue misdetection
    if (h >= 45 && h <= 75 && s > 80 && v > 160) {
      // Additional check: yellow should have high red and green, low blue
      if (r > 140 && g > 140 && b < 120) {
        colorScores.yellow += Math.min(s / 255, v / 255) * 2.5; // Higher weight for yellow
      }
    }
    
    // Green
    if (h >= 75 && h <= 165 && s > 80 && v > 80) {
      colorScores.green += Math.min(s / 255, v / 255) * 2;
    }
    
    // Blue - Much more restrictive to avoid yellow misdetection
    if (h >= 200 && h <= 280 && s > 80 && v > 80) {
      // Additional check: blue should have high blue, low red and green
      if (b > 120 && b > r * 1.4 && b > g * 1.4) {
        colorScores.blue += Math.min(s / 255, v / 255) * 3; // Higher weight for blue
      }
    }
    
    // Feature 2: Enhanced RGB-based scoring with better color separation
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;
    const avg = (r + g + b) / 3;
    
    // White
    if (avg > 180 && diff < 50) {
      colorScores.white += (avg - 180) / 75 * (1 - diff / 255) * 1.5;
    }
    
    // Red
    if (r > 120 && r > g * 1.3 && r > b * 1.3) {
      colorScores.red += (r - 120) / 135 * Math.min(r / g, r / b) * 1.5;
    }
    
    // Orange
    if (r > 100 && g > 60 && b < 90 && r > g && g > b) {
      colorScores.orange += Math.min((r - 80) / 80, (g - 40) / 80) * (1 - b / 255) * 1.5;
    }
    
    // Yellow - More restrictive RGB checks
    if (r > 120 && g > 120 && b < 100 && Math.abs(r - g) < 40) {
      // Additional check: yellow should not have high blue component
      if (b < Math.max(r, g) * 0.7) {
        colorScores.yellow += Math.min((r - 100) / 80, (g - 100) / 80) * (1 - Math.abs(r - g) / 255) * 2;
      }
    }
    
    // Green
    if (g > 120 && g > r * 1.3 && g > b * 1.3) {
      colorScores.green += (g - 120) / 135 * Math.min(g / r, g / b) * 1.5;
    }
    
    // Blue - Much more restrictive RGB checks
    if (b > 120 && b > r * 1.5 && b > g * 1.5) {
      // Additional check: blue should have significantly higher blue component
      if (b > (r + g) / 2 * 1.3) {
        colorScores.blue += (b - 120) / 135 * Math.min(b / r, b / g) * 2.5;
      }
    }
    
    // Feature 3: Enhanced LAB-based scoring with better color separation
    // White
    if (l > 80 && Math.abs(a) < 20 && Math.abs(b) < 20) {
      colorScores.white += (l - 80) / 20 * (1 - (Math.abs(a) + Math.abs(b)) / 100) * 1.5;
    }
    
    // Red
    if (a > 20 && l > 40) {
      colorScores.red += (a - 10) / 40 * (l / 100) * 1.5;
    }
    
    // Orange
    if (a > 15 && b > 15 && l > 50) {
      colorScores.orange += Math.min((a - 5) / 30, (b - 5) / 30) * (l / 100) * 1.5;
    }
    
    // Yellow - More restrictive LAB checks
    if (b > 20 && Math.abs(a) < 25 && l > 60) {
      // Additional check: yellow should have positive b but not too high
      if (b < 50) {
        colorScores.yellow += (b - 10) / 40 * (1 - Math.abs(a) / 50) * (l / 100) * 2;
      }
    }
    
    // Green
    if (a < -15 && l > 40) {
      colorScores.green += (-a - 5) / 35 * (l / 100) * 1.5;
    }
    
    // Blue - Much more restrictive LAB checks
    if (b < -15 && l > 40) {
      // Additional check: blue should have significantly negative b
      if (b < -25) {
        colorScores.blue += (-b - 5) / 35 * (l / 100) * 2.5;
      }
    }
    
    // Feature 4: Color ratio analysis for better separation
    const ratios = {
      r_g: r / g,
      r_b: r / b,
      g_r: g / r,
      g_b: g / b,
      b_r: b / r,
      b_g: b / g
    };
    
    // Yellow should have balanced red and green, low blue
    if (ratios.r_g > 0.8 && ratios.r_g < 1.2 && ratios.r_b > 1.2 && ratios.g_b > 1.2) {
      colorScores.yellow += 1.0;
    }
    
    // Blue should have high blue ratios
    if (ratios.b_r > 1.5 && ratios.b_g > 1.5) {
      colorScores.blue += 1.5;
    }
    
    // Find the color with the highest score
    let bestColor = 'unknown';
    let bestScore = 0;
    
    for (const [color, score] of Object.entries(colorScores)) {
      if (score > bestScore) {
        bestScore = score;
        bestColor = color;
      }
    }
    
    // Only return a color if the score is high enough
    return bestScore > 1.5 ? bestColor : 'unknown';
  };

  // Enhanced confidence calculation with better blue detection
  const getColorConfidenceEnhanced = (color, r, g, b) => {
    if (color === 'unknown') return 0;
    
    const [h, s, v] = rgbToHsv(r, g, b);
    const [l, a, b_lab] = rgbToLab(r, g, b);
    
    // Enhanced confidence calculation with better color separation
    let confidence = 0;
    
    switch (color) {
      case 'white':
        confidence = (v > 200 ? 0.9 : v / 222) * (s < 50 ? 1.0 : 50 / s);
        break;
      case 'red':
        confidence = ((h < 15 || h > 345) ? 0.9 : 0.3) * (s > 80 ? 0.9 : s / 89) * (v > 80 ? 0.9 : v / 89);
        break;
      case 'orange':
        confidence = (h >= 10 && h <= 45 ? 0.9 : 0.3) * (s > 100 ? 0.9 : s / 111) * (v > 100 ? 0.9 : v / 111);
        break;
      case 'yellow':
        // Enhanced yellow confidence with better blue separation
        let yellowConfidence = 0;
        if (h >= 40 && h <= 80 && s > 80 && v > 160) {
          yellowConfidence += 0.4;
        }
        if (r > 140 && g > 140 && b < 120) {
          yellowConfidence += 0.3;
        }
        if (Math.abs(r - g) < 40) {
          yellowConfidence += 0.2;
        }
        if (b < Math.max(r, g) * 0.7) {
          yellowConfidence += 0.1;
        }
        confidence = Math.min(1.0, yellowConfidence);
        break;
      case 'green':
        confidence = (h >= 75 && h <= 165 ? 0.9 : 0.3) * (s > 80 ? 0.9 : s / 89) * (v > 80 ? 0.9 : v / 89);
        break;
      case 'blue':
        // Enhanced blue confidence with better yellow separation
        let blueConfidence = 0;
        if (h >= 200 && h <= 280 && s > 80 && v > 80) {
          blueConfidence += 0.3;
        }
        if (b > 120 && b > r * 1.4 && b > g * 1.4) {
          blueConfidence += 0.3;
        }
        if (b > (r + g) / 2 * 1.3) {
          blueConfidence += 0.2;
        }
        if (b_lab < -25) {
          blueConfidence += 0.2;
        }
        confidence = Math.min(1.0, blueConfidence);
        break;
      default:
        confidence = 0;
    }
    
    return confidence;
  };

  // Validate and correct color confusion (white/yellow, orange/red)
  const validateColorConfusion = (colors) => {
    if (!Array.isArray(colors) || colors.length === 0) return colors;
    
    const correctedColors = [...colors];
    const colorCounts = {};
    
    // Count colors
    correctedColors.flat().forEach(color => {
      if (color !== 'unknown') {
        colorCounts[color] = (colorCounts[color] || 0) + 1;
      }
    });
    
    // Check for white vs yellow confusion
    const hasWhite = colorCounts.white > 0;
    const hasYellow = colorCounts.yellow > 0;
    
    if (hasWhite && hasYellow) {
      // If we have both white and yellow, check for impossible patterns
      // White should typically appear in corners or edges, yellow in center
      const whitePositions = [];
      const yellowPositions = [];
      
      correctedColors.forEach((row, rowIndex) => {
        row.forEach((color, colIndex) => {
          if (color === 'white') {
            whitePositions.push({ row: rowIndex, col: colIndex });
          } else if (color === 'yellow') {
            yellowPositions.push({ row: rowIndex, col: colIndex });
          }
        });
      });
      
      // If yellow appears in center and white in corners, likely correct
      // If white appears in center and yellow in corners, likely swapped
      const yellowInCenter = yellowPositions.some(pos => pos.row === 1 && pos.col === 1);
      const whiteInCenter = whitePositions.some(pos => pos.row === 1 && pos.col === 1);
      
      if (whiteInCenter && !yellowInCenter) {
        // Swap white and yellow
        correctedColors.forEach((row, rowIndex) => {
          row.forEach((color, colIndex) => {
            if (color === 'white') {
              correctedColors[rowIndex][colIndex] = 'yellow';
            } else if (color === 'yellow') {
              correctedColors[rowIndex][colIndex] = 'white';
            }
          });
        });
      }
    }
    
    // Check for orange vs red confusion - more aggressive correction
    const hasOrange = colorCounts.orange > 0;
    const hasRed = colorCounts.red > 0;
    
    if (hasOrange && hasRed) {
      console.log('Orange vs Red confusion detected. Attempting correction...');
      
      // If we have both orange and red, and orange appears more than red,
      // some orange might actually be red
      if (colorCounts.orange > colorCounts.red) {
        correctedColors.forEach((row, rowIndex) => {
          row.forEach((color, colIndex) => {
            if (color === 'orange') {
              // Check if this position is likely to be red based on typical cube patterns
              // Red squares are often on edges or corners
              const isEdgeOrCorner = (rowIndex === 0 || rowIndex === 2 || colIndex === 0 || colIndex === 2);
              if (isEdgeOrCorner && colorCounts.orange > 2) {
                correctedColors[rowIndex][colIndex] = 'red';
                console.log(`Corrected orange to red at position [${rowIndex}][${colIndex}]`);
              }
            }
          });
        });
      }
    }
    
    return correctedColors;
  };

  // Color validation specifically for blue/yellow confusion
  const validateBlueYellowConfusion = (colors) => {
    if (!Array.isArray(colors) || colors.length === 0) return colors;
    
    const colorCounts = {};
    colors.flat().forEach(color => {
      colorCounts[color] = (colorCounts[color] || 0) + 1;
    });
    
    // Check for blue/yellow confusion patterns
    const blueCount = colorCounts['blue'] || 0;
    const yellowCount = colorCounts['yellow'] || 0;
    
    // If we have too many yellows and few blues, some might be misdetected
    if (yellowCount > 4 && blueCount < 2) {
      console.log('Potential blue/yellow confusion detected. Attempting correction...');
      
      // Look for yellow squares that might actually be blue
      for (let i = 0; i < colors.length; i++) {
        for (let j = 0; j < colors[i].length; j++) {
          if (colors[i][j] === 'yellow') {
            // Check if this position is likely to be blue based on typical cube patterns
            // Blue squares are often on edges or corners
            const isEdgeOrCorner = (i === 0 || i === 2 || j === 0 || j === 2);
            if (isEdgeOrCorner && yellowCount > 4) {
              colors[i][j] = 'blue';
              console.log(`Corrected yellow to blue at position [${i}][${j}]`);
            }
          }
        }
      }
    }
    
    // If we have too many blues and few yellows, some might be misdetected
    if (blueCount > 4 && yellowCount < 2) {
      console.log('Potential blue/yellow confusion detected. Attempting correction...');
      
      // Look for blue squares that might actually be yellow
      for (let i = 0; i < colors.length; i++) {
        for (let j = 0; j < colors[i].length; j++) {
          if (colors[i][j] === 'blue') {
            // Check if this position is likely to be yellow based on typical cube patterns
            // Yellow squares are often in the center or middle positions
            const isCenterOrMiddle = (i === 1 || j === 1);
            if (isCenterOrMiddle && blueCount > 4) {
              colors[i][j] = 'yellow';
              console.log(`Corrected blue to yellow at position [${i}][${j}]`);
            }
          }
        }
      }
    }
    
    return colors;
  };

  // Color calibration system that learns from the environment
  const calibrateColorsFromEnvironment = (ctx, gridBounds) => {
    if (!gridBounds) return null;
    
    const { x, y, width: gridWidth, height: gridHeight } = gridBounds;
    const samples = [];
    
    // Sample multiple points in the grid area to understand lighting
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 5; j++) {
        const sampleX = x + (i * gridWidth / 4);
        const sampleY = y + (j * gridHeight / 4);
        
        if (sampleX >= 0 && sampleX < ctx.canvas.width && sampleY >= 0 && sampleY < ctx.canvas.height) {
          try {
            const imageData = ctx.getImageData(sampleX, sampleY, 1, 1).data;
            samples.push({
              r: imageData[0],
              g: imageData[1],
              b: imageData[2]
            });
          } catch (error) {
            // Skip invalid samples
          }
        }
      }
    }
    
    if (samples.length === 0) return null;
    
    // Calculate average lighting conditions
    const avgR = samples.reduce((sum, s) => sum + s.r, 0) / samples.length;
    const avgG = samples.reduce((sum, s) => sum + s.g, 0) / samples.length;
    const avgB = samples.reduce((sum, s) => sum + s.b, 0) / samples.length;
    const avgBrightness = (avgR + avgG + avgB) / 3;
    
    // Calculate color balance
    const colorBalance = {
      r: avgR / avgBrightness,
      g: avgG / avgBrightness,
      b: avgB / avgBrightness
    };
    
    // Store calibration data
    setCalibrationData({
      avgBrightness,
      colorBalance,
      samples: samples.length,
      timestamp: Date.now()
    });
    
    return { avgBrightness, colorBalance };
  };

  // Apply color calibration to improve detection
  const applyColorCalibration = (r, g, b) => {
    if (!calibrationData) return { r, g, b };
    
    const { avgBrightness, colorBalance } = calibrationData;
    
    // Adjust colors based on calibration
    const adjustedR = Math.min(255, Math.max(0, r / colorBalance.r));
    const adjustedG = Math.min(255, Math.max(0, g / colorBalance.g));
    const adjustedB = Math.min(255, Math.max(0, b / colorBalance.b));
    
    return { r: adjustedR, g: adjustedG, b: adjustedB };
  };

  // Revolutionary color detection with machine learning-inspired approach
  const detectColorRevolutionary = (r, g, b) => {
    const [h, s, v] = rgbToHsv(r, g, b);
    const [l, a, b_lab] = rgbToLab(r, g, b);
    
    // Calculate color scores using multiple advanced techniques
    const colorScores = {
      white: 0,
      red: 0,
      orange: 0,
      yellow: 0,
      green: 0,
      blue: 0
    };
    
    // Technique 1: Advanced HSV with better boundaries
    // White - More lenient criteria to fix white detection
    if (v > 180 && s < 60 && Math.abs(r - g) < 40 && Math.abs(g - b) < 40 && Math.abs(r - b) < 40) {
      colorScores.white += 3.5; // Higher score for white
    }
    
    // Red - Very restrictive red detection to avoid orange confusion
    if ((h < 8 || h > 352) && s > 120 && v > 80 && r > g * 1.8 && r > b * 1.8 && g < 80) {
      colorScores.red += 2.5;
    }
    
    // Orange - Very specific orange detection with strict differentiation from red
    if (h >= 15 && h <= 40 && s > 100 && v > 80 && r > g && g > b && r > 100 && r - g < 50 && g > 80) {
      colorScores.orange += 2.5;
    }
    
    // Yellow - More lenient to avoid white confusion
    if (h >= 45 && h <= 75 && s > 80 && v > 150 && r > 120 && g > 120 && b < 120 && Math.abs(r - g) < 50) {
      colorScores.yellow += 2.0; // Lower score to prioritize white
    }
    
    // Green - Strict green range
    if (h >= 80 && h <= 160 && s > 80 && v > 80 && g > r * 1.4 && g > b * 1.4) {
      colorScores.green += 2.5;
    }
    
    // Blue - Very strict to avoid yellow confusion
    if (h >= 210 && h <= 270 && s > 80 && v > 80 && b > r * 1.4 && b > g * 1.4 && b > 100) {
      colorScores.blue += 3.0;
    }
    
    // Technique 2: RGB ratio analysis
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;
    const avg = (r + g + b) / 3;
    
    // White - More lenient RGB criteria
    if (avg > 160 && diff < 60 && r > 140 && g > 140 && b > 140) {
      colorScores.white += 2.5; // Higher score for white
    }
    
    // Red - Very restrictive RGB criteria
    if (r > 130 && r > g * 1.8 && r > b * 1.8 && g < 80 && b < 80) {
      colorScores.red += 2.0;
    }
    
    // Orange - Very specific RGB criteria
    if (r > 120 && g > 80 && b < 80 && r > g && g > b && r - g < 50 && g > 80) {
      colorScores.orange += 2.0;
    }
    
    // Yellow - More lenient RGB criteria
    if (r > 120 && g > 120 && b < 120 && Math.abs(r - g) < 60) {
      colorScores.yellow += 1.5; // Lower score to prioritize white
    }
    
    // Green - Strict RGB criteria
    if (g > 130 && g > r * 1.4 && g > b * 1.4 && r < 120 && b < 120) {
      colorScores.green += 2.0;
    }
    
    // Blue - Very strict RGB criteria
    if (b > 130 && b > r * 1.4 && b > g * 1.4 && r < 120 && g < 120) {
      colorScores.blue += 2.5;
    }
    
    // Technique 3: LAB color space analysis
    // White - More lenient LAB criteria
    if (l > 70 && Math.abs(a) < 25 && Math.abs(b) < 25) {
      colorScores.white += 2.5; // Higher score for white
    }
    
    // Red - More restrictive LAB criteria
    if (a > 35 && l > 45 && b < 15) {
      colorScores.red += 2.0;
    }
    
    // Orange - More specific LAB criteria
    if (a > 20 && b > 20 && l > 55 && a < 40) {
      colorScores.orange += 2.0;
    }
    
    // Yellow - More lenient LAB criteria
    if (b > 25 && Math.abs(a) < 30 && l > 60 && b < 60) {
      colorScores.yellow += 1.5; // Lower score to prioritize white
    }
    
    // Green - Strict LAB criteria
    if (a < -20 && l > 45 && b > 5) {
      colorScores.green += 2.0;
    }
    
    // Blue - Very strict LAB criteria
    if (b < -25 && l > 45 && a < -5) {
      colorScores.blue += 2.5;
    }
    
    // Technique 4: Color distance analysis with better reference colors
    const referenceColors = {
      white: { r: 255, g: 255, b: 255 },
      red: { r: 255, g: 0, b: 0 },
      orange: { r: 255, g: 165, b: 0 },
      yellow: { r: 255, g: 255, b: 0 },
      green: { r: 0, g: 255, b: 0 },
      blue: { r: 0, g: 0, b: 255 }
    };
    
    for (const [color, ref] of Object.entries(referenceColors)) {
      const distance = Math.sqrt(
        Math.pow(r - ref.r, 2) + 
        Math.pow(g - ref.g, 2) + 
        Math.pow(b - ref.b, 2)
      );
      
      // Normalize distance to score (closer = higher score)
      const score = Math.max(0, 1 - (distance / 250)); // More lenient distance
      colorScores[color] += score * 1.5;
    }
    
    // Special handling for white vs yellow confusion
    if (colorScores.white > 0 && colorScores.yellow > 0) {
      // If both white and yellow are detected, prioritize white for high brightness
      const avg = (r + g + b) / 3;
      if (avg > 180) {
        colorScores.white += 1.0; // Boost white score
        colorScores.yellow -= 0.5; // Reduce yellow score
      }
    }
    
    // Find the color with the highest score
    let bestColor = 'unknown';
    let bestScore = 0;
    
    for (const [color, score] of Object.entries(colorScores)) {
      if (score > bestScore) {
        bestScore = score;
        bestColor = color;
      }
    }
    
    // Lower threshold for better detection
    return bestScore > 1.5 ? bestColor : 'unknown';
  };

  // Revolutionary confidence calculation for better accuracy
  const getColorConfidenceRevolutionary = (color, r, g, b) => {
    if (color === 'unknown') return 0;
    
    const [h, s, v] = rgbToHsv(r, g, b);
    const [l, a, b_lab] = rgbToLab(r, g, b);
    
    // Calculate confidence using multiple techniques
    let confidence = 0;
    
    switch (color) {
      case 'white':
        // More lenient criteria for white
        if (v > 180 && s < 60) confidence += 0.3;
        if (Math.abs(r - g) < 40 && Math.abs(g - b) < 40 && Math.abs(r - b) < 40) confidence += 0.3;
        if (r > 140 && g > 140 && b > 140) confidence += 0.2;
        if (l > 70 && Math.abs(a) < 25 && Math.abs(b) < 25) confidence += 0.2;
        
        // Special boost for high brightness white
        const avg = (r + g + b) / 3;
        if (avg > 180) confidence += 0.1;
        break;
        
      case 'red':
        // Multiple criteria for red
        if ((h < 15 || h > 345) && s > 80 && v > 80) confidence += 0.3;
        if (r > g * 1.4 && r > b * 1.4) confidence += 0.3;
        if (r > 130 && g < 120 && b < 120) confidence += 0.2;
        if (a > 30 && l > 45) confidence += 0.2;
        break;
        
      case 'orange':
        // Better criteria for orange
        if (h >= 15 && h <= 45 && s > 80 && v > 80) confidence += 0.3;
        if (r > g && g > b && r > 100) confidence += 0.3;
        if (r > 120 && g > 70 && b < 90) confidence += 0.2;
        if (a > 20 && b > 20 && l > 55) confidence += 0.2;
        
        // Special boost for clear orange (not red)
        if (h >= 15 && h <= 45 && (r - g) < 80) confidence += 0.1;
        break;
        
      case 'yellow':
        // More lenient criteria for yellow
        if (h >= 45 && h <= 75 && s > 80 && v > 150) confidence += 0.3;
        if (r > 120 && g > 120 && b < 120 && Math.abs(r - g) < 60) confidence += 0.3;
        if (r > 120 && g > 120 && b < 120) confidence += 0.2;
        if (b > 25 && Math.abs(a) < 30 && l > 60) confidence += 0.2;
        break;
        
      case 'green':
        // Multiple criteria for green
        if (h >= 80 && h <= 160 && s > 80 && v > 80) confidence += 0.3;
        if (g > r * 1.4 && g > b * 1.4) confidence += 0.3;
        if (g > 130 && r < 120 && b < 120) confidence += 0.2;
        if (a < -20 && l > 45) confidence += 0.2;
        break;
        
      case 'blue':
        // Multiple criteria for blue
        if (h >= 210 && h <= 270 && s > 80 && v > 80) confidence += 0.3;
        if (b > r * 1.4 && b > g * 1.4 && b > 100) confidence += 0.3;
        if (b > 130 && r < 120 && g < 120) confidence += 0.2;
        if (b < -25 && l > 45) confidence += 0.2;
        break;
        
      default:
        confidence = 0;
    }
    
    // Boost confidence for high-quality detections
    if (confidence > 0.7) {
      confidence = Math.min(1.0, confidence * 1.15);
    }
    
    return Math.min(1.0, confidence);
  };

  // Revolutionary alignment calculation for better accuracy
  const calculateAlignmentScore = (validDetections, totalConfidence, colors) => {
    if (!Array.isArray(colors) || colors.length === 0) return 0;
    
    // Base alignment from valid detections
    const detectionScore = (validDetections / 9) * 60; // Up to 60 points
    
    // Confidence score
    const confidenceScore = Math.min(30, (totalConfidence / 9) * 30); // Up to 30 points
    
    // Color distribution score (bonus for good color distribution)
    const colorCounts = {};
    colors.flat().forEach(color => {
      if (color !== 'unknown') {
        colorCounts[color] = (colorCounts[color] || 0) + 1;
      }
    });
    
    const uniqueColors = Object.keys(colorCounts).length;
    const distributionScore = Math.min(10, uniqueColors * 2); // Up to 10 points for good distribution
    
    // Calculate total alignment score
    const totalScore = detectionScore + confidenceScore + distributionScore;
    
    return Math.min(100, Math.round(totalScore));
  };

  return (
    <div className="cube-recognition">
      <div className="recognition-header">
        <h3>🎯 Cube Face Recognition</h3>
        <div className="quality-indicator">
          <span className={`quality-dot ${cubeDetected ? (alignmentScore > 80 ? 'good' : alignmentScore > 50 ? 'medium' : 'poor') : 'poor'}`}></span>
          <span>
            {cubeDetected ? `Alignment: ${Math.round(alignmentScore)}%` : 'Initializing Detection...'}
          </span>
        </div>
      </div>

      {processingError && (
        <div className="error-message">
          <p>⚠️ {processingError}</p>
        </div>
      )}

      <div className="camera-container">
        <div className="webcam-wrapper">
                <canvas
        ref={canvasRef}
        width="480"
        height="480"
        className="recognition-canvas"
      />
        </div>
        
        <div className="save-controls">
          <button
            onClick={handleSave}
            disabled={!isFaceValid() || isProcessing}
            className={`save-face-button ${isFaceValid() ? 'valid' : 'invalid'}`}
          >
            {isProcessing ? '⏳ Processing...' : '💾 Save Face'}
          </button>
          
          {isFaceValid() && (
            <div className="save-status">
              <span className="status-indicator">✅ Ready to Save</span>
              <span className="detection-count">
                Colors Detected: {faceColors.flat().filter(c => c !== 'unknown').length}/9
              </span>
            </div>
          )}
          
          {!isFaceValid() && cubeDetected && (
            <div className="validation-message">
              <p>⚠️ Please improve alignment - need {Math.round(80 - alignmentScore)}% better alignment</p>
            </div>
          )}
        </div>
      </div>

              {debugMode && (
          <div className="debug-info">
            <h4>🐛 Debug Information:</h4>
            <div className="debug-grid">
              <div className="debug-item">
                <strong>Alignment Score:</strong> {Math.round(alignmentScore)}%
              </div>
              <div className="debug-item">
                <strong>Colors Detected:</strong> {faceColors.flat().filter(c => c !== 'unknown').length}/9
              </div>
              <div className="debug-item">
                <strong>Cube Detected:</strong> {cubeDetected ? 'Yes' : 'No'}
              </div>
              <div className="debug-item">
                <strong>Face Valid:</strong> {isFaceValid() ? 'Yes' : 'No'}
              </div>
            </div>
            <div className="color-debug">
              <h5>Color Analysis:</h5>
              {faceColors.map((row, rowIndex) => (
                <div key={rowIndex} className="color-row">
                  {row.map((color, colIndex) => (
                    <span key={colIndex} className={`color-debug-item ${color}`}>
                      {color.substring(0, 1).toUpperCase()}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {colorCalibration && (
          <div className="calibration-info">
            <h4>🎨 Color Calibration Mode:</h4>
            <div className="calibration-tips">
              <p><strong>For best results:</strong></p>
              <ul>
                <li>Ensure good lighting (natural light preferred)</li>
                <li>Hold the cube steady and centered</li>
                <li>Avoid shadows and reflections</li>
                <li>Keep the cube face parallel to camera</li>
                <li>Use debug mode to see RGB values</li>
              </ul>
              {calibrationData && (
                <div className="calibration-data">
                  <p><strong>Calibration Data:</strong></p>
                  <p>Center RGB: ({calibrationData.r}, {calibrationData.g}, {calibrationData.b})</p>
                  <p>HSV: ({Math.round(rgbToHsv(calibrationData.r, calibrationData.g, calibrationData.b)[0])}, 
                       {Math.round(rgbToHsv(calibrationData.r, calibrationData.g, calibrationData.b)[1])}, 
                       {Math.round(rgbToHsv(calibrationData.r, calibrationData.g, calibrationData.b)[2])})</p>
                </div>
              )}
            </div>
          </div>
        )}

      <div className="control-buttons">
        <button onClick={toggleMirror} className="mirror-button">
          {mirrorMode ? '🔄 Mirror: ON' : '🔄 Mirror: OFF'}
        </button>
        <button onClick={toggleDebug} className="debug-button">
          {debugMode ? '🐛 Debug: ON' : '🐛 Debug: OFF'}
        </button>
        <button onClick={() => setColorCalibration(!colorCalibration)} className="calibration-button">
          {colorCalibration ? '🎨 Calibration: ON' : '🎨 Calibration: OFF'}
        </button>
        <button onClick={() => {
          if (calibrationData) {
            setCalibrationData(null);
          } else {
            calibrateColors();
          }
        }} className="capture-calibration-button">
          {calibrationData ? '🔄 Reset Calibration' : '📸 Capture Center'}
        </button>
        <button onClick={() => {
          if (canvasRef.current && cubeBounds) {
            const ctx = canvasRef.current.getContext('2d');
            calibrateColorsFromEnvironment(ctx, cubeBounds);
          }
        }} className="environment-calibration-button">
          🎨 Calibrate Environment
        </button>
        <button onClick={() => {
          // Auto-calibrate and improve detection
          if (canvasRef.current && cubeBounds) {
            const ctx = canvasRef.current.getContext('2d');
            calibrateColorsFromEnvironment(ctx, cubeBounds);
            // Force a re-analysis
            setTimeout(() => {
              if (videoRef?.current?.video) {
                processFrame();
              }
            }, 100);
          }
        }} className="auto-improve-button">
          🚀 Auto-Improve Detection
        </button>
        <button onClick={() => {
          // Reset OpenCV loading state and retry
          opencvFailed = false;
          opencvLoadingPromise = null;
          opencvLoaded = false;
          opencvInitialized = false;
          setOpencvError(null);
          setOpencvReady(false);
          // Trigger reload
          const script = document.querySelector('script[src*="opencv.js"]');
          if (script) {
            script.remove();
          }
          // Reload the component to trigger OpenCV loading
          window.location.reload();
        }} className="retry-opencv-button">
          🔄 Retry OpenCV
        </button>
        <div className="opencv-status">
          {opencvReady ? '✅ OpenCV Ready' : '⏳ Loading OpenCV...'}
          {opencvError && (
            <div className="error-message">
              ⚠️ {opencvError}
            </div>
          )}
          {processingError && (
            <div className="error-message">
              ⚠️ Processing Error: {processingError}
            </div>
          )}
          <div className="performance-stats">
            <div>FPS: {performanceStats.fps}</div>
            <div>Processing: {performanceStats.processingTime}ms</div>
            <div>Frames: {performanceStats.frameCount}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

const getColorHex = (color) => {
  const colorMap = {
    white: '#ffffff',
    red: '#ff0000',
    green: '#00ff00',
    blue: '#0000ff',
    yellow: '#ffff00',
    orange: '#ff8c00',
    unknown: '#666666'
  };
  return colorMap[color] || '#666666';
};

export default CubeRecognition; 