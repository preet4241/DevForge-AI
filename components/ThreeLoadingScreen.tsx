import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export const ThreeLoadingScreen = () => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    // Colors from snippet context (inferred)
    const O1 = 0xff4400;
    const O4 = 0xff8800;

    // Scene Setup
    const scene = new THREE.Scene();
    // Use transparent background to let CSS radial gradient show through
    // scene.background = new THREE.Color(0x09090b); 

    // Camera
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 4;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mountRef.current.appendChild(renderer.domElement);

    // Lights
    scene.add(new THREE.AmbientLight(0xff4400, 0.3));
    
    const pl1 = new THREE.PointLight(O1, 6, 20);
    pl1.position.set(3, 3, 3);
    scene.add(pl1);
    
    const pl2 = new THREE.PointLight(O4, 3, 15);
    pl2.position.set(-3, -2, -1);
    scene.add(pl2);

    // Blob Object
    const geo = new THREE.SphereGeometry(1.2, 64, 64);
    
    // Store original positions for noise calculation
    const count = geo.attributes.position.count;
    const origPos = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) {
        origPos[i] = geo.attributes.position.array[i];
    }

    const mat = new THREE.MeshStandardMaterial({
      color: O4,
      emissive: 0xff3300, // Brighter, more vibrant orange/red emissive color
      emissiveIntensity: 1.2, // Increased intensity for a stronger glow
      roughness: 0.1, // Lower roughness for a shinier, more liquid-like surface
      metalness: 0.4, // Adjusted metalness to balance reflection and color
    });
    const blob = new THREE.Mesh(geo, mat);
    scene.add(blob);

    // Particles (Bubbles)
    const particleCount = 100;
    const particleGeo = new THREE.BufferGeometry();
    const particlePos = new Float32Array(particleCount * 3);
    const particleVel = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      particlePos[i * 3] = (Math.random() - 0.5) * 6;
      particlePos[i * 3 + 1] = (Math.random() - 0.5) * 6 - 3;
      particlePos[i * 3 + 2] = (Math.random() - 0.5) * 4;
      particleVel[i] = Math.random() * 0.015 + 0.005;
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0xffaa00,
      size: 0.06,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // Audio Setup (Ambient Hum)
    let audioCtx: AudioContext | null = null;
    let oscillators: OscillatorNode[] = [];
    
    const initAudio = () => {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return;
        
        audioCtx = new AudioContextClass();
        
        // Base low hum
        const humOsc = audioCtx.createOscillator();
        humOsc.type = 'sine';
        humOsc.frequency.value = 55; // Low frequency
        
        const humGain = audioCtx.createGain();
        humGain.gain.value = 0.05; // Low volume
        
        // Subtle modulation for a "bubbling" feel
        const lfo = audioCtx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.2; // Slow modulation
        
        const lfoGain = audioCtx.createGain();
        lfoGain.gain.value = 5; // Modulate frequency by +/- 5Hz
        
        lfo.connect(lfoGain);
        lfoGain.connect(humOsc.frequency);
        
        humOsc.connect(humGain);
        humGain.connect(audioCtx.destination);
        
        humOsc.start();
        lfo.start();
        
        oscillators.push(humOsc, lfo);
      } catch (e) {
        console.log("Audio context failed to start or not supported", e);
      }
    };
    
    // Try to start audio immediately (might be blocked until interaction, but this is often triggered post-interaction)
    initAudio();

    // Animation Loop
    let frameId: number;
    const animate = (t: number) => {
      frameId = requestAnimationFrame(animate);
      const time = t * 0.001;
      
      const pos = geo.attributes.position;
      
      for (let i = 0; i < pos.count; i++) {
        const ix = i * 3;
        const ox = origPos[ix];
        const oy = origPos[ix+1];
        const oz = origPos[ix+2];
        
        // Normalize to get direction
        const len = Math.sqrt(ox*ox + oy*oy + oz*oz);
        const nx = ox/len;
        const ny = oy/len;
        const nz = oz/len;
        
        // Noise calculation
        const noise = Math.sin(nx*4 + time*1.5)*0.18 + 
                      Math.sin(ny*5 + time*1.3)*0.14 + 
                      Math.sin(nz*3 + time*2)*0.1;
        
        // Apply noise to position
        pos.setXYZ(i, ox + nx*noise, oy + ny*noise, oz + nz*noise);
      }
      
      pos.needsUpdate = true;
      geo.computeVertexNormals();
      
      blob.rotation.y = time * 0.35;
      blob.rotation.x = time * 0.2;
      
      pl1.position.set(Math.cos(time)*4, Math.sin(time)*2, 3);
      
      // Animate particles (bubbles)
      const pPos = particleGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        pPos[i * 3 + 1] += particleVel[i]; // Move up
        
        // Slight horizontal drift
        pPos[i * 3] += Math.sin(time * 2 + i) * 0.005;
        
        if (pPos[i * 3 + 1] > 4) {
          pPos[i * 3 + 1] = -4; // Reset to bottom
          pPos[i * 3] = (Math.random() - 0.5) * 6;
        }
      }
      particleGeo.attributes.position.needsUpdate = true;
      
      renderer.render(scene, camera);
    };

    requestAnimationFrame(animate);

    // Resize Handler
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      geo.dispose();
      mat.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      renderer.dispose();
      
      // Cleanup audio
      oscillators.forEach(osc => {
        try { osc.stop(); } catch(e) {}
      });
      if (audioCtx && audioCtx.state !== 'closed') {
        audioCtx.close();
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-900 via-zinc-950 to-black">
      <div ref={mountRef} className="absolute inset-0 z-0" />
      
      <div className="relative z-10 flex flex-col items-center space-y-4 pointer-events-none animate-fade-in mt-64">
        <h2 className="text-2xl font-bold text-white tracking-widest uppercase drop-shadow-[0_0_10px_rgba(255,100,0,0.8)]">
          MORPHING
        </h2>
        <div className="flex gap-1">
            <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce shadow-[0_0_8px_#f97316]" style={{ animationDelay: '0s' }}></div>
            <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce shadow-[0_0_8px_#f97316]" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce shadow-[0_0_8px_#f97316]" style={{ animationDelay: '0.2s' }}></div>
        </div>
      </div>
    </div>
  );
};
