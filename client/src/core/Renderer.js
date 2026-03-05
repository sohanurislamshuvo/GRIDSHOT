import * as THREE from 'three';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// Cinematic color grading + vignette + film grain shader
const ColorGradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: 0.35 },
    uGrain: { value: 0.015 }
  },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uVignette;
    uniform float uGrain;
    varying vec2 vUv;
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      // Vignette
      float dist = length(vUv - 0.5) * 1.4;
      color.rgb *= 1.0 - uVignette * dist * dist;
      // Film grain
      float noise = fract(sin(dot(vUv + uTime * 0.01, vec2(12.9898, 78.233))) * 43758.5453);
      color.rgb += (noise - 0.5) * uGrain;
      // Warm highlight / cool shadow lift
      color.r += 0.01;
      color.b += color.r < 0.3 ? 0.015 : -0.005;
      gl_FragColor = color;
    }
  `
};

export const Quality = { LOW: 0, MEDIUM: 1, HIGH: 2 };

const VIEW_MODES = ['tpp', 'shoulder', 'fpp'];
const FOV = { tpp: 45, shoulder: 55, fpp: 70 };

/** Auto-detect appropriate quality tier */
function detectQuality() {
  // Check localStorage first
  const saved = localStorage.getItem('shadow-arena-quality');
  if (saved !== null) return parseInt(saved, 10);

  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    || ('ontouchstart' in window && navigator.maxTouchPoints > 1);
  if (isMobile) return Quality.LOW;

  const cores = navigator.hardwareConcurrency || 2;
  if (cores >= 8) return Quality.HIGH;
  if (cores >= 4) return Quality.MEDIUM;
  return Quality.LOW;
}

export class Renderer {
  constructor(container, quality) {
    this.container = container;
    this.cameraMode = 'tpp';
    this.quality = quality !== undefined ? quality : detectQuality();

    // Three.js scene
    this.scene = new THREE.Scene();

    // Perspective camera
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 1, 5000);
    this.camera.position.set(1000, 800, 1300);
    this.camera.lookAt(1000, 0, 1000);

    // WebGL renderer
    const pixelRatio = this.quality === Quality.LOW
      ? 1
      : Math.min(window.devicePixelRatio, this.quality === Quality.HIGH ? 2 : 1.5);

    this.renderer = new THREE.WebGLRenderer({ antialias: false });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.3;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Shadows (disabled on LOW)
    if (this.quality > Quality.LOW) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    } else {
      this.renderer.shadowMap.enabled = false;
    }

    container.appendChild(this.renderer.domElement);

    // Build post-processing pipeline based on quality tier
    this._buildComposer();

    // CSS2D renderer for health bars / labels
    this.css2dRenderer = new CSS2DRenderer();
    this.css2dRenderer.setSize(window.innerWidth, window.innerHeight);
    this.css2dRenderer.domElement.style.position = 'absolute';
    this.css2dRenderer.domElement.style.top = '0';
    this.css2dRenderer.domElement.style.left = '0';
    this.css2dRenderer.domElement.style.pointerEvents = 'none';
    container.appendChild(this.css2dRenderer.domElement);

    // Damage vignette overlay
    this._vignette = document.createElement('div');
    this._vignette.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      pointer-events: none; z-index: 5; opacity: 0;
      background: radial-gradient(ellipse at center, transparent 50%, rgba(255,0,0,0.6) 100%);
      transition: opacity 0.05s;
    `;
    container.appendChild(this._vignette);

    // Target FOV for smooth transitions
    this._targetFov = 45;

    this._resizeHandler = () => this._onResize();
    window.addEventListener('resize', this._resizeHandler);
  }

  _buildComposer() {
    if (this.composer) this.composer.dispose();

    const w = window.innerWidth;
    const h = window.innerHeight;

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    this._gtaoPass = null;
    this._bloomPass = null;
    this._smaaPass = null;
    this._colorGradePass = null;

    // HIGH: Full pipeline (GTAO + Bloom + SMAA + ColorGrade)
    if (this.quality >= Quality.HIGH) {
      const gtaoPass = new GTAOPass(this.scene, this.camera, w, h);
      gtaoPass.output = GTAOPass.OUTPUT.Default;
      gtaoPass.updateGtaoMaterial({ radius: 0.4, distanceExponent: 2, thickness: 5, scale: 1.0 });
      gtaoPass.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 4, rings: 4, samples: 16 });
      this.composer.addPass(gtaoPass);
      this._gtaoPass = gtaoPass;
    }

    // MEDIUM+: Bloom (reduced strength on MEDIUM)
    if (this.quality >= Quality.MEDIUM) {
      const strength = this.quality === Quality.HIGH ? 0.4 : 0.25;
      const threshold = this.quality === Quality.HIGH ? 0.6 : 0.9;
      const bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), strength, threshold, 0.85);
      this.composer.addPass(bloomPass);
      this._bloomPass = bloomPass;
    }

    // HIGH: SMAA anti-aliasing
    if (this.quality >= Quality.HIGH) {
      const smaaPass = new SMAAPass(
        w * this.renderer.getPixelRatio(),
        h * this.renderer.getPixelRatio()
      );
      this.composer.addPass(smaaPass);
      this._smaaPass = smaaPass;
    }

    // MEDIUM+: Color grading (vignette + grain + tint)
    if (this.quality >= Quality.MEDIUM) {
      const colorGradePass = new ShaderPass(ColorGradeShader);
      this.composer.addPass(colorGradePass);
      this._colorGradePass = colorGradePass;
    }

    this.composer.addPass(new OutputPass());
  }

  /** Get the shadow map size for the current quality */
  getShadowMapSize() {
    if (this.quality === Quality.HIGH) return 4096;
    if (this.quality === Quality.MEDIUM) return 2048;
    return 1024;
  }

  /** Change quality at runtime */
  setQuality(level) {
    if (level === this.quality) return;
    this.quality = level;
    localStorage.setItem('shadow-arena-quality', level);

    const pixelRatio = level === Quality.LOW
      ? 1
      : Math.min(window.devicePixelRatio, level === Quality.HIGH ? 2 : 1.5);
    this.renderer.setPixelRatio(pixelRatio);

    if (level > Quality.LOW) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    } else {
      this.renderer.shadowMap.enabled = false;
    }
    this.renderer.shadowMap.needsUpdate = true;

    this._buildComposer();
  }

  /** Check if the renderer is running at mobile/low quality */
  isMobile() {
    return this.quality === Quality.LOW;
  }

  cycleViewMode() {
    const idx = VIEW_MODES.indexOf(this.cameraMode);
    this.cameraMode = VIEW_MODES[(idx + 1) % VIEW_MODES.length];
    this._targetFov = FOV[this.cameraMode];
    this.camera.near = this.cameraMode === 'fpp' ? 0.5 : 1;
    this.camera.updateProjectionMatrix();
    return this.cameraMode;
  }

  followTarget(gameX, gameY, rotation = 0, pitch = 0, lerpFactor = 0.1) {
    // Smooth FOV transition
    if (Math.abs(this.camera.fov - this._targetFov) > 0.1) {
      this.camera.fov += (this._targetFov - this.camera.fov) * 0.15;
      this.camera.updateProjectionMatrix();
    }

    switch (this.cameraMode) {
      case 'tpp':
        this._followTPP(gameX, gameY, lerpFactor);
        break;
      case 'shoulder':
        this._followShoulder(gameX, gameY, rotation, lerpFactor);
        break;
      case 'fpp':
        this._followFPP(gameX, gameY, rotation, pitch, lerpFactor);
        break;
    }
  }

  _followTPP(gameX, gameY, lerp) {
    const targetX = gameX;
    const targetZ = gameY + 350;
    this.camera.position.x += (targetX - this.camera.position.x) * lerp;
    this.camera.position.y += (800 - this.camera.position.y) * lerp;
    this.camera.position.z += (targetZ - this.camera.position.z) * lerp;
    this.camera.lookAt(
      this.camera.position.x,
      0,
      this.camera.position.z - 350
    );
  }

  _followShoulder(gameX, gameY, rotation, lerp) {
    const behindDist = 40;
    const rightOffset = 12;
    const height = 30;

    const behindX = -Math.cos(rotation) * behindDist + Math.sin(rotation) * rightOffset;
    const behindZ = -Math.sin(rotation) * behindDist - Math.cos(rotation) * rightOffset;

    const targetX = gameX + behindX;
    const targetY = height;
    const targetZ = gameY + behindZ;

    this.camera.position.x += (targetX - this.camera.position.x) * lerp;
    this.camera.position.y += (targetY - this.camera.position.y) * lerp;
    this.camera.position.z += (targetZ - this.camera.position.z) * lerp;

    const lookAheadDist = 10;
    this.camera.lookAt(
      gameX + Math.cos(rotation) * lookAheadDist,
      14,
      gameY + Math.sin(rotation) * lookAheadDist
    );
  }

  _followFPP(gameX, gameY, rotation, pitch, lerp) {
    const headHeight = 27;
    const targetX = gameX;
    const targetY = headHeight;
    const targetZ = gameY;

    this.camera.position.x += (targetX - this.camera.position.x) * 0.3;
    this.camera.position.y += (targetY - this.camera.position.y) * 0.3;
    this.camera.position.z += (targetZ - this.camera.position.z) * 0.3;

    const lookDist = 100;
    const lookX = gameX + Math.cos(rotation) * lookDist;
    const lookY = headHeight + Math.sin(pitch) * lookDist;
    const lookZ = gameY + Math.sin(rotation) * lookDist;
    this.camera.lookAt(lookX, lookY, lookZ);
  }

  followSkydive(gameX, gameZ, height = 1200) {
    const targetX = gameX;
    const targetY = height;
    const targetZ = gameZ + 100;
    this.camera.position.x += (targetX - this.camera.position.x) * 0.08;
    this.camera.position.y += (targetY - this.camera.position.y) * 0.08;
    this.camera.position.z += (targetZ - this.camera.position.z) * 0.08;
    this.camera.lookAt(gameX, 0, gameZ);

    if (Math.abs(this.camera.fov - 60) > 0.1) {
      this.camera.fov += (60 - this.camera.fov) * 0.1;
      this.camera.updateProjectionMatrix();
    }
  }

  descendCamera(gameX, gameZ, progress) {
    const skyHeight = 1200;
    const tppHeight = 800;
    const ease = progress * (2 - progress);
    const height = skyHeight + (tppHeight - skyHeight) * ease;
    const zOffset = 100 + (350 - 100) * ease;

    this.camera.position.set(gameX, height, gameZ + zOffset);
    this.camera.lookAt(gameX, 0, gameZ);

    const fov = 60 + (45 - 60) * ease;
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  setCameraPosition(gameX, gameY) {
    this.camera.position.set(gameX, 800, gameY + 350);
    this.camera.lookAt(gameX, 0, gameY);
    this._targetFov = FOV[this.cameraMode];
    this.camera.fov = this._targetFov;
    this.camera.updateProjectionMatrix();
  }

  render(dt = 0) {
    if (this._colorGradePass) {
      this._colorGradePass.uniforms.uTime.value += dt;
    }
    this.composer.render();
    this.css2dRenderer.render(this.scene, this.camera);
  }

  flashDamage() {
    this._vignette.style.opacity = '1';
    setTimeout(() => { this._vignette.style.opacity = '0'; }, 150);
  }

  getCanvas() {
    return this.renderer.domElement;
  }

  _onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    if (this._bloomPass) this._bloomPass.resolution.set(w, h);
    if (this._gtaoPass) this._gtaoPass.setSize(w, h);
    this.css2dRenderer.setSize(w, h);
  }

  dispose() {
    window.removeEventListener('resize', this._resizeHandler);
    this.composer.dispose();
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
    this.container.removeChild(this.css2dRenderer.domElement);
    this.container.removeChild(this._vignette);
  }
}
