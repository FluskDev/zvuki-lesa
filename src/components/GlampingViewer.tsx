import { useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrthographicCamera, Environment } from '@react-three/drei';
import * as THREE from 'three';

// Pool Component
function Pool() {
  const poolRef = useRef<THREE.Mesh>(null);

  return (
    <group position={[2.5, 0, 0]}>
      {/* Pool basin */}
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[1.2, 1.1, 0.3, 32]} />
        <meshStandardMaterial color="#1a3a4a" metalness={0.3} roughness={0.4} />
      </mesh>
      {/* Water surface */}
      <mesh ref={poolRef} position={[0, 0.32, 0]}>
        <cylinderGeometry args={[1.1, 1.1, 0.05, 32]} />
        <meshStandardMaterial
          color="#00a8ff"
          metalness={0.8}
          roughness={0.1}
          transparent
          opacity={0.9}
        />
      </mesh>
      {/* Pool edge */}
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[1.35, 1.35, 0.1, 32]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.5} roughness={0.5} />
      </mesh>
    </group>
  );
}

// Wooden Bath (Чан) Component
function WoodenBath() {
  const [hovered, setHovered] = useState(false);

  return (
    <group
      position={[-2.5, 0, 0.5]}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      {/* Bath body - wooden barrel */}
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.8, 0.85, 1, 16]} />
        <meshStandardMaterial
          color={hovered ? "#8B4513" : "#654321"}
          roughness={0.8}
        />
      </mesh>
      {/* Bath rim */}
      <mesh position={[0, 1, 0]}>
        <torusGeometry args={[0.85, 0.08, 8, 16]} />
        <meshStandardMaterial color="#3a2a1a" roughness={0.9} />
      </mesh>
      {/* Bottom rim */}
      <mesh position={[0, 0.02, 0]}>
        <torusGeometry args={[0.85, 0.08, 8, 16]} />
        <meshStandardMaterial color="#3a2a1a" roughness={0.9} />
      </mesh>
      {/* Water in bath */}
      <mesh position={[0, 0.7, 0]}>
        <cylinderGeometry args={[0.75, 0.75, 0.3, 16]} />
        <meshStandardMaterial
          color="#4a90a8"
          metalness={0.6}
          roughness={0.2}
          transparent
          opacity={0.85}
        />
      </mesh>
      {/* Steam particles */}
      <SteamEffect />
      {/* Ladder */}
      <group position={[1.2, 0, 0]}>
        {/* Ladder posts */}
        <mesh position={[0, 0.6, 0]}>
          <boxGeometry args={[0.05, 1.2, 0.05]} />
          <meshStandardMaterial color="#5a4030" roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.6, 0.4]}>
          <boxGeometry args={[0.05, 1.2, 0.05]} />
          <meshStandardMaterial color="#5a4030" roughness={0.85} />
        </mesh>
        {/* Ladder rungs */}
        {[0.2, 0.5, 0.8].map((y, i) => (
          <mesh key={i} position={[0, y, 0.2]}>
            <boxGeometry args={[0.05, 0.05, 0.4]} />
            <meshStandardMaterial color="#5a4030" roughness={0.85} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// Steam positions pre-generated for consistency
const STEAM_POSITIONS = (() => {
  const positions = new Float32Array(30 * 3);
  // Use seeded pseudo-random for consistency
  let seed = 12345;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < 30; i++) {
    positions[i * 3] = (random() - 0.5) * 1.2;
    positions[i * 3 + 1] = random() * 0.8 + 0.8;
    positions[i * 3 + 2] = (random() - 0.5) * 1.2;
  }
  return positions;
})();

// Steam effect for bath
function SteamEffect() {
  const steamRef = useRef<THREE.Points>(null);

  useFrame((state) => {
    if (steamRef.current) {
      steamRef.current.rotation.y += 0.002;
      const positions = steamRef.current.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i + 1] += Math.sin(state.clock.elapsedTime + i) * 0.002;
      }
      steamRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <points ref={steamRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[STEAM_POSITIONS, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#ffffff"
        size={0.08}
        transparent
        opacity={0.4}
        sizeAttenuation
      />
    </points>
  );
}

// House Component
function House() {
  const [hovered, setHovered] = useState(false);

  return (
    <group
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      {/* House base */}
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[2.5, 1, 3]} />
        <meshStandardMaterial
          color={hovered ? "#404040" : "#2a2a2a"}
          roughness={0.7}
        />
      </mesh>
      {/* Gabled roof */}
      <mesh position={[0, 1.3, 0]} rotation={[0, 0, 0]}>
        <coneGeometry args={[2, 0.8, 4]} />
        <meshStandardMaterial
          color={hovered ? "#505050" : "#333333"}
          roughness={0.6}
        />
      </mesh>
      {/* Door */}
      <mesh position={[0, 0.4, 1.51]}>
        <boxGeometry args={[0.5, 0.8, 0.05]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.5} />
      </mesh>
      {/* Window */}
      <mesh position={[0.6, 0.6, 1.51]}>
        <boxGeometry args={[0.4, 0.4, 0.05]} />
        <meshStandardMaterial color="#87CEEB" emissive="#87CEEB" emissiveIntensity={0.3} />
      </mesh>
      {/* Window */}
      <mesh position={[-0.6, 0.6, 1.51]}>
        <boxGeometry args={[0.4, 0.4, 0.05]} />
        <meshStandardMaterial color="#87CEEB" emissive="#87CEEB" emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}

// Terrace/Deck
function Terrace() {
  return (
    <group position={[0, 0.02, 2.5]}>
      <mesh>
        <boxGeometry args={[6, 0.1, 2]} />
        <meshStandardMaterial color="#3a3020" roughness={0.85} />
      </mesh>
      {/* Terrace posts */}
      {[[-2.5, 0, -0.8], [2.5, 0, -0.8], [-2.5, 0, 0.8], [2.5, 0, 0.8]].map((pos, i) => (
        <mesh key={i} position={pos as [number, number, number]}>
          <boxGeometry args={[0.1, 1, 0.1]} />
          <meshStandardMaterial color="#3a3020" roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}

// Ground/Terrain
function Ground() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#2d3436" roughness={0.8} />
      </mesh>
    </group>
  );
}

// Interactive Hotspot Marker
function HotspotMarker({ position, onClick }: {
  position: [number, number, number];
  onClick?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const markerRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (markerRef.current) {
      const scale = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.1;
      markerRef.current.scale.setScalar(scale);
    }
  });

  return (
    <group
      ref={markerRef}
      position={position}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onClick={onClick}
    >
      {/* Outer glow ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.25, 0.35, 32]} />
        <meshBasicMaterial
          color={hovered ? "#ffcc00" : "#ffdd44"}
          transparent
          opacity={0.6}
        />
      </mesh>
      {/* Inner circle */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[0.2, 32]} />
        <meshBasicMaterial color={hovered ? "#ffcc00" : "#ffdd44"} />
      </mesh>
      {/* Plus icon */}
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <boxGeometry args={[0.2, 0.04, 0.02]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <boxGeometry args={[0.04, 0.2, 0.02]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
    </group>
  );
}

// Trees
function Tree({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.08, 0.1, 0.8, 8]} />
        <meshStandardMaterial color="#4a3020" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1, 0]}>
        <coneGeometry args={[0.4, 0.8, 8]} />
        <meshStandardMaterial color="#2a5a30" roughness={0.8} />
      </mesh>
    </group>
  );
}

// Fence
function Fence() {
  const fencePosts: [number, number, number][] = [];
  for (let i = -8; i <= 8; i += 1) {
    fencePosts.push([i, 0.4, 8]);
    fencePosts.push([i, 0.4, -8]);
  }
  for (let i = -7; i <= 7; i += 1) {
    fencePosts.push([8, 0.4, i]);
    fencePosts.push([-8, 0.4, i]);
  }

  return (
    <group>
      {fencePosts.map((pos, i) => (
        <mesh key={i} position={pos}>
          <boxGeometry args={[0.08, 0.8, 0.08]} />
          <meshStandardMaterial color="#3a3a3a" roughness={0.7} />
        </mesh>
      ))}
      {/* Fence mesh effect */}
      <mesh position={[0, 0.4, 8]}>
        <boxGeometry args={[16, 0.6, 0.02]} />
        <meshStandardMaterial color="#2a2a2a" transparent opacity={0.3} wireframe />
      </mesh>
    </group>
  );
}

// Main 3D Scene
function Scene3D() {
  const [activeHotspot, setActiveHotspot] = useState<string | null>(null);

  return (
    <>
      <OrthographicCamera
        makeDefault
        position={[12, 12, 12]}
        zoom={30}
        near={0.1}
        far={1000}
      />

      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 20, 10]} intensity={1} castShadow />
      <pointLight position={[-5, 5, -5]} intensity={0.5} color="#8888ff" />

      <color attach="background" args={["#1a1a2e"]} />
      <Environment preset="city" />

      <Ground />
      <Fence />
      <Terrace />
      <House />
      <Pool />
      <WoodenBath />

      {/* Trees */}
      <Tree position={[-6, 0, -5]} />
      <Tree position={[-5, 0, -6]} />
      <Tree position={[6, 0, -5]} />
      <Tree position={[5, 0, 5]} />
      <Tree position={[-7, 0, 3]} />

      {/* Interactive Hotspots */}
      <HotspotMarker
        position={[0, 1.8, 0]}
        onClick={() => setActiveHotspot('main')}
      />
      <HotspotMarker
        position={[2.5, 1.2, 0]}
        onClick={() => setActiveHotspot('pool')}
      />
      <HotspotMarker
        position={[-2.5, 1.5, 0.5]}
        onClick={() => setActiveHotspot('bath')}
      />

      {/* Info labels */}
      {(activeHotspot === 'main' || activeHotspot === 'pool' || activeHotspot === 'bath') && (
        <group position={[5, 3, 0]}>
          <mesh>
            <planeGeometry args={[4, 1.5]} />
            <meshBasicMaterial color="#1a1a1a" transparent opacity={0.9} />
          </mesh>
        </group>
      )}
    </>
  );
}

interface GlampingViewerProps {
  className?: string;
}

export default function GlampingViewer({
  className = ""
}: GlampingViewerProps) {
  return (
    <div className={`relative w-full h-full min-h-[500px] ${className}`} style={{ width: '100%', height: '100%' }}>
      <Canvas shadows>
        <Scene3D />
      </Canvas>

      {/* Overlay info panel */}
      <div className="absolute bottom-4 left-4 bg-black/80 backdrop-blur-sm rounded-lg p-4 max-w-xs">
        <h3 className="text-yellow-400 font-bold text-lg mb-2">Отличия в качестве</h3>
        <p className="text-gray-300 text-sm">
          Дом с бассейном и чаном — уникальное предложение для вашего отдыха
        </p>
      </div>
    </div>
  );
}

export { Pool, WoodenBath, House, Terrace, HotspotMarker };
