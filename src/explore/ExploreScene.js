// Three.js exploration engine, following WaterBackground.jsx's pattern (raw
// `three` package, built/animated/torn-down from a React useEffect) rather
// than react-three-fiber. Ported from the extension's cyberworld-scene.js,
// with all DOM-injection UI (notifications, modals, quest tracker) stripped
// out in favor of the `callbacks` React hands in — this module never touches
// `document`.
import * as THREE from 'three';

// ─── Player avatar ─────────────────────────────────────────────────────────
class StylizedCharacter extends THREE.Group {
  constructor() {
    super();

    const bodyGeometry = new THREE.CylinderGeometry(0.3, 0.4, 1.5, 6);
    const bodyMaterial = new THREE.MeshPhongMaterial({
      color: 0x00c8ff, emissive: 0x00c8ff, emissiveIntensity: 0.3,
      shininess: 100, transparent: true, opacity: 0.9
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.75;
    body.castShadow = true;
    this.add(body);

    const headGeometry = new THREE.OctahedronGeometry(0.35, 0);
    const headMaterial = new THREE.MeshPhongMaterial({
      color: 0xb0dff4, emissive: 0xb0dff4, emissiveIntensity: 0.4, shininess: 100
    });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 1.8;
    head.castShadow = true;
    this.add(head);

    const bodyWireframe = new THREE.EdgesGeometry(bodyGeometry);
    const bodyWireframeMat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });
    const bodyWireframeMesh = new THREE.LineSegments(bodyWireframe, bodyWireframeMat);
    bodyWireframeMesh.position.y = 0.75;
    this.add(bodyWireframeMesh);

    const headWireframe = new THREE.EdgesGeometry(headGeometry);
    const headWireframeMat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });
    const headWireframeMesh = new THREE.LineSegments(headWireframe, headWireframeMat);
    headWireframeMesh.position.y = 1.8;
    this.add(headWireframeMesh);

    const coreGeometry = new THREE.SphereGeometry(0.15, 8, 8);
    const coreMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    core.position.y = 0.75;
    this.add(core);
    this.core = core;

    this.head = head;
    this.bodyWireframeMesh = bodyWireframeMesh;
    this.headWireframeMesh = headWireframeMesh;
  }

  update(time) {
    this.core.scale.setScalar(1 + Math.sin(time * 5) * 0.2);
    this.head.position.y = 1.8 + Math.sin(time * 3) * 0.05;
    this.headWireframeMesh.position.y = 1.8 + Math.sin(time * 3) * 0.05;
    this.head.rotation.y += 0.01;
    this.headWireframeMesh.rotation.y += 0.01;
  }
}

// ─── Movement / camera ──────────────────────────────────────────────────────
class PlayerController {
  constructor(character) {
    this.character = character;
    this.velocity = new THREE.Vector3();
    this.position = new THREE.Vector3(0, 0, 0);
    this.rotation = 0;
    this.gravity = -0.015;
    this.jumpPower = 0.3;
    this.isGrounded = false;
    // Base speed raised from the original 0.1 -- touch d-pad input is coarser
    // than keyboard, so a snappier baseline reads better than relying on the
    // sprint hold for normal movement to not feel sluggish.
    this.moveSpeed = 0.15;
    this.sprintMultiplier = 2;
  }

  reset() {
    this.velocity.set(0, 0, 0);
    this.position.set(0, 0, 0);
    this.rotation = 0;
    this.character.position.set(0, 0, 0);
    this.character.rotation.y = 0;
  }

  update(keys, ground, cameraAngle) {
    this.velocity.y += this.gravity;

    if (this.position.y <= ground.position.y + ground.geometry.parameters.height / 2 + 0.1) {
      this.position.y = ground.position.y + ground.geometry.parameters.height / 2 + 0.1;
      this.velocity.y = 0;
      this.isGrounded = true;
    } else {
      this.isGrounded = false;
    }

    const speed = keys.shift.pressed ? this.moveSpeed * this.sprintMultiplier : this.moveSpeed;
    const moveX = (keys.d.pressed ? 1 : 0) - (keys.a.pressed ? 1 : 0);
    const moveZ = (keys.s.pressed ? 1 : 0) - (keys.w.pressed ? 1 : 0);

    if (moveX !== 0 || moveZ !== 0) {
      const directionAngle = Math.atan2(moveX, moveZ) + cameraAngle;
      this.position.x += Math.sin(directionAngle) * speed;
      this.position.z += Math.cos(directionAngle) * speed;
      this.rotation = directionAngle;
    }

    if (keys.arrowleft.pressed) this.rotation += 0.05;
    if (keys.arrowright.pressed) this.rotation -= 0.05;

    if (keys.space.pressed && this.isGrounded) {
      this.velocity.y = this.jumpPower;
      keys.space.pressed = false;
    }

    this.position.y += this.velocity.y;

    const platformSize = 100;
    const halfSize = platformSize / 2 - 2;
    this.position.x = Math.max(-halfSize, Math.min(halfSize, this.position.x));
    this.position.z = Math.max(-halfSize, Math.min(halfSize, this.position.z));

    this.character.position.copy(this.position);
    this.character.rotation.y = this.rotation;
  }
}

// Base framing tuned for landscape/desktop aspect ratios (>= 1). Portrait
// phones get pulled back proportionally via setFraming() below, rather than
// keeping the landscape distance and letting the narrower width crop the
// scene -- see BASE_ASPECT_THRESHOLD usage in setFraming.
const CAMERA_BASE_DISTANCE = 12;
const CAMERA_BASE_HEIGHT = 6;
// How far portrait framing is allowed to pull back, so extreme aspect
// ratios (a very tall, very narrow window) don't zoom out indefinitely.
const CAMERA_MAX_PULLBACK_FACTOR = 1.8;

class CameraController {
  constructor(camera, target) {
    this.camera = camera;
    this.target = target;
    this.distance = CAMERA_BASE_DISTANCE;
    this.height = CAMERA_BASE_HEIGHT;
    this.rotationSpeed = 0.05;
    this.angle = 0;
  }

  // Recomputes distance/height for the given width/height aspect ratio.
  // Landscape/square (aspect >= 1) keeps the tuned base framing; portrait
  // pulls the camera back (and up, at a gentler rate) so the narrower width
  // still shows roughly as much of the scene as landscape does, instead of
  // just cropping the sides of the same framing.
  setFraming(aspect) {
    if (aspect >= 1) {
      this.distance = CAMERA_BASE_DISTANCE;
      this.height = CAMERA_BASE_HEIGHT;
      return;
    }
    const factor = Math.min(CAMERA_MAX_PULLBACK_FACTOR, 1 / aspect);
    this.distance = CAMERA_BASE_DISTANCE * factor;
    this.height = CAMERA_BASE_HEIGHT * Math.sqrt(factor);
  }

  update(keys) {
    if (keys.q.pressed) this.angle += this.rotationSpeed;
    if (keys.e.pressed) this.angle -= this.rotationSpeed;

    const offset = new THREE.Vector3(
      Math.sin(this.angle) * this.distance,
      this.height,
      Math.cos(this.angle) * this.distance
    );

    this.camera.position.copy(this.target.position).add(offset);
    this.camera.lookAt(this.target.position.x, this.target.position.y + 1, this.target.position.z);
  }
}

// ─── Collectible ─────────────────────────────────────────────────────────
// New shape from explore/collectibles.js: {position, tierId, color, name, reward}.
// checkCollision is synchronous (the async addCollectible()/updateQuestProgress()
// calls the original made are gone — the caller handles the reward via callback).
class Collectible extends THREE.Mesh {
  constructor(data) {
    const { position, color, name, reward } = data;
    const geometry = new THREE.OctahedronGeometry(0.6, 0);
    const material = new THREE.MeshPhongMaterial({
      color, emissive: color, emissiveIntensity: 0.5, shininess: 100, transparent: true, opacity: 0.9
    });
    super(geometry, material);

    this.position.set(position[0], position[1], position[2]);
    this.castShadow = true;
    this.collected = false;
    this.collectibleName = name;
    this.reward = reward;

    const wireframe = new THREE.EdgesGeometry(geometry);
    const wireframeMat = new THREE.LineBasicMaterial({ color: 0xffffff });
    this.wireframeMesh = new THREE.LineSegments(wireframe, wireframeMat);
    this.add(this.wireframeMesh);

    this.floatOffset = Math.random() * Math.PI * 2;
  }

  update(time) {
    if (!this.collected) {
      this.rotation.y += 0.02;
      this.rotation.x += 0.01;
      this.position.y = 1 + Math.sin(time * 2 + this.floatOffset) * 0.3;
    }
  }

  checkCollision(playerPos) {
    if (this.collected) return false;
    const distance = this.position.distanceTo(playerPos);
    if (distance < 1.5) {
      this.collected = true;
      this.visible = false;
      return true;
    }
    return false;
  }
}

// ─── Merchant ────────────────────────────────────────────────────────────
// Ported at reduced scope (per plan decision #3): positioning/collision are
// unchanged, but there's no item-catalog rendering here — on collision it
// just hands the merchant data to React, which shows a "check back later"
// placeholder instead of a purchase flow.
class Merchant extends THREE.Group {
  constructor(merchantData, position) {
    super();

    this.merchantData = merchantData;
    this.position.copy(position);

    const bodyGeometry = new THREE.CylinderGeometry(0.5, 0.6, 2, 6);
    const bodyMaterial = new THREE.MeshPhongMaterial({
      color: 0xa6a6a6, emissive: 0xffffff, emissiveIntensity: 0.2, shininess: 100, transparent: true, opacity: 0.9
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 1;
    body.castShadow = true;
    this.add(body);

    const headGeometry = new THREE.BoxGeometry(0.6, 0.6, 0.6);
    const headMaterial = new THREE.MeshPhongMaterial({
      color: 0xffffff, emissive: 0xa6a6a6, emissiveIntensity: 0.3, shininess: 100
    });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 2.5;
    head.castShadow = true;
    this.add(head);

    const bodyWireframe = new THREE.EdgesGeometry(bodyGeometry);
    const bodyWireframeMat = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
    const bodyWireframeMesh = new THREE.LineSegments(bodyWireframe, bodyWireframeMat);
    bodyWireframeMesh.position.y = 1;
    this.add(bodyWireframeMesh);

    const headWireframe = new THREE.EdgesGeometry(headGeometry);
    const headWireframeMat = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
    const headWireframeMesh = new THREE.LineSegments(headWireframe, headWireframeMat);
    headWireframeMesh.position.y = 2.5;
    this.add(headWireframeMesh);

    this.head = head;
    this.headWireframeMesh = headWireframeMesh;
    this.interacted = false;
  }

  update(time) {
    this.rotation.y = Math.sin(time * 0.5) * 0.3;
    this.head.position.y = 2.5 + Math.sin(time * 2) * 0.1;
    this.headWireframeMesh.position.y = 2.5 + Math.sin(time * 2) * 0.1;
  }

  checkCollision(playerPos) {
    if (this.interacted) return false;
    const distance = new THREE.Vector2(this.position.x - playerPos.x, this.position.z - playerPos.z).length();
    return distance < 3;
  }
}

// ─── Hex pillar (frxst.io environment decoration) ──────────────────────────
class HexPillar extends THREE.Group {
  constructor(position, height, colorHex = '#b0dff4') {
    super();
    this.position.copy(position);
    const colorNum = parseInt(colorHex.replace('#', '0x'));

    const pillarGeometry = new THREE.CylinderGeometry(1.5, 1.5, height, 6);
    const pillarMaterial = new THREE.MeshPhongMaterial({
      color: colorNum, emissive: colorNum, emissiveIntensity: 0.3, transparent: true, opacity: 0.6, shininess: 100
    });
    const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
    pillar.position.y = height / 2;
    pillar.castShadow = true;
    this.add(pillar);

    const wireframe = new THREE.EdgesGeometry(pillarGeometry);
    const wireframeMat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });
    const wireframeMesh = new THREE.LineSegments(wireframe, wireframeMat);
    wireframeMesh.position.y = height / 2;
    this.add(wireframeMesh);

    const topGeometry = new THREE.CylinderGeometry(1.8, 1.8, 0.3, 6);
    const topMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
    const top = new THREE.Mesh(topGeometry, topMaterial);
    top.position.y = height;
    this.add(top);

    this.pillar = pillar;
    this.top = top;
  }

  update(time) {
    this.top.material.opacity = 0.6 + Math.sin(time * 2) * 0.2;
    this.pillar.material.emissiveIntensity = 0.3 + Math.sin(time * 3) * 0.15;
  }
}

// ─── Web portal ──────────────────────────────────────────────────────────
class WebPortal extends THREE.Group {
  constructor(destinations, position, style) {
    super();
    this.position.copy(position);
    this.destinations = destinations;
    this.style = style;

    const ringShape = new THREE.Shape();
    const radius = 2;
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i;
      const x = radius * Math.cos(angle);
      const z = radius * Math.sin(angle);
      if (i === 0) ringShape.moveTo(x, z); else ringShape.lineTo(x, z);
    }
    ringShape.lineTo(radius, 0);

    const ringGeometry = new THREE.ShapeGeometry(ringShape);
    const ringMaterial = new THREE.MeshPhongMaterial({
      color: style.color, emissive: style.emissive, emissiveIntensity: 0.5,
      side: THREE.DoubleSide, transparent: true, opacity: 0.3
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.1;
    this.add(ring);

    const points = [];
    for (let i = 0; i <= 6; i++) {
      const angle = (Math.PI / 3) * i;
      points.push(new THREE.Vector3(radius * Math.cos(angle), 0.15, radius * Math.sin(angle)));
    }
    const wireframeGeometry = new THREE.BufferGeometry().setFromPoints(points);
    const wireframeMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 3 });
    this.add(new THREE.Line(wireframeGeometry, wireframeMaterial));

    const particleCount = 50;
    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * radius * 0.8;
      particlePositions[i * 3] = Math.cos(angle) * r;
      particlePositions[i * 3 + 1] = Math.random() * 5;
      particlePositions[i * 3 + 2] = Math.sin(angle) * r;
    }
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMaterial = new THREE.PointsMaterial({ color: style.color, size: 0.15, transparent: true, opacity: 0.8 });
    this.particles = new THREE.Points(particleGeometry, particleMaterial);
    this.add(this.particles);

    this.ring = ring;
    this.activated = false;
  }

  update(time) {
    this.ring.rotation.z += 0.01;
    this.ring.material.emissiveIntensity = 0.5 + Math.sin(time * 2) * 0.2;

    const positions = this.particles.geometry.attributes.position.array;
    for (let i = 0; i < positions.length; i += 3) {
      positions[i + 1] += 0.02;
      if (positions[i + 1] > 5) positions[i + 1] = 0;
    }
    this.particles.geometry.attributes.position.needsUpdate = true;
    this.particles.rotation.y += 0.005;
  }

  checkCollision(playerPos) {
    if (this.activated) return false;
    const distance = new THREE.Vector2(this.position.x - playerPos.x, this.position.z - playerPos.z).length();
    return distance < 2.5;
  }
}

// ─── Engine factory ─────────────────────────────────────────────────────
export function createExploreScene(container, callbacks) {
  const { onCollect, onPortalTriggered, onMerchantTriggered } = callbacks;

  let width = container.clientWidth, height = container.clientHeight;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a0a);

  const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
  camera.position.set(0, 5, 10);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.shadowMap.enabled = true;
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 0.4));
  const pointLight = new THREE.PointLight(0x00c8ff, 1.5, 100);
  pointLight.position.set(10, 15, 10);
  pointLight.castShadow = true;
  scene.add(pointLight);
  const pointLight2 = new THREE.PointLight(0xb0dff4, 1, 100);
  pointLight2.position.set(-10, 10, -10);
  scene.add(pointLight2);
  const rimLight = new THREE.DirectionalLight(0xb0dff4, 0.5);
  rimLight.position.set(0, 5, -10);
  scene.add(rimLight);

  const keys = {
    a: { pressed: false }, d: { pressed: false }, s: { pressed: false }, w: { pressed: false },
    shift: { pressed: false }, space: { pressed: false },
    arrowleft: { pressed: false }, arrowright: { pressed: false },
    q: { pressed: false }, e: { pressed: false },
  };

  let player = null, playerController = null, cameraController = null, ground = null;
  let collectibles = [], portals = [], merchants = [], hexPillars = [];
  let blizzardParticles = null;
  let worldObjects = []; // everything loadWorld builds, for clean teardown on the next load

  function clearWorld() {
    worldObjects.forEach(obj => {
      scene.remove(obj);
      obj.traverse?.((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          (Array.isArray(child.material) ? child.material : [child.material]).forEach(m => m.dispose());
        }
      });
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach(m => m.dispose());
      }
    });
    worldObjects = [];
    collectibles = []; portals = []; merchants = []; hexPillars = [];
    blizzardParticles = null;
    player = null; playerController = null; cameraController = null; ground = null;
  }

  function loadWorld(domain, worldConfig, editorPrefs = { blizzardEnabled: true, gridEnabled: true }) {
    clearWorld();

    scene.fog = new THREE.Fog(0x0a0a0a, 30, 100);
    scene.background = new THREE.Color(0x121212);

    const groundGeometry = new THREE.BoxGeometry(100, 0.5, 100);
    const groundMaterial = new THREE.MeshPhongMaterial({
      color: 0x2a2a2a, emissive: worldConfig.color, emissiveIntensity: 0.05
    });
    ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.position.y = -0.25;
    ground.receiveShadow = true;
    scene.add(ground);
    worldObjects.push(ground);

    const gridHelper = new THREE.GridHelper(100, 20, worldConfig.color, 0x004466);
    gridHelper.position.y = 0.01;
    gridHelper.visible = editorPrefs.gridEnabled;
    scene.add(gridHelper);
    worldObjects.push(gridHelper);

    player = new StylizedCharacter();
    player.position.set(0, 0, 0);
    scene.add(player);
    worldObjects.push(player);

    playerController = new PlayerController(player);
    cameraController = new CameraController(camera, player);
    cameraController.angle = Math.PI;
    cameraController.setFraming(width / height);

    // Portal placement, same three-way domain branch as the original.
    if (domain === 'www.google.com') {
      if (worldConfig.portalDestinations?.length > 0) {
        const portal = new WebPortal(worldConfig.portalDestinations, new THREE.Vector3(-20, 0, 0),
          { color: worldConfig.color, emissive: worldConfig.emissive });
        scene.add(portal); portals.push(portal); worldObjects.push(portal);
      }
    } else if (domain === 'frxst.io' || domain === 'www.frxst.io') {
      const googlePortal = new WebPortal(
        [{ name: 'Google Hub', url: 'https://www.google.com', icon: '🔍', description: 'Return to the search hub' }],
        new THREE.Vector3(-20, 0, 0), { color: worldConfig.color, emissive: worldConfig.emissive });
      scene.add(googlePortal); portals.push(googlePortal); worldObjects.push(googlePortal);

      if (worldConfig.hasCustomPortal && worldConfig.portalDestinations?.length > 0) {
        const customPortal = new WebPortal(worldConfig.portalDestinations, new THREE.Vector3(20, 0, 0),
          { color: worldConfig.color, emissive: worldConfig.emissive });
        scene.add(customPortal); portals.push(customPortal); worldObjects.push(customPortal);
      }
    } else {
      const googlePortal = new WebPortal(
        [{ name: 'Google Hub', url: 'https://www.google.com', icon: '🔍', description: 'Return to the search hub' }],
        new THREE.Vector3(-20, 0, 0), { color: worldConfig.color, emissive: worldConfig.emissive });
      scene.add(googlePortal); portals.push(googlePortal); worldObjects.push(googlePortal);
    }

    if (worldConfig.collectibles?.length > 0) {
      worldConfig.collectibles.forEach(data => {
        const collectible = new Collectible(data);
        scene.add(collectible); collectibles.push(collectible); worldObjects.push(collectible);
      });
    }

    if (worldConfig.merchant) {
      const merchantPos = new THREE.Vector3(...worldConfig.merchant.position);
      const merchant = new Merchant(worldConfig.merchant, merchantPos);
      scene.add(merchant); merchants.push(merchant); worldObjects.push(merchant);
    }

    if (worldConfig.environment) {
      if (worldConfig.environment.hexPillars) {
        worldConfig.environment.hexPillars.forEach(cfg => {
          const pillar = new HexPillar(new THREE.Vector3(...cfg.position), cfg.height);
          scene.add(pillar); hexPillars.push(pillar); worldObjects.push(pillar);
        });
      }

      if (worldConfig.environment.blizzard) {
        const blizzardGeometry = new THREE.BufferGeometry();
        const blizzardCount = 1000;
        const blizzardPositions = new Float32Array(blizzardCount * 3);
        for (let i = 0; i < blizzardCount * 3; i += 3) {
          blizzardPositions[i] = (Math.random() - 0.5) * 150;
          blizzardPositions[i + 1] = Math.random() * 50;
          blizzardPositions[i + 2] = (Math.random() - 0.5) * 150;
        }
        blizzardGeometry.setAttribute('position', new THREE.BufferAttribute(blizzardPositions, 3));
        const blizzardMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, transparent: true, opacity: 0.7 });
        blizzardParticles = new THREE.Points(blizzardGeometry, blizzardMaterial);
        blizzardParticles.visible = editorPrefs.blizzardEnabled;
        scene.add(blizzardParticles);
        worldObjects.push(blizzardParticles);
      }

      if (worldConfig.environment.snowflakes) {
        for (let i = 0; i < 8; i++) {
          const angle = (Math.PI * 2 / 8) * i;
          const radius = 30 + Math.random() * 15;
          const snowflakeGeo = new THREE.OctahedronGeometry(0.5 + Math.random() * 0.5, 0);
          const snowflakeMat = new THREE.MeshPhongMaterial({
            color: 0xffffff, emissive: 0xb0dff4, emissiveIntensity: 0.5, transparent: true, opacity: 0.8
          });
          const snowflake = new THREE.Mesh(snowflakeGeo, snowflakeMat);
          snowflake.position.set(Math.cos(angle) * radius, 2 + Math.random() * 3, Math.sin(angle) * radius);
          snowflake.userData.floatOffset = Math.random() * Math.PI * 2;
          snowflake.userData.rotSpeed = 0.01 + Math.random() * 0.02;
          scene.add(snowflake);
          worldObjects.push(snowflake);
        }
      }
    }
  }

  function addCollectibleAt(positionArray, data) {
    const collectible = new Collectible({ position: positionArray, ...data });
    scene.add(collectible);
    collectibles.push(collectible);
    worldObjects.push(collectible);
  }

  // Owner-panel "Spawn Collectible" helper — places it just in front of the
  // player rather than requiring the caller to know internal scene coordinates.
  function spawnCollectibleNearPlayer({ tierId, color, name, reward }) {
    if (!playerController) return;
    const p = playerController.position;
    const offsetAngle = Math.random() * Math.PI * 2;
    addCollectibleAt([p.x + Math.cos(offsetAngle) * 3, 1, p.z + Math.sin(offsetAngle) * 3], { tierId, color, name, reward });
  }

  function setKey(name, pressed) {
    if (keys[name]) keys[name].pressed = pressed;
  }

  let time = 0;
  let frameId;
  const snowflakeObjects = () => worldObjects.filter(o => o.userData?.floatOffset !== undefined);

  function animate() {
    frameId = requestAnimationFrame(animate);
    time += 0.01;

    if (player) {
      cameraController.update(keys);
      if (playerController && ground) playerController.update(keys, ground, cameraController.angle);
      player.update(time);

      for (let i = collectibles.length - 1; i >= 0; i--) {
        const c = collectibles[i];
        c.update(time);
        if (c.checkCollision(playerController.position)) {
          onCollect?.(c.reward);
          scene.remove(c);
          collectibles.splice(i, 1);
        }
      }

      portals.forEach(portal => {
        portal.update(time);
        if (portal.checkCollision(playerController.position)) {
          portal.activated = true;
          onPortalTriggered?.(portal.destinations);
          setTimeout(() => { portal.activated = false; }, 1000);
        }
      });

      merchants.forEach(merchant => {
        merchant.update(time);
        if (merchant.checkCollision(playerController.position)) {
          merchant.interacted = true;
          onMerchantTriggered?.(merchant.merchantData);
          setTimeout(() => { merchant.interacted = false; }, 1000);
        }
      });

      hexPillars.forEach(pillar => pillar.update(time));

      if (blizzardParticles) {
        const positions = blizzardParticles.geometry.attributes.position.array;
        for (let i = 0; i < positions.length; i += 3) {
          positions[i + 1] -= 0.1;
          positions[i] += (Math.random() - 0.5) * 0.1;
          if (positions[i + 1] < 0) positions[i + 1] = 50;
        }
        blizzardParticles.geometry.attributes.position.needsUpdate = true;
      }

      snowflakeObjects().forEach(obj => {
        obj.rotation.y += obj.userData.rotSpeed || 0.01;
        obj.rotation.x += (obj.userData.rotSpeed || 0.01) * 0.5;
        const baseY = 2 + (obj.userData.floatOffset % 3);
        obj.position.y = baseY + Math.sin(time * 2 + obj.userData.floatOffset) * 0.4;
      });
    }

    renderer.render(scene, camera);
  }
  animate();

  const handleResize = () => {
    width = container.clientWidth; height = container.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    // Also re-frame the camera distance/height -- covers a device rotation
    // mid-session (portrait <-> landscape both fire a resize), not just the
    // initial framing set in loadWorld().
    cameraController?.setFraming(width / height);
  };
  window.addEventListener('resize', handleResize);

  function dispose() {
    cancelAnimationFrame(frameId);
    window.removeEventListener('resize', handleResize);
    clearWorld();
    renderer.dispose();
    if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
  }

  return { loadWorld, setKey, spawnCollectibleNearPlayer, dispose };
}
