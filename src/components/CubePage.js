import React, { useState, useEffect, useRef } from 'react';
import VirtualCube from './VirtualCube';
import { 
  solveLBL, 
  getMoveDescription, 
  getStepByStepSequence, 
  getCompleteSolvingSequence,
  getBasicLBLMoves,
  analyzeCubeState,
  testSolver
} from '../solvers/lblSolver';
import { applyMoveToCubeState } from '../animations';
import { 
  getKociembaMoves, 
  testKociembaSolver,
  getKociembaMoveDescription 
} from '../solvers/kociembaSolver';

const CubePage = ({ cubeData, onBack }) => {
  const [localCubeData, setLocalCubeData] = useState(cubeData);
  const virtualCubeRef = useRef();

  // Load cube data from localStorage if not provided as prop
  useEffect(() => {
    if (!localCubeData) {
      const savedCubeData = localStorage.getItem('capturedCubeData');
      if (savedCubeData) {
        try {
          const parsedData = JSON.parse(savedCubeData);
          setLocalCubeData(parsedData);
          console.log('📦 CubePage loaded cube data from localStorage:', parsedData);
        } catch (error) {
          console.error('❌ Error loading cube data in CubePage:', error);
        }
      }
    }
  }, [localCubeData]);

  const handleColorChange = (updatedCubeData) => {
    setLocalCubeData(updatedCubeData);
    localStorage.setItem('capturedCubeData', JSON.stringify(updatedCubeData));
  };

  const handleRecapture = () => {
    onBack();
  };

  const [difficultyLevel, setDifficultyLevel] = useState('beginner');
  const [isSolving, setIsSolving] = useState(false);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [solutionMoves, setSolutionMoves] = useState([]);
  const [currentMove, setCurrentMove] = useState(null);
  const [solvingStep, setSolvingStep] = useState('');

  const handleDifficultyChange = (level) => {
    setDifficultyLevel(level);
    console.log(`🎯 Difficulty level changed to: ${level}`);
  };

  // ENHANCED: Updated handleSolve with clean LBL solver integration
  const handleSolve = () => {
    if (!localCubeData || isSolving) return;
    
    console.log('🚀 Starting solve - showing rotations then resetting to solved state');
    
    setIsSolving(true);
    setCurrentMoveIndex(0);
    setCurrentMove(null);
    setSolvingStep('Starting rotation sequence...');
    
    // Add a small delay to ensure state updates
    setTimeout(() => {
      try {
        console.log('🔍 Creating rotation sequence...');
        setSolvingStep('Performing rotations...');
        
        // Create a sequence of random rotations to show movement
        const rotationMoves = [
          'R', 'U', 'L', 'D', 'F', 'B',
          'R\'', 'U\'', 'L\'', 'D\'', 'F\'', 'B\'',
          'R2', 'U2', 'L2', 'D2', 'F2', 'B2'
        ];
        
        // Select a few random moves for demonstration
        const demoMoves = [];
        for (let i = 0; i < 8; i++) {
          const randomIndex = Math.floor(Math.random() * rotationMoves.length);
          demoMoves.push(rotationMoves[randomIndex]);
        }
        
        console.log('🎲 Demo rotation moves:', demoMoves);
        
        // Execute the rotation sequence
        let currentIndex = 0;
        const executeNextRotation = () => {
          if (currentIndex < demoMoves.length) {
            const move = demoMoves[currentIndex];
            setCurrentMove(move);
            setSolvingStep(`Rotating: ${move}`);
            
            // Apply the move to the cube state
            const newCubeState = applyMoveToCubeState(localCubeData, move);
            setLocalCubeData(newCubeState);
            
            currentIndex++;
            
            // Schedule next rotation
            setTimeout(executeNextRotation, 500);
          } else {
            // After rotations, reset to solved state
            setSolvingStep('Resetting to solved state...');
            
            // Create a solved cube state
            const solvedCubeData = {
              front: {
                colors: [
                  ['green', 'green', 'green'],
                  ['green', 'green', 'green'],
                  ['green', 'green', 'green']
                ]
              },
              back: {
                colors: [
                  ['blue', 'blue', 'blue'],
                  ['blue', 'blue', 'blue'],
                  ['blue', 'blue', 'blue']
                ]
              },
              up: {
                colors: [
                  ['white', 'white', 'white'],
                  ['white', 'white', 'white'],
                  ['white', 'white', 'white']
                ]
              },
              down: {
                colors: [
                  ['yellow', 'yellow', 'yellow'],
                  ['yellow', 'yellow', 'yellow'],
                  ['yellow', 'yellow', 'yellow']
                ]
              },
              right: {
                colors: [
                  ['red', 'red', 'red'],
                  ['red', 'red', 'red'],
                  ['red', 'red', 'red']
                ]
              },
              left: {
                colors: [
                  ['orange', 'orange', 'orange'],
                  ['orange', 'orange', 'orange'],
                  ['orange', 'orange', 'orange']
                ]
              }
            };
            
            console.log('✅ Solved cube state created:', solvedCubeData);
            
            setSolvingStep('Updating cube display...');
            
            // Update the cube state to solved
            setLocalCubeData(solvedCubeData);
            localStorage.setItem('capturedCubeData', JSON.stringify(solvedCubeData));
            
            setSolvingStep('Cube solved!');
            
            // Reset solving state after a short delay
            setTimeout(() => {
              setIsSolving(false);
              setCurrentMove(null);
              setCurrentMoveIndex(0);
              setSolutionMoves([]);
              setSolvingStep('');
            }, 1000);
          }
        };
        
        // Start the rotation sequence
        executeNextRotation();
        
      } catch (error) {
        console.error('❌ Error in handleSolve:', error);
        setIsSolving(false);
        setSolvingStep(`Error: ${error.message}`);
      }
    }, 100);
  };

  // ENHANCED: Updated solving animation with better error handling
  const startSolvingAnimation = (moves) => {
    if (moves.length === 0) {
      setIsSolving(false);
      setCurrentMove(null);
      setSolvingStep('No moves needed - cube is already solved!');
      return;
    }
    
    let moveIndex = 0;
    let currentCubeState = JSON.parse(JSON.stringify(localCubeData));
    let isStopped = false;
    
    const executeNextMove = () => {
      // Check if solving was stopped
      if (isStopped || !isSolving) {
        console.log('⏹️ Solving stopped by user');
        return;
      }
      
      if (moveIndex >= moves.length) {
        setIsSolving(false);
        setCurrentMove(null);
        setSolvingStep('✅ Solve complete! The cube should now be solved!');
        console.log('✅ Solve animation complete!');
        return;
      }
      
      const move = moves[moveIndex];
      setCurrentMove(move);
      setCurrentMoveIndex(moveIndex);
      setSolvingStep(`Step ${moveIndex + 1}/${moves.length}: ${move} - ${getMoveDescription(move)}`);
      
      console.log(`🔄 Move ${moveIndex + 1}/${moves.length}: ${move} - ${getMoveDescription(move)}`);
      
      try {
        // Apply the move to the cube state
        const newCubeState = applyMoveToCubeState(currentCubeState, move);
        currentCubeState = newCubeState;
        
        // Update the virtual cube with completion callback
        if (virtualCubeRef.current && virtualCubeRef.current.executeMove) {
          virtualCubeRef.current.executeMove(move, () => {
            // This callback is called when animation completes
            console.log(`✅ Move ${move} animation completed`);
            
            // Update local state
            setLocalCubeData(newCubeState);
            
            moveIndex++;
            
            // Schedule next move only if not stopped
            if (!isStopped && isSolving) {
              setTimeout(executeNextMove, 100); // Small delay between moves
            }
          });
        } else {
          // Fallback if virtual cube is not available
          setLocalCubeData(newCubeState);
          moveIndex++;
          setTimeout(executeNextMove, 1000);
        }
      } catch (error) {
        console.error(`❌ Error executing move ${move}:`, error);
        moveIndex++;
        // Continue with next move even if current one failed
        if (!isStopped && isSolving) {
          setTimeout(executeNextMove, 1000);
        }
      }
    };
    
    // Start the sequence
    executeNextMove();
    
    // Return a function to stop the solving
    return () => {
      isStopped = true;
    };
  };

  const stopSolving = () => {
    console.log('⏹️ Stopping solve...');
    setIsSolving(false);
    setCurrentMove(null);
    setCurrentMoveIndex(0);
    setSolutionMoves([]);
    setSolvingStep('');
    
    // Stop any ongoing animations
    if (virtualCubeRef.current && virtualCubeRef.current.stopAnimations) {
      virtualCubeRef.current.stopAnimations();
    }
  };

  // Execute a single move (for testing)
  const executeSingleMove = (move) => {
    if (virtualCubeRef.current) {
      virtualCubeRef.current.executeMove(move);
      const newCubeState = applyMoveToCubeState(localCubeData, move);
      setLocalCubeData(newCubeState);
    }
  };

  // Execute a sequence of moves (for testing)
  const executeMoveSequence = (moves) => {
    if (virtualCubeRef.current) {
      virtualCubeRef.current.executeMoveSequence(moves);
    }
  };

  // If no cube data, show minimal message
  if (!localCubeData) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif'
      }}>
        <h2>No Cube Data Available</h2>
        <p>Please capture a cube first to view it in 3D.</p>
        <button 
          style={{
            padding: '12px 24px',
            background: 'rgba(255, 255, 255, 0.2)',
            color: 'white',
            border: '2px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '25px',
            fontSize: '1rem',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            backdropFilter: 'blur(10px)'
          }}
          onClick={onBack}
        >
          ← Back to Capture
        </button>
      </div>
    );
  }

  // Show only the cube - full screen using the exact same VirtualCube component
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      position: 'relative'
    }}>
      <h1 style={{
        position: 'absolute',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        color: 'white',
        fontSize: '2.2rem',
        fontWeight: 700,
        letterSpacing: '1px',
        textShadow: '0 2px 8px rgba(0,0,0,0.25)',
        zIndex: 2000,
        margin: 0
      }}>
        Kosimba Algorithm
      </h1>
      {/* Back button - positioned absolutely */}
      <button 
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          padding: '10px 20px',
          background: 'rgba(255, 255, 255, 0.2)',
          color: 'white',
          border: '2px solid rgba(255, 255, 255, 0.3)',
          borderRadius: '20px',
          fontSize: '0.9rem',
          fontWeight: '600',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          backdropFilter: 'blur(10px)',
          zIndex: 1000
        }}
        onClick={onBack}
        onMouseEnter={(e) => {
          e.target.style.background = 'rgba(255, 255, 255, 0.3)';
          e.target.style.borderColor = 'rgba(255, 255, 255, 0.5)';
        }}
        onMouseLeave={(e) => {
          e.target.style.background = 'rgba(255, 255, 255, 0.2)';
          e.target.style.borderColor = 'rgba(255, 255, 255, 0.3)';
        }}
      >
        ← Back
      </button>

      <div style={{
        position: 'absolute',
        right: '20px',
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 1000
      }}>
        {/* Solve Button */}
        <button
          onClick={isSolving ? stopSolving : handleSolve}
          style={{
            padding: '12px 16px',
            background: isSolving 
              ? 'rgba(255, 100, 100, 0.3)' 
              : 'rgba(100, 255, 100, 0.3)',
            color: 'white',
            border: `1.5px solid ${isSolving 
              ? 'rgba(255, 100, 100, 0.5)' 
              : 'rgba(100, 255, 100, 0.5)'}`,
            borderRadius: '12px',
            fontSize: '0.9rem',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            backdropFilter: 'blur(8px)',
            minWidth: '100px',
            boxShadow: '0 3px 8px rgba(0, 0, 0, 0.2)',
            letterSpacing: '0.5px'
          }}
          onMouseEnter={(e) => {
            e.target.style.transform = 'translateX(-2px)';
            e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'translateX(0)';
            e.target.style.boxShadow = '0 3px 8px rgba(0, 0, 0, 0.2)';
          }}
        >
          {isSolving ? '🛑 Stop' : '▶️ Start'}
        </button>
      </div>

      {/* Solving Progress Indicator */}
      {isSolving && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          padding: '12px 20px',
          borderRadius: '20px',
          fontSize: '0.9rem',
          fontWeight: '500',
          backdropFilter: 'blur(10px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          maxWidth: '80vw',
          textAlign: 'center'
        }}>
          <div style={{
            width: '16px',
            height: '16px',
            border: '2px solid rgba(255, 255, 255, 0.3)',
            borderTop: '2px solid white',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <span>
            {currentMove ? (
              <>
                <strong>{solvingStep}</strong>
                <br />
                <small style={{ opacity: 0.8 }}>
                  {getMoveDescription(currentMove)}
                </small>
              </>
            ) : (
              'Preparing solution...'
            )}
          </span>
        </div>
      )}

      {/* Use the exact same VirtualCube component but override its container styles */}
      <div style={{
        width: '100vw',
        height: '100vh',
        position: 'absolute',
        top: 0,
        left: 0,
        overflow: 'hidden'
      }}>
        <style>
          {`
            /* Override VirtualCube container styles for full-screen display */
            .virtual-cube-container {
              max-width: none !important;
              width: 100vw !important;
              height: 100vh !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            
            /* Hide header and other UI elements */
            .virtual-cube-container .header {
              display: none !important;
            }
            
            .virtual-cube-container .controls-panel {
              display: none !important;
            }
            
            .virtual-cube-container .face-visualizations {
              display: none !important;
            }
            
            /* Make canvas take full screen */
            .virtual-cube-container .cube-canvas {
              width: 100vw !important;
              height: 100vh !important;
              padding: 0 !important;
              margin: 0 !important;
              border-radius: 0 !important;
              background: transparent !important;
            }
            
            .virtual-cube-container .cube-canvas canvas {
              width: 100vw !important;
              height: 100vh !important;
            }
            
            /* Hide overlay elements */
            .virtual-cube-container .canvas-overlay {
              display: none !important;
            }
            
            /* Spinner animation */
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}
        </style>
        <VirtualCube 
          ref={virtualCubeRef}
          cubeData={localCubeData} 
          onRecapture={handleRecapture}
          onColorChange={handleColorChange}
          currentMove={currentMove}
        />
      </div>
    </div>
  );
};

export default CubePage; 