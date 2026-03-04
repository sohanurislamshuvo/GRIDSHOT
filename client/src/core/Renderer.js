import * as THREE from 'three';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';

export class Renderer {
  constructor(container) {
    this.container = container;

    // Three.js scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a0f);

    // Perspective camera for tactical top-down view
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 1, 5000);
    this.camera.position.set(1000, 800, 1300);
    this.camera.lookAt(1000, 0, 1000);

    // WebGL renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: false }); // SMAA handles AA
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    // Post-processing
    this.composer = new EffectComposer(this.renderer);
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    // Bloom for emissive glow (visors, bullets, shields, muzzle flash)
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.4,   // strength - subtle glow
      0.6,   // radius
      0.85   // threshold - only bright emissive materials bloom
    );
    this.composer.addPass(bloomPass);
    this._bloomPass = bloomPass;

    // Anti-aliasing
    const smaaPass = new SMAAPass(
      window.innerWidth * this.renderer.getPixelRatio(),
      window.innerHeight * this.renderer.getPixelRatio()
    );
    this.composer.addPass(smaaPass);
    this._smaaPass = smaaPass;

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

    // Handle resize
    window.addEventListener('resize', () => this._onResize());
  }

  followTarget(gameX, gameY, lerpFactor = 0.08) {
    // Game coordinates: x -> Three.js x, y -> Three.js z
    const targetCamX = gameX;
    const targetCamZ = gameY + 350;
    this.camera.position.x += (targetCamX - this.camera.position.x) * lerpFactor;
    this.camera.position.z += (targetCamZ - this.camera.position.z) * lerpFactor;
    this.camera.lookAt(
      this.camera.position.x,
      0,
      this.camera.position.z - 350
    );
  }

  setCameraPosition(gameX, gameY) {
    this.camera.position.set(gameX, 800, gameY + 350);
    this.camera.lookAt(gameX, 0, gameY);
  }

  render() {
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
