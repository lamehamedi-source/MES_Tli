import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import { createEngine } from './engine.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.localClippingEnabled = true;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1b1f25);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.05, 100);
camera.position.set(-4.2, 1.6, 4.6);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0, 0);

const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(-3, 6, 4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4 });
scene.add(sun, new THREE.HemisphereLight(0xbfd4ff, 0x30281f, 0.6));

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(8, 64),
  new THREE.MeshStandardMaterial({ color: 0x2a2f37, roughness: 0.9 }),
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -1.3;
floor.receiveShadow = true;
scene.add(floor);
const grid = new THREE.GridHelper(16, 32, 0x3b424d, 0x323842);
grid.position.y = -1.299;
scene.add(grid);

// Engine axis along world X: intake faces -X, exhaust +X.
const engine = createEngine();
engine.group.rotation.z = -Math.PI / 2;
engine.group.position.x = -2;
scene.add(engine.group);

// Cutaway removes the half of the shells facing the default camera (z > 0).
const cutPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);

const params = { cutaway: true, spin: true, throttle: 0.6 };
const applyCutaway = () => {
  for (const m of engine.shellMaterials) m.clippingPlanes = params.cutaway ? [cutPlane] : [];
};
applyCutaway();

const gui = new GUI({ title: 'LEAP-style turbofan' });
gui.add(params, 'cutaway').name('Cutaway').onChange(applyCutaway);
gui.add(params, 'spin').name('Spin');
gui.add(params, 'throttle', 0, 1, 0.01).name('Throttle');

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();
  if (params.spin) {
    engine.lp.rotation.y += dt * params.throttle * 8;
    engine.hp.rotation.y += dt * params.throttle * 20;
  }
  controls.update();
  renderer.render(scene, camera);
});
