import * as THREE from 'three';

const CYCLE_DURATION = 600; // 10 minutes full cycle

// Time phases: 0=noon, 0.25=dusk, 0.5=midnight, 0.75=dawn, 1.0=noon again
const DAY_COLOR = new THREE.Color(0xfff0dd);
const DUSK_COLOR = new THREE.Color(0xff8844);
const NIGHT_COLOR = new THREE.Color(0x3344aa);
const DAWN_COLOR = new THREE.Color(0xffaa66);

const FOG_DAY = new THREE.Color(0x8899aa);
const FOG_NIGHT = new THREE.Color(0x0a0e1a);

export class TimeOfDaySystem {
  constructor(dirLight, ambient, hemi, scene, renderer) {
    this.dirLight = dirLight;
    this.ambient = ambient;
    this.hemi = hemi;
    this.scene = scene;
    this.renderer = renderer;

    this.time = 0;        // 0 to 1 (full cycle)
    this.cycleDuration = CYCLE_DURATION;
    this._tmpColor = new THREE.Color();

    // Pre-allocated reusable Color objects to avoid GC pressure in update()
    this._ambientNight = new THREE.Color(0x1a2244);
    this._ambientDay = new THREE.Color(0x445566);
    this._hemiNight = new THREE.Color(0x223355);
    this._hemiDay = new THREE.Color(0x6688aa);
    this._hemiGroundNight = new THREE.Color(0x111118);
    this._hemiGroundDay = new THREE.Color(0x222225);
  }

  update(dt) {
    this.time = (this.time + dt / this.cycleDuration) % 1;

    // sunAngle: 0=noon(top), 0.25=horizon(dusk), 0.5=below(night), 0.75=horizon(dawn)
    const sunAngle = this.time * Math.PI * 2;
    const sunHeight = Math.sin(sunAngle); // +1 = noon, -1 = midnight
    const sunHorizontal = Math.cos(sunAngle);

    // Normalized daylight factor: 1 at noon, 0 at midnight
    const dayFactor = Math.max(0, sunHeight);
    // Twilight factor: peaks at dawn/dusk
    const twilightFactor = Math.max(0, 1 - Math.abs(sunHeight) * 2) * (1 - dayFactor * 0.5);

    // --- Directional Light ---
    if (this.dirLight) {
      // Position orbits around the map center
      const cx = 1000, cz = 1000;
      const sunDist = 800;
      const sunY = 600 + sunHeight * 400; // 200 to 1000
      const sunX = cx + sunHorizontal * sunDist;
      const sunZ = cz + 300;

      this.dirLight.position.set(sunX, Math.max(100, sunY), sunZ);

      // Intensity: bright during day, dim glow during dusk, off at night
      this.dirLight.intensity = Math.max(0.1, dayFactor * 2.0 + twilightFactor * 0.6);

      // Color: warm white during day, orange at dusk/dawn, blue tint at night
      if (dayFactor > 0.5) {
        this._tmpColor.copy(DAY_COLOR);
      } else if (dayFactor > 0) {
        this._tmpColor.lerpColors(DUSK_COLOR, DAY_COLOR, dayFactor * 2);
      } else {
        this._tmpColor.lerpColors(NIGHT_COLOR, DUSK_COLOR, Math.max(0, sunHeight + 1));
      }
      this.dirLight.color.copy(this._tmpColor);
    }

    // --- Ambient Light ---
    if (this.ambient) {
      this.ambient.intensity = 0.3 + dayFactor * 0.5;
      this.ambient.color.lerpColors(
        this._ambientNight,
        this._ambientDay,
        dayFactor
      );
    }

    // --- Hemisphere Light ---
    if (this.hemi) {
      this.hemi.intensity = 0.2 + dayFactor * 0.4;
      this.hemi.color.lerpColors(
        this._hemiNight,
        this._hemiDay,
        dayFactor
      );
      this.hemi.groundColor.lerpColors(
        this._hemiGroundNight,
        this._hemiGroundDay,
        dayFactor
      );
    }

    // --- Fog ---
    if (this.scene.fog) {
      this.scene.fog.color.lerpColors(FOG_NIGHT, FOG_DAY, dayFactor);
    }

    // --- Renderer exposure ---
    if (this.renderer) {
      this.renderer.renderer.toneMappingExposure = 0.7 + dayFactor * 0.6;
    }

    return { dayFactor, sunHeight };
  }

  /** Get current day factor (0=night, 1=day) */
  getDayFactor() {
    const sunAngle = this.time * Math.PI * 2;
    return Math.max(0, Math.sin(sunAngle));
  }
}
