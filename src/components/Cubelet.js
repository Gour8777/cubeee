import React from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const Cubelet = ({ position }) => {
  return (
    <mesh position={position}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial attach="material-0" color="white" />
      <meshStandardMaterial attach="material-1" color="red" />
      <meshStandardMaterial attach="material-2" color="blue" />
      <meshStandardMaterial attach="material-3" color="green" />
      <meshStandardMaterial attach="material-4" color="yellow" />
      <meshStandardMaterial attach="material-5" color="orange" />
    </mesh>
  );
};

export default Cubelet;
