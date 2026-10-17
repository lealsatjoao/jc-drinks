// Abertura da JC Drinks: um Sex on the Beach servido numa taça de cristal em V, tudo em código e com física.
//  - o gelo cai primeiro: bate no vidro e um no outro e fica no fundo da taça; quando o suco sobe, ele boia;
//  - o fio de suco cai pela gravidade e afina conforme ganha velocidade (conservação do volume);
//    a vazão é constante, então numa taça em V o nível sobe rápido no começo e devagar no fim (volume do cone);
//  - onde ele bate, a superfície afunda e faz ondas (sem gotinhas voando, para parecer de verdade);
//  - a superfície do suco tem equação de onda: treme no impacto, quando o gelo boia e quando as gotas caem;
//  - a groselha entra pela superfície e afunda como uma nuvem até o fundo (é mais densa);
//  - a meia rodela de laranja cai e encaixa na borda e o canudo com guarda-chuva cai e se apoia no gelo.
// O vidro reflete uma foto 360° de estúdio (img/estudio.hdr, Poly Haven, CC0).
// Sem 3D (WebGL) no aparelho: fica a foto parada e o resto da página funciona igual.
import * as THREE from "three";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { Reflector } from "three/addons/objects/Reflector.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const palco = document.getElementById("palco");
const parado = matchMedia("(prefers-reduced-motion: reduce)").matches;
const pronto = () => document.documentElement.classList.add("abertura-pronta");
// fundo da abertura: "festa" (padrão: preto com luzes neon passando) ou "branco" (?fundo=branco)
const FUNDO = new URLSearchParams(location.search).get("fundo") || "festa";
document.documentElement.dataset.fundo = FUNDO;

try {
  iniciar();
} catch (e) {
  console.warn("Abertura sem 3D:", e);
  document.documentElement.classList.add("sem-3d");
  pronto();
}

function iniciar() {
  // bordas suaves (sem serrilhado) em todo aparelho, e uma resolução que se ajusta sozinha:
  // começa nítida e, se os quadros demorarem, baixa um pouco até ficar fluido
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  if (!renderer.getContext()) throw new Error("sem WebGL");
  let resolucao = Math.min(devicePixelRatio, 2);
  renderer.setPixelRatio(resolucao);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  palco.appendChild(renderer.domElement);

  const cena = new THREE.Scene();
  cena.background = new THREE.Color("#ffffff");
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 60);

  // reflexo de estúdio de verdade
  const pm = new THREE.PMREMGenerator(renderer);
  new RGBELoader().load("img/estudio.hdr", (hdr) => {
    cena.environment = pm.fromEquirectangular(hdr).texture;
    hdr.dispose();
  });
  const luz = new THREE.DirectionalLight("#ffffff", 1.3);
  luz.position.set(-3, 6, 4);
  cena.add(luz);
  const contra = new THREE.DirectionalLight("#ffffff", 0.8);
  contra.position.set(3, 3, -5);
  cena.add(contra);
  cena.add(new THREE.HemisphereLight("#ffffff", "#ece8e2", 0.55));

  const copo = new THREE.Group();
  cena.add(copo);

  // ---------- taça de cristal em V: pé, haste fina e bojo em cone ----------
  const A = 1.07;                 // ponta de dentro do cone (onde o suco começa)
  const H = 1.786;                // altura da borda
  const RBORDA = 0.645;           // raio de dentro na borda
  const K = RBORDA / (1.78 - A);  // abertura do cone (raio por altura)
  const RMAX = 0.66;
  const rDentro = (y) => (y <= A ? 0.001 : Math.max(0.001, (y - A) * K - 0.003));
  const perfil = [
    [0, 0], [0.40, 0], [0.412, 0.01], [0.40, 0.024], [0.09, 0.042], [0.032, 0.11], [0.022, 0.5], [0.024, 0.93],
    [0.04, 1.0], [0.07, 1.04], [0.66, 1.778], [0.663, 1.784], [0.655, 1.788], [0.647, 1.782], [0.03, 1.09], [0.012, 1.074], [0, 1.07],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  // cristal: transparente no meio e com contorno escuro e brilho nas bordas, como em foto de estúdio (fresnel), sem granulado
  const cristal = new THREE.MeshPhysicalMaterial({
    color: "#000000", roughness: 0.015, metalness: 0, transparent: true, opacity: 0.0, depthWrite: false,
    clearcoat: 1, clearcoatRoughness: 0, specularIntensity: 1, ior: 1.6, envMapIntensity: 1.7, side: THREE.DoubleSide,
  });
  cristal.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", `#include <common>
      #define CONTORNO_VIDRO ${FUNDO === "festa" ? "vec3(0.78, 0.8, 0.86)" : "vec3(0.16, 0.15, 0.14)"}`).replace("#include <opaque_fragment>", `
      float borda = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 3.0);
      float brilho = dot(outgoingLight, vec3(0.299, 0.587, 0.114));
      float reflexo = smoothstep(0.7, 1.4, brilho);
      diffuseColor.a = clamp(borda * 0.7 + reflexo * 0.7, 0.0, 1.0);
      outgoingLight = mix(mix(vec3(1.0), CONTORNO_VIDRO, borda * 0.9), vec3(1.25), reflexo);
      #include <opaque_fragment>`);
  };
  const vidro = new THREE.Mesh(new THREE.LatheGeometry(perfil, 128), cristal);
  vidro.renderOrder = 2;
  copo.add(vidro);

  // ---------- "JC Drinks" gravado no vidro (jateado: branco fosco), na frente do bojo ----------
  // a letra é colocada pela medida em volta do cone (ângulo × raio), então não fica esticada nem torta
  const gravura = (() => {
    const c = document.createElement("canvas"); c.width = 1024; c.height = 768;
    const t = new THREE.CanvasTexture(c);
    const desenhar = () => {
      const x = c.getContext("2d");
      x.clearRect(0, 0, 1024, 768);
      x.fillStyle = "#ffffff"; x.textAlign = "center"; x.textBaseline = "alphabetic";
      x.font = "400 420px Marcellus, Georgia, serif";
      x.fillText("J", 512 - 96, 470); x.fillText("C", 512 + 96, 470);
      x.font = "400 62px Jost, Helvetica, sans-serif";
      if ("letterSpacing" in x) x.letterSpacing = "38px";
      x.fillText("DRINKS", 512 + 19, 630);
      t.needsUpdate = true;
    };
    desenhar();
    document.fonts?.load("420px Marcellus").then(() => document.fonts.load("74px Jost")).then(desenhar).catch(() => {});
    return t;
  })();
  const Y0_GRAV = 1.25, ALT_GRAV = 0.3, LARG_GRAV = 0.4;
  const raioFora = (y) => 0.07 + (y - 1.04) * (0.59 / 0.738) + 0.0015;
  const jateado = new THREE.MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.9, transparent: true, opacity: 0.62, depthWrite: false, side: THREE.FrontSide });
  jateado.onBeforeCompile = (sh) => {
    sh.uniforms.uGravura = { value: gravura };
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vGrav;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvGrav = position;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vGrav; uniform sampler2D uGravura;")
      .replace("#include <color_fragment>", `#include <color_fragment>
        float angG = atan(vGrav.x, vGrav.z);
        vec2 uvG = vec2(0.5 + angG * length(vGrav.xz) / ${LARG_GRAV.toFixed(3)}, (vGrav.y - ${Y0_GRAV.toFixed(3)}) / ${ALT_GRAV.toFixed(3)});
        if (uvG.x < 0.0 || uvG.x > 1.0 || uvG.y < 0.0 || uvG.y > 1.0) discard;
        float marca = texture2D(uGravura, vec2(uvG.x, uvG.y)).a;
        if (marca < 0.02) discard;
        diffuseColor.a *= marca;`);
  };
  const pontosGrav = [];
  for (let i = 0; i <= 12; i++) { const y = Y0_GRAV - 0.02 + (ALT_GRAV + 0.04) * (i / 12); pontosGrav.push(new THREE.Vector2(raioFora(y), y)); }
  const marcaVidro = new THREE.Mesh(new THREE.LatheGeometry(pontosGrav, 160, -1.2, 2.4), jateado);
  marcaVidro.renderOrder = 3;
  copo.add(marcaVidro);

  // ---------- material do suco: degradê laranja → groselha, com a "nuvem" de groselha afundando ----------
  const corLaranja = new THREE.Color("#ec7a0e"), corGroselha = new THREE.Color("#9c0f26");
  const uSuco = { uFundo: { value: A - 1 }, uNuvem: { value: -10 }, uNuvemForca: { value: 0 }, uLaranja: { value: corLaranja }, uGroselha: { value: corGroselha }, uTempo: { value: 0 } };
  const suco = new THREE.MeshPhysicalMaterial({
    color: "#ffffff", roughness: 0.14, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.08, specularIntensity: 0.55,
    sheen: 0.15, sheenColor: new THREE.Color("#ffd28c"), sheenRoughness: 0.4, envMapIntensity: 0.35,
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

  // corpo do suco (cone que sobe junto com o nível)
  const SEG = 72;
  const corpo = new THREE.Mesh(new THREE.BufferGeometry(), suco);
  copo.add(corpo);
  function refazerCorpo(nivel) {
    const pts = [new THREE.Vector2(0.0001, A)];
    for (let i = 1; i <= 10; i++) { const y = A + (nivel - A) * (i / 10); pts.push(new THREE.Vector2(rDentro(y), y)); }
    corpo.geometry.dispose();
    corpo.geometry = new THREE.LatheGeometry(pts, SEG);
  }

  // superfície com ondas: malha polar lida de uma grade de altura (equação de onda)
  const N = 64, ESP = (2 * RMAX) / (N - 1);
  let hAtual = new Float32Array(N * N), hAntes = new Float32Array(N * N);
  const ANEIS = 18, RAIOS = 72;
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
      const menisco = Math.pow(a / ANEIS, 8) * 0.01; // o suco sobe um pouquinho no vidro
      for (let i = 0; i < RAIOS; i++) {
        const t = (i / RAIOS) * Math.PI * 2, x = Math.cos(t) * rr, z = Math.sin(t) * rr;
        capPos[k++] = x; capPos[k++] = nivel + menisco + alturaEm(x, z); capPos[k++] = z;
      }
    }
    capGeo.attributes.position.needsUpdate = true;
    capGeo.computeVertexNormals();
  }
  let agitacao = 1;
  function ondas(nivel) {
    if (agitacao < 1e-5) return false; // suco parado: não precisa calcular nada
    const c2 = 0.3, amort = 0.984, novo = hAntes;
    for (let z = 1; z < N - 1; z++) for (let x = 1; x < N - 1; x++) {
      const i = z * N + x;
      const lap = hAtual[i - 1] + hAtual[i + 1] + hAtual[i - N] + hAtual[i + N] - 4 * hAtual[i];
      novo[i] = (2 * hAtual[i] - hAntes[i] + c2 * lap) * amort;
    }
    // vidro: fora do círculo do nível atual, a lâmina fica parada
    const r = rDentro(nivel), rr = r * r;
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      const px = -RMAX + x * ESP, pz = -RMAX + z * ESP;
      if (px * px + pz * pz > rr) novo[z * N + x] = 0;
    }
    hAntes = hAtual; hAtual = novo;
    let maior = 0;
    for (let i = 0; i < novo.length; i += 7) { const v = Math.abs(novo[i]); if (v > maior) maior = v; }
    agitacao = maior;
    return true;
  }
  const empurrar = (x, z, forca) => {
    agitacao = 1;
    const ix = Math.round((x + RMAX) / ESP), iz = Math.round((z + RMAX) / ESP);
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      const xx = ix + dx, zz = iz + dz;
      if (xx > 0 && zz > 0 && xx < N - 1 && zz < N - 1) hAtual[zz * N + xx] -= forca * Math.exp(-(dx * dx + dz * dz) / 2);
    }
  };

  // ---------- gelo: cubos de verdade, com física (gravidade, batida no vidro e entre eles, boia no suco) ----------
  const G = 7.5; // gravidade em "câmera lenta" para ficar bonito
  // gelo cristalino: quase transparente no meio, com reflexo forte nas quinas e faces de lado
  const gelo = new THREE.MeshPhysicalMaterial({
    color: "#cfe6f0", roughness: 0.02, metalness: 0, transparent: true, opacity: 0.12, ior: 1.31,
    clearcoat: 1, clearcoatRoughness: 0, specularIntensity: 1, envMapIntensity: 2.4,
  });
  // faces do gelo não são lisas: ondulações de quando começa a derreter (mapa de relevo feito em código)
  gelo.normalMap = (() => {
    const T = 256, alt = new Float32Array(T * T);
    for (let o = 0; o < 5; o++) {
      const f = 2 + o * 3, fase = Math.random() * 10;
      for (let y = 0; y < T; y++) for (let x = 0; x < T; x++)
        alt[y * T + x] += Math.sin((x / T) * f * 6.283 + fase + Math.sin((y / T) * f * 4.1) * 1.3) * Math.cos((y / T) * f * 6.283 + fase * 0.7) / (o + 1);
    }
    const c = document.createElement("canvas"); c.width = c.height = T;
    const x = c.getContext("2d"), img = x.createImageData(T, T);
    for (let y = 0; y < T; y++) for (let xx = 0; xx < T; xx++) {
      const h = (a, b) => alt[((b + T) % T) * T + ((a + T) % T)];
      const dx = (h(xx + 1, y) - h(xx - 1, y)) * 0.9, dy = (h(xx, y + 1) - h(xx, y - 1)) * 0.9;
      const l = Math.hypot(dx, dy, 1), k = (y * T + xx) * 4;
      img.data[k] = (-dx / l * 0.5 + 0.5) * 255; img.data[k + 1] = (-dy / l * 0.5 + 0.5) * 255; img.data[k + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[k + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  })();
  gelo.normalScale = new THREE.Vector2(0.6, 0.6);
  // quinas e faces de lado ficam escuras e azuladas (luz que reflete por dentro), como gelo de verdade em fundo branco
  gelo.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", `#include <common>
      #define CONTORNO_GELO ${FUNDO === "festa" ? "vec3(0.75, 0.86, 0.95)" : "vec3(0.3, 0.4, 0.48)"}
      #define BASE_GELO ${FUNDO === "festa" ? "0.2" : "0.1"}`).replace("#include <opaque_fragment>", `
      float lado = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 2.0);
      float luzGelo = dot(outgoingLight, vec3(0.299, 0.587, 0.114));
      float reflexoGelo = smoothstep(0.9, 1.6, luzGelo);
      diffuseColor.a = clamp(BASE_GELO + lado * 0.55 + reflexoGelo * 0.75, 0.0, 1.0);
      outgoingLight = mix(mix(vec3(0.93, 0.97, 1.0), CONTORNO_GELO, lado * 0.8), vec3(1.3), reflexoGelo);
      #include <opaque_fragment>`);
  };
  // miolo branco e nublado (água que congelou por último) e bolhinhas presas
  const miolo = new THREE.MeshPhysicalMaterial({ color: "#ffffff", roughness: 1, transparent: true, opacity: 0.16, depthWrite: false });
  const bolha = new THREE.MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.2, transparent: true, opacity: 0.55, depthWrite: false });
  const LADO = 0.16, RAIO_GELO = LADO * 0.84; // raio que cobre os cantos do cubo: o gelo nunca atravessa o vidro
  const cubos = [0, 1, 2, 3, 4].map((i) => {
    const m = new THREE.Mesh(new RoundedBoxGeometry(LADO, LADO * 0.94, LADO * 1.02, 4, 0.025), gelo);
    const nuvemGelo = new THREE.Mesh(new RoundedBoxGeometry(LADO * 0.5, LADO * 0.42, LADO * 0.46, 2, 0.04), miolo);
    nuvemGelo.rotation.set(0.3 * i, 0.5, 0.2);
    m.add(nuvemGelo);
    for (let k = 0; k < 5; k++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.004 + Math.random() * 0.005, 8, 6), bolha);
      b.position.set((Math.random() - 0.5) * LADO * 0.6, (Math.random() - 0.5) * LADO * 0.6, (Math.random() - 0.5) * LADO * 0.6);
      m.add(b);
    }
    m.visible = false;
    copo.add(m);
    const ang = i * 2.2 + 0.4;
    return {
      m, cai: 0.95 + i * 0.22,
      p: new THREE.Vector3(Math.cos(ang) * 0.06, 4.6 + i * 0.3, Math.sin(ang) * 0.06), v: new THREE.Vector3(0, -0.4, 0),
      giro: new THREE.Vector3((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6),
      tocouSuco: false,
    };
  });
  const nCone = new THREE.Vector2();
  function moverGelo(dt, t, nivel) {
    const ativos = cubos.filter((c) => t >= c.cai);
    for (const c of ativos) {
      c.m.visible = true;
      // dentro do suco: empuxo (o gelo é mais leve que o suco) e o suco freia o movimento
      const fundo = Math.min(1, Math.max(0, (nivel - (c.p.y - RAIO_GELO)) / (2 * RAIO_GELO)));
      c.v.y += (-G + G * fundo * 1.2) * dt; // boia com uma ponta para fora
      if (fundo > 0) { c.v.multiplyScalar(1 - Math.min(1, 3.5 * fundo * dt)); c.giro.multiplyScalar(1 - Math.min(1, 4 * fundo * dt)); }
      if (fundo > 0.05 && !c.tocouSuco) { c.tocouSuco = true; empurrar(c.p.x, c.p.z, 0.05); }
      if (fundo > 0) { c.p.x *= 1 - dt * 0.3; c.p.z *= 1 - dt * 0.3; }
      c.p.addScaledVector(c.v, dt);
    }
    // batida no vidro (parede do cone) e entre os cubos, algumas vezes por quadro para ficar firme
    for (let it = 0; it < 4; it++) {
      for (const c of ativos) {
        const r = Math.hypot(c.p.x, c.p.z) || 1e-6;
        nCone.set(-1, K).normalize();                         // normal da parede, para dentro e para cima
        const d = (-r + K * (c.p.y - A)) / Math.hypot(1, K); // distância até a parede
        if (d < RAIO_GELO && c.p.y < H + 0.4) {
          const fura = RAIO_GELO - d, ux = c.p.x / r, uz = c.p.z / r;
          c.p.x += nCone.x * fura * ux; c.p.z += nCone.x * fura * uz; c.p.y += nCone.y * fura;
          const vn = (c.v.x * ux + c.v.z * uz) * nCone.x + c.v.y * nCone.y;
          if (vn < 0) {
            c.v.x -= (1.3 * vn) * nCone.x * ux; c.v.z -= (1.3 * vn) * nCone.x * uz; c.v.y -= 1.3 * vn * nCone.y;
            c.v.multiplyScalar(0.82);                                 // atrito com o vidro
            c.giro.multiplyScalar(0.7).add(new THREE.Vector3(c.v.z, 0, -c.v.x).multiplyScalar(2));
          }
        }
      }
      for (let i = 0; i < ativos.length; i++) for (let j = i + 1; j < ativos.length; j++) {
        const a = ativos[i], b = ativos[j], dx = b.p.clone().sub(a.p), l = dx.length(), min = RAIO_GELO * 1.55;
        if (l < min && l > 1e-6) {
          dx.divideScalar(l);
          const fura = (min - l) / 2;
          a.p.addScaledVector(dx, -fura); b.p.addScaledVector(dx, fura);
          const vr = b.v.clone().sub(a.v).dot(dx);
          if (vr < 0) { a.v.addScaledVector(dx, vr * 0.62); b.v.addScaledVector(dx, -vr * 0.62); a.giro.multiplyScalar(0.8); b.giro.multiplyScalar(0.8); }
        }
      }
    }
    for (const c of ativos) {
      c.giro.multiplyScalar(1 - Math.min(1, dt * 1.2));
      if (c.v.lengthSq() < 0.002 && c.p.y < nivel) c.giro.multiplyScalar(0.9);
      c.m.rotation.x += c.giro.x * dt; c.m.rotation.y += c.giro.y * dt; c.m.rotation.z += c.giro.z * dt;
      c.m.position.copy(c.p);
    }
  }

  // ---------- o fio que cai (queda livre, afina com a velocidade) ----------
  const TOPO = 4.8, V0 = 0.35, R_FIO = 0.05;
  const BOCA = new THREE.Vector3(-0.3, TOPO, 0.06), VX = 0.015;
  const ANEL = 20, FATIAS = 80;
  const fioPos = new Float32Array(FATIAS * ANEL * 3), fioUv = new Float32Array(FATIAS * ANEL * 2);
  const fioIdx = [];
  for (let s = 0; s < FATIAS - 1; s++) for (let a = 0; a < ANEL; a++) {
    const i = s * ANEL + a, j = s * ANEL + ((a + 1) % ANEL);
    fioIdx.push(i, i + ANEL, j, j, i + ANEL, j + ANEL);
  }
  const fioGeo = new THREE.BufferGeometry();
  fioGeo.setAttribute("position", new THREE.BufferAttribute(fioPos, 3));
  fioGeo.setAttribute("uv", new THREE.BufferAttribute(fioUv, 2));
  fioGeo.setIndex(fioIdx);
  // listras finas claras e escuras que descem junto com o líquido: mostram que ele está correndo
  const listras = (() => {
    const c = document.createElement("canvas"); c.width = 64; c.height = 256;
    const x = c.getContext("2d");
    x.fillStyle = "#ffffff"; x.fillRect(0, 0, 64, 256);
    for (let i = 0; i < 26; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? "255,240,210" : "150,70,10"},${0.08 + Math.random() * 0.16})`; x.fillRect(Math.random() * 64, 0, 1 + Math.random() * 5, 256); }
    for (let i = 0; i < 18; i++) { x.fillStyle = `rgba(150,70,10,${0.05 + Math.random() * 0.08})`; x.fillRect(0, Math.random() * 256, 64, 2 + Math.random() * 10); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const fioMat = new THREE.MeshPhysicalMaterial({ color: corLaranja, map: listras, roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.4, sheen: 0.5, sheenColor: new THREE.Color("#ffe2a8") });
  const fio = new THREE.Mesh(fioGeo, fioMat);
  fio.frustumCulled = false;
  cena.add(fio);
  const yQueda = (t) => BOCA.y - V0 * t - 0.5 * G * t * t;
  const vQueda = (t) => V0 + G * t;
  const tAte = (y) => { const d = BOCA.y - y; return (-V0 + Math.sqrt(V0 * V0 + 2 * G * d)) / G; };
  // onde o fio para: no suco ou, com a taça ainda vazia, na parede do V (e escorre para o fundo)
  const XF = Math.hypot(BOCA.x, BOCA.z);
  const pareda = A + (XF + 0.03) / K;
  const ondeBate = (nivel) => Math.max(nivel, pareda);

  // cada servida: [início, fim, cor, quanto de suco entra (fração da taça)]
  const NIVEL_FIM = 1.62;
  const VOL = (y) => Math.pow(Math.max(0, y - A), 3);       // volume do cone ∝ altura³
  const servidas = [
    { de: 2.55, ate: 4.25, cor: corLaranja, vol: VOL(NIVEL_FIM) * 0.93 },
    { de: 4.55, ate: 5.0, cor: corGroselha, vol: VOL(NIVEL_FIM) * 0.07 },
  ];
  function desenharFio(agora, superficie) {
    let ativa = null;
    for (const sv of servidas) if (agora >= sv.de && agora <= sv.ate + tAte(A) + 0.05) ativa = sv;
    if (!ativa) { fio.visible = false; return null; }
    fioMat.color.copy(ativa.cor).lerp(new THREE.Color("#ffffff"), 0.08);
    const tMax = Math.min(agora - ativa.de, tAte(superficie));
    const tMin = Math.max(0, agora - ativa.ate);
    if (tMax <= tMin) { fio.visible = false; return null; }
    fio.visible = true;
    let k = 0, u = 0;
    for (let s = 0; s < FATIAS; s++) {
      const t = tMin + (tMax - tMin) * (s / (FATIAS - 1));
      const y = yQueda(t), saiu = agora - t;
      // vazão constante: r ∝ 1/√v; balança um pouco, como fio de verdade
      let r = R_FIO * Math.sqrt(V0 / vQueda(t)) * 1.9;
      const ponta = Math.min(1, (tMax - t) / 0.02, (t - tMin) / 0.035 + (tMin === 0 ? 1 : 0));
      r *= 0.35 + 0.65 * ponta;
      const bx = BOCA.x + VX * t + Math.sin(saiu * 17) * 0.006 * t, bz = BOCA.z + Math.cos(saiu * 13) * 0.005 * t;
      for (let a = 0; a < ANEL; a++) {
        const ang = (a / ANEL) * Math.PI * 2;
        const rug = 1 + Math.sin(saiu * 40 + ang * 2) * 0.05 * t;
        fioPos[k++] = bx + Math.cos(ang) * r * rug; fioPos[k++] = y; fioPos[k++] = bz + Math.sin(ang) * r * rug;
        fioUv[u++] = a / ANEL; fioUv[u++] = saiu * 1.6; // a textura anda junto com o líquido
      }
    }
    fioGeo.attributes.position.needsUpdate = true;
    fioGeo.attributes.uv.needsUpdate = true;
    fioGeo.computeVertexNormals();
    const batendo = agora - ativa.de >= tAte(superficie) && tMin < tAte(superficie);
    return batendo ? { sv: ativa, x: BOCA.x + VX * tAte(superficie), y: superficie, z: BOCA.z, v: vQueda(tAte(superficie)) } : null;
  }

  // ---------- gotas que espirram ----------
  const MAX_GOTAS = 180;
  const gotaMat = new THREE.MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.05, clearcoat: 1, envMapIntensity: 1.2 });
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
      const forca = v * (0.16 + Math.random() * 0.2);
      vivas.push({
        x, y, z,
        vx: Math.cos(ang) * abre * forca * 0.6, vy: forca * (0.6 + Math.random() * 0.6), vz: Math.sin(ang) * abre * forca * 0.6,
        r: 0.007 + Math.random() * 0.014, cor, parede: false,
      });
    }
  }
  function moverGotas(dt, superficie) {
    for (let i = vivas.length - 1; i >= 0; i--) {
      const g = vivas[i];
      if (g.parede) { g.vy = Math.max(-0.35, g.vy - G * 0.3 * dt); g.r *= 1 - dt * 0.6; } // escorre no vidro e vai sumindo
      else g.vy -= G * dt;
      g.x += g.vx * dt; g.y += g.vy * dt; g.z += g.vz * dt;
      const rr = Math.hypot(g.x, g.z), lim = rDentro(g.y) - g.r;
      if (rr > lim && g.y < H && g.y > A) { g.x *= lim / rr; g.z *= lim / rr; g.vx = g.vz = 0; g.parede = true; }
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

  // ---------- meia rodela de laranja, feita em código ----------
  // casca com poros de óleo, parte branca, gomos com gominhos de suco virados para o centro, películas e miolo;
  // relevo (bump), brilho molhado e luz que atravessa a polpa (translucidez, como fruta de verdade contra a luz).
  // É meia rodela (a laranja cortada no meio), em pé, com a borda da taça entrando no corte reto.
  const aleatorio = (() => { let n = 7; return () => ((n = (n * 16807) % 2147483647) - 1) / 2147483646; })();
  const TAM = 1024, M = TAM / 2;
  const corLar = document.createElement("canvas"), altLar = document.createElement("canvas");
  corLar.width = corLar.height = altLar.width = altLar.height = TAM;
  (() => {
    const c = corLar.getContext("2d"), h = altLar.getContext("2d");
    const R = M, R_CASCA = R * 0.935, R_BRANCO = R * 0.9, R_GOMO = R * 0.89, GOMOS = 10;
    // casca
    let g = c.createRadialGradient(M, M, R_CASCA, M, M, R);
    g.addColorStop(0, "#ffa531"); g.addColorStop(0.5, "#ff8a12"); g.addColorStop(1, "#e86c00");
    c.fillStyle = g; c.beginPath(); c.arc(M, M, R, 0, Math.PI * 2); c.fill();
    h.fillStyle = "#9a9a9a"; h.beginPath(); h.arc(M, M, R, 0, Math.PI * 2); h.fill();
    // parte branca (mesocarpo), meio translúcida, com um verde claro perto da casca
    g = c.createRadialGradient(M, M, R_GOMO, M, M, R_CASCA);
    g.addColorStop(0, "#fff6e6"); g.addColorStop(0.6, "#fff1da"); g.addColorStop(1, "#ffd08a");
    c.fillStyle = g; c.beginPath(); c.arc(M, M, R_CASCA, 0, Math.PI * 2); c.fill();
    h.fillStyle = "#bdbdbd"; h.beginPath(); h.arc(M, M, R_CASCA, 0, Math.PI * 2); h.fill();
    // fundo dos gomos (vira a película entre eles)
    c.fillStyle = "#fff0d2"; c.beginPath(); c.arc(M, M, R_GOMO, 0, Math.PI * 2); c.fill();
    h.fillStyle = "#d0d0d0"; h.beginPath(); h.arc(M, M, R_GOMO, 0, Math.PI * 2); h.fill();
    for (let i = 0; i < GOMOS; i++) {
      const larg = (Math.PI * 2) / GOMOS, a0 = i * larg + 0.014 + (aleatorio() - 0.5) * 0.01, a1 = (i + 1) * larg - 0.014;
      const meio = (a0 + a1) / 2, r0 = R * 0.075;
      const gomo = (ctx) => {
        ctx.beginPath();
        ctx.moveTo(M + Math.cos(meio) * r0, M + Math.sin(meio) * r0);
        ctx.lineTo(M + Math.cos(a0) * (r0 + 18), M + Math.sin(a0) * (r0 + 18));
        ctx.arc(M, M, R_GOMO - 8, a0, a1);
        ctx.closePath();
      };
      // polpa: verde-amarelado, mais claro e translúcido no centro
      g = c.createRadialGradient(M, M, r0, M, M, R_GOMO);
      g.addColorStop(0, "#ffc04d"); g.addColorStop(0.45, "#ff9d1e"); g.addColorStop(1, "#ff8205");
      c.save(); gomo(c); c.fillStyle = g; c.fill(); c.clip();
      h.save(); gomo(h); h.fillStyle = "#6a6a6a"; h.fill(); h.clip();
      // gominhos de suco (vesículas): gotas compridas apontando para o centro
      for (let k = 0; k < 520; k++) {
        const a = a0 + aleatorio() * (a1 - a0), rr = r0 + 10 + Math.pow(aleatorio(), 0.8) * (R_GOMO - r0 - 20);
        const x = M + Math.cos(a) * rr, y = M + Math.sin(a) * rr;
        const comp = 7 + (rr / R) * 26 * (0.6 + aleatorio() * 0.6), lar = 2.2 + (rr / R) * 5 * (0.6 + aleatorio() * 0.6);
        c.fillStyle = `rgba(${aleatorio() < 0.5 ? "255,222,150" : "255,120,0"},${0.25 + aleatorio() * 0.35})`;
        c.beginPath(); c.ellipse(x, y, comp, lar, a, 0, Math.PI * 2); c.fill();
        c.fillStyle = `rgba(255,246,218,${0.25 + aleatorio() * 0.4})`;
        c.beginPath(); c.ellipse(x - Math.cos(a) * comp * 0.3, y - Math.sin(a) * comp * 0.3, comp * 0.35, lar * 0.35, a, 0, Math.PI * 2); c.fill();
        const hg = h.createRadialGradient(x, y, 0, x, y, comp);
        hg.addColorStop(0, "rgba(255,255,255,.75)"); hg.addColorStop(1, "rgba(255,255,255,0)");
        h.fillStyle = hg; h.beginPath(); h.ellipse(x, y, comp, lar * 1.2, a, 0, Math.PI * 2); h.fill();
      }
      c.restore(); h.restore();
      // sementinha às vezes
      if (i % 4 === 1) {
        const rr = R * 0.22, x = M + Math.cos(meio) * rr, y = M + Math.sin(meio) * rr;
        c.fillStyle = "#f8ecd0"; c.beginPath(); c.ellipse(x, y, 16, 7, meio, 0, Math.PI * 2); c.fill();
        h.fillStyle = "#ffffff"; h.beginPath(); h.ellipse(x, y, 16, 7, meio, 0, Math.PI * 2); h.fill();
      }
    }
    // miolo
    g = c.createRadialGradient(M, M, 0, M, M, R * 0.085);
    g.addColorStop(0, "#fffaf0"); g.addColorStop(1, "#ffe7bf");
    c.fillStyle = g; c.beginPath(); c.arc(M, M, R * 0.085, 0, Math.PI * 2); c.fill();
    h.fillStyle = "#e0e0e0"; h.beginPath(); h.arc(M, M, R * 0.085, 0, Math.PI * 2); h.fill();
    // poros de óleo na casca
    for (let k = 0; k < 900; k++) {
      const a = aleatorio() * Math.PI * 2, rr = R_CASCA + 4 + aleatorio() * (R - R_CASCA - 8);
      c.fillStyle = `rgba(${aleatorio() < 0.5 ? "255,200,110" : "214,92,0"},${0.3 + aleatorio() * 0.4})`;
      c.beginPath(); c.arc(M + Math.cos(a) * rr, M + Math.sin(a) * rr, 1 + aleatorio() * 2, 0, Math.PI * 2); c.fill();
    }
  })();
  const texDe = (canvas, cor) => { const t = new THREE.CanvasTexture(canvas); if (cor) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  // a lateral da rodela: casca com poros
  const cascaLado = (() => {
    const c = document.createElement("canvas"); c.width = 1024; c.height = 64;
    const x = c.getContext("2d");
    const g = x.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, "#e06800"); g.addColorStop(0.5, "#ff9420"); g.addColorStop(1, "#e06800");
    x.fillStyle = g; x.fillRect(0, 0, 1024, 64);
    for (let k = 0; k < 1400; k++) { x.fillStyle = `rgba(${aleatorio() < 0.5 ? "255,205,120" : "200,84,0"},${0.3 + aleatorio() * 0.4})`; x.beginPath(); x.arc(aleatorio() * 1024, aleatorio() * 64, 0.8 + aleatorio() * 1.8, 0, Math.PI * 2); x.fill(); }
    return texDe(c, true);
  })();
  // face do corte reto: a polpa vista de lado, com os gominhos esticados
  const corteLado = (() => {
    const c = document.createElement("canvas"); c.width = 512; c.height = 32;
    const x = c.getContext("2d");
    const g = x.createLinearGradient(0, 0, 512, 0);
    g.addColorStop(0, "#e06800"); g.addColorStop(0.03, "#fff1da"); g.addColorStop(0.07, "#ff9d1e"); g.addColorStop(0.5, "#ffc04d");
    g.addColorStop(0.93, "#ff9d1e"); g.addColorStop(0.97, "#fff1da"); g.addColorStop(1, "#e06800");
    x.fillStyle = g; x.fillRect(0, 0, 512, 32);
    for (let k = 0; k < 260; k++) { x.fillStyle = `rgba(${aleatorio() < 0.5 ? "255,236,180" : "230,100,0"},${0.25 + aleatorio() * 0.3})`; x.fillRect(20 + aleatorio() * 472, aleatorio() * 32, 1 + aleatorio() * 2, 6 + aleatorio() * 14); }
    return texDe(c, true);
  })();
  // luz que atravessa a polpa: brilha quando há luz atrás da fruta (aproximação de translucidez usada em jogos)
  const uLuzAtras = { value: new THREE.Vector3(0, 0, -1) };
  const translucida = (m, forca) => {
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uLuzAtras = uLuzAtras;
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform vec3 uLuzAtras;")
        .replace("#include <opaque_fragment>", `
          vec3 vOlho = normalize(vViewPosition);
          vec3 vLuz = normalize(uLuzAtras + normal * 0.35);
          float atravessa = pow(clamp(dot(vOlho, -vLuz), 0.0, 1.0), 2.5) * ${forca.toFixed(2)};
          outgoingLight += diffuseColor.rgb * vec3(1.0, 0.62, 0.25) * atravessa;
          #include <opaque_fragment>`);
    };
  };
  const polpaMat = new THREE.MeshPhysicalMaterial({
    map: texDe(corLar, true), bumpMap: texDe(altLar), bumpScale: 1.1, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.06,
    sheen: 0.1, sheenColor: new THREE.Color("#fff0d6"), sheenRoughness: 0.5, emissive: new THREE.Color("#ff5a00"), emissiveIntensity: 0.05, envMapIntensity: 0.5,
  });
  translucida(polpaMat, 0.7);
  const cascaMat = new THREE.MeshPhysicalMaterial({ map: cascaLado, roughness: 0.38, clearcoat: 0.7, clearcoatRoughness: 0.25 });
  const corteMat = new THREE.MeshPhysicalMaterial({ map: corteLado, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08, side: THREE.DoubleSide });
  translucida(corteMat, 0.9);
  const RL = 0.22, ESP_L = 0.04;
  const fruta = new THREE.Group();
  // meia rodela: só a metade de cima (z negativo vira "para cima" quando ela fica em pé); o corte reto fica embaixo
  const meia = new THREE.Mesh(new THREE.CylinderGeometry(RL, RL, ESP_L, 96, 1, false, Math.PI / 2, Math.PI), [cascaMat, polpaMat, polpaMat]);
  const faceReta = new THREE.Mesh(new THREE.PlaneGeometry(2 * RL, ESP_L), corteMat);
  meia.add(faceReta);
  fruta.add(meia);
  const ANG_FRUTA = 0.55;
  const FRUTA_FIM = new THREE.Vector3(Math.cos(ANG_FRUTA) * (RBORDA + 0.004), H - 0.035, Math.sin(ANG_FRUTA) * (RBORDA + 0.004));
  fruta.rotation.order = "YXZ";
  fruta.rotation.y = -ANG_FRUTA;
  fruta.rotation.x = Math.PI / 2;
  fruta.visible = false;
  copo.add(fruta);
  const molaFruta = { y: FRUTA_FIM.y + 1.8, v: 0, gira: 0, vg: 0, bateu: false };

  // ---------- canudo com guarda-chuva de papel ----------
  const enfeite = new THREE.Group();
  // canudo dobrável: reto, sanfona (os anéis que dobram) e a ponta virada em "L" para fora
  const L_CANUDO = 1.05;
  const canudo = new THREE.Mesh(
    (() => {
      const RETO = 0.95, RC = 0.07, DOBRA = THREE.MathUtils.degToRad(80), PONTA = 0.2, R = 0.016;
      const SANF0 = RETO - 0.05, ARCO = RC * DOBRA, TOTAL = RETO + ARCO + PONTA;
      // ponto e direção ao longo do canudo (no plano xy; a ponta vira para -x)
      const ponto = (u) => {
        if (u <= RETO) return [0, u, 0, 1];
        if (u <= RETO + ARCO) { const t = (u - RETO) / RC; return [-RC + RC * Math.cos(t), RETO + RC * Math.sin(t), -Math.sin(t), Math.cos(t)]; }
        const t = DOBRA, l = u - RETO - ARCO;
        return [-RC + RC * Math.cos(t) - Math.sin(t) * l, RETO + RC * Math.sin(t) + Math.cos(t) * l, -Math.sin(t), Math.cos(t)];
      };
      const raio = (u) => (u >= SANF0 && u <= RETO + ARCO + 0.03 ? R * (1 + 0.16 * Math.pow(Math.abs(Math.sin((u - SANF0) * 260)), 0.6)) : R);
      const FAT = 260, VOLTA = 20, vs = [], idx = [];
      for (let i = 0; i <= FAT; i++) {
        const u = (i / FAT) * TOTAL, [x, y, tx, ty] = ponto(u), r = raio(u);
        const nx = ty, ny = -tx; // normal no plano; a outra direção é o eixo z
        for (let k = 0; k < VOLTA; k++) {
          const a = (k / VOLTA) * Math.PI * 2;
          vs.push(x + (Math.cos(a) * nx) * r, y + (Math.cos(a) * ny) * r, Math.sin(a) * r);
        }
      }
      for (let i = 0; i < FAT; i++) for (let k = 0; k < VOLTA; k++) {
        const a = i * VOLTA + k, b = i * VOLTA + ((k + 1) % VOLTA), c = a + VOLTA, d = b + VOLTA;
        idx.push(a, c, b, b, c, d);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(vs, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      return g;
    })(),
    new THREE.MeshPhysicalMaterial({ color: "#151412", roughness: 0.28, clearcoat: 0.9, side: THREE.DoubleSide }),
  );
  enfeite.add(canudo);
  // guarda-chuva preso no meio do canudo (o canudo passa pelo centro dele): papel em gomos, dobras e varetas
  const chapeu = new THREE.Mesh(
    (() => {
      // 12 gomos fechados, cada um com a sua cor; o papel afunda um pouco no meio de cada gomo (dobra entre as varetas)
      const R_GC = 0.3, ALT_GC = 0.11, GOMOS = 12, SUB = 8, ANEIS_GC = 6;
      const c1 = new THREE.Color("#c39545"), c2 = new THREE.Color("#f4ecdc"); // dourado e creme, as cores do site
      const vs = [], cs = [], idx = [];
      for (let gm = 0; gm < GOMOS; gm++) {
        const base = vs.length / 3, cor = gm % 2 ? c1 : c2;
        for (let j = 0; j <= ANEIS_GC; j++) for (let i = 0; i <= SUB; i++) {
          const f = i / SUB, ang = ((gm + f) / GOMOS) * Math.PI * 2, r = (R_GC * j) / ANEIS_GC;
          const dobra = Math.sin(f * Math.PI) * 0.012 * (r / R_GC);
          vs.push(Math.cos(ang) * r, ALT_GC * (1 - j / ANEIS_GC) - dobra, Math.sin(ang) * r);
          cs.push(cor.r, cor.g, cor.b);
        }
        for (let j = 0; j < ANEIS_GC; j++) for (let i = 0; i < SUB; i++) {
          const a = base + j * (SUB + 1) + i, b = a + 1, c = a + SUB + 1, d = c + 1;
          idx.push(a, c, b, b, c, d);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(vs, 3));
      g.setAttribute("color", new THREE.Float32BufferAttribute(cs, 3));
      g.setIndex(idx);
      g.translate(0, -ALT_GC / 2, 0);
      g.computeVertexNormals();
      return g;
    })(),
    new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.8, sheen: 0.35, sheenColor: new THREE.Color("#fff1dc"), side: THREE.DoubleSide }),
  );
  const madeira = new THREE.MeshPhysicalMaterial({ color: "#d9b98a", roughness: 0.7 });
  // anel que segura o guarda-chuva aberto no canudo
  const anel = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.03, 0.05, 20), madeira);
  const guarda = new THREE.Group();
  anel.position.y = -0.005;
  chapeu.position.y = 0.05;
  // por baixo, o papel é mais claro (como guarda-chuva de verdade) e fecha a cobertura
  const forro = new THREE.Mesh(chapeu.geometry, new THREE.MeshPhysicalMaterial({ color: "#efe3cc", roughness: 0.85, side: THREE.DoubleSide }));
  forro.position.y = -0.004;
  chapeu.add(forro);
  guarda.add(chapeu, anel);
  for (let i = 0; i < 12; i++) {
    const vareta = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.23, 6), madeira);
    const a = (i / 12) * Math.PI * 2;
    vareta.position.set(Math.cos(a) * 0.115, 0.05, Math.sin(a) * 0.115);
    vareta.rotation.set(0, -a, 1.22);
    guarda.add(vareta);
  }
  guarda.position.set(0, 0.8, 0);
  enfeite.add(guarda);
  enfeite.visible = false;
  copo.add(enfeite);
  const PE_CANUDO = new THREE.Vector3(0.03, A + 0.06, 0);
  const molaCanudo = { y: PE_CANUDO.y + 2.6, v: 0, incl: 0, vi: 0 };
  const INCL_FIM = 0.34;


  // sombra macia no chão branco
  const sombra = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 256;
    const x = c.getContext("2d"), g = x.createRadialGradient(128, 128, 8, 128, 128, 128);
    g.addColorStop(0, "rgba(60,48,36,.26)"); g.addColorStop(0.45, "rgba(60,48,36,.09)"); g.addColorStop(1, "rgba(60,48,36,0)");
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.002;
    return m;
  })();
  cena.add(sombra);

  // ---------- fundo de festa: preto, com luzes neon passando atrás da taça e refletindo no balcão ----------
  const neon = [];
  let reflexoBalcao = null;
  if (FUNDO === "festa") {
    cena.background = new THREE.Color("#050508");
    sombra.visible = false;
    // brilho macio (gaussiano) para os feixes e as bolinhas de luz desfocadas
    const brilhoTex = (() => {
      const c = document.createElement("canvas"); c.width = c.height = 128;
      const x = c.getContext("2d"), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.25, "rgba(255,255,255,.55)"); g.addColorStop(1, "rgba(255,255,255,0)");
      x.fillStyle = g; x.fillRect(0, 0, 128, 128);
      return new THREE.CanvasTexture(c);
    })();
    const CORES = ["#ff2bd6", "#22e4ff", "#ffb43a", "#8a5cff", "#ff3b6b"];
    // feixes de luz compridos que varrem devagar, como luz de pista
    for (let i = 0; i < 7; i++) {
      const cor = new THREE.Color(CORES[i % CORES.length]);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 16), new THREE.MeshBasicMaterial({ map: brilhoTex, color: cor, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.position.set(-6 + i * 2, 2, -6 - (i % 3));
      cena.add(m);
      neon.push({ m, tipo: "feixe", fase: Math.random() * 6.28, vel: 0.12 + Math.random() * 0.12, base: -0.9 + Math.random() * 1.8, forca: 0.35 + Math.random() * 0.25 });
    }
    // bolinhas de luz desfocadas (bokeh) passando ao fundo
    for (let i = 0; i < 22; i++) {
      const cor = new THREE.Color(CORES[i % CORES.length]);
      const tam = 0.3 + Math.random() * 0.9;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(tam, tam), new THREE.MeshBasicMaterial({ map: brilhoTex, color: cor, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.position.set((Math.random() - 0.5) * 16, -0.5 + Math.random() * 6, -4 - Math.random() * 5);
      cena.add(m);
      neon.push({ m, tipo: "bolinha", fase: Math.random() * 6.28, vel: 0.15 + Math.random() * 0.35, x0: m.position.x, forca: 0.25 + Math.random() * 0.35 });
    }
    // luzes coloridas de verdade, que brilham no vidro, no gelo e na laranja
    for (let i = 0; i < 2; i++) {
      const l = new THREE.PointLight(CORES[i], 0, 12, 1.4);
      cena.add(l);
      neon.push({ m: l, tipo: "luz", fase: i * 2.1, vel: 0.35 + i * 0.1 });
    }
    // balcão preto brilhante que reflete a taça e as luzes
    // o balcão termina um pouco atrás da taça: dali para trás é só o escuro da festa, com as luzes
    const espelho = new Reflector(new THREE.PlaneGeometry(40, 8), { textureWidth: Math.min(1024, innerWidth * 0.75), textureHeight: Math.min(1024, innerHeight * 0.75), color: 0x5a5a62 });
    reflexoBalcao = espelho;
    espelho.rotation.x = -Math.PI / 2; espelho.position.set(0, -0.001, 1.5);
    cena.add(espelho);
    const balcao = new THREE.Mesh(new THREE.PlaneGeometry(40, 8), new THREE.MeshBasicMaterial({ color: "#050508", transparent: true, opacity: 0.72 }));
    balcao.rotation.x = -Math.PI / 2; balcao.position.set(0, 0.0005, 1.5);
    cena.add(balcao);
    // no escuro, o contorno do cristal e do gelo é claro (reflexo), não escuro
  }
  function mexerNeon(t) {
    const acende = Math.min(1, Math.max(0, (t - 0.3) / 1.5));
    for (const n of neon) {
      if (n.tipo === "feixe") { n.m.rotation.z = n.base + Math.sin(t * n.vel + n.fase) * 0.55; n.m.material.opacity = acende * n.forca * (0.6 + 0.4 * Math.sin(t * 0.7 + n.fase)); }
      else if (n.tipo === "bolinha") { n.m.position.x = n.x0 + Math.sin(t * n.vel * 0.5 + n.fase) * 1.6; n.m.material.opacity = acende * n.forca * (0.5 + 0.5 * Math.sin(t * n.vel + n.fase)); }
      else { const a = t * n.vel + n.fase; n.m.position.set(Math.cos(a) * 2.6, 1.6 + Math.sin(a * 1.3) * 0.8, Math.sin(a) * 2.2 - 0.6); n.m.intensity = acende * 2.5; }
    }
  }

  // ---------- câmera ----------
  function ajustar() {
    const w = palco.clientWidth, h = palco.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // a taça com o enfeite (2,3 de altura, 1,6 de largura) ocupa o meio da tela, entre o logo e o botão, em qualquer tamanho
    const tg = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const d = Math.max(5.2 / 2 / tg, 2.5 / 2 / (tg * camera.aspect));
    const ang = controle ? controle.getAzimuthalAngle() : 0;
    camera.position.set(Math.sin(ang) * d, 1.12 + d * 0.1, Math.cos(ang) * d);
    camera.lookAt(0, 1.12, 0);
    camera.updateProjectionMatrix();
    if (controle) { controle.target.set(0, 1.12, 0); controle.update(); }
  }
  let controle = null;
  ajustar();
  // girar a taça 360° arrastando o dedo (ou o mouse) para os lados, com embalo
  controle = new OrbitControls(camera, renderer.domElement);
  controle.target.set(0, 1.12, 0);
  controle.enableZoom = false; controle.enablePan = false;
  controle.enableDamping = true; controle.dampingFactor = 0.07; controle.rotateSpeed = 0.7;
  const polar = controle.getPolarAngle();
  controle.minPolarAngle = polar - 0.18; controle.maxPolarAngle = polar + 0.08;
  controle.update();
  renderer.domElement.style.touchAction = "pan-y"; // arrastar para cima/baixo continua rolando a página
  renderer.domElement.style.cursor = "grab";
  let mexendo = false;
  controle.addEventListener("start", () => { mexendo = true; renderer.domElement.style.cursor = "grabbing"; });
  controle.addEventListener("end", () => { mexendo = false; renderer.domElement.style.cursor = "grab"; });
  addEventListener("resize", ajustar);

  // ---------- a cena andando ----------
  const suave = (t) => t * t * (3 - 2 * t);
  const entre = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
  let nivel = A + 0.0005, vol = 0, nuvem = -10, nuvemForca = 0, fundoGroselha = A - 1;
  let tempo = 0, ultimo = performance.now(), avisou = false, nivelDesenhado = nivel;
  refazerCorpo(nivel);

  function passo(dt) {
    tempo += dt;
    const t = tempo;

    const surge = suave(entre(t, 0, 0.8));
    copo.position.y = (1 - surge) * 0.35;
    renderer.toneMappingExposure = (2.4 - 1.4 * surge) * (FUNDO === "festa" ? 0.82 : 1);   // sai do branco, como foto revelando
    sombra.material.opacity = surge;

    moverGelo(dt, t, nivel);

    const imp = desenharFio(t, ondeBate(nivel));
    if (imp) {
      vol += (imp.sv.vol / (imp.sv.ate - imp.sv.de)) * dt;
      nivel = Math.min(NIVEL_FIM, A + Math.cbrt(vol));
      const noSuco = imp.y <= nivel + 0.001;
      if (noSuco) empurrar(imp.x, imp.z, 0.012 * (nivel < A + 0.08 ? 0.4 : 1));
      if (imp.sv.cor === corGroselha) { nuvemForca = Math.min(1, nuvemForca + dt * 3); nuvem = nivel - 0.05; }
    }
    if (t > 4.6) {
      nuvem += (A + 0.12 - nuvem) * Math.min(1, dt * 1.6);
      if (t > 5.2) { nuvemForca *= Math.pow(0.35, dt); fundoGroselha += (A + (NIVEL_FIM - A) * 0.45 - fundoGroselha) * Math.min(1, dt * 1.4); }
      else fundoGroselha = Math.max(fundoGroselha, A + 0.04);
    }
    uSuco.uNuvem.value = nuvem; uSuco.uNuvemForca.value = nuvemForca; uSuco.uFundo.value = fundoGroselha; uSuco.uTempo.value = t;

    const mexeu = ondas(nivel);
    const subiu = nivel !== nivelDesenhado;
    if (subiu) { refazerCorpo(nivel); nivelDesenhado = nivel; }
    tampa.visible = nivel > A + 0.006;
    corpo.visible = tampa.visible;
    if (tampa.visible && (mexeu || subiu)) atualizarTampa(nivel);
    moverGotas(dt, nivel);

    // meia laranja: cai e encaixa na borda com um quique amortecido
    if (t > 5.25) {
      fruta.visible = true;
      if (!molaFruta.bateu) {
        molaFruta.v -= G * dt; molaFruta.y += molaFruta.v * dt;
        if (molaFruta.y <= FRUTA_FIM.y) { molaFruta.y = FRUTA_FIM.y; molaFruta.v *= -0.28; molaFruta.vg = 2.4; if (Math.abs(molaFruta.v) < 0.2) molaFruta.bateu = true; }
      } else { molaFruta.v += (-(molaFruta.y - FRUTA_FIM.y) * 140 - molaFruta.v * 12) * dt; molaFruta.y += molaFruta.v * dt; }
      molaFruta.vg += (-molaFruta.gira * 90 - molaFruta.vg * 7) * dt;
      molaFruta.gira += molaFruta.vg * dt;
      fruta.position.set(FRUTA_FIM.x, molaFruta.y, FRUTA_FIM.z);
      fruta.rotation.z = molaFruta.gira * 0.12; // balança quando cai na borda
    }
    // canudo com guarda-chuva: cai, desce entre o gelo e se apoia nele
    if (t > 5.5) {
      enfeite.visible = true;
      if (molaCanudo.y > PE_CANUDO.y) { molaCanudo.v -= G * dt; molaCanudo.y = Math.max(PE_CANUDO.y, molaCanudo.y + molaCanudo.v * dt); if (molaCanudo.y === PE_CANUDO.y) empurrar(PE_CANUDO.x, PE_CANUDO.z, 0.02); }
      else { molaCanudo.vi += ((INCL_FIM - molaCanudo.incl) * 60 - molaCanudo.vi * 6) * dt; molaCanudo.incl += molaCanudo.vi * dt; }
      enfeite.rotation.set(0, 0, molaCanudo.incl);
      enfeite.position.set(PE_CANUDO.x, molaCanudo.y, PE_CANUDO.z);
    }

    if (!avisou && t > 6.0) { avisou = true; pronto(); }
  }

  if (parado) for (let i = 0; i < 720; i++) passo(1 / 60); // sem animação: já mostra o drink pronto

  // prepara todos os materiais antes de começar (assim nada engasga quando o gelo, a laranja ou o canudo aparecem)
  {
    const escondidos = [];
    cena.traverse((o) => { if (!o.visible) { escondidos.push(o); o.visible = true; } });
    renderer.compile(cena, camera);
    for (const o of escondidos) o.visible = false;
  }
  // medidor de fluidez: se a média dos quadros passar de ~22 ms, baixa a resolução (e, se precisar, tira o reflexo do balcão)
  let somaQ = 0, nQ = 0;
  function medir(ms) {
    somaQ += ms; nQ++;
    if (nQ < 40) return;
    const media = somaQ / nQ; somaQ = 0; nQ = 0;
    if (media > 22 && resolucao > 1) { resolucao = Math.max(1, resolucao - 0.25); renderer.setPixelRatio(resolucao); ajustar(); }
    else if (media > 26 && reflexoBalcao && reflexoBalcao.visible) reflexoBalcao.visible = false;
  }

  function quadro(agora) {
    const ms = agora - ultimo;
    const dt = Math.min(1 / 30, ms / 1000);
    ultimo = agora;
    if (ms > 0 && ms < 200) medir(ms);
    controle.update();
    // luz de trás da laranja (atrás e acima da taça), levada para o espaço da câmera
    uLuzAtras.value.set(1.0, 1.7, -4.4).normalize().transformDirection(camera.matrixWorldInverse);
    passo(dt);
    // a taça gira devagar e para com o "JC Drinks" de frente; depois só balança de leve
    copo.rotation.y = tempo < 6 ? -0.6 * (1 - suave(tempo / 6)) : 0.14 * Math.sin((tempo - 6) * 0.3);
    if (neon.length) mexerNeon(tempo);
    renderer.render(cena, camera);
    requestAnimationFrame(quadro);
  }
  requestAnimationFrame((a) => { ultimo = a; quadro(a); });
}
