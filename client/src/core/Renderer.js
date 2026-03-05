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

const VIEW_MODES = ['tpp', 'shoulder', 'fpp'];
const FOV = { tpp: 45, shoulder: 55, fpp: 70 };

export class Renderer {
  constructor(container) {
    this.container = container;
    this.cameraMode = 'tpp';

    // Three.js scene (no background — sky dome added by WorldBuilder)
    this.scene = new THREE.Scene();

    // Perspective camera
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 1, 5000);
    this.camera.position.set(1000, 800, 1300);
    this.camera.lookAt(1000, 0, 1000);

    // WebGL renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: false });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.3;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    // Post-processing pipeline: Render → GTAO → Bloom → SMAA → ColorGrade → Output
    this.composer = new EffectComposer(this.renderer);
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    // GTAO (ambient occlusion — contact shadows)
    const gtaoPass = new GTAOPass(this.scene, this.camera, window.innerWidth, window.innerHeight);
    gtaoPass.output = GTAOPass.OUTPUT.Default;
    gtaoPass.updateGtaoMaterial({ radius: 0.4, distanceExponent: 2, thickness: 5, scale: 1.0 });
    gtaoPass.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 4, rings: 4, samples: 16 });
    this.composer.addPass(gtaoPass);
    this._gtaoPass = gtaoPass;

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.4, 0.6, 0.85
    );
    this.composer.addPass(bloomPass);
    this._bloomPass = bloomPass;

    const smaaPass = new SMAAPass(
      window.innerWidth * this.renderer.getPixelRatio(),
      window.innerHeight * this.renderer.getPixelRatio()
    );
    this.composer.addPass(smaaPass);
    this._smaaPass = smaaPass;

    // Color grading (vignette + grain + tint)
    const colorGradePass = new ShaderPass(ColorGradeShader);
    this.composer.addPass(colorGradePass);
    this._colorGradePass = colorGradePass;

    const outputPass = new OutputPass();
    this.composer.addPass(outputPass);

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

    window.addEventListener('resize', () => this._onResize());
  }

  cycleViewMode() {
    const idx = VIEW_MODES.indexOf(this.cameraMode);
    this.cameraMode = VIEW_MODES[(idx + 1) % VIEW_MODES.length];
    this._targetFov = FOV[this.cameraMode];
    // Adjust near plane for close views
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
    // Behind and slightly right of player
    const behindDist = 40;
    const rightOffset = 12;
    const height = 30;

    // "Behind" is opposite to where player faces
    // rotation is the game aim angle (in XZ plane)
    const behindX = -Math.cos(rotation) * behindDist + Math.sin(rotation) * rightOffset;
    const behindZ = -Math.sin(rotation) * behindDist - Math.cos(rotation) * rightOffset;

    const targetX = gameX + behindX;
    const targetY = height;
    const targetZ = gameY + behindZ;

    this.camera.position.x += (targetX - this.camera.position.x) * lerp;
    this.camera.position.y += (targetY - this.camera.position.y) * lerp;
    this.camera.position.z += (targetZ - this.camera.position.z) * lerp;

    // Look at player torso height, slightly ahead
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

    // Look in aim direction with pitch
    const lookDist = 100;
    const lookX = gameX + Math.cos(rotation) * lookDist;
    const lookY = headHeight + Math.sin(pitch) * lookDist;
    const lookZ = gameY + Math.sin(rotation) * lookDist;
    this.camera.lookAt(lookX, lookY, lookZ);
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
    this._bloomPass.resolution.set(w, h);
    if (this._gtaoPass) this._gtaoPass.setSize(w, h);
    this.css2dRenderer.setSize(w, h);
  }

  dispose() {
    window.removeEventListener('resize', this._onResize);
    this.composer.dispose();
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
    this.container.removeChild(this.css2dRenderer.domElement);
    this.container.removeChild(this._vignette);
  }
}
