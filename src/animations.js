// src/animations.js
// Animation system for Rubik's Cube face rotations

import * as THREE from 'three';

// Face constants
export const Faces = Object.freeze({
  RIGHT: "R",
  LEFT: "L", 
  UP: "U",
  DOWN: "D",
  FRONT: "F",
  BACK: "B"
});

// Animation status tracking
const faceAnimationStatus = {
  [Faces.RIGHT]: false,
  [Faces.LEFT]: false,
  [Faces.UP]: false,
  [Faces.DOWN]: false,
  [Faces.FRONT]: false,
  [Faces.BACK]: false,
};

// Animation configuration
const ANIMATION_CONFIG = {
  duration: 800, // Increased to 800ms for smoother animation
  easing: 'cubic-bezier(0.4, 0.0, 0.2, 1)', // Smooth easing
  rotationAngle: Math.PI / 2, // 90 degrees
};

// Animation callbacks
let animationCallbacks = {
  onStart: null,
  onComplete: null,
  onUpdate: null,
  onStateChange: null
};

// Current animation state
let currentAnimation = {
  face: null,
  startTime: 0,
  isAnimating: false,
  clockwise: true,
  angle: Math.PI / 2
};

// Initialize animation system
export function initAnimations(callbacks = {}) {
  animationCallbacks = { ...animationCallbacks, ...callbacks };
  console.log('🎬 Animation system initialized');
}

// Get rotation axis for each face
function getRotationAxis(face) {
  const axes = {
    [Faces.RIGHT]: new THREE.Vector3(1, 0, 0),   // X-axis
    [Faces.LEFT]: new THREE.Vector3(-1, 0, 0),   // Negative X-axis
    [Faces.UP]: new THREE.Vector3(0, 1, 0),      // Y-axis
    [Faces.DOWN]: new THREE.Vector3(0, -1, 0),   // Negative Y-axis
    [Faces.FRONT]: new THREE.Vector3(0, 0, 1),   // Z-axis
    [Faces.BACK]: new THREE.Vector3(0, 0, -1),   // Negative Z-axis
  };
  return axes[face];
}

// Get affected cube positions for each face
function getAffectedCubes(face) {
  const positions = [];
  
  // Generate all 27 cube positions
  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        positions.push([x, y, z]);
      }
    }
  }
  
  // Filter positions based on face
  switch (face) {
    case Faces.RIGHT:
      return positions.filter(([x]) => x === 1);
    case Faces.LEFT:
      return positions.filter(([x]) => x === -1);
    case Faces.UP:
      return positions.filter(([, y]) => y === 1);
    case Faces.DOWN:
      return positions.filter(([, y]) => y === -1);
    case Faces.FRONT:
      return positions.filter(([, , z]) => z === 1);
    case Faces.BACK:
      return positions.filter(([, , z]) => z === -1);
    default:
      return [];
  }
}

// Easing function for smooth animation
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Parse move notation (e.g., "R", "R'", "R2")
function parseMove(move) {
  const face = move.charAt(0);
  const modifier = move.substring(1);
  
  let clockwise = true;
  let angle = Math.PI / 2; // 90 degrees
  
  if (modifier === "'") {
    clockwise = false;
    angle = -Math.PI / 2;
  } else if (modifier === "2") {
    clockwise = true;
    angle = Math.PI; // 180 degrees
  }
  
  return { face, clockwise, angle };
}

// Apply a move to the cube state (actual cube transformation)
export function applyMoveToCubeState(cubeState, move) {
  const { face, clockwise, angle } = parseMove(move);
  const newState = JSON.parse(JSON.stringify(cubeState));
  
  console.log(`🔄 Applying move: ${move} (${clockwise ? 'clockwise' : 'counter-clockwise'})`);
  
  // Apply the move transformation based on face
  switch (face) {
    case 'F': // Front face
      rotateFrontFace(newState, clockwise);
      break;
    case 'B': // Back face
      rotateBackFace(newState, clockwise);
      break;
    case 'R': // Right face
      rotateRightFace(newState, clockwise);
      break;
    case 'L': // Left face
      rotateLeftFace(newState, clockwise);
      break;
    case 'U': // Up face
      rotateUpFace(newState, clockwise);
      break;
    case 'D': // Down face
      rotateDownFace(newState, clockwise);
      break;
  }
  
  return newState;
}

// Rotate front face (Z = 1)
function rotateFrontFace(cubeState, clockwise) {
  // Rotate the front face itself
  const frontFace = cubeState.front.colors;
  const rotated = rotate2DArray(frontFace, clockwise);
  cubeState.front.colors = rotated;
  
  // Rotate the adjacent edges
  if (clockwise) {
    // Save top edge
    const topEdge = [
      cubeState.up.colors[2][0],
      cubeState.up.colors[2][1],
      cubeState.up.colors[2][2]
    ];
    
    // Move left edge to top
    cubeState.up.colors[2][0] = cubeState.left.colors[0][2];
    cubeState.up.colors[2][1] = cubeState.left.colors[1][2];
    cubeState.up.colors[2][2] = cubeState.left.colors[2][2];
    
    // Move bottom edge to left
    cubeState.left.colors[0][2] = cubeState.down.colors[0][2];
    cubeState.left.colors[1][2] = cubeState.down.colors[0][1];
    cubeState.left.colors[2][2] = cubeState.down.colors[0][0];
    
    // Move right edge to bottom
    cubeState.down.colors[0][0] = cubeState.right.colors[2][0];
    cubeState.down.colors[0][1] = cubeState.right.colors[1][0];
    cubeState.down.colors[0][2] = cubeState.right.colors[0][0];
    
    // Move top edge to right
    cubeState.right.colors[0][0] = topEdge[0];
    cubeState.right.colors[1][0] = topEdge[1];
    cubeState.right.colors[2][0] = topEdge[2];
  } else {
    // Counter-clockwise rotation
    const topEdge = [
      cubeState.up.colors[2][0],
      cubeState.up.colors[2][1],
      cubeState.up.colors[2][2]
    ];
    
    // Move right edge to top
    cubeState.up.colors[2][0] = cubeState.right.colors[0][0];
    cubeState.up.colors[2][1] = cubeState.right.colors[1][0];
    cubeState.up.colors[2][2] = cubeState.right.colors[2][0];
    
    // Move bottom edge to right
    cubeState.right.colors[0][0] = cubeState.down.colors[0][2];
    cubeState.right.colors[1][0] = cubeState.down.colors[0][1];
    cubeState.right.colors[2][0] = cubeState.down.colors[0][0];
    
    // Move left edge to bottom
    cubeState.down.colors[0][0] = cubeState.left.colors[2][2];
    cubeState.down.colors[0][1] = cubeState.left.colors[1][2];
    cubeState.down.colors[0][2] = cubeState.left.colors[0][2];
    
    // Move top edge to left
    cubeState.left.colors[0][2] = topEdge[0];
    cubeState.left.colors[1][2] = topEdge[1];
    cubeState.left.colors[2][2] = topEdge[2];
  }
}

// Rotate back face (Z = -1)
function rotateBackFace(cubeState, clockwise) {
  // Rotate the back face itself
  const backFace = cubeState.back.colors;
  const rotated = rotate2DArray(backFace, clockwise);
  cubeState.back.colors = rotated;
  
  // Rotate the adjacent edges (opposite direction from front)
  if (clockwise) {
    const topEdge = [
      cubeState.up.colors[0][0],
      cubeState.up.colors[0][1],
      cubeState.up.colors[0][2]
    ];
    
    // Move right edge to top
    cubeState.up.colors[0][0] = cubeState.right.colors[0][2];
    cubeState.up.colors[0][1] = cubeState.right.colors[1][2];
    cubeState.up.colors[0][2] = cubeState.right.colors[2][2];
    
    // Move bottom edge to right
    cubeState.right.colors[0][2] = cubeState.down.colors[2][2];
    cubeState.right.colors[1][2] = cubeState.down.colors[2][1];
    cubeState.right.colors[2][2] = cubeState.down.colors[2][0];
    
    // Move left edge to bottom
    cubeState.down.colors[2][0] = cubeState.left.colors[2][0];
    cubeState.down.colors[2][1] = cubeState.left.colors[1][0];
    cubeState.down.colors[2][2] = cubeState.left.colors[0][0];
    
    // Move top edge to left
    cubeState.left.colors[0][0] = topEdge[2];
    cubeState.left.colors[1][0] = topEdge[1];
    cubeState.left.colors[2][0] = topEdge[0];
  } else {
    const topEdge = [
      cubeState.up.colors[0][0],
      cubeState.up.colors[0][1],
      cubeState.up.colors[0][2]
    ];
    
    // Move left edge to top
    cubeState.up.colors[0][0] = cubeState.left.colors[2][0];
    cubeState.up.colors[0][1] = cubeState.left.colors[1][0];
    cubeState.up.colors[0][2] = cubeState.left.colors[0][0];
    
    // Move bottom edge to left
    cubeState.left.colors[0][0] = cubeState.down.colors[2][0];
    cubeState.left.colors[1][0] = cubeState.down.colors[2][1];
    cubeState.left.colors[2][0] = cubeState.down.colors[2][2];
    
    // Move right edge to bottom
    cubeState.down.colors[2][0] = cubeState.right.colors[2][2];
    cubeState.down.colors[2][1] = cubeState.right.colors[1][2];
    cubeState.down.colors[2][2] = cubeState.right.colors[0][2];
    
    // Move top edge to right
    cubeState.right.colors[0][2] = topEdge[0];
    cubeState.right.colors[1][2] = topEdge[1];
    cubeState.right.colors[2][2] = topEdge[2];
  }
}

// Rotate right face (X = 1)
function rotateRightFace(cubeState, clockwise) {
  // Rotate the right face itself
  const rightFace = cubeState.right.colors;
  const rotated = rotate2DArray(rightFace, clockwise);
  cubeState.right.colors = rotated;
  
  // Rotate the adjacent edges
  if (clockwise) {
    const topEdge = [
      cubeState.up.colors[0][2],
      cubeState.up.colors[1][2],
      cubeState.up.colors[2][2]
    ];
    
    // Move front edge to top
    cubeState.up.colors[0][2] = cubeState.front.colors[0][2];
    cubeState.up.colors[1][2] = cubeState.front.colors[1][2];
    cubeState.up.colors[2][2] = cubeState.front.colors[2][2];
    
    // Move bottom edge to front
    cubeState.front.colors[0][2] = cubeState.down.colors[0][2];
    cubeState.front.colors[1][2] = cubeState.down.colors[1][2];
    cubeState.front.colors[2][2] = cubeState.down.colors[2][2];
    
    // Move back edge to bottom
    cubeState.down.colors[0][2] = cubeState.back.colors[2][0];
    cubeState.down.colors[1][2] = cubeState.back.colors[1][0];
    cubeState.down.colors[2][2] = cubeState.back.colors[0][0];
    
    // Move top edge to back
    cubeState.back.colors[0][0] = topEdge[2];
    cubeState.back.colors[1][0] = topEdge[1];
    cubeState.back.colors[2][0] = topEdge[0];
  } else {
    const topEdge = [
      cubeState.up.colors[0][2],
      cubeState.up.colors[1][2],
      cubeState.up.colors[2][2]
    ];
    
    // Move back edge to top
    cubeState.up.colors[0][2] = cubeState.back.colors[2][0];
    cubeState.up.colors[1][2] = cubeState.back.colors[1][0];
    cubeState.up.colors[2][2] = cubeState.back.colors[0][0];
    
    // Move bottom edge to back
    cubeState.back.colors[0][0] = cubeState.down.colors[2][2];
    cubeState.back.colors[1][0] = cubeState.down.colors[1][2];
    cubeState.back.colors[2][0] = cubeState.down.colors[0][2];
    
    // Move front edge to bottom
    cubeState.down.colors[0][2] = cubeState.front.colors[0][2];
    cubeState.down.colors[1][2] = cubeState.front.colors[1][2];
    cubeState.down.colors[2][2] = cubeState.front.colors[2][2];
    
    // Move top edge to front
    cubeState.front.colors[0][2] = topEdge[0];
    cubeState.front.colors[1][2] = topEdge[1];
    cubeState.front.colors[2][2] = topEdge[2];
  }
}

// Rotate left face (X = -1)
function rotateLeftFace(cubeState, clockwise) {
  // Rotate the left face itself
  const leftFace = cubeState.left.colors;
  const rotated = rotate2DArray(leftFace, clockwise);
  cubeState.left.colors = rotated;
  
  // Rotate the adjacent edges (opposite direction from right)
  if (clockwise) {
    const topEdge = [
      cubeState.up.colors[0][0],
      cubeState.up.colors[1][0],
      cubeState.up.colors[2][0]
    ];
    
    // Move back edge to top
    cubeState.up.colors[0][0] = cubeState.back.colors[2][2];
    cubeState.up.colors[1][0] = cubeState.back.colors[1][2];
    cubeState.up.colors[2][0] = cubeState.back.colors[0][2];
    
    // Move bottom edge to back
    cubeState.back.colors[0][2] = cubeState.down.colors[2][0];
    cubeState.back.colors[1][2] = cubeState.down.colors[1][0];
    cubeState.back.colors[2][2] = cubeState.down.colors[0][0];
    
    // Move front edge to bottom
    cubeState.down.colors[0][0] = cubeState.front.colors[0][0];
    cubeState.down.colors[1][0] = cubeState.front.colors[1][0];
    cubeState.down.colors[2][0] = cubeState.front.colors[2][0];
    
    // Move top edge to front
    cubeState.front.colors[0][0] = topEdge[0];
    cubeState.front.colors[1][0] = topEdge[1];
    cubeState.front.colors[2][0] = topEdge[2];
  } else {
    const topEdge = [
      cubeState.up.colors[0][0],
      cubeState.up.colors[1][0],
      cubeState.up.colors[2][0]
    ];
    
    // Move front edge to top
    cubeState.up.colors[0][0] = cubeState.front.colors[0][0];
    cubeState.up.colors[1][0] = cubeState.front.colors[1][0];
    cubeState.up.colors[2][0] = cubeState.front.colors[2][0];
    
    // Move bottom edge to front
    cubeState.front.colors[0][0] = cubeState.down.colors[0][0];
    cubeState.front.colors[1][0] = cubeState.down.colors[1][0];
    cubeState.front.colors[2][0] = cubeState.down.colors[2][0];
    
    // Move back edge to bottom
    cubeState.down.colors[0][0] = cubeState.back.colors[2][2];
    cubeState.down.colors[1][0] = cubeState.back.colors[1][2];
    cubeState.down.colors[2][0] = cubeState.back.colors[0][2];
    
    // Move top edge to back
    cubeState.back.colors[0][2] = topEdge[2];
    cubeState.back.colors[1][2] = topEdge[1];
    cubeState.back.colors[2][2] = topEdge[0];
  }
}

// Rotate up face (Y = 1)
function rotateUpFace(cubeState, clockwise) {
  // Rotate the up face itself
  const upFace = cubeState.up.colors;
  const rotated = rotate2DArray(upFace, clockwise);
  cubeState.up.colors = rotated;
  
  // Rotate the adjacent edges
  if (clockwise) {
    const frontEdge = [
      cubeState.front.colors[0][0],
      cubeState.front.colors[0][1],
      cubeState.front.colors[0][2]
    ];
    
    // Move left edge to front
    cubeState.front.colors[0][0] = cubeState.left.colors[0][0];
    cubeState.front.colors[0][1] = cubeState.left.colors[0][1];
    cubeState.front.colors[0][2] = cubeState.left.colors[0][2];
    
    // Move back edge to left
    cubeState.left.colors[0][0] = cubeState.back.colors[0][0];
    cubeState.left.colors[0][1] = cubeState.back.colors[0][1];
    cubeState.left.colors[0][2] = cubeState.back.colors[0][2];
    
    // Move right edge to back
    cubeState.back.colors[0][0] = cubeState.right.colors[0][0];
    cubeState.back.colors[0][1] = cubeState.right.colors[0][1];
    cubeState.back.colors[0][2] = cubeState.right.colors[0][2];
    
    // Move front edge to right
    cubeState.right.colors[0][0] = frontEdge[0];
    cubeState.right.colors[0][1] = frontEdge[1];
    cubeState.right.colors[0][2] = frontEdge[2];
  } else {
    const frontEdge = [
      cubeState.front.colors[0][0],
      cubeState.front.colors[0][1],
      cubeState.front.colors[0][2]
    ];
    
    // Move right edge to front
    cubeState.front.colors[0][0] = cubeState.right.colors[0][0];
    cubeState.front.colors[0][1] = cubeState.right.colors[0][1];
    cubeState.front.colors[0][2] = cubeState.right.colors[0][2];
    
    // Move back edge to right
    cubeState.right.colors[0][0] = cubeState.back.colors[0][0];
    cubeState.right.colors[0][1] = cubeState.back.colors[0][1];
    cubeState.right.colors[0][2] = cubeState.back.colors[0][2];
    
    // Move left edge to back
    cubeState.back.colors[0][0] = cubeState.left.colors[0][0];
    cubeState.back.colors[0][1] = cubeState.left.colors[0][1];
    cubeState.back.colors[0][2] = cubeState.left.colors[0][2];
    
    // Move front edge to left
    cubeState.left.colors[0][0] = frontEdge[0];
    cubeState.left.colors[0][1] = frontEdge[1];
    cubeState.left.colors[0][2] = frontEdge[2];
  }
}

// Rotate down face (Y = -1)
function rotateDownFace(cubeState, clockwise) {
  // Rotate the down face itself
  const downFace = cubeState.down.colors;
  const rotated = rotate2DArray(downFace, clockwise);
  cubeState.down.colors = rotated;
  
  // Rotate the adjacent edges (opposite direction from up)
  if (clockwise) {
    const frontEdge = [
      cubeState.front.colors[2][0],
      cubeState.front.colors[2][1],
      cubeState.front.colors[2][2]
    ];
    
    // Move right edge to front
    cubeState.front.colors[2][0] = cubeState.right.colors[2][0];
    cubeState.front.colors[2][1] = cubeState.right.colors[2][1];
    cubeState.front.colors[2][2] = cubeState.right.colors[2][2];
    
    // Move back edge to right
    cubeState.right.colors[2][0] = cubeState.back.colors[2][0];
    cubeState.right.colors[2][1] = cubeState.back.colors[2][1];
    cubeState.right.colors[2][2] = cubeState.back.colors[2][2];
    
    // Move left edge to back
    cubeState.back.colors[2][0] = cubeState.left.colors[2][0];
    cubeState.back.colors[2][1] = cubeState.left.colors[2][1];
    cubeState.back.colors[2][2] = cubeState.left.colors[2][2];
    
    // Move front edge to left
    cubeState.left.colors[2][0] = frontEdge[0];
    cubeState.left.colors[2][1] = frontEdge[1];
    cubeState.left.colors[2][2] = frontEdge[2];
  } else {
    const frontEdge = [
      cubeState.front.colors[2][0],
      cubeState.front.colors[2][1],
      cubeState.front.colors[2][2]
    ];
    
    // Move left edge to front
    cubeState.front.colors[2][0] = cubeState.left.colors[2][0];
    cubeState.front.colors[2][1] = cubeState.left.colors[2][1];
    cubeState.front.colors[2][2] = cubeState.left.colors[2][2];
    
    // Move back edge to left
    cubeState.left.colors[2][0] = cubeState.back.colors[2][0];
    cubeState.left.colors[2][1] = cubeState.back.colors[2][1];
    cubeState.left.colors[2][2] = cubeState.back.colors[2][2];
    
    // Move right edge to back
    cubeState.back.colors[2][0] = cubeState.right.colors[2][0];
    cubeState.back.colors[2][1] = cubeState.right.colors[2][1];
    cubeState.back.colors[2][2] = cubeState.right.colors[2][2];
    
    // Move front edge to right
    cubeState.right.colors[2][0] = frontEdge[0];
    cubeState.right.colors[2][1] = frontEdge[1];
    cubeState.right.colors[2][2] = frontEdge[2];
  }
}

// Helper function to rotate a 2D array (face)
function rotate2DArray(array, clockwise) {
  const n = array.length;
  const rotated = Array(n).fill().map(() => Array(n).fill(null));
  
  if (clockwise) {
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        rotated[j][n - 1 - i] = array[i][j];
      }
    }
  } else {
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        rotated[n - 1 - j][i] = array[i][j];
      }
    }
  }
  
  return rotated;
}

// Main animation function
export function animate(face, moveNotation = null) {
  if (faceAnimationStatus[face]) {
    console.log(`⚠️ Animation already running for face ${face}`);
    return false;
  }
  
  // Parse move if provided
  let moveData = { face, clockwise: true, angle: Math.PI / 2 };
  if (moveNotation) {
    moveData = parseMove(moveNotation);
  }
  
  // Start animation
  faceAnimationStatus[face] = true;
  currentAnimation = {
    face: moveData.face,
    startTime: Date.now(),
    isAnimating: true,
    clockwise: moveData.clockwise,
    angle: moveData.angle
  };
  
  console.log(`🎬 Starting animation for ${moveData.face} face: ${moveData.clockwise ? 'clockwise' : 'counter-clockwise'}`);
  
  // Call start callback
  if (animationCallbacks.onStart) {
    animationCallbacks.onStart(moveData);
  }
  
  return true;
}

// Update animation (call this in render loop)
export function updateAnimations() {
  if (!currentAnimation.isAnimating) return;
  
  const now = Date.now();
  const elapsed = now - currentAnimation.startTime;
  const progress = Math.min(elapsed / ANIMATION_CONFIG.duration, 1);
  
  // Apply easing
  const easedProgress = easeInOutCubic(progress);
  const currentAngle = currentAnimation.angle * easedProgress;
  
  // Call update callback with current animation state
  if (animationCallbacks.onUpdate) {
    animationCallbacks.onUpdate({
      face: currentAnimation.face,
      angle: currentAngle,
      progress: easedProgress,
      isComplete: progress >= 1
    });
  }
  
  // Check if animation is complete
  if (progress >= 1) {
    // Animation complete
    faceAnimationStatus[currentAnimation.face] = false;
    currentAnimation.isAnimating = false;
    
    console.log(`✅ Animation complete for ${currentAnimation.face} face`);
    
    // Call complete callback
    if (animationCallbacks.onComplete) {
      animationCallbacks.onComplete(currentAnimation.face);
    }
  }
}

// Stop all animations
export function stopAllAnimations() {
  Object.keys(faceAnimationStatus).forEach(face => {
    faceAnimationStatus[face] = false;
  });
  currentAnimation.isAnimating = false;
  console.log('⏹️ All animations stopped');
}

// Check if any animation is running
export function isAnimating() {
  return currentAnimation.isAnimating;
}

// Get current animation state
export function getCurrentAnimation() {
  return { ...currentAnimation };
}

// Get affected cubes for a face
export function getAffectedCubesForFace(face) {
  return getAffectedCubes(face);
}

// Get rotation axis for a face
export function getRotationAxisForFace(face) {
  return getRotationAxis(face);
}

// Execute a sequence of moves with animations
export function executeMoveSequence(cubeState, moves, onMoveComplete = null) {
  let currentIndex = 0;
  
  function executeNextMove() {
    if (currentIndex >= moves.length) {
      console.log('✅ Move sequence complete');
      if (onMoveComplete) onMoveComplete(cubeState);
      return;
    }
    
    const move = moves[currentIndex];
    console.log(`🔄 Executing move ${currentIndex + 1}/${moves.length}: ${move}`);
    
    // Apply the move to cube state
    const newState = applyMoveToCubeState(cubeState, move);
    
    // Start animation
    animate(move.charAt(0), move);
    
    // Wait for animation to complete before next move
    const checkAnimation = setInterval(() => {
      if (!isAnimating()) {
        clearInterval(checkAnimation);
        currentIndex++;
        executeNextMove();
      }
    }, 50);
  }
  
  executeNextMove();
}