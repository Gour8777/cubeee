import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

// Enhanced CubePiece component with proper multi-face colors
const CubePiece = ({ position, colors, isAnimating, rotationAxis, rotationAngle, onFaceClick, size = 0.9 }) => {
  const meshRef = useRef();
  
  // Ensure we have 6 colors (one for each face)
  const ensureSixColors = (colorsArray) => {
    const defaultColors = ['red', 'orange', 'white', 'yellow', 'green', 'blue'];
    const result = [...(colorsArray || [])];
    while (result.length < 6) {
      result.push(defaultColors[result.length] || 'gray');
    }
    return result;
  };

  const faceColors = ensureSixColors(colors);
  
  // Log color changes for debugging
  useEffect(() => {
    console.log('🎨 CubePiece colors updated:', { position, faceColors });
  }, [faceColors, position]);

  const getColorHex = (color) => {
    const colorMap = {
      white: '#FFFFFF',
      red: '#FF0000',
      green: '#00FF00',
      blue: '#0000FF',
      yellow: '#FFFF00',
      orange: '#FFA500',
      gray: '#666666'
    };
    return colorMap[color] || '#666666';
  };

  const handleFaceClick = (faceName, event) => {
    if (event && event.stopPropagation) {
      event.stopPropagation();
    }
    if (onFaceClick) {
      onFaceClick(faceName, position);
    }
  };

  // Create a proper multi-face cubelet with individual face colors
  return (
    <group ref={meshRef} position={position} scale={[size, size, size]}>
      {/* Front face (Z positive) */}
      <mesh position={[0, 0, 0.475]} onClick={(e) => handleFaceClick('front', e)}>
        <planeGeometry args={[0.9, 0.9]} />
        <meshStandardMaterial 
          color={getColorHex(faceColors[0])} // Front face
          roughness={0.3}
          metalness={0.1}
        />
      </mesh>
      
      {/* Back face (Z negative) */}
      <mesh position={[0, 0, -0.475]} rotation={[0, Math.PI, 0]} onClick={(e) => handleFaceClick('back', e)}>
        <planeGeometry args={[0.9, 0.9]} />
        <meshStandardMaterial 
          color={getColorHex(faceColors[1])} // Back face
          roughness={0.3}
          metalness={0.1}
        />
      </mesh>
      
      {/* Right face (X positive) */}
      <mesh position={[0.475, 0, 0]} rotation={[0, Math.PI / 2, 0]} onClick={(e) => handleFaceClick('right', e)}>
        <planeGeometry args={[0.9, 0.9]} />
        <meshStandardMaterial 
          color={getColorHex(faceColors[2])} // Right face
          roughness={0.3}
          metalness={0.1}
        />
      </mesh>
      
      {/* Left face (X negative) */}
      <mesh position={[-0.475, 0, 0]} rotation={[0, -Math.PI / 2, 0]} onClick={(e) => handleFaceClick('left', e)}>
        <planeGeometry args={[0.9, 0.9]} />
        <meshStandardMaterial 
          color={getColorHex(faceColors[3])} // Left face
          roughness={0.3}
          metalness={0.1}
        />
      </mesh>
      
      {/* Top face (Y positive) */}
      <mesh position={[0, 0.475, 0]} rotation={[-Math.PI / 2, 0, 0]} onClick={(e) => handleFaceClick('up', e)}>
        <planeGeometry args={[0.9, 0.9]} />
        <meshStandardMaterial 
          color={getColorHex(faceColors[4])} // Up face
          roughness={0.3}
          metalness={0.1}
        />
      </mesh>
      
      {/* Bottom face (Y negative) */}
      <mesh position={[0, -0.475, 0]} rotation={[Math.PI / 2, 0, 0]} onClick={(e) => handleFaceClick('down', e)}>
        <planeGeometry args={[0.9, 0.9]} />
        <meshStandardMaterial 
          color={getColorHex(faceColors[5])} // Down face
          roughness={0.3}
          metalness={0.1}
        />
      </mesh>
    </group>
  );
};

// Enhanced RubiksCube component with proper color mapping
const RubiksCube = ({ cubeData, onFaceClick, currentMove, animationSpeed = 1, onAnimationComplete }) => {
  const cubeRef = useRef();
  const animationRef = useRef({
    isAnimating: false,
    rotationAngle: 0,
    targetAngle: 0,
    rotationAxis: new THREE.Vector3(0, 0, 1),
    affectedCubes: [],
    startTime: 0,
    duration: 800, // Animation duration in ms
  });

  // Force re-render when cubeData changes
  useEffect(() => {
    console.log('🔄 RubiksCube received new data:', cubeData);
  }, [cubeData]);

  // Enhanced coordinate mapping system for proper face orientation
  const getFaceMapping = (x, y, z, faceName) => {
    // Define the correct mapping for each face based on standard Rubik's Cube orientation
    const mappings = {
      front: {
        // Front face (z = 1): standard orientation
        '[-1,1,1]': [0, 0],   // top-left
        '[0,1,1]': [0, 1],    // top-center  
        '[1,1,1]': [0, 2],    // top-right
        '[-1,0,1]': [1, 0],   // middle-left
        '[0,0,1]': [1, 1],    // center
        '[1,0,1]': [1, 2],    // middle-right
        '[-1,-1,1]': [2, 0],  // bottom-left
        '[0,-1,1]': [2, 1],   // bottom-center
        '[1,-1,1]': [2, 2]    // bottom-right
      },
      back: {
        // Back face (z = -1): opposite orientation
        '[-1,1,-1]': [0, 2],  // top-left (but right side from back view)
        '[0,1,-1]': [0, 1],   // top-center
        '[1,1,-1]': [0, 0],   // top-right (but left side from back view)
        '[-1,0,-1]': [1, 2],  // middle-left
        '[0,0,-1]': [1, 1],   // center
        '[1,0,-1]': [1, 0],   // middle-right
        '[-1,-1,-1]': [2, 2], // bottom-left
        '[0,-1,-1]': [2, 1],  // bottom-center
        '[1,-1,-1]': [2, 0]   // bottom-right
      },
      right: {
        // Right face (x = 1): viewed from right side - accounting for mirror mode
        '[1,1,-1]': [0, 2],   // top-left (mirrored to top-right)
        '[1,1,0]': [0, 1],    // top-center
        '[1,1,1]': [0, 0],    // top-right (mirrored to top-left)
        '[1,0,-1]': [1, 2],   // middle-left (mirrored to middle-right)
        '[1,0,0]': [1, 1],    // center
        '[1,0,1]': [1, 0],    // middle-right (mirrored to middle-left)
        '[1,-1,-1]': [2, 2],  // bottom-left (mirrored to bottom-right)
        '[1,-1,0]': [2, 1],   // bottom-center
        '[1,-1,1]': [2, 0]    // bottom-right (mirrored to bottom-left)
      },
      left: {
        // Left face (x = -1): viewed from left side - accounting for mirror mode
        '[-1,1,1]': [0, 2],   // top-left (mirrored to top-right)
        '[-1,1,0]': [0, 1],   // top-center
        '[-1,1,-1]': [0, 0],  // top-right (mirrored to top-left)
        '[-1,0,1]': [1, 2],   // middle-left (mirrored to middle-right)
        '[-1,0,0]': [1, 1],   // center
        '[-1,0,-1]': [1, 0],  // middle-right (mirrored to middle-left)
        '[-1,-1,1]': [2, 2],  // bottom-left (mirrored to bottom-right)
        '[-1,-1,0]': [2, 1],  // bottom-center
        '[-1,-1,-1]': [2, 0]  // bottom-right (mirrored to bottom-left)
      },
      up: {
        // Up face (y = 1): viewed from top - accounting for mirror mode
        '[-1,1,-1]': [0, 2],  // top-left (mirrored to top-right)
        '[0,1,-1]': [0, 1],   // top-center
        '[1,1,-1]': [0, 0],   // top-right (mirrored to top-left)
        '[-1,1,0]': [1, 2],   // middle-left (mirrored to middle-right)
        '[0,1,0]': [1, 1],    // center
        '[1,1,0]': [1, 0],    // middle-right (mirrored to middle-left)
        '[-1,1,1]': [2, 2],   // bottom-left (mirrored to bottom-right)
        '[0,1,1]': [2, 1],    // bottom-center
        '[1,1,1]': [2, 0]     // bottom-right (mirrored to bottom-left)
      },
      down: {
        // Down face (y = -1): viewed from bottom - accounting for mirror mode
        '[-1,-1,1]': [0, 2],  // top-left (mirrored to top-right)
        '[0,-1,1]': [0, 1],   // top-center
        '[1,-1,1]': [0, 0],   // top-right (mirrored to top-left)
        '[-1,-1,0]': [1, 2],  // middle-left (mirrored to middle-right)
        '[0,-1,0]': [1, 1],   // center
        '[1,-1,0]': [1, 0],   // middle-right (mirrored to middle-left)
        '[-1,-1,-1]': [2, 2], // bottom-left (mirrored to bottom-right)
        '[0,-1,-1]': [2, 1],  // bottom-center
        '[1,-1,-1]': [2, 0]   // bottom-right (mirrored to bottom-left)
      }
    };
    
    const faceMapping = mappings[faceName];
    if (!faceMapping) {
      return { row: 0, col: 0 };
    }
    
    const positionKey = `[${x},${y},${z}]`;
    const gridCoords = faceMapping[positionKey];
    
    if (gridCoords) {
      return { row: gridCoords[0], col: gridCoords[1] };
    }
    
    return { row: 0, col: 0 };
  };

  // Create positions for 3x3x3 cube
  const positions = [];
  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        positions.push([x, y, z]);
      }
    }
  }

  // Enhanced function to get colors for each cube piece based on position
  const getCubePieceColors = (x, y, z) => {
    const colors = [];
    
    // Helper function to get face colors
    const getFaceColors = (faceData) => {
      if (!faceData) return null;
      if (faceData.colors && Array.isArray(faceData.colors)) {
        return faceData.colors;
      }
      if (Array.isArray(faceData)) {
        return faceData;
      }
      return null;
    };

    // Get color for specific position on a face
    const getFaceColor = (faceName, faceData, x, y, z) => {
      const colors = getFaceColors(faceData);
      if (!colors) return null;
      
      const { row, col } = getFaceMapping(x, y, z, faceName);
      
      // Ensure row and col are within bounds
      if (row >= 0 && row < colors.length && col >= 0 && col < colors[row].length) {
        const color = colors[row][col];
        if (color && color !== 'unknown' && color !== null) {
          return color;
        }
      }
      
      return null;
    };

    // Map colors for each face in the correct order: [front, back, right, left, up, down]
    
    // Front face (z = 1)
    colors.push(getFaceColor('front', cubeData.front, x, y, z));

    // Back face (z = -1)
    colors.push(getFaceColor('back', cubeData.back, x, y, z));

    // Right face (x = 1)
    colors.push(getFaceColor('right', cubeData.right, x, y, z));

    // Left face (x = -1)
    colors.push(getFaceColor('left', cubeData.left, x, y, z));

    // Up face (y = 1)
    colors.push(getFaceColor('up', cubeData.up, x, y, z));

    // Down face (y = -1)
    colors.push(getFaceColor('down', cubeData.down, x, y, z));

    return colors;
  };

  // Handle move animations
  useEffect(() => {
    if (currentMove && !animationRef.current.isAnimating) {
      const { face, direction } = currentMove;
      animationRef.current.isAnimating = true;
      animationRef.current.rotationAngle = 0;
      animationRef.current.targetAngle = direction === 1 ? Math.PI / 2 : -Math.PI / 2;
      animationRef.current.startTime = Date.now();
      
      // Define rotation axis and affected cubes based on face
      switch (face) {
        case 'F': // Front
          animationRef.current.rotationAxis = new THREE.Vector3(0, 0, 1);
          animationRef.current.affectedCubes = positions
            .map((pos, index) => ({ pos, index }))
            .filter(({ pos }) => pos[2] === 1)
            .map(({ index }) => index);
          break;
        case 'B': // Back
          animationRef.current.rotationAxis = new THREE.Vector3(0, 0, -1);
          animationRef.current.affectedCubes = positions
            .map((pos, index) => ({ pos, index }))
            .filter(({ pos }) => pos[2] === -1)
            .map(({ index }) => index);
          break;
        case 'R': // Right
          animationRef.current.rotationAxis = new THREE.Vector3(1, 0, 0);
          animationRef.current.affectedCubes = positions
            .map((pos, index) => ({ pos, index }))
            .filter(({ pos }) => pos[0] === 1)
            .map(({ index }) => index);
          break;
        case 'L': // Left
          animationRef.current.rotationAxis = new THREE.Vector3(-1, 0, 0);
          animationRef.current.affectedCubes = positions
            .map((pos, index) => ({ pos, index }))
            .filter(({ pos }) => pos[0] === -1)
            .map(({ index }) => index);
          break;
        case 'U': // Up
          animationRef.current.rotationAxis = new THREE.Vector3(0, 1, 0);
          animationRef.current.affectedCubes = positions
            .map((pos, index) => ({ pos, index }))
            .filter(({ pos }) => pos[1] === 1)
            .map(({ index }) => index);
          break;
        case 'D': // Down
          animationRef.current.rotationAxis = new THREE.Vector3(0, -1, 0);
          animationRef.current.affectedCubes = positions
            .map((pos, index) => ({ pos, index }))
            .filter(({ pos }) => pos[1] === -1)
            .map(({ index }) => index);
          break;
      }
    }
  }, [currentMove]);

  // Animation update loop
  useFrame(() => {
    if (animationRef.current.isAnimating) {
      const now = Date.now();
      const elapsed = now - animationRef.current.startTime;
      const progress = Math.min(elapsed / animationRef.current.duration, 1);
      
      // Easing function for smooth animation
      const easedProgress = progress < 0.5 
        ? 2 * progress * progress 
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      
      animationRef.current.rotationAngle = animationRef.current.targetAngle * easedProgress;
      
      // Check if animation is complete
      if (progress >= 1) {
        animationRef.current.isAnimating = false;
        console.log('✅ Animation complete');
        
        // Notify parent component that animation is complete
        if (onAnimationComplete) {
          onAnimationComplete();
        }
      }
    }
  });

  // Debug function to visualize coordinate mapping
  const debugFaceMapping = () => {
    console.log('🔍 Debugging face mapping...');
    
    const testPositions = [
      [-1, -1, 1], [-1, 0, 1], [-1, 1, 1],
      [0, -1, 1], [0, 0, 1], [0, 1, 1],
      [1, -1, 1], [1, 0, 1], [1, 1, 1]
    ];
    
    const faceNames = ['front', 'back', 'right', 'left', 'up', 'down'];
    
    faceNames.forEach(faceName => {
      console.log(`\n📋 ${faceName.toUpperCase()} face mapping:`);
      testPositions.forEach(([x, y, z], index) => {
        const { row, col } = getFaceMapping(x, y, z, faceName);
        console.log(`  3D[${x},${y},${z}] -> Grid[${row}][${col}]`);
      });
    });
  };

  return (
    <group ref={cubeRef}>
      {positions.map((position, index) => {
        const isAffected = animationRef.current.affectedCubes.includes(index);
        const colors = getCubePieceColors(...position);
        
        return (
          <CubePiece
            key={`cube-piece-${index}-${JSON.stringify(colors)}`}
            position={position}
            colors={colors}
            isAnimating={isAffected && animationRef.current.isAnimating}
            rotationAxis={animationRef.current.rotationAxis}
            rotationAngle={animationRef.current.rotationAngle}
            onFaceClick={onFaceClick}
            size={0.9}
          />
        );
      })}
    </group>
  );
};

// Enhanced CubeControls component


// Main VirtualCube component
const VirtualCube = forwardRef(({ cubeData, onColorChange, currentMove: externalCurrentMove }, ref) => {
  const [localCubeData, setLocalCubeData] = useState(cubeData || {});
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [showColorPalette, setShowColorPalette] = useState(false);
  const [forceUpdate, setForceUpdate] = useState(0);
  
  // Animation states
  const [isScrambling, setIsScrambling] = useState(false);
  const [isSolving, setIsSolving] = useState(false);
  const [animationSpeed, setAnimationSpeed] = useState(1);
  const [solvingMoves, setSolvingMoves] = useState([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [currentMove, setCurrentMove] = useState(null);
  
  // Animation completion callback
  const [animationCompleteCallback, setAnimationCompleteCallback] = useState(null);

  // Color palette
  const colorPalette = [
    { name: 'white', hex: '#FFFFFF', label: 'White' },
    { name: 'red', hex: '#FF0000', label: 'Red' },
    { name: 'green', hex: '#00FF00', label: 'Green' },
    { name: 'blue', hex: '#0000FF', label: 'Blue' },
    { name: 'yellow', hex: '#FFFF00', label: 'Yellow' },
    { name: 'orange', hex: '#FFA500', label: 'Orange' }
  ];

  // Update local data when prop changes
  useEffect(() => {
    if (cubeData) {
      setLocalCubeData(cubeData);
      console.log('Camera data received for 3D cube:', {
        front: cubeData.front?.colors?.length,
        back: cubeData.back?.colors?.length,
        up: cubeData.up?.colors?.length,
        down: cubeData.down?.colors?.length,
        left: cubeData.left?.colors?.length,
        right: cubeData.right?.colors?.length
      });
    } else {
      // Add some sample data for testing if no cube data exists
      const sampleData = {
        front: { colors: [['red', 'red', 'red'], ['red', 'red', 'red'], ['red', 'red', 'red']] },
        back: { colors: [['orange', 'orange', 'orange'], ['orange', 'orange', 'orange'], ['orange', 'orange', 'orange']] },
        up: { colors: [['white', 'white', 'white'], ['white', 'white', 'white'], ['white', 'white', 'white']] },
        down: { colors: [['yellow', 'yellow', 'yellow'], ['yellow', 'yellow', 'yellow'], ['yellow', 'yellow', 'yellow']] },
        left: { colors: [['green', 'green', 'green'], ['green', 'green', 'green'], ['green', 'green', 'green']] },
        right: { colors: [['blue', 'blue', 'blue'], ['blue', 'blue', 'blue'], ['blue', 'blue', 'blue']] }
      };
      setLocalCubeData(sampleData);
      console.log('Using sample data for testing');
    }
  }, [cubeData]);

  // Force re-render when local data changes
  useEffect(() => {
    console.log('🔄 Local cube data updated:', localCubeData);
  }, [localCubeData]);

  // Helper functions
  const getFaceColors = (faceData) => {
    if (!faceData) return null;
    if (faceData.colors && Array.isArray(faceData.colors)) {
      return faceData.colors;
    }
    if (Array.isArray(faceData)) {
      return faceData;
    }
    return null;
  };

  const getColorHex = (color) => {
    const colorMap = {
      white: '#FFFFFF',
      red: '#FF0000',
      green: '#00FF00',
      blue: '#0000FF',
      yellow: '#FFFF00',
      orange: '#FFA500',
      gray: '#666666'
    };
    return colorMap[color] || '#666666';
  };

  // Direct mapping system for Rubik's Cube faces
  const getDirectFaceMapping = (x, y, z, faceName) => {
    // Create a direct lookup table for each face
    // This maps each 3D cube piece position to its exact 2D grid position
    
    const faceMappings = {
      front: {
        // Front face (z = 1): standard orientation
        '[-1,1,1]': [0, 0],   // top-left
        '[0,1,1]': [0, 1],    // top-center  
        '[1,1,1]': [0, 2],    // top-right
        '[-1,0,1]': [1, 0],   // middle-left
        '[0,0,1]': [1, 1],    // center
        '[1,0,1]': [1, 2],    // middle-right
        '[-1,-1,1]': [2, 0],  // bottom-left
        '[0,-1,1]': [2, 1],   // bottom-center
        '[1,-1,1]': [2, 2]    // bottom-right
      },
      back: {
        // Back face (z = -1): opposite orientation
        '[-1,1,-1]': [0, 2],  // top-left
        '[0,1,-1]': [0, 1],   // top-center
        '[1,1,-1]': [0, 0],   // top-right
        '[-1,0,-1]': [1, 2],  // middle-left
        '[0,0,-1]': [1, 1],   // center
        '[1,0,-1]': [1, 0],   // middle-right
        '[-1,-1,-1]': [2, 2], // bottom-left
        '[0,-1,-1]': [2, 1],  // bottom-center
        '[1,-1,-1]': [2, 0]   // bottom-right
      },
      right: {
        // Right face (x = 1): viewed from right side
        '[1,1,-1]': [0, 0],   // top-left
        '[1,1,0]': [0, 1],    // top-center
        '[1,1,1]': [0, 2],    // top-right
        '[1,0,-1]': [1, 0],   // middle-left
        '[1,0,0]': [1, 1],    // center
        '[1,0,1]': [1, 2],    // middle-right
        '[1,-1,-1]': [2, 0],  // bottom-left
        '[1,-1,0]': [2, 1],   // bottom-center
        '[1,-1,1]': [2, 2]    // bottom-right
      },
      left: {
        // Left face (x = -1): viewed from left side
        '[-1,1,1]': [0, 0],   // top-left
        '[-1,1,0]': [0, 1],   // top-center
        '[-1,1,-1]': [0, 2],  // top-right
        '[-1,0,1]': [1, 0],   // middle-left
        '[-1,0,0]': [1, 1],   // center
        '[-1,0,-1]': [1, 2],  // middle-right
        '[-1,-1,1]': [2, 0],  // bottom-left
        '[-1,-1,0]': [2, 1],  // bottom-center
        '[-1,-1,-1]': [2, 2]  // bottom-right
      },
      up: {
        // Up face (y = 1): viewed from top
        '[-1,1,-1]': [0, 0],  // top-left
        '[0,1,-1]': [0, 1],   // top-center
        '[1,1,-1]': [0, 2],   // top-right
        '[-1,1,0]': [1, 0],   // middle-left
        '[0,1,0]': [1, 1],    // center
        '[1,1,0]': [1, 2],    // middle-right
        '[-1,1,1]': [2, 0],   // bottom-left
        '[0,1,1]': [2, 1],    // bottom-center
        '[1,1,1]': [2, 2]     // bottom-right
      },
      down: {
        // Down face (y = -1): viewed from bottom
        '[-1,-1,1]': [0, 0],  // top-left
        '[0,-1,1]': [0, 1],   // top-center
        '[1,-1,1]': [0, 2],   // top-right
        '[-1,-1,0]': [1, 0],  // middle-left
        '[0,-1,0]': [1, 1],   // center
        '[1,-1,0]': [1, 2],   // middle-right
        '[-1,-1,-1]': [2, 0], // bottom-left
        '[0,-1,-1]': [2, 1],  // bottom-center
        '[1,-1,-1]': [2, 2]   // bottom-right
      }
    };
    
    // Get the mapping for the specific face
    const faceMapping = faceMappings[faceName];
    if (!faceMapping) {
      console.log(`❌ No mapping found for face: ${faceName}`);
      return { row: 0, col: 0 };
    }
    
    // Create the position key
    const positionKey = `[${x},${y},${z}]`;
    
    // Get the grid coordinates for this 3D position
    const gridCoords = faceMapping[positionKey];
    if (gridCoords) {
      console.log(`✅ Mapped ${faceName}: 3D${positionKey} -> Grid[${gridCoords[0]}][${gridCoords[1]}]`);
      return { row: gridCoords[0], col: gridCoords[1] };
    }
    
    console.log(`❌ No mapping found for ${faceName}: 3D${positionKey}`);
    return { row: 0, col: 0 };
  };

  // Capture sequence guide for proper Rubik's Cube mapping
  const getCaptureSequenceGuide = () => {
    return {
      sequence: [
        {
          step: 1,
          face: 'front',
          instruction: 'Show the front face of your cube (any face you choose as front)',
          rotation: 'No rotation needed'
        },
        {
          step: 2,
          face: 'right',
          instruction: 'Rotate the cube 90° clockwise around the Y-axis (turn right)',
          rotation: 'Y-axis clockwise'
        },
        {
          step: 3,
          face: 'back',
          instruction: 'Rotate the cube 90° clockwise around the Y-axis again',
          rotation: 'Y-axis clockwise'
        },
        {
          step: 4,
          face: 'left',
          instruction: 'Rotate the cube 90° clockwise around the Y-axis again',
          rotation: 'Y-axis clockwise'
        },
        {
          step: 5,
          face: 'up',
          instruction: 'Rotate the cube 90° clockwise around the X-axis (turn up)',
          rotation: 'X-axis clockwise'
        },
        {
          step: 6,
          face: 'down',
          instruction: 'Rotate the cube 90° clockwise around the X-axis again',
          rotation: 'X-axis clockwise'
        }
      ]
    };
  };

  // Enhanced coordinate mapping for 3D cube
  const getEnhancedCubePieceColors = (x, y, z) => {
    const colors = [];
    
    // Helper function to get face colors
    const getFaceColors = (faceData) => {
      if (!faceData) return null;
      if (faceData.colors && Array.isArray(faceData.colors)) {
        return faceData.colors;
      }
      if (Array.isArray(faceData)) {
        return faceData;
      }
      return null;
    };

    // Get color for specific position on a face using direct mapping
    const getFaceColor = (faceName, faceData, x, y, z) => {
      const colors = getFaceColors(faceData);
      if (!colors) return null;
      
      const { row, col } = getDirectFaceMapping(x, y, z, faceName);
      
      // Ensure row and col are within bounds
      if (row >= 0 && row < colors.length && col >= 0 && col < colors[row].length) {
        const color = colors[row][col];
        if (color && color !== 'unknown' && color !== null) {
          console.log(`🎨 Found color ${color} for ${faceName}[${row}][${col}]`);
          return color;
        }
      }
      
      console.log(`❌ No color found for ${faceName}[${row}][${col}]`);
      return null;
    };

    // Front face (z = 1) - User's chosen front face
    if (z === 1) {
      colors.push(getFaceColor('front', localCubeData.front, x, y, z));
    } else {
      colors.push(null);
    }

    // Back face (z = -1) - After rotating cube 180° around Y-axis
    if (z === -1) {
      colors.push(getFaceColor('back', localCubeData.back, x, y, z));
    } else {
      colors.push(null);
    }

    // Up face (y = 1) - After rotating cube 90° around X-axis
    if (y === 1) {
      colors.push(getFaceColor('up', localCubeData.up, x, y, z));
    } else {
      colors.push(null);
    }

    // Down face (y = -1) - After rotating cube 180° around X-axis
    if (y === -1) {
      colors.push(getFaceColor('down', localCubeData.down, x, y, z));
    } else {
      colors.push(null);
    }

    // Right face (x = 1) - After rotating cube 90° around Y-axis
    if (x === 1) {
      colors.push(getFaceColor('right', localCubeData.right, x, y, z));
    } else {
      colors.push(null);
    }

    // Left face (x = -1) - After rotating cube 270° around Y-axis
    if (x === -1) {
      colors.push(getFaceColor('left', localCubeData.left, x, y, z));
    } else {
      colors.push(null);
    }

    return colors;
  };

  const handleFaceClick = (faceName, position) => {
    setSelectedSquare({ faceName, position });
    setShowColorPalette(true);
  };

  const applyColorToSquare = (colorName) => {
    if (!selectedSquare) {
      console.log('❌ No selected square');
      return;
    }

    console.log(`🎨 Applying color ${colorName} to square:`, selectedSquare);

    const newCubeData = JSON.parse(JSON.stringify(localCubeData));
    
    // Ensure the face exists
    if (!newCubeData[selectedSquare.faceName]) {
      newCubeData[selectedSquare.faceName] = { 
        colors: Array(3).fill().map(() => Array(3).fill('unknown')) 
      };
      console.log(`📝 Created new face data for ${selectedSquare.faceName}`);
    }
    
    // Ensure colors array exists
    if (!newCubeData[selectedSquare.faceName].colors) {
      newCubeData[selectedSquare.faceName].colors = Array(3).fill().map(() => Array(3).fill('unknown'));
    }
    
    // Set color for the specific square that was clicked
    if (selectedSquare.rowIndex !== undefined && selectedSquare.colIndex !== undefined) {
      newCubeData[selectedSquare.faceName].colors[selectedSquare.rowIndex][selectedSquare.colIndex] = colorName;
      console.log(`✅ Applied color ${colorName} to ${selectedSquare.faceName}[${selectedSquare.rowIndex}][${selectedSquare.colIndex}]`);
      console.log(`📊 New face data:`, newCubeData[selectedSquare.faceName].colors);
    } else {
      // Fallback to center color (from 3D face click)
      newCubeData[selectedSquare.faceName].colors[1][1] = colorName;
      console.log(`✅ Applied color ${colorName} to ${selectedSquare.faceName} center`);
    }

    // Update state immediately
    setLocalCubeData(newCubeData);
    
    // Close modal and clear selection
    setShowColorPalette(false);
    setSelectedSquare(null);
    
    // Force re-render by incrementing force update
    setForceUpdate(prev => {
      const newValue = prev + 1;
      console.log(`🔄 Force update incremented to: ${newValue}`);
      return newValue;
    });
    
    // Notify parent component
    if (onColorChange) {
      console.log('📤 Notifying parent component of color change');
      onColorChange(newCubeData);
    }
    
    console.log('🎯 Color application complete. New cube data:', newCubeData);
  };

  const cancelColorSelection = () => {
    setShowColorPalette(false);
    setSelectedSquare(null);
  };

  // Cube control functions
  const handleScramble = () => {
    setIsScrambling(true);
    // Simulate scrambling
    setTimeout(() => {
      setIsScrambling(false);
    }, 2000);
  };

  const handleSolve = () => {
    setIsSolving(true);
    setSolvingMoves([
      { notation: 'R', face: 'R', direction: 1 },
      { notation: 'U', face: 'U', direction: 1 },
      { notation: 'R\'', face: 'R', direction: -1 },
      { notation: 'U\'', face: 'U', direction: -1 }
    ]);
    setCurrentMoveIndex(-1);
    
    // Simulate solving moves
    const moveInterval = setInterval(() => {
      setCurrentMoveIndex(prev => {
        const next = prev + 1;
        if (next < solvingMoves.length) {
          setCurrentMove(solvingMoves[next]);
          return next;
        } else {
          clearInterval(moveInterval);
          setIsSolving(false);
          setCurrentMove(null);
          return prev;
        }
      });
    }, 1000 / animationSpeed);
  };

  const handleReset = () => {
    setIsScrambling(false);
    setIsSolving(false);
    setSolvingMoves([]);
    setCurrentMoveIndex(-1);
    setCurrentMove(null);
  };

  const handleSpeedChange = (speed) => {
    setAnimationSpeed(speed);
  };

  // Save and sync faces to 3D cube
  const handleSaveFaces = () => {
    console.log('💾 Save button clicked - syncing faces to 3D cube');
    console.log('📊 Current localCubeData:', localCubeData);
    
    // Create a deep copy to ensure we're working with fresh data
    const updatedCubeData = JSON.parse(JSON.stringify(localCubeData));
    
    // Ensure all faces have proper color arrays and validate the data
    const faceNames = ['front', 'back', 'up', 'down', 'left', 'right'];
    faceNames.forEach(faceName => {
      if (!updatedCubeData[faceName]) {
        updatedCubeData[faceName] = { colors: Array(3).fill().map(() => Array(3).fill('unknown')) };
        console.log(`📝 Created new face data for ${faceName}`);
      } else if (!updatedCubeData[faceName].colors) {
        updatedCubeData[faceName].colors = Array(3).fill().map(() => Array(3).fill('unknown'));
        console.log(`📝 Created colors array for ${faceName}`);
      }
      
      // Validate the colors array structure
      if (updatedCubeData[faceName].colors) {
        for (let row = 0; row < 3; row++) {
          for (let col = 0; col < 3; col++) {
            if (!updatedCubeData[faceName].colors[row][col] || 
                updatedCubeData[faceName].colors[row][col] === 'unknown') {
              // Set a default color if none exists
              updatedCubeData[faceName].colors[row][col] = 'gray';
            }
          }
        }
        console.log(`✅ Validated ${faceName} face:`, updatedCubeData[faceName].colors);
      }
    });
    
    // Update the local state with the processed data
    setLocalCubeData(updatedCubeData);
    
    // Force a complete re-render of the 3D cube with multiple triggers
    setForceUpdate(prev => {
      const newValue = prev + 1;
      console.log(`🔄 Force update incremented to: ${newValue}`);
      return newValue;
    });
    
    // Notify parent component of the changes
    if (onColorChange) {
      console.log('📤 Notifying parent component of face sync');
      onColorChange(updatedCubeData);
    }
    
    console.log('✅ Faces synced to 3D cube:', updatedCubeData);
    
    // Add a small delay to ensure the state update is processed
    setTimeout(() => {
      console.log('🔄 Final state check - localCubeData:', localCubeData);
    }, 100);
  };

  // Test function to verify face mapping
  const testFaceMapping = () => {
    console.log('🧪 Testing face mapping...');
    
    const testCases = [
      { face: 'front', x: -1, y: 1, z: 1, expected: [0, 0] },
      { face: 'front', x: 0, y: 0, z: 1, expected: [1, 1] },
      { face: 'front', x: 1, y: -1, z: 1, expected: [2, 2] },
      { face: 'right', x: 1, y: 1, z: -1, expected: [0, 0] },
      { face: 'right', x: 1, y: 0, z: 0, expected: [1, 1] },
      { face: 'right', x: 1, y: -1, z: 1, expected: [2, 2] },
      { face: 'left', x: -1, y: 1, z: 1, expected: [0, 0] },
      { face: 'left', x: -1, y: 0, z: 0, expected: [1, 1] },
      { face: 'left', x: -1, y: -1, z: -1, expected: [2, 2] },
      { face: 'up', x: -1, y: 1, z: -1, expected: [0, 0] },
      { face: 'up', x: 0, y: 1, z: 0, expected: [1, 1] },
      { face: 'up', x: 1, y: 1, z: 1, expected: [2, 2] },
      { face: 'down', x: -1, y: -1, z: 1, expected: [0, 0] },
      { face: 'down', x: 0, y: -1, z: 0, expected: [1, 1] },
      { face: 'down', x: 1, y: -1, z: -1, expected: [2, 2] }
    ];
    
    testCases.forEach(test => {
      const result = getDirectFaceMapping(test.x, test.y, test.z, test.face);
      const expected = test.expected;
      const passed = result.row === expected[0] && result.col === expected[1];
      console.log(`${passed ? '✅' : '❌'} ${test.face}: [${test.x},${test.y},${test.z}] -> [${result.row},${result.col}] (expected: [${expected[0]},${expected[1]}])`);
    });
  };

  // Render face visual grid
  const renderFaceVisual = (faceData, faceName) => {
    const colors = getFaceColors(faceData);
    
    // Debug: Log the face data
    console.log(`🎨 Rendering ${faceName} face:`, { faceData, colors });
    
    // Always render a grid, even if no data
    return (
      <div 
        key={`face-grid-${faceName}-${forceUpdate}`}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '2px',
          width: '80px',
          height: '80px',
          border: '2px solid #666',
          borderRadius: '4px',
          padding: '2px',
          backgroundColor: '#333'
        }}
      >
        {Array(9).fill().map((_, index) => {
          const row = Math.floor(index / 3);
          const col = index % 3;
          const color = colors && colors[row] && colors[row][col] ? colors[row][col] : 'gray';
          
          // Check if this square is currently selected
          const isSelected = selectedSquare && 
            selectedSquare.faceName === faceName.toLowerCase() && 
            selectedSquare.rowIndex === row && 
            selectedSquare.colIndex === col;
          
          return (
            <div
              key={`${faceName}-${row}-${col}-${forceUpdate}-${color}`}
              style={{
                width: '20px',
                height: '20px',
                border: isSelected ? '2px solid #ff9800' : '1px solid #666',
                cursor: 'pointer',
                backgroundColor: getColorHex(color),
                borderRadius: '2px',
                boxShadow: isSelected ? '0 0 5px #ff9800' : 'none',
                transform: isSelected ? 'scale(1.1)' : 'scale(1)',
                transition: 'all 0.2s ease'
              }}
              onClick={() => {
                console.log(`🖱️ Clicked on ${faceName} face at position [${row}][${col}]`);
                setSelectedSquare({ faceName: faceName.toLowerCase(), rowIndex: row, colIndex: col });
                setShowColorPalette(true);
              }}
              title={`Click to change ${faceName} face color (currently: ${color})`}
            />
          );
        })}
      </div>
    );
  };

  const getFaceStats = (faceData) => {
    if (!faceData) return 'Not captured';
    const colors = getFaceColors(faceData);
    if (!colors) return 'No data';
    
    const validColors = colors.flat().filter(color => color && color !== 'unknown');
    return `${validColors.length}/9 squares`;
  };

  // Expose functions through ref
  useImperativeHandle(ref, () => ({
    executeMove: (move, onComplete = null) => {
      console.log(`🎯 VirtualCube.executeMove called with: ${move}`);
      // Parse the move and trigger animation
      const face = move.charAt(0);
      const direction = move.includes("'") ? -1 : 1;
      setCurrentMove({ face, direction });
      
      // Store the completion callback
      if (onComplete) {
        setAnimationCompleteCallback(() => onComplete);
      }
    },
    
    executeMoveSequence: (moves, onComplete = null) => {
      console.log(`🎯 VirtualCube.executeMoveSequence called with:`, moves);
      let currentIndex = 0;
      
      const executeNextMove = () => {
        if (currentIndex < moves.length) {
          const move = moves[currentIndex];
          const face = move.charAt(0);
          const direction = move.includes("'") ? -1 : 1;
          setCurrentMove({ face, direction });
          currentIndex++;
          
          // Schedule next move after animation completes
          setTimeout(executeNextMove, 1000);
        } else if (onComplete) {
          onComplete();
        }
      };
      
      executeNextMove();
    },
    
    stopAnimations: () => {
      console.log('⏹️ VirtualCube.stopAnimations called');
      setCurrentMove(null);
      if (animationCompleteCallback) {
        animationCompleteCallback();
        setAnimationCompleteCallback(null);
      }
    }
  }));

  // Handle animation completion
  useEffect(() => {
    if (animationCompleteCallback && !currentMove) {
      // Animation has completed, call the callback
      animationCompleteCallback();
      setAnimationCompleteCallback(null);
    }
  }, [currentMove, animationCompleteCallback]);

  return (
    <div className="virtual-cube-container">
      <div className="header">
        <h2>🎲 Virtual Rubik's Cube</h2>
        <p>3D representation of your captured cube with interactive controls</p>
      </div>

      <div className="content">
        {/* 3D Cube Canvas */}
        <div className="cube-canvas">
          <Canvas
            camera={{ position: [5, 5, 5], fov: 50 }}
            style={{ background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)' }}
          >
            <ambientLight intensity={0.6} />
            <directionalLight position={[10, 10, 5]} intensity={1} />
            <pointLight position={[-10, -10, -5]} intensity={0.5} />
            
            <RubiksCube 
              key={`rubiks-cube-${forceUpdate}-${JSON.stringify(localCubeData)}`}
              cubeData={localCubeData}
              onFaceClick={handleFaceClick}
              currentMove={currentMove}
              animationSpeed={animationSpeed}
              onAnimationComplete={() => {
                // Clear the current move to indicate animation is complete
                setCurrentMove(null);
              }}
            />
            
            {/* Subtle wireframe grid for reference */}
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[3.2, 3.2, 3.2]} />
              <meshBasicMaterial 
                color="#333333" 
                transparent={true} 
                opacity={0.1}
                wireframe={true}
              />
            </mesh>
            
            <OrbitControls 
              enablePan={true}
              enableZoom={true}
              enableRotate={true}
              autoRotate={false}
              autoRotateSpeed={0}
            />
          </Canvas>
          

        </div>

        {/* Controls and Debug Panel */}
        <div className="controls-panel">


          {/* Face Visualizations */}
          <div className="face-visualizations">
            <h3>📊 Captured Faces</h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '15px',
              padding: '10px'
            }}>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                padding: '10px',
                background: 'rgba(0, 0, 0, 0.2)',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                <span style={{ color: '#4fc3f7', fontWeight: '600', fontSize: '14px' }}>Front</span>
                {renderFaceVisual(localCubeData.front, 'Front')}
              </div>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                padding: '10px',
                background: 'rgba(0, 0, 0, 0.2)',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                <span style={{ color: '#4fc3f7', fontWeight: '600', fontSize: '14px' }}>Back</span>
                {renderFaceVisual(localCubeData.back, 'Back')}
              </div>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                padding: '10px',
                background: 'rgba(0, 0, 0, 0.2)',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                <span style={{ color: '#4fc3f7', fontWeight: '600', fontSize: '14px' }}>Up</span>
                {renderFaceVisual(localCubeData.up, 'Up')}
              </div>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                padding: '10px',
                background: 'rgba(0, 0, 0, 0.2)',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                <span style={{ color: '#4fc3f7', fontWeight: '600', fontSize: '14px' }}>Down</span>
                {renderFaceVisual(localCubeData.down, 'Down')}
              </div>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                padding: '10px',
                background: 'rgba(0, 0, 0, 0.2)',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                <span style={{ color: '#4fc3f7', fontWeight: '600', fontSize: '14px' }}>Left</span>
                {renderFaceVisual(localCubeData.left, 'Left')}
              </div>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                padding: '10px',
                background: 'rgba(0, 0, 0, 0.2)',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                <span style={{ color: '#4fc3f7', fontWeight: '600', fontSize: '14px' }}>Right</span>
                {renderFaceVisual(localCubeData.right, 'Right')}
              </div>
            </div>
            
            {/* Capture Sequence Guide */}
            <div style={{
              marginTop: '15px',
              padding: '15px',
              background: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <h4 style={{ color: '#4fc3f7', marginBottom: '10px', fontSize: '14px' }}>
                📋 Capture Sequence Guide
              </h4>
              <div style={{ fontSize: '12px', color: '#fff', opacity: '0.9' }}>
                {getCaptureSequenceGuide().sequence.map((step, index) => (
                  <div key={index} style={{ marginBottom: '8px' }}>
                    <strong>Step {step.step}:</strong> {step.face.charAt(0).toUpperCase() + step.face.slice(1)} Face
                    <br />
                    <span style={{ fontSize: '11px', opacity: '0.8' }}>
                      {step.instruction}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Save Button */}

          </div>


        </div>
      </div>

      {/* Color Palette Modal */}
      {showColorPalette && (
        <div className="color-palette-modal">
          <div className="palette-content">
            <h3>
              Choose Color for {typeof selectedSquare?.faceName === 'string' ? selectedSquare.faceName.charAt(0).toUpperCase() + selectedSquare.faceName.slice(1) : 'Face'} 
              {selectedSquare?.rowIndex !== undefined && selectedSquare?.colIndex !== undefined 
                ? ` [${selectedSquare.rowIndex}][${selectedSquare.colIndex}]` 
                : ' Center'}
            </h3>
            <div className="palette-grid">
              {colorPalette.map(color => (
                <button
                  key={color.name}
                  className="palette-color"
                  style={{ backgroundColor: color.hex }}
                  onClick={() => applyColorToSquare(color.name)}
                  title={color.label}
                />
              ))}
            </div>
            <button className="cancel-button" onClick={cancelColorSelection}>
              Cancel
            </button>
          </div>
        </div>
      )}


    </div>
  );
});

export default VirtualCube; 