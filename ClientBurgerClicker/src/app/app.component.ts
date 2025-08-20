import { Component, ElementRef, HostListener, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PopFx } from '../models/popfx';
import { ScoreRow } from '../models/scorerow';
import { ScoreService } from '../services/score.service';

import {
  AxesHelper,
  DirectionalLight,
  DoubleSide,
  GridHelper,
  HemisphereLight,
  Mesh,
  MeshNormalMaterial,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  WebGLRenderer
} from 'three';

import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { WebsocketService } from '../services/websocket.service';

type WsMsgScores = { type: 'scores'; scores: Record<string, number> };
type WsMsgClick  = { type: 'click'; name: string; total: number };
type WsMsg = WsMsgScores | WsMsgClick;

@Component({
  selector: 'my-app',
  imports: [FormsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent {
  @ViewChild('burgerBtn') burgerBtn?: ElementRef<HTMLButtonElement>;

  // Estado de juego
  name = '';
  bestScore = 0;

  mobile = false;

  // UI/FX
  message = '';
  submitting = false;
  loadingScores = false;
  pops: PopFx[] = [];
  private popId = 0;

  // Scoreboard
  scores: ScoreRow[] = [];

  // CPS
  private clickTimestamps: number[] = [];
  private readonly horizonMs = 2000; // 2s

  private wsConnected = false;

  constructor(
    private readonly api: ScoreService,
    private readonly ws: WebsocketService
  ) {}

  ngOnInit(): void {
    // Estado local
    try {
      const raw = localStorage.getItem('burger_clicker_state');
      if (raw) {
        const s = JSON.parse(raw);
        this.name = s.name ?? '';
        this.bestScore = s.bestScore ?? 0;
      }
    } catch {}
    setInterval(() => this.pruneTimestamps(), 500);

    // Canvas
    const canvas = document.getElementById('burger_canvas') as HTMLCanvasElement;
    if (!canvas) return;

    // Renderer con fondo transparente
    const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0); // alpha 0 => transparente
    renderer.outputColorSpace = SRGBColorSpace;

    // Escena y cámara
    const scene = new Scene();
    const camera = new PerspectiveCamera(60, 2, 0.1, 1000);

    // Tamaño correcto (y resize)
    const setSize = () => {
      this.mobile = window.innerWidth < 700;

      const w = canvas.clientWidth || 300;
      const h = canvas.clientHeight || 300;
      if (canvas.width !== w || canvas.height !== h) {
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
    };
    setSize();
    window.addEventListener('resize', setSize);

    // Luces (para que el modelo no se vea negro)
    const hemi = new HemisphereLight(0xffffff, 0x444444, 1.2);
    hemi.position.set(0, 20, 0);
    scene.add(hemi);

    const dir = new DirectionalLight(0xffffff, 1.3);
    dir.position.set(5, 10, 7.5);
    scene.add(dir);

    // Cámara
    camera.position.set(1, 7, 10);
    camera.lookAt(0.3, 1, 0);

    // ====== OBJ + MTL ======
    const ASSETS_PATH = '/assets/models/'; // <-- ajustá si usás otra carpeta
    const SHOW_DEBUG_HELPERS = false;      // poné true para ver ejes y grilla

    if (SHOW_DEBUG_HELPERS) {
      scene.add(new AxesHelper(2));
      const grid = new GridHelper(10, 10);
      grid.position.y = -0.31;
      scene.add(grid);
    }

    const onProgress = (xhr?: ProgressEvent<EventTarget>) => {
      if (xhr && (xhr as any).lengthComputable) {
        const p = Math.round(((xhr as any).loaded / (xhr as any).total) * 100);
        console.log(`[Carga] ${p}%`);
      }
    };

    const loadWithMaterials = () => {
      const mtlLoader = new MTLLoader();
      // Dónde está el .mtl
      mtlLoader.setPath(ASSETS_PATH);
      // Dónde están las texturas a las que hace referencia el .mtl
      mtlLoader.setResourcePath(ASSETS_PATH);

      mtlLoader.load(
        'Hamburger_01.mtl',
        (materials) => {
          console.log('[MTL] OK', materials);
          materials.preload();

          // (Opcional) asegurar sRGB y visibilidad
          Object.values(materials.materials).forEach((mat: any) => {
            if (mat?.map) {
              mat.map.colorSpace = SRGBColorSpace;
              mat.map.needsUpdate = true;
            }
            if (mat?.transparent && mat.opacity === 0) {
              mat.transparent = false;
              mat.opacity = 1;
            }
            if (mat?.side !== DoubleSide) mat.side = DoubleSide;
          });

          const objLoader = new OBJLoader();
          objLoader.setPath(ASSETS_PATH);
          objLoader.setMaterials(materials);

          objLoader.load(
            'Hamburger_01.obj',
            (obj: any) => {
              console.log('[OBJ] OK con materiales', obj);
              obj.scale.set(0.5, 0.5, 0.5);
              obj.position.set(0, -0.3, 0);
              scene.add(obj);

              // (No sobreescribimos materiales aquí)

              // Animación
              const animate = () => {
                requestAnimationFrame(animate);
                if (this.cps < 3) {
                  obj.rotation.y += 0.005 + this.cps * 0.1;
                  // move burger to default rotation frame by frame
                  obj.rotation.x += (0 - obj.rotation.x) * 0.05;
                  obj.rotation.z += (0 - obj.rotation.z) * 0.05;

                  obj.scale.x += (0.5 - obj.scale.x) * 0.05;
                  obj.scale.y += (0.5 - obj.scale.y) * 0.05;
                  obj.scale.z += (0.5 - obj.scale.z) * 0.05;
                } else if (this.cps < 7.5) {
                  // do flips
                  obj.rotation.y += 0.005 + 6 * 0.1;
                  obj.rotation.x += (Math.random() - 0.5) * 0.2;
                  obj.rotation.z += (Math.random() - 0.5) * 0.2;
                } else if (this.cps < 10) {
                  // do flips and spins
                  obj.rotation.y += 0.005 + 10 * 0.1;
                  obj.scale.x = 0.5 + Math.random() * 0.5;
                  obj.scale.y = 0.5 + Math.random() * 0.5;
                  obj.scale.z = 0.5 + Math.random() * 0.5;
                }
                setSize();
                renderer.render(scene, camera);
              };
              animate();
            },
            onProgress,
            (err) => {
              console.error('Error al cargar OBJ (con MTL):', err);
              fallbackLoadObj(scene, camera, renderer, setSize);
            }
          );
        },
        onProgress,
        (err) => {
          console.error('Error al cargar MTL:', err);
          fallbackLoadObj(scene, camera, renderer, setSize);
        }
      );
    };

    const fallbackLoadObj = (
      scene: Scene,
      camera: PerspectiveCamera,
      renderer: WebGLRenderer,
      setSizeFn: () => void
    ) => {
      const objLoader = new OBJLoader();
      objLoader.setPath(ASSETS_PATH);
      objLoader.load(
        'Hamburger_01.obj',
        (obj: any) => {
          console.warn('[Fallback] Muestro OBJ con MeshNormalMaterial');
          obj.scale.set(0.5, 0.5, 0.5);
          obj.position.set(0, -0.3, 0);
          obj.traverse((child: any) => {
            if (child instanceof Mesh) {
              child.material = new MeshNormalMaterial({ side: DoubleSide });
            }
          });
          scene.add(obj);

          const animate = () => {
            requestAnimationFrame(animate);
            obj.rotation.y += 0.01;
            setSizeFn();
            renderer.render(scene, camera);
          };
          animate();
        },
        onProgress,
        (e) => console.error('[Fallback] Tampoco pude cargar el OBJ', e)
      );
    };

    loadWithMaterials();
    // ====== /OBJ + MTL ======

     this.ws.connection().subscribe(ok => {
      this.wsConnected = ok;
      if (!ok) this.message = 'Reconectando al servidor...';
    });

    this.ws.messages().subscribe((msg: WsMsg) => {
      if (msg.type === 'scores') {
        // normalizar al formato de tu tabla
        const rows = Object.entries(msg.scores)
          .map(([name, score], i) => ({
            id: i,
            name,
            score,
            created_at: null,
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 20);
        this.scores = rows;
        this.loadingScores = false;
      } else if (msg.type === 'click') {
        // animación/feedback en vivo del que clickeó
        if (msg.name === this.name.trim()) {
          this.bestScore = Math.max(this.bestScore, msg.total);
          this.persist();
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.ws.close();
  }

  // Accesible por teclado
  @HostListener('window:keydown', ['$event'])
  onKey(ev: KeyboardEvent) {
    if (ev.code === 'Space' || ev.code === 'Enter') {
      ev.preventDefault();
    }
  }

  onClick(ev: MouseEvent | KeyboardEvent) {
    this.clickTimestamps.push(Date.now());

    // Pops UI como tenías
    const rect = this.burgerBtn?.nativeElement.getBoundingClientRect();
    const cx = rect ? rect.left + rect.width / 2 : 'clientX' in ev ? ev.clientX : 0;
    const cy = rect ? rect.top + rect.height / 2 : 'clientY' in ev ? ev.clientY : 0;
    const jitterX = (Math.random() - 0.5) * 200;
    const jitterY = (Math.random() - 0.5) * 100;
    this.spawnPop(cx + jitterX, cy + jitterY, '+1');

    // >>> enviar el click al backend (si tenés nombre)
    const name = this.name.trim();
    if (name) {
      this.ws.send({ type: 'click', name });
    }

    this.persist();
  }

  resetRun() {
    this.clickTimestamps = [];
    this.message = '';
  }

  // ===== Utilidades =====
  get cps(): number {
    this.pruneTimestamps();
    return this.clickTimestamps.length / (this.horizonMs / 1000);
  }

  private pruneTimestamps() {
    const now = Date.now();
    this.clickTimestamps = this.clickTimestamps.filter((t) => now - t <= this.horizonMs);
  }

  private spawnPop(x: number, y: number, value: string | number) {
    const id = this.popId++;
    this.pops = [...this.pops, { id, x, y, value }];
    setTimeout(() => {
      this.pops = this.pops.filter((p) => p.id !== id);
    }, 1500);
  }

  fmt(n: number): string {
    return new Intl.NumberFormat().format(n);
  }
  fmtDate(iso: string | null): string {
    return iso ? new Date(iso).toLocaleString() : '—';
  }

  private persist() {
    try {
      localStorage.setItem(
        'burger_clicker_state',
        JSON.stringify({ name: this.name, bestScore: this.bestScore })
      );
    } catch {}
  }
}
