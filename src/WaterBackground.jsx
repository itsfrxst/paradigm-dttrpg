import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

// Ambient animated backdrop for the Start Screen — a trimmed-down version of
// a standalone Three.js water sim: a sine-displaced plane with a matching
// vertex-color palette (deep navy -> mid teal -> the game's cyan accent),
// slow ambient ripples that self-seed over time, and a handful of drifting
// motes for depth. No orbit drag, mode switching, or click handling — those
// belonged to that sim's own interactive demo, not a passive background.
const WaterBackground = () => {
  const mountRef = useRef(null);

  useEffect(() => {
    const container = mountRef.current;
    if(!container) return;

    let width = container.clientWidth, height = container.clientHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const bgColor = 0x05090e;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(bgColor);
    scene.fog = new THREE.FogExp2(bgColor, 0.026);

    const camera = new THREE.PerspectiveCamera(55, width/height, 0.1, 200);
    camera.position.set(0, 7, 22);
    camera.lookAt(0, 0, 0);

    const SIZE = 60;
    const GRID = 90;
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, GRID, GRID);
    geo.rotateX(-Math.PI/2);
    const posAttr = geo.attributes.position;
    const COUNT = posAttr.count;
    const baseX = new Float32Array(COUNT);
    const baseZ = new Float32Array(COUNT);
    for(let i=0;i<COUNT;i++){ baseX[i]=posAttr.getX(i); baseZ[i]=posAttr.getZ(i); }
    const colors = new Float32Array(COUNT*3);
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Palette matched to the game's own cyan/navy theme rather than the
    // reference sim's blue-white abyss, so this reads as one system.
    const deep = new THREE.Color(0x040c14);
    const mid  = new THREE.Color(0x004a68);
    const crest = new THREE.Color(0x00c8ff);
    const tempC = new THREE.Color();

    const mat = new THREE.MeshPhongMaterial({
      vertexColors: true, shininess: 120, specular: new THREE.Color(0x66d9ff),
      transparent: true, opacity: 0.88, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);

    const ambientLight = new THREE.AmbientLight(0x223344, 1.4);
    scene.add(ambientLight);
    const sun = new THREE.DirectionalLight(0x88ccff, 1.6);
    sun.position.set(8, 16, 6);
    scene.add(sun);
    const rim = new THREE.PointLight(0x00c8ff, 2.2, 60);
    rim.position.set(-14, 6, -10);
    scene.add(rim);

    // Drifting motes for atmospheric depth.
    const PCOUNT = 220;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(PCOUNT*3);
    const pVel = new Float32Array(PCOUNT*3);
    for(let i=0;i<PCOUNT;i++){
      pPos[i*3]=(Math.random()-0.5)*SIZE;
      pPos[i*3+1]=Math.random()*3;
      pPos[i*3+2]=(Math.random()-0.5)*SIZE;
      pVel[i*3]=(Math.random()-0.5)*0.006;
      pVel[i*3+1]=Math.random()*0.012;
      pVel[i*3+2]=(Math.random()-0.5)*0.006;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos,3));
    const pMat = new THREE.PointsMaterial({ color:0x8fe3ff, size:0.09, transparent:true, opacity:0.45 });
    const particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    // Ambient ripples — no click input, just a slow self-seeding trickle so
    // the surface never looks perfectly static.
    const ripples = [];
    const addRipple = (x,z,strength=1) => ripples.push({x,z,age:0,strength});
    for(let i=0;i<3;i++) addRipple((Math.random()-0.5)*SIZE*0.6, (Math.random()-0.5)*SIZE*0.6, 0.5);

    const clock = new THREE.Clock();
    let waveCount = 0;
    let frameId;

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      // Slow, barely-perceptible camera sway instead of user-driven orbit.
      camera.position.x = Math.sin(t*0.05) * 3;
      camera.position.y = 7 + Math.sin(t*0.08)*0.6;
      camera.lookAt(0,0,0);

      for(let r=ripples.length-1;r>=0;r--){
        ripples[r].age += 0.016;
        if(ripples[r].age > 14) ripples.splice(r,1);
      }
      if(Math.floor(t*0.15) > waveCount){
        waveCount = Math.floor(t*0.15);
        addRipple((Math.random()-0.5)*SIZE*0.7, (Math.random()-0.5)*SIZE*0.7, 0.35+Math.random()*0.3);
      }

      for(let i=0;i<COUNT;i++){
        const x=baseX[i], z=baseZ[i];
        let y =
          Math.sin(x*0.15 + t*0.35)*0.5 +
          Math.sin(z*0.12 + t*0.28)*0.45 +
          Math.sin((x+z)*0.09 + t*0.42)*0.3 +
          Math.sin(x*0.28 - z*0.18 + t*0.22)*0.18;

        for(const rp of ripples){
          const dx=x-rp.x, dz=z-rp.z;
          const dist=Math.sqrt(dx*dx+dz*dz);
          const waveFront = rp.age*3.2;
          const spread=1.6;
          const delta = dist-waveFront;
          if(Math.abs(delta) < spread){
            const envelope = 1-Math.abs(delta)/spread;
            const decay = Math.exp(-rp.age*0.35)*rp.strength;
            y += Math.sin(delta*3.5) * envelope * decay;
          }
        }

        posAttr.setY(i,y);
        const norm = Math.max(0, Math.min(1, (y+1.5)/3));
        if(norm < 0.5) tempC.lerpColors(deep, mid, norm*2);
        else tempC.lerpColors(mid, crest, (norm-0.5)*2);
        colors[i*3]=tempC.r; colors[i*3+1]=tempC.g; colors[i*3+2]=tempC.b;
      }
      posAttr.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
      geo.computeVertexNormals();

      const pp = particles.geometry.attributes.position;
      for(let i=0;i<PCOUNT;i++){
        pp.array[i*3] += pVel[i*3];
        pp.array[i*3+1] += pVel[i*3+1];
        pp.array[i*3+2] += pVel[i*3+2];
        if(pp.array[i*3+1] > 3.2 || Math.random() < 0.0015){
          pp.array[i*3] = (Math.random()-0.5)*SIZE;
          pp.array[i*3+1] = Math.random()*0.4;
          pp.array[i*3+2] = (Math.random()-0.5)*SIZE;
          pVel[i*3]=(Math.random()-0.5)*0.006;
          pVel[i*3+1]=Math.random()*0.012;
          pVel[i*3+2]=(Math.random()-0.5)*0.006;
        }
      }
      pp.needsUpdate = true;

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      width = container.clientWidth; height = container.clientHeight;
      camera.aspect = width/height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
      geo.dispose(); mat.dispose(); pGeo.dispose(); pMat.dispose();
      renderer.dispose();
      if(renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} style={{position:'absolute', inset:0, zIndex:0, pointerEvents:'none'}} />;
};

export default WaterBackground;
