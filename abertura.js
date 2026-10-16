// Abertura: um copo de vidro de verdade (3D, three.js) enchendo de suco de laranja, a groselha descendo para o fundo
// e o logo aparecendo em cima. Se o aparelho não tiver 3D (WebGL), fica a foto parada, sem quebrar nada.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const palco = document.getElementById("palco");
const parado = matchMedia("(prefers-reduced-motion: reduce)").matches;

function semTresD() {
  document.documentElement.classList.add("sem-3d");
  document.documentElement.classList.add("abertura-pronta");
}

try {
  iniciar();
} catch (e) {
  console.warn("Abertura sem 3D:", e);
  semTresD();
}

function iniciar() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  if (!renderer.getContext()) throw new Error("sem WebGL");
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  palco.appendChild(renderer.domElement);

  const cena = new THREE.Scene();
  const fundo = new THREE.Color("#f7f5f1");
  cena.background = fundo;
  const pm = new THREE.PMREMGenerator(renderer);
  cena.environment = pm.fromScene(new RoomEnvironment(renderer), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);

  // luz principal suave, de lado, como estúdio de foto de bebida
  const chave = new THREE.DirectionalLight("#ffffff", 1.4);
  chave.position.set(-3, 5, 4);
  cena.add(chave);
  const contra = new THREE.DirectionalLight("#ffe7c4", 1.1);
  contra.position.set(3, 3, -4);
  cena.add(contra);

  const copo = new THREE.Group();
  cena.add(copo);

  // ---------- o copo (long drink de vidro grosso) ----------
  const H = 1.5, R0 = 0.36, R1 = 0.42, PAREDE = 0.028, BASE = 0.14;
  const perfil = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(R0 - 0.02, 0),
    new THREE.Vector2(R0, 0.02),
    new THREE.Vector2(R1, H - 0.01),
    new THREE.Vector2(R1 - 0.006, H),
    new THREE.Vector2(R1 - PAREDE + 0.004, H),
    new THREE.Vector2(R1 - PAREDE, H - 0.01),
    new THREE.Vector2(R0 - PAREDE, BASE + 0.02),
    new THREE.Vector2(R0 - PAREDE - 0.03, BASE),
    new THREE.Vector2(0, BASE),
  ];
  const vidro = new THREE.Mesh(
    new THREE.LatheGeometry(perfil, 96),
    new THREE.MeshPhysicalMaterial({
      color: "#ffffff", metalness: 0, roughness: 0.04, transmission: 1, thickness: 0.28, ior: 1.5,
      clearcoat: 1, clearcoatRoughness: 0.03, specularIntensity: 1, envMapIntensity: 1.25, side: THREE.DoubleSide,
      attenuationColor: new THREE.Color("#ffffff"), attenuationDistance: 6,
    }),
  );
  vidro.renderOrder = 2;
  copo.add(vidro);

  // ---------- o líquido (sobe de baixo para cima) ----------
  const rIn0 = R0 - PAREDE - 0.004, rIn1 = R1 - PAREDE - 0.004, ALT_MAX = H - BASE - 0.16;
  function liquido(cor, brilho) {
    const g = new THREE.LatheGeometry([new THREE.Vector2(0, 0), new THREE.Vector2(rIn0, 0), new THREE.Vector2(rIn1, 1), new THREE.Vector2(0, 1)], 96);
    const m = new THREE.Mesh(g, new THREE.MeshPhysicalMaterial({
      color: cor, roughness: 0.12, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08,
      sheen: 0.4, sheenColor: new THREE.Color(brilho), sheenRoughness: 0.5, envMapIntensity: 0.9,
    }));
    m.position.y = BASE;
    m.scale.y = 0.0001;
    copo.add(m);
    return m;
  }
  const laranja = liquido("#f2861a", "#ffc46b");
  const groselha = liquido("#a50f25", "#ff5a6e");
  groselha.scale.set(0.985, 0.0001, 0.985);

  // ---------- gelo ----------
  const geloMat = new THREE.MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.12, metalness: 0, clearcoat: 1, transmission: 1, thickness: 0.18, ior: 1.31, envMapIntensity: 1.6 });
  const gelos = [];
  const posGelo = [[-0.12, 0.05, 0.4], [0.13, -0.06, -0.3], [0.02, 0.12, 0.9], [-0.05, -0.13, 1.6]];
  for (const [x, z, rot] of posGelo) {
    const g = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.18, 0.2, 3, 0.045), geloMat);
    g.position.set(x, 0, z);
    g.rotation.set(rot * 0.3, rot, rot * 0.2);
    g.userData = { flutua: Math.random() * Math.PI * 2 };
    g.visible = false;
    copo.add(g);
    gelos.push(g);
  }

  // ---------- o fio do suco caindo ----------
  const fioMat = new THREE.MeshPhysicalMaterial({ color: "#f5a02a", roughness: 0.1, clearcoat: 1, envMapIntensity: 1 });
  const fio = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.034, 1, 24, 40, true), fioMat);
  fio.visible = false;
  cena.add(fio);
  const fioBase = fio.geometry.attributes.position.array.slice();

  // ---------- rodela de limão na borda ----------
  const fatia = new THREE.Group();
  const casca = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.04, 56, 1, false, 0, Math.PI), new THREE.MeshPhysicalMaterial({ color: "#5f9a22", roughness: 0.35, clearcoat: 0.7 }));
  const polpa = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.042, 56, 1, false, 0, Math.PI), new THREE.MeshPhysicalMaterial({ color: "#d9ec8c", roughness: 0.4, sheen: 1, sheenColor: new THREE.Color("#f6ffd8"), clearcoat: 0.5 }));
  fatia.add(casca, polpa);
  fatia.rotation.set(Math.PI / 2, 0, Math.PI - 0.35);
  fatia.position.set(R1 * 0.72, H - 0.02, R1 * 0.72);
  fatia.rotation.y = -Math.PI / 4;
  fatia.scale.setScalar(0.001);
  copo.add(fatia);

  // ---------- canudo ----------
  const canudo = new THREE.Mesh(
    new THREE.CylinderGeometry(0.019, 0.019, 1.62, 20, 1, true),
    new THREE.MeshPhysicalMaterial({ color: "#1b1a17", roughness: 0.35, clearcoat: 0.8, side: THREE.DoubleSide }),
  );
  canudo.rotation.z = -0.22;
  canudo.rotation.x = 0.1;
  canudo.visible = false;
  copo.add(canudo);

  // sombra macia no chão
  const sombraTex = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 256;
    const x = c.getContext("2d"); const g = x.createRadialGradient(128, 128, 10, 128, 128, 128);
    g.addColorStop(0, "rgba(40,30,20,.35)"); g.addColorStop(.5, "rgba(40,30,20,.12)"); g.addColorStop(1, "rgba(40,30,20,0)");
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  })();
  const sombra = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.8), new THREE.MeshBasicMaterial({ map: sombraTex, transparent: true, depthWrite: false }));
  sombra.rotation.x = -Math.PI / 2; sombra.position.y = 0.001;
  cena.add(sombra);
  copo.position.y = 0;

  // ---------- tamanho da tela ----------
  function ajustar() {
    const w = palco.clientWidth, h = palco.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // no celular (em pé) a câmera recua para o copo caber; o copo fica na parte de baixo, o logo em cima
    const emPe = w / h < 0.8;
    const longe = emPe ? 8.2 : 6.6;
    camera.position.set(0, 2.3, longe);
    camera.lookAt(0, emPe ? 1.12 : 1.02, 0);
    camera.updateProjectionMatrix();
  }
  ajustar();
  addEventListener("resize", ajustar);

  // ---------- a coreografia ----------
  const suave = (t) => t * t * (3 - 2 * t);
  const entre = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
  const TOPO_FIO = 3.6;
  let inicio = performance.now();
  if (parado) inicio -= 20000; // sem animação: já mostra o copo cheio
  let logoMostrado = false;

  function fioAte(cor, alturaSuperficie, t, forca) {
    fio.visible = forca > 0.001;
    if (!fio.visible) return;
    fioMat.color.set(cor);
    const len = TOPO_FIO - alturaSuperficie;
    fio.scale.set(forca, len, forca);
    fio.position.set(0.02, alturaSuperficie + len / 2, 0.02);
    // o fio ondula um pouco, como líquido de verdade
    const p = fio.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = fioBase[i * 3 + 1];
      const onda = Math.sin(y * 18 + t * 22) * 0.004 + Math.sin(y * 7 - t * 9) * 0.003;
      p.array[i * 3] = fioBase[i * 3] + onda / Math.max(forca, 0.2);
    }
    p.needsUpdate = true;
  }

  function quadro(agora) {
    const t = (agora - inicio) / 1000;

    // copo se monta: sobe do chão, rápido
    copo.rotation.y = -0.5 + t * 0.12;
    const monta = suave(entre(t, 0, 0.55));
    vidro.scale.set(1, Math.max(0.001, monta), 1);
    copo.scale.setScalar(0.96 + 0.04 * monta);
    renderer.toneMappingExposure = 0.8 + 0.25 * monta;
    sombra.material.opacity = monta;

    // gelo cai
    gelos.forEach((g, i) => {
      const k = suave(entre(t, 0.45 + i * 0.07, 0.75 + i * 0.07));
      g.visible = k > 0;
      const chao = BASE + 0.1 + i * 0.16;
      if (t < 1.0) g.position.y = chao + (1 - k) * 2.2;
    });

    // suco cai e enche: 0,8 s a 2,1 s
    const nivelL = suave(entre(t, 0.85, 2.1)) * 0.86;
    laranja.scale.y = Math.max(0.0001, nivelL * ALT_MAX);
    const supL = BASE + nivelL * ALT_MAX;
    gelos.forEach((g, i) => {
      if (t >= 1.0) {
        const chao = BASE + 0.1 + i * 0.16;
        const boia = Math.max(chao, Math.min(supL - 0.04 - (3 - i) * 0.05, chao + 0.6));
        g.position.y += (boia - g.position.y) * 0.12;
        g.rotation.z += Math.sin(t * 1.3 + g.userData.flutua) * 0.0008;
      }
    });

    // groselha desce para o fundo: 2,2 s a 2,9 s
    const nivelG = suave(entre(t, 2.25, 2.95)) * 0.27;
    groselha.scale.y = Math.max(0.0001, nivelG * ALT_MAX);

    if (t < 2.2) fioAte("#f5a02a", supL, t, suave(entre(t, 0.7, 0.9)) * (1 - suave(entre(t, 1.95, 2.15))));
    else fioAte("#c0192e", supL, t, 0.75 * suave(entre(t, 2.2, 2.32)) * (1 - suave(entre(t, 2.7, 2.9))));

    // limão encaixa na borda (com um pulinho) e o canudo entra
    const lim = entre(t, 2.9, 3.25);
    fatia.scale.setScalar(Math.max(0.001, suave(lim) * (1 + Math.sin(lim * Math.PI) * 0.12)));
    const can = suave(entre(t, 3.05, 3.4));
    canudo.visible = can > 0;
    canudo.position.set(0.07, BASE + 0.98 + (1 - can) * 1.6, -0.05);

    if (!logoMostrado && t > 3.3) {
      logoMostrado = true;
      document.documentElement.classList.add("abertura-pronta");
    }

    renderer.render(cena, camera);
    requestAnimationFrame(quadro);
  }
  requestAnimationFrame(quadro);
}
