// Abertura da JC Drinks: um Sex on the Beach sendo servido, tudo em código e com física.
//  - o fio de suco cai pela gravidade e afina conforme ganha velocidade (conservação do volume);
//  - onde ele bate, espirram gotas que sobem, caem e escorrem na parede do copo;
//  - a superfície do suco é uma "lâmina d'água" com equação de onda: treme e faz ondinhas no ponto do impacto;
//  - a groselha entra pela superfície e afunda como uma nuvem até o fundo (é mais densa);
//  - a rodela de limão cai e encaixa na borda (mola com amortecimento) e o canudo cai e se apoia na borda.
// O vidro reflete uma foto 360° de estúdio (img/estudio.hdr, Poly Haven, CC0).
// Sem 3D (WebGL) no aparelho: fica a foto parada e o resto da página funciona igual.
import * as THREE from "three";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";

const palco = document.getElementById("palco");
const parado = matchMedia("(prefers-reduced-motion: reduce)").matches;
const pronto = () => document.documentElement.classList.add("abertura-pronta");

try {
  iniciar();
} catch (e) {
  console.warn("Abertura sem 3D:", e);
  document.documentElement.classList.add("sem-3d");
  pronto();
}

function iniciar() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  if (!renderer.getContext()) throw new Error("sem WebGL");
  const celular = Math.min(innerWidth, innerHeight) < 700;
  renderer.setPixelRatio(Math.min(devicePixelRatio, celular ? 2 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  palco.appendChild(renderer.domElement);

  const cena = new THREE.Scene();
  cena.background = new THREE.Color("#f7f5f1");
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 60);

  // reflexo de estúdio de verdade
  const pm = new THREE.PMREMGenerator(renderer);
  new RGBELoader().load("img/estudio.hdr", (hdr) => {
    cena.environment = pm.fromEquirectangular(hdr).texture;
    hdr.dispose();
  });
  const luz = new THREE.DirectionalLight("#ffffff", 1.2);
  luz.position.set(-3, 6, 4);
  cena.add(luz);
  cena.add(new THREE.HemisphereLight("#ffffff", "#e9e2d6", 0.5));

  const copo = new THREE.Group();
  cena.add(copo);

  // ---------- taça de cristal: pé, haste e bojo em tulipa ----------
  // parte de dentro do bojo (raio, altura), de baixo para cima: o suco acompanha essa curva
  const DENTRO = [[0, 1.035], [0.12, 1.045], [0.24, 1.11], [0.333, 1.24], [0.373, 1.45], [0.363, 1.7], [0.333, 1.95]];
  const BASE = DENTRO[0][1], H = 1.96, RMAX = 0.373;
  const rDentro = (y) => {
    if (y <= DENTRO[0][1]) return 0.001;
    for (let i = 1; i < DENTRO.length; i++) {
      const [r1, y1] = DENTRO[i], [r0, y0] = DENTRO[i - 1];
      if (y <= y1) { const k = (y - y0) / (y1 - y0), kk = k * k * (3 - 2 * k) * 0.35 + k * 0.65; return r0 + (r1 - r0) * kk - 0.003; }
    }
    return DENTRO[DENTRO.length - 1][0] - 0.003;
  };
  const perfil = [
    [0, 0], [0.30, 0], [0.31, 0.012], [0.295, 0.03], [0.07, 0.05], [0.036, 0.12], [0.031, 0.55], [0.033, 0.9],
    [0.052, 0.97], [0.13, 1.0], [0.262, 1.08], [0.355, 1.23], [0.395, 1.45], [0.385, 1.7], [0.355, 1.955],
    [0.345, 1.962], [0.334, 1.955], [0.363, 1.7], [0.373, 1.45], [0.333, 1.24], [0.24, 1.11], [0.12, 1.045], [0, 1.035],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const vidro = new THREE.Mesh(
    new THREE.LatheGeometry(perfil, 160),
    new THREE.MeshPhysicalMaterial({
      color: "#ffffff", roughness: 0, metalness: 0, transmission: 1, thickness: 0.06, ior: 1.6, dispersion: 5,
      clearcoat: 1, clearcoatRoughness: 0, specularIntensity: 1, envMapIntensity: 1.1, side: THREE.FrontSide,
    }),
  );
  copo.add(vidro);

  // ---------- material do suco: degradê laranja → groselha, com a "nuvem" de groselha afundando ----------
  const corLaranja = new THREE.Color("#f28a17"), corGroselha = new THREE.Color("#a3122a");
  const uSuco = { uFundo: { value: BASE - 1 }, uNuvem: { value: -10 }, uNuvemForca: { value: 0 }, uLaranja: { value: corLaranja }, uGroselha: { value: corGroselha }, uTempo: { value: 0 } };
  const suco = new THREE.MeshPhysicalMaterial({
    color: "#ffffff", roughness: 0.08, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05,
    sheen: 0.6, sheenColor: new THREE.Color("#ffd28c"), sheenRoughness: 0.4, envMapIntensity: 0.9,
  });
  suco.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uSuco);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vLocal;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvLocal = position;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>
        varying vec3 vLocal; uniform float uFundo, uNuvem, uNuvemForca, uTempo; uniform vec3 uLaranja, uGroselha;`)
      .replace("#include <color_fragment>", `#include <color_fragment>
        float ang = atan(vLocal.z, vLocal.x);
        float onda = sin(ang * 5.0 + uTempo * 1.7) * 0.018 + sin(ang * 11.0 - uTempo * 2.3) * 0.009;
        float fundo = 1.0 - smoothstep(uFundo - 0.07, uFundo + 0.07, vLocal.y + onda);
        float nuvem = uNuvemForca * exp(-pow((vLocal.y - uNuvem + onda * 2.0) / 0.12, 2.0)) * (0.55 + 0.45 * sin(ang * 3.0 + vLocal.y * 9.0));
        diffuseColor.rgb = mix(uLaranja, uGroselha, clamp(max(fundo, nuvem), 0.0, 1.0));`);
  };

  // corpo do suco (parede lateral, sobe junto com o nível)
  const SEG = 96;
  const corpo = new THREE.Mesh(new THREE.BufferGeometry(), suco);
  copo.add(corpo);
  function refazerCorpo(nivel) {
    // a lateral do suco acompanha a curva do bojo até o nível
    const pts = [new THREE.Vector2(0.0001, BASE)];
    const passos = 14;
    for (let i = 1; i <= passos; i++) { const y = BASE + (nivel - BASE) * (i / passos); pts.push(new THREE.Vector2(rDentro(y), y)); }
    const g = new THREE.LatheGeometry(pts, SEG);
    corpo.geometry.dispose();
    corpo.geometry = g;
  }

  // superfície com ondas: malha polar lida de uma grade de altura (equação de onda)
  const N = 56, ESP = (2 * RMAX) / (N - 1);
  let hAtual = new Float32Array(N * N), hAntes = new Float32Array(N * N);
  const ANEIS = 22, RAIOS = 72;
  const capPos = new Float32Array((ANEIS * RAIOS + 1) * 3);
  const capIdx = [];
  for (let a = 0; a < ANEIS; a++) for (let r = 0; r < RAIOS; r++) {
    const i0 = a === 0 ? 0 : 1 + (a - 1) * RAIOS + r, i1 = a === 0 ? 0 : 1 + (a - 1) * RAIOS + ((r + 1) % RAIOS);
    const j0 = 1 + a * RAIOS + r, j1 = 1 + a * RAIOS + ((r + 1) % RAIOS);
    if (a === 0) capIdx.push(0, j1, j0); else capIdx.push(i0, i1, j1, i0, j1, j0);
  }
  const capGeo = new THREE.BufferGeometry();
  capGeo.setAttribute("position", new THREE.BufferAttribute(capPos, 3));
  capGeo.setIndex(capIdx);
  const tampa = new THREE.Mesh(capGeo, suco);
  copo.add(tampa);
  const alturaEm = (x, z) => {
    const gx = (x + RMAX) / ESP, gz = (z + RMAX) / ESP;
    const ix = Math.min(N - 2, Math.max(0, Math.floor(gx))), iz = Math.min(N - 2, Math.max(0, Math.floor(gz)));
    const fx = gx - ix, fz = gz - iz, a = hAtual;
    return (a[iz * N + ix] * (1 - fx) + a[iz * N + ix + 1] * fx) * (1 - fz) + (a[(iz + 1) * N + ix] * (1 - fx) + a[(iz + 1) * N + ix + 1] * fx) * fz;
  };
  function atualizarTampa(nivel) {
    const r = rDentro(nivel) - 0.002;
    let k = 0;
    capPos[k++] = 0; capPos[k++] = nivel + alturaEm(0, 0); capPos[k++] = 0;
    for (let a = 1; a <= ANEIS; a++) {
      const rr = (a / ANEIS) * r;
      // menisco: o suco sobe um pouquinho na parede do copo
      const menisco = Math.pow(a / ANEIS, 8) * 0.012;
      for (let i = 0; i < RAIOS; i++) {
        const t = (i / RAIOS) * Math.PI * 2, x = Math.cos(t) * rr, z = Math.sin(t) * rr;
        capPos[k++] = x; capPos[k++] = nivel + menisco + alturaEm(x, z); capPos[k++] = z;
      }
    }
    capGeo.attributes.position.needsUpdate = true;
    capGeo.computeVertexNormals();
  }
  function ondas() {
    const c2 = 0.32, amort = 0.985, novo = hAntes;
    for (let z = 1; z < N - 1; z++) for (let x = 1; x < N - 1; x++) {
      const i = z * N + x;
      const lap = hAtual[i - 1] + hAtual[i + 1] + hAtual[i - N] + hAtual[i + N] - 4 * hAtual[i];
      novo[i] = (2 * hAtual[i] - hAntes[i] + c2 * lap) * amort;
    }
    // parede do copo: fora do círculo, a lâmina fica parada
    const rr = RMAX * RMAX;
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      const px = -RMAX + x * ESP, pz = -RMAX + z * ESP;
      if (px * px + pz * pz > rr) novo[z * N + x] = 0;
    }
    hAntes = hAtual; hAtual = novo;
  }
  const empurrar = (x, z, forca) => {
    const ix = Math.round((x + RMAX) / ESP), iz = Math.round((z + RMAX) / ESP);
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      const xx = ix + dx, zz = iz + dz;
      if (xx > 0 && zz > 0 && xx < N - 1 && zz < N - 1) hAtual[zz * N + xx] -= forca * Math.exp(-(dx * dx + dz * dz) / 2);
    }
  };

  // ---------- o fio que cai (queda livre, afina com a velocidade) ----------
  const G = 7.5;                       // gravidade em "câmera lenta" para ficar bonito
  const TOPO = 4.6, V0 = 0.35, R_FIO = 0.05;
  const BOCA = new THREE.Vector3(0.05, TOPO, 0.03), VX = -0.02;
  const ANEL = 18, FATIAS = 70;
  const fioPos = new Float32Array(FATIAS * ANEL * 3);
  const fioIdx = [];
  for (let s = 0; s < FATIAS - 1; s++) for (let a = 0; a < ANEL; a++) {
    const i = s * ANEL + a, j = s * ANEL + ((a + 1) % ANEL);
    fioIdx.push(i, i + ANEL, j, j, i + ANEL, j + ANEL);
  }
  const fioGeo = new THREE.BufferGeometry();
  fioGeo.setAttribute("position", new THREE.BufferAttribute(fioPos, 3));
  fioGeo.setIndex(fioIdx);
  const fioMat = new THREE.MeshPhysicalMaterial({ color: corLaranja, roughness: 0.04, clearcoat: 1, envMapIntensity: 1.2, sheen: 0.5, sheenColor: new THREE.Color("#ffe2a8") });
  const fio = new THREE.Mesh(fioGeo, fioMat);
  fio.frustumCulled = false;
  cena.add(fio);
  const yQueda = (t) => BOCA.y - V0 * t - 0.5 * G * t * t;
  const vQueda = (t) => V0 + G * t;
  const tAte = (y) => { const d = BOCA.y - y; return (-V0 + Math.sqrt(V0 * V0 + 2 * G * d)) / G; };

  // cada servida: [início, fim, cor, quanto sobe o nível (em altura)]
  const ALT = H - BASE - 0.2;
  const servidas = [
    { de: 0.75, ate: 2.35, cor: corLaranja, sobe: ALT * 1.05 },
    { de: 2.65, ate: 3.15, cor: corGroselha, sobe: ALT * 0.08 },
  ];
  function desenharFio(agora, superficie) {
    let ativa = null;
    for (const sv of servidas) if (agora >= sv.de && agora <= sv.ate + tAte(BASE) + 0.05) ativa = sv;
    if (!ativa) { fio.visible = false; return null; }
    fioMat.color.copy(ativa.cor);
    // líquido que saiu da boca entre "de" e "ate": no instante "agora", está a t segundos de queda
    const tMax = Math.min(agora - ativa.de, tAte(superficie));
    const tMin = Math.max(0, agora - ativa.ate);
    if (tMax <= tMin) { fio.visible = false; return null; }
    fio.visible = true;
    let k = 0;
    for (let s = 0; s < FATIAS; s++) {
      const t = tMin + (tMax - tMin) * (s / (FATIAS - 1));
      const y = yQueda(t), saiu = agora - t;
      // afina com a velocidade (vazão constante: r ∝ 1/√v) e balança um pouco, como fio de verdade
      let r = R_FIO * Math.sqrt(V0 / vQueda(t)) * 1.9;
      const ponta = Math.min(1, (tMax - t) / 0.02, (t - tMin) / 0.035 + (tMin === 0 ? 1 : 0));
      r *= 0.35 + 0.65 * ponta;
      const bx = BOCA.x + VX * t + Math.sin(saiu * 17) * 0.006 * t, bz = BOCA.z + Math.cos(saiu * 13) * 0.005 * t;
      for (let a = 0; a < ANEL; a++) {
        const ang = (a / ANEL) * Math.PI * 2;
        const rug = 1 + Math.sin(saiu * 40 + ang * 2) * 0.05 * t;
        fioPos[k++] = bx + Math.cos(ang) * r * rug; fioPos[k++] = y; fioPos[k++] = bz + Math.sin(ang) * r * rug;
      }
    }
    fioGeo.attributes.position.needsUpdate = true;
    fioGeo.computeVertexNormals();
    const batendo = agora - ativa.de >= tAte(superficie) && tMin < tAte(superficie);
    return batendo ? { sv: ativa, x: BOCA.x + VX * tAte(superficie), z: BOCA.z, v: vQueda(tAte(superficie)) } : null;
  }

  // ---------- gotas que espirram ----------
  const MAX_GOTAS = 160;
  const gotaMat = new THREE.MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.05, clearcoat: 1, envMapIntensity: 1.1 });
  const gotas = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 10), gotaMat, MAX_GOTAS);
  gotas.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  gotas.frustumCulled = false;
  copo.add(gotas);
  const vivas = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), esc = new THREE.Vector3(), pos = new THREE.Vector3();
  for (let i = 0; i < MAX_GOTAS; i++) { gotas.setMatrixAt(i, m4.makeScale(0, 0, 0)); gotas.setColorAt(i, corLaranja); }
  function espirrar(x, y, z, v, cor, quantas) {
    for (let i = 0; i < quantas && vivas.length < MAX_GOTAS; i++) {
      const ang = Math.random() * Math.PI * 2, abre = 0.25 + Math.random() * 0.9;
      const forca = v * (0.18 + Math.random() * 0.22);
      vivas.push({
        x, y, z,
        vx: Math.cos(ang) * abre * forca * 0.6, vy: forca * (0.6 + Math.random() * 0.6), vz: Math.sin(ang) * abre * forca * 0.6,
        r: 0.008 + Math.random() * 0.016, cor, parede: false,
      });
    }
  }
  function moverGotas(dt, superficie) {
    for (let i = vivas.length - 1; i >= 0; i--) {
      const g = vivas[i];
      if (g.parede) { g.vy = Math.max(-0.35, g.vy - G * 0.3 * dt); g.r *= 1 - dt * 0.6; } // escorre na parede e vai sumindo
      else g.vy -= G * dt;
      g.x += g.vx * dt; g.y += g.vy * dt; g.z += g.vz * dt;
      const rr = Math.hypot(g.x, g.z), lim = rDentro(g.y) - g.r;
      if (rr > lim && g.y < H && g.y > BASE) { g.x *= lim / rr; g.z *= lim / rr; g.vx = g.vz = 0; g.parede = true; }
      if ((g.y < superficie && g.vy < 0) || g.r < 0.004) { if (g.y < superficie) empurrar(g.x, g.z, 0.0015); vivas.splice(i, 1); }
    }
    for (let i = 0; i < MAX_GOTAS; i++) {
      const g = vivas[i];
      if (g) { pos.set(g.x, g.y, g.z); esc.setScalar(g.r); m4.compose(pos, q, esc); gotas.setColorAt(i, g.cor); }
      else m4.makeScale(0, 0, 0);
      gotas.setMatrixAt(i, m4);
    }
    gotas.instanceMatrix.needsUpdate = true;
    if (gotas.instanceColor) gotas.instanceColor.needsUpdate = true;
  }

  // ---------- rodela de limão de verdade (casca, parte branca e gomos) ----------
  const texLimao = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 512;
    const x = c.getContext("2d"), m = 256;
    x.fillStyle = "#3d7a1c"; x.beginPath(); x.arc(m, m, 256, 0, Math.PI * 2); x.fill();
    x.fillStyle = "#6fa52c"; x.beginPath(); x.arc(m, m, 246, 0, Math.PI * 2); x.fill();
    x.fillStyle = "#eef3d2"; x.beginPath(); x.arc(m, m, 232, 0, Math.PI * 2); x.fill();
    const gomos = 10;
    for (let i = 0; i < gomos; i++) {
      const a0 = (i / gomos) * Math.PI * 2 + 0.035, a1 = ((i + 1) / gomos) * Math.PI * 2 - 0.035;
      const gr = x.createRadialGradient(m, m, 18, m, m, 214);
      gr.addColorStop(0, "#e9f2b0"); gr.addColorStop(0.35, "#cfe46a"); gr.addColorStop(1, "#a9cc3a");
      x.fillStyle = gr; x.beginPath(); x.moveTo(m + Math.cos((a0 + a1) / 2) * 20, m + Math.sin((a0 + a1) / 2) * 20);
      x.arc(m, m, 214, a0, a1); x.closePath(); x.fill();
      for (let k = 0; k < 90; k++) {
        const a = a0 + Math.random() * (a1 - a0), rr = 30 + Math.random() * 180;
        x.fillStyle = `rgba(255,255,230,${0.08 + Math.random() * 0.18})`;
        x.beginPath(); x.ellipse(m + Math.cos(a) * rr, m + Math.sin(a) * rr, 2 + Math.random() * 5, 1 + Math.random() * 2, a, 0, Math.PI * 2); x.fill();
      }
    }
    x.fillStyle = "#f4f6dc"; x.beginPath(); x.arc(m, m, 16, 0, Math.PI * 2); x.fill();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    return t;
  })();
  const polpaMat = new THREE.MeshPhysicalMaterial({ map: texLimao, roughness: 0.32, clearcoat: 0.9, clearcoatRoughness: 0.15, sheen: 0.6, sheenColor: new THREE.Color("#f4ffd0") });
  const cascaMat = new THREE.MeshPhysicalMaterial({ color: "#3f7d1e", roughness: 0.45, clearcoat: 0.5 });
  const RL = 0.16;
  const limao = new THREE.Mesh(new THREE.CylinderGeometry(RL, RL, 0.04, 72), [cascaMat, polpaMat, polpaMat]);
  const ANG_LIMAO = 0.62;
  const LIMAO_FIM = new THREE.Vector3(Math.cos(ANG_LIMAO) * 0.335, H + RL * 0.2, Math.sin(ANG_LIMAO) * 0.335);
  limao.rotation.order = "YXZ";
  limao.rotation.y = -ANG_LIMAO;
  limao.rotation.x = Math.PI / 2;
  limao.visible = false;
  copo.add(limao);
  const molaLimao = { y: LIMAO_FIM.y + 1.6, v: 0, gira: 0, vg: 0, bateu: false };

  // ---------- canudo ----------
  const canudo = new THREE.Mesh(
    new THREE.CylinderGeometry(0.017, 0.017, 1.28, 24, 1, true),
    new THREE.MeshPhysicalMaterial({ color: "#151412", roughness: 0.3, clearcoat: 0.9, side: THREE.DoubleSide }),
  );
  canudo.visible = false;
  copo.add(canudo);
  const PE_CANUDO = new THREE.Vector3(0.06, BASE + 0.03, -0.05);
  const molaCanudo = { y: PE_CANUDO.y + 2.2, v: 0, incl: 0, vi: 0 };
  const INCL_FIM = 0.36;

  // sombra macia
  const sombra = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 256;
    const x = c.getContext("2d"), g = x.createRadialGradient(128, 128, 8, 128, 128, 128);
    g.addColorStop(0, "rgba(60,40,20,.32)"); g.addColorStop(0.45, "rgba(60,40,20,.12)"); g.addColorStop(1, "rgba(60,40,20,0)");
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.002;
    return m;
  })();
  cena.add(sombra);

  // ---------- câmera ----------
  function ajustar() {
    const w = palco.clientWidth, h = palco.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const emPe = w / h < 0.8;
    camera.position.set(0, 2.4, emPe ? 12.2 : 10.2);
    camera.lookAt(0, emPe ? 1.25 : 1.12, 0);
    camera.updateProjectionMatrix();
  }
  ajustar();
  addEventListener("resize", ajustar);

  // ---------- a cena andando ----------
  const suave = (t) => t * t * (3 - 2 * t);
  const entre = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
  let nivel = BASE + 0.0005, nuvem = -10, nuvemForca = 0, fundoGroselha = BASE - 1;
  let tempo = 0, ultimo = performance.now(), avisou = false;
  refazerCorpo(nivel);

  function passo(dt) {
    tempo += dt;
    const t = tempo;

    const surge = suave(entre(t, 0, 0.8));
    copo.position.y = (1 - surge) * 0.35;
    renderer.toneMappingExposure = 2.6 - 1.6 * surge;   // sai do branco, como foto revelando
    sombra.material.opacity = surge;

    const imp = desenharFio(t, nivel);
    if (imp) {
      const subida = imp.sv.sobe / (imp.sv.ate - imp.sv.de);
      nivel = Math.min(BASE + ALT, nivel + subida * dt);
      empurrar(imp.x, imp.z, 0.012 * (nivel < BASE + 0.03 ? 0.4 : 1));
      espirrar(imp.x, nivel, imp.z, imp.v, imp.sv.cor, nivel < BASE + 0.05 ? 3 : 2);
      if (imp.sv.cor === corGroselha) { nuvemForca = Math.min(1, nuvemForca + dt * 3); nuvem = nivel - 0.05; }
    }
    if (t > 2.7) {
      nuvem += (BASE + 0.1 - nuvem) * Math.min(1, dt * 1.6);
      if (t > 3.3) { nuvemForca *= Math.pow(0.35, dt); fundoGroselha += (BASE + ALT * 0.3 - fundoGroselha) * Math.min(1, dt * 1.4); }
      else fundoGroselha = Math.max(fundoGroselha, BASE + 0.02);
    }
    uSuco.uNuvem.value = nuvem; uSuco.uNuvemForca.value = nuvemForca; uSuco.uFundo.value = fundoGroselha; uSuco.uTempo.value = t;

    ondas();
    refazerCorpo(nivel);
    tampa.visible = nivel > BASE + 0.004;
    corpo.visible = tampa.visible;
    if (tampa.visible) atualizarTampa(nivel);
    moverGotas(dt, nivel);

    // limão: cai e encaixa na borda com um quique amortecido
    if (t > 3.45) {
      limao.visible = true;
      if (!molaLimao.bateu) {
        molaLimao.v -= G * dt; molaLimao.y += molaLimao.v * dt;
        if (molaLimao.y <= LIMAO_FIM.y) { molaLimao.y = LIMAO_FIM.y; molaLimao.v *= -0.28; molaLimao.vg = 2.4; if (Math.abs(molaLimao.v) < 0.2) molaLimao.bateu = true; }
      } else { molaLimao.v += (-(molaLimao.y - LIMAO_FIM.y) * 140 - molaLimao.v * 12) * dt; molaLimao.y += molaLimao.v * dt; }
      molaLimao.vg += (-molaLimao.gira * 90 - molaLimao.vg * 7) * dt;
      molaLimao.gira += molaLimao.vg * dt;
      limao.position.set(LIMAO_FIM.x, molaLimao.y, LIMAO_FIM.z);
      limao.rotation.z = molaLimao.gira * 0.12;
    }
    // canudo: cai, bate no fundo e se apoia na borda
    if (t > 3.7) {
      canudo.visible = true;
      if (molaCanudo.y > PE_CANUDO.y) { molaCanudo.v -= G * dt; molaCanudo.y = Math.max(PE_CANUDO.y, molaCanudo.y + molaCanudo.v * dt); }
      else { molaCanudo.vi += ((INCL_FIM - molaCanudo.incl) * 60 - molaCanudo.vi * 6) * dt; molaCanudo.incl += molaCanudo.vi * dt; }
      const L = 1.28, a = molaCanudo.incl;
      canudo.rotation.set(0, 0, a);
      canudo.position.set(PE_CANUDO.x - Math.sin(a) * L / 2, molaCanudo.y + Math.cos(a) * L / 2, PE_CANUDO.z);
    }

    if (!avisou && t > 4.0) { avisou = true; pronto(); }
  }

  if (parado) for (let i = 0; i < 540; i++) passo(1 / 60); // sem animação: já mostra o drink pronto

  function quadro(agora) {
    const dt = Math.min(1 / 30, (agora - ultimo) / 1000);
    ultimo = agora;
    passo(dt);
    copo.rotation.y = -0.4 + tempo * 0.07;
    renderer.render(cena, camera);
    requestAnimationFrame(quadro);
  }
  requestAnimationFrame((a) => { ultimo = a; quadro(a); });
}
