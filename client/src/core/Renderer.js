import * as THREE from 'three';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';

export class Renderer {
  constructor(container) {
    this.container = container;

    // Three.js scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x111111);

    // Perspective camera for tactical top-down view
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 1, 5000);
    this.camera.position.set(1000, 800, 1300);
    this.camera.lookAt(1000, 0, 1000);

    // WebGL renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    container.appendChild(this.renderer.domElement);

    // CSS2D renderer for health bars / labels
    this.css2dRenderer = new CSS2DRenderer();
    this.css2dRenderer.setSize(window.innerWidth, window.innerHeight);
    this.css2dRenderer.domElement.style.position = 'absolute';
    this.css2dRenderer.domElement.style.top = '0';
    this.css2dRenderer.domElement.style.left = '0';
    this.css2dRenderer.domElement.style.pointerEvents = 'none';
    container.appendChild(this.css2dRenderer.domElement);

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
    this.renderer.render(this.scene, this.camera);
    this.css2dRenderer.render(this.scene, this.camera);
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
    this.css2dRenderer.setSize(w, h);
  }

  dispose() {
    window.removeEventListener('resize', this._onResize);
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
    this.container.removeChild(this.css2dRenderer.domElement);
  }
}
