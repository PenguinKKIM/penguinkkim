import * as THREE from "three";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js";

const canvas = document.querySelector(".intro-canvas");

if (canvas) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0.1, 5.4);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 3.8;
  controls.maxDistance = 7;
  controls.minPolarAngle = Math.PI * 0.28;
  controls.maxPolarAngle = Math.PI * 0.72;
  controls.target.set(0, -0.05, 0);
  controls.update();

  // 캔버스에 키보드 포커스가 있을 때만 방향키로 회전합니다.
  canvas.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();

    const offset = camera.position.clone().sub(controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    const step = Math.PI / 18;

    if (event.key === "ArrowLeft") spherical.theta -= step;
    if (event.key === "ArrowRight") spherical.theta += step;
    if (event.key === "ArrowUp") spherical.phi -= step;
    if (event.key === "ArrowDown") spherical.phi += step;
    spherical.phi = THREE.MathUtils.clamp(
      spherical.phi,
      controls.minPolarAngle,
      controls.maxPolarAngle,
    );

    camera.position.copy(controls.target).add(offset.setFromSpherical(spherical));
    controls.update();
  });

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  scene.add(new THREE.HemisphereLight(0xffffff, 0xb8c4d9, 2.2));

  const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
  keyLight.position.set(3, 4, 5);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0xa9bfff, 1.8);
  rimLight.position.set(-4, 2, -3);
  scene.add(rimLight);

  // GLB가 로딩되는 동안에는 기존 코드형 펭귄을 보여줍니다.
  let penguin = createPenguin();
  let penguinBaseY = penguin.position.y;
  scene.add(penguin);

  let mixer = null;
  const loader = new GLTFLoader();

  loader.load(
    "./asset/model/penguin.glb",
    (gltf) => {
      scene.remove(penguin);
      disposeModel(penguin);

      penguin = gltf.scene;
      fitModelToScene(penguin);
      penguinBaseY = penguin.position.y;

      const solidMaterial = new THREE.MeshStandardMaterial({
        color: 0xb8bec9,
        roughness: 0.85,
        metalness: 0,
      });

      const oldMaterials = new Set();
      penguin.traverse((child) => {
        if (child.isMesh) {
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach((material) => oldMaterials.add(material));
          child.material = solidMaterial;
        }
      });
      // 단색 재질로 교체한 뒤 사용하지 않는 텍스처와 재질을 해제합니다.
      disposeMaterials(oldMaterials);

      if (gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(penguin);
        mixer.clipAction(gltf.animations[0]).play();
      }

      scene.add(penguin);
    },
    undefined,
    (error) => {
      console.error("penguin.glb를 불러오지 못했습니다.", error);
    },
  );

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(1.2, 48),
    new THREE.MeshBasicMaterial({
      color: 0x8f9bb8,
      transparent: true,
      opacity: 0.16,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1.48;
  ground.scale.set(1.2, 0.45, 1);
  scene.add(ground);

  const clock = new THREE.Clock();

  function resize() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    if (!width || !height) return;

    camera.aspect = width / height;
    const baseFov = THREE.MathUtils.degToRad(35);
    camera.fov = THREE.MathUtils.radToDeg(
      2 * Math.atan(Math.tan(baseFov / 2) / Math.min(1, camera.aspect)),
    );
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize();

  function animate() {
    const delta = Math.min(clock.getDelta(), 0.05);
    const elapsed = clock.elapsedTime;
    const bob = reducedMotion.matches ? 0 : Math.sin(elapsed * 1.5);
    penguin.position.y = penguinBaseY + bob * 0.035;
    ground.position.y = -1.48 + bob * 0.01;

    if (mixer && !reducedMotion.matches) mixer.update(delta);
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  animate();
}

function fitModelToScene(model) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z);

  if (!maxDimension) return;

  const targetSize = 2.8;
  model.scale.multiplyScalar(targetSize / maxDimension);

  // 스케일을 적용한 뒤 다시 중심을 계산해야 회전할 때 화면 밖으로 밀리지 않습니다.
  const scaledBox = new THREE.Box3().setFromObject(model);
  const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
  model.position.sub(scaledCenter);
}

function disposeMaterials(materials) {
  const textures = new Set();
  materials.forEach((material) => {
    Object.values(material).forEach((value) => {
      if (value?.isTexture) textures.add(value);
    });
    material.dispose();
  });
  textures.forEach((texture) => texture.dispose());
}

function disposeModel(model) {
  const geometries = new Set();
  const materials = new Set();
  model.traverse((child) => {
    if (!child.isMesh) return;
    geometries.add(child.geometry);
    const meshMaterials = Array.isArray(child.material) ? child.material : [child.material];
    meshMaterials.forEach((material) => materials.add(material));
  });
  geometries.forEach((geometry) => geometry.dispose());
  disposeMaterials(materials);
}

function createPenguin() {
  const penguin = new THREE.Group();

  const black = new THREE.MeshStandardMaterial({
    color: 0x242633,
    roughness: 0.72,
  });
  const white = new THREE.MeshStandardMaterial({
    color: 0xf8f8f5,
    roughness: 0.8,
  });
  const orange = new THREE.MeshStandardMaterial({
    color: 0xf0a04b,
    roughness: 0.7,
  });

  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), black);
  body.scale.set(0.98, 1.22, 0.82);
  body.position.y = -0.18;
  penguin.add(body);

  const belly = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), white);
  belly.scale.set(0.68, 0.9, 0.22);
  belly.position.set(0, -0.22, 0.7);
  penguin.add(belly);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.94, 40, 28), black);
  head.scale.set(1, 0.92, 0.9);
  head.position.y = 0.9;
  penguin.add(head);

  const face = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), white);
  face.scale.set(0.78, 0.54, 0.2);
  face.position.set(0, 0.82, 0.78);
  penguin.add(face);

  [-0.25, 0.25].forEach((x) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.075, 20, 16), black);
    eye.position.set(x, 0.96, 0.97);
    penguin.add(eye);
  });

  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.32, 4), orange);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.78, 1.03);
  penguin.add(beak);

  [-1, 1].forEach((side) => {
    const wing = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 22), black);
    wing.scale.set(0.28, 0.82, 0.24);
    wing.position.set(side * 0.98, -0.12, 0.02);
    wing.rotation.z = side * -0.34;
    penguin.add(wing);

    const foot = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), orange);
    foot.scale.set(0.38, 0.14, 0.58);
    foot.position.set(side * 0.36, -1.35, 0.36);
    penguin.add(foot);
  });

  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.38, 24, 18), black);
  tail.scale.set(0.8, 0.8, 0.6);
  tail.position.set(0, -0.62, -0.68);
  penguin.add(tail);

  return penguin;
}

const navLinks = document.querySelectorAll(".gnb a");

navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    navLinks.forEach((item) => item.classList.remove("active"));
    link.classList.add("active");
  });
});
