import * as THREE from 'three';

export interface WaypointArrowOptions {
  scene: THREE.Scene;
  getHeight?: (x: number, z: number) => number;
}

/**
 * A prominent, stylized 3D red spinning arrow that hovers above the active milestone house.
 * Features continuous rotation, vertical floating bobbing, and a pulsing ground/roof halo.
 */
export class WaypointArrow {
  private scene: THREE.Scene;
  private getHeight?: (x: number, z: number) => number;

  private group: THREE.Group = new THREE.Group();
  private arrowMeshGroup: THREE.Group = new THREE.Group();
  private beaconRing: THREE.Mesh | null = null;
  private pointLight: THREE.PointLight | null = null;

  private baseY: number = 0;
  private isVisible: boolean = false;
  private currentScale: number = 0;
  private targetScale: number = 0;

  // Disposables
  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];

  constructor(options: WaypointArrowOptions) {
    this.scene = options.scene;
    this.getHeight = options.getHeight;

    this.buildArrow();
    this.group.visible = false;
    this.scene.add(this.group);
  }

  private buildArrow(): void {
    // 1. Arrow Core Material (Vibrant ruby red with warm emissive glow)
    const arrowMat = new THREE.MeshStandardMaterial({
      color: 0xef4444, // Bright crimson/ruby red
      emissive: 0xdc2626,
      emissiveIntensity: 0.65,
      roughness: 0.25,
      metalness: 0.15,
      flatShading: false,
    });
    this.materials.push(arrowMat);

    // 2. Down-pointing Arrow Head (Cone)
    const coneRadius = 1.05;
    const coneHeight = 1.6;
    const coneGeo = new THREE.ConeGeometry(coneRadius, coneHeight, 20);
    this.geometries.push(coneGeo);

    const coneMesh = new THREE.Mesh(coneGeo, arrowMat);
    // In Three.js, cone tip points +Y by default; rotate 180 deg so tip points straight down
    coneMesh.rotation.x = Math.PI;
    coneMesh.position.y = coneHeight * 0.5; // tip will touch y = 0
    coneMesh.castShadow = true;
    this.arrowMeshGroup.add(coneMesh);

    // 3. Arrow Shaft (Cylinder)
    const shaftRadius = 0.42;
    const shaftHeight = 1.7;
    const shaftGeo = new THREE.CylinderGeometry(shaftRadius, shaftRadius, shaftHeight, 20);
    this.geometries.push(shaftGeo);

    const shaftMesh = new THREE.Mesh(shaftGeo, arrowMat);
    shaftMesh.position.y = coneHeight + shaftHeight * 0.5;
    shaftMesh.castShadow = true;
    this.arrowMeshGroup.add(shaftMesh);

    // Top cap finial (Sphere)
    const capGeo = new THREE.SphereGeometry(shaftRadius * 1.15, 16, 16);
    this.geometries.push(capGeo);
    const capMesh = new THREE.Mesh(capGeo, arrowMat);
    capMesh.position.y = coneHeight + shaftHeight;
    this.arrowMeshGroup.add(capMesh);

    this.group.add(this.arrowMeshGroup);

    // 4. Pulsing Beacon Halo Ring under the arrow tip
    const ringGeo = new THREE.TorusGeometry(1.6, 0.08, 12, 32);
    this.geometries.push(ringGeo);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xff3b30,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });
    this.materials.push(ringMat);

    this.beaconRing = new THREE.Mesh(ringGeo, ringMat);
    this.beaconRing.rotation.x = Math.PI * 0.5; // flat horizontal ring
    this.beaconRing.position.y = -0.2;
    this.group.add(this.beaconRing);

    // 5. Point Light casting warm red glow on the bungalow roof
    this.pointLight = new THREE.PointLight(0xef4444, 2.2, 14.0);
    this.pointLight.position.set(0, 1.2, 0);
    this.group.add(this.pointLight);
  }

  /**
   * Positions the arrow above a world location.
   */
  public setTarget(x: number, z: number, heightOffset = 8.5): void {
    let groundY = 0;
    if (this.getHeight) {
      groundY = this.getHeight(x, z);
    }
    this.baseY = groundY + heightOffset;
    this.group.position.set(x, this.baseY, z);
    this.show();
  }

  /**
   * Sets the position directly from a Vector3.
   */
  public setTargetVector(pos: THREE.Vector3, heightOffset = 8.5): void {
    this.setTarget(pos.x, pos.z, heightOffset);
  }

  public show(): void {
    this.isVisible = true;
    this.targetScale = 1.0;
    this.group.visible = true;
  }

  public hide(): void {
    this.isVisible = false;
    this.targetScale = 0.0;
  }

  /**
   * Frame animation update: spinning, vertical bobbing, and halo pulse.
   */
  public update(dt: number, elapsed: number): void {
    if (!this.group.visible && this.currentScale <= 0.001) return;

    // Smooth scale enter/exit
    this.currentScale = THREE.MathUtils.lerp(this.currentScale, this.targetScale, Math.min(dt * 8.0, 1.0));
    this.group.scale.setScalar(this.currentScale);
    if (this.currentScale <= 0.005 && !this.isVisible) {
      this.group.visible = false;
      return;
    }

    // Continuous 360-degree rotation
    this.arrowMeshGroup.rotation.y += dt * 3.0;

    // Gentle vertical bobbing motion (sine wave)
    const bobOffset = Math.sin(elapsed * 3.8) * 0.42;
    this.arrowMeshGroup.position.y = bobOffset;

    // Pulse the beacon ring
    if (this.beaconRing) {
      const pulse = 1.0 + Math.sin(elapsed * 4.5) * 0.22;
      this.beaconRing.scale.setScalar(pulse);
      const ringMat = this.beaconRing.material as THREE.MeshBasicMaterial;
      if (ringMat) {
        ringMat.opacity = 0.55 + Math.sin(elapsed * 4.5) * 0.3;
      }
    }
  }

  public dispose(): void {
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
    this.scene.remove(this.group);
  }
}
