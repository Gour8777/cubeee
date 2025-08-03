import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import './App.css';
import Camera from './camera';
import VirtualCube from './components/VirtualCube';
import CubePage from './components/CubePage';

// Main App Component with Router
function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

// App Content Component
function AppContent() {
  const [activeTab, setActiveTab] = useState('camera');
  const [capturedCubeData, setCapturedCubeData] = useState(null);
  const [captureProgress, setCaptureProgress] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();

  // Load cube data from localStorage on component mount
  useEffect(() => {
    const savedCubeData = localStorage.getItem('capturedCubeData');
    if (savedCubeData) {
      try {
        const parsedData = JSON.parse(savedCubeData);
        setCapturedCubeData(parsedData);
        console.log('📦 Loaded cube data from localStorage:', parsedData);
      } catch (error) {
        console.error('❌ Error loading cube data from localStorage:', error);
      }
    }
  }, []);

  // Save cube data to localStorage whenever it changes
  useEffect(() => {
    if (capturedCubeData) {
      localStorage.setItem('capturedCubeData', JSON.stringify(capturedCubeData));
      console.log('💾 Saved cube data to localStorage:', capturedCubeData);
    }
  }, [capturedCubeData]);

  const handleCubeCaptured = (cubeData) => {
    setCapturedCubeData(cubeData);
    setActiveTab('cube');
  };

  const handleStartCubePage = () => {
    console.log('🚀 Start button clicked! Navigating to /cube');
    navigate('/cube');
  };

  const handleBackFromCubePage = () => {
    console.log('🔙 Back button clicked! Navigating to /');
    navigate('/');
  };

  // Check if we're on the cube page
  const isOnCubePage = location.pathname === '/cube';

  return (
    <Routes>
      {/* Cube Page Route */}
      <Route 
        path="/cube" 
        element={
          <CubePage 
            cubeData={capturedCubeData} 
            onBack={handleBackFromCubePage}
          />
        } 
      />
      
      {/* Main App Route */}
      <Route 
        path="/" 
        element={
          <div className="app">
            <div className="app-header">
              <div className="app-title">
                <h1>🎯 Rubik's Cube Capture System</h1>
                <p className="app-subtitle">Capture your physical cube and see it in 3D!</p>
              </div>
              
              <div className="app-navigation">
                <button 
                  className={`nav-button ${activeTab === 'camera' ? 'active' : ''}`}
                  onClick={() => setActiveTab('camera')}
                >
                  📷 Camera Capture
                </button>
                <button 
                  className={`nav-button ${activeTab === 'cube' ? 'active' : ''}`}
                  onClick={() => setActiveTab('cube')}
                  disabled={!capturedCubeData}
                >
                  🎲 Virtual Cube
                </button>
              </div>
            </div>

            <div className="app-content">
              {activeTab === 'camera' ? (
                <Camera 
                  onCubeCaptured={handleCubeCaptured}
                  captureProgress={captureProgress}
                  setCaptureProgress={setCaptureProgress}
                />
              ) : (
                <div className="virtual-cube-section">
                  {!capturedCubeData ? (
                    <div className="no-cube-message">
                      <h2>No Cube Captured Yet</h2>
                      <p>Start by capturing your physical Rubik's Cube using the camera.</p>
                      <button 
                        className="start-capture-button"
                        onClick={() => setActiveTab('camera')}
                      >
                        📷 Start Capture
                      </button>
                    </div>
                  ) : (
                    <>
                      <div style={{ padding: '20px', textAlign: 'center' }}>
                        <h3>Cube Data Available</h3>
                        <p>Faces captured: {Object.keys(capturedCubeData || {}).length}</p>
                      </div>
                      <VirtualCube 
                        cubeData={capturedCubeData} 
                        onRecapture={() => setActiveTab('camera')}
                        onColorChange={(updatedCubeData) => setCapturedCubeData(updatedCubeData)}
                      />
                      <div className="start-button-container">
                        {console.log('🎨 Rendering start button container')}
                        <button 
                          className="start-button"
                          onClick={() => {
                            console.log('🔘 Start button clicked!');
                            handleStartCubePage();
                          }}
                        >
                          🚀 Start 3D Experience
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        } 
      />
    </Routes>
  );
}

export default App; 