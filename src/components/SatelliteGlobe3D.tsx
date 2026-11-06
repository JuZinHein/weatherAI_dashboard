import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CityInfo, ForecastDataset } from '../types/forecast';
import { MYANMAR_BORDER_POINTS } from '../utils/geo';
import { BURMESE_STRINGS, toBurmeseNumber, BURMESE_CITIES_MAP } from '../utils/burmese';
import { getStepTimeWindow } from '../utils/forecastTime';
import { CityWeatherPopup3D } from './CityWeatherPopup3D';
import { Compass, Flame, RotateCw, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { fetchZarrField, fetchZarrMeta, type ZarrField } from '../services/zarrApi';
import { MYANMAR_CITIES } from '../data/myanmarCities';

interface SatelliteGlobe3DProps {
  dataset: ForecastDataset;
  modelId: string;
  currentStepIndex: number;
  selectedCity: CityInfo;
  onSelectCity: (city: CityInfo) => void;
  isKioskPlaying: boolean;
}

/**
 * Mathematically matches Three.js SphereGeometry equirectangular UV mapping:
 * - Lon -180 is u=0, Lon 0 is u=0.5, Lon +180 is u=1
 * - Lat +90 is v=0 (North Pole), Lat -90 is v=1 (South Pole)
 */
export function latLonToSphere(lat: number, lon: number, radius = 1.8): THREE.Vector3 {
  const phi = ((lon + 180) / 360) * Math.PI * 2;
  const theta = ((90 - lat) / 180) * Math.PI;
  const x = -radius * Math.cos(phi) * Math.sin(theta);
  const y = radius * Math.cos(theta);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  return new THREE.Vector3(x, y, z);
}

export const SatelliteGlobe3D: React.FC<SatelliteGlobe3DProps> = ({
  dataset,
  modelId,
  currentStepIndex,
  selectedCity,
  onSelectCity,
  isKioskPlaying,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  // Pure Daytime Satellite High-Resolution Globe
  /** Weather radar overlay — off until the user toggles မိုးလေဝသ ရေဒါ */
  const [showRadar, setShowRadar] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  /** OrbitControls autoRotateSpeed — lower = slower Earth spin (default slowed from 0.35 → 0.12) */
  const [rotateSpeed, setRotateSpeed] = useState(0.12);
  // Auto-show city card on load; stays in sync when the selected city changes
  const [activePopupCity, setActivePopupCity] = useState<CityInfo | null>(selectedCity);

  // Three.js refs that persist across renders
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  const earthMeshRef = useRef<THREE.Mesh | null>(null);
  const radarMeshRef = useRef<THREE.Mesh | null>(null);
  const radarTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const cityPinsRef = useRef<{ mesh: THREE.Mesh; halo: THREE.Mesh; sprite: THREE.Sprite; city: CityInfo }[]>([]);

  // Smooth camera target (only used on explicit Focus Myanmar click or Zoom buttons, NEVER on step/city change)
  const targetCamPosRef = useRef<THREE.Vector3 | null>(null);

  // Central Myanmar coordinates
  const MYANMAR_CENTER = { lat: 19.75, lon: 96.1 };

  // Refs so the animation loop / OrbitControls stay in sync without remounting
  const autoRotateRef = useRef(autoRotate);
  const rotateSpeedRef = useRef(rotateSpeed);
  useEffect(() => {
    autoRotateRef.current = autoRotate;
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
    }
  }, [autoRotate]);
  useEffect(() => {
    rotateSpeedRef.current = rotateSpeed;
    if (controlsRef.current) {
      controlsRef.current.autoRotateSpeed = rotateSpeed;
    }
  }, [rotateSpeed]);

  // Keep onSelectCity in ref to avoid re-triggering Three.js setup
  const onSelectCityRef = useRef(onSelectCity);
  useEffect(() => {
    onSelectCityRef.current = onSelectCity;
  }, [onSelectCity]);

  // Textures cache
  const texturesCacheRef = useRef<Record<string, THREE.Texture>>({});
  const [weatherVariable, setWeatherVariable] = useState('');
  const [weatherField, setWeatherField] = useState<ZarrField | null>(null);
  const [weatherFieldError, setWeatherFieldError] = useState('');
  const [isWeatherFieldLoading, setIsWeatherFieldLoading] = useState(false);

  const leadHour = dataset.leadHours[currentStepIndex] ?? 0;

  useEffect(() => {
    if (!modelId) return;
    const controller = new AbortController();
    setWeatherVariable('');
    setWeatherField(null);
    setWeatherFieldError('');
    setIsWeatherFieldLoading(true);

    fetchZarrMeta(modelId, controller.signal)
      .then((meta) => {
        const variable = meta.available_variables.includes('t2m')
          ? 't2m'
          : meta.available_variables.includes('t1000')
            ? 't1000'
            : null;
        if (!variable) {
          throw new Error(`No 2 m or 1000 hPa temperature field is available in ${modelId} Zarr.`);
        }
        if (!controller.signal.aborted) setWeatherVariable(variable);
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') return;
        if (!controller.signal.aborted) {
          setWeatherFieldError(error instanceof Error ? error.message : String(error));
          setIsWeatherFieldLoading(false);
        }
      })
    return () => controller.abort();
  }, [modelId]);

  useEffect(() => {
    if (!weatherVariable) return;
    const controller = new AbortController();
    setWeatherField(null);
    setWeatherFieldError('');
    setIsWeatherFieldLoading(true);

    fetchZarrField({
      modelId,
      variable: weatherVariable,
      leadHour,
      bbox: { west: 92, south: 9, east: 102, north: 29 },
      signal: controller.signal,
    })
      .then((field) => {
        if (!controller.signal.aborted) setWeatherField(field);
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') return;
        if (!controller.signal.aborted) {
          setWeatherFieldError(error instanceof Error ? error.message : String(error));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsWeatherFieldLoading(false);
      });

    return () => controller.abort();
  }, [leadHour, modelId, weatherVariable]);

  // 1. INITIALIZE THREE.JS SCENE ONCE ON MOUNT (Zero stops/pauses during playback)
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 1000);
    cameraRef.current = camera;

    // Start far enough to see the full globe; Myanmar-facing so “Focus မြန်မာ” is a zoom-in
    const myanmarCenterVec = latLonToSphere(MYANMAR_CENTER.lat, MYANMAR_CENTER.lon, 1.8);
    const cameraDir = myanmarCenterVec.clone().normalize();
    // Earth radius ≈ 1.8; FOV 36° needs ~6× to fit the full disc with a little margin
    const initialCamDist = 6.0;
    camera.position.copy(cameraDir.clone().multiplyScalar(initialCamDist));
    camera.lookAt(0, 0, 0);

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    // Google Earth Style OrbitControls with smooth continuous momentum
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.055;
    controls.minDistance = 2.0;
    controls.maxDistance = 9.0;
    controls.autoRotate = autoRotateRef.current;
    controls.autoRotateSpeed = rotateSpeedRef.current;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    // Lighting
    // Natural Daytime Illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.15);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfff8ee, 3.0);
    sunLight.position.set(cameraDir.x * 12 + 6, cameraDir.y * 12 + 6, cameraDir.z * 12 + 6);
    scene.add(sunLight);

    const blueRimLight = new THREE.DirectionalLight(0x38bdf8, 1.2);
    blueRimLight.position.set(-cameraDir.x * 10, -cameraDir.y * 10, -cameraDir.z * 10);
    scene.add(blueRimLight);

    // Starfield
    const starGeo = new THREE.BufferGeometry();
    const starCount = 1800;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      const v = new THREE.Vector3(
        (Math.random() - 0.5) * 160,
        (Math.random() - 0.5) * 160,
        (Math.random() - 0.5) * 160
      ).normalize().multiplyScalar(50 + Math.random() * 35);
      starPositions[i] = v.x;
      starPositions[i + 1] = v.y;
      starPositions[i + 2] = v.z;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.15,
      transparent: true,
      opacity: 0.85,
    });
    scene.add(new THREE.Points(starGeo, starMat));

    // Base Global Earth Sphere Texture Loader (High-Resolution Daytime Equirectangular)
    const textureLoader = new THREE.TextureLoader();
    const loadTexture = (url: string) => {
      if (texturesCacheRef.current[url]) return texturesCacheRef.current[url];
      const tex = textureLoader.load(url);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      texturesCacheRef.current[url] = tex;
      return tex;
    };

    const dayTexture = loadTexture('/textures/earth_4k.jpg');

    const earthGeo = new THREE.SphereGeometry(1.8, 128, 128);
    const earthMat = new THREE.MeshStandardMaterial({
      map: dayTexture,
      roughness: 0.55,
      metalness: 0.04,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    earthMeshRef.current = earthMesh;
    scene.add(earthMesh);

    // Realistic Atmospheric Horizon Glow (Blue Limb)
    const atmoGeo = new THREE.SphereGeometry(1.895, 64, 64);
    const atmoMat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.66 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.5);
          gl_FragColor = vec4(0.2, 0.65, 1.0, 1.0) * intensity * 2.3;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });
    scene.add(new THREE.Mesh(atmoGeo, atmoMat));

    // WEATHER RADAR FULL SPHERE LAYER
    const rCanvas = document.createElement('canvas');
    rCanvas.width = 2048;
    rCanvas.height = 1024;
    const rTexture = new THREE.CanvasTexture(rCanvas);
    rTexture.colorSpace = THREE.SRGBColorSpace;
    rTexture.minFilter = THREE.LinearMipmapLinearFilter;
    rTexture.magFilter = THREE.LinearFilter;
    rTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    radarTextureRef.current = rTexture;

    const rGeo = new THREE.SphereGeometry(1.808, 128, 128);
    const rMat = new THREE.MeshBasicMaterial({
      map: rTexture,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    const rMesh = new THREE.Mesh(rGeo, rMat);
    rMesh.visible = false; // matches showRadar default (off until toggled)
    radarMeshRef.current = rMesh;
    scene.add(rMesh);

    // Myanmar National Border
    const borderPoints3D: THREE.Vector3[] = MYANMAR_BORDER_POINTS.map(([lon, lat]) =>
      latLonToSphere(lat, lon, 1.815)
    );
    const borderGeo = new THREE.BufferGeometry().setFromPoints(borderPoints3D);
    const borderMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      linewidth: 2.2,
      transparent: true,
      opacity: 0.85,
    });
    scene.add(new THREE.LineLoop(borderGeo, borderMat));

    // CLEAN STATIC CITY MARKERS (NO PULSING ANIMATIONS, NO JARRING ARTIFACTS)
    const cityGroup = new THREE.Group();
    const cityPins: { mesh: THREE.Mesh; halo: THREE.Mesh; sprite: THREE.Sprite; city: CityInfo }[] = [];

    MYANMAR_CITIES.forEach((city) => {
      const pinPos = latLonToSphere(city.lat, city.lon, 1.822);
      const isSelected = city.name === selectedCity.name;

      // 1. Large Invisible Hit-Sphere for effortless click/touch target
      const hitGeo = new THREE.SphereGeometry(0.048, 8, 8);
      const hitMat = new THREE.MeshBasicMaterial({ visible: false });
      const hitMesh = new THREE.Mesh(hitGeo, hitMat);
      hitMesh.position.copy(pinPos);
      hitMesh.userData = { city };
      cityGroup.add(hitMesh);

      // 2. Clean, Static Pin Jewel Beacon Dot
      const pinGeo = new THREE.SphereGeometry(0.012, 16, 16);
      const pinMat = new THREE.MeshBasicMaterial({
        color: isSelected ? 0x10b981 : 0xffffff,
      });
      const pinMesh = new THREE.Mesh(pinGeo, pinMat);
      pinMesh.position.copy(pinPos);
      pinMesh.userData = { city };
      cityGroup.add(pinMesh);

      // 3. Clean Stationary Halo (No pulsing rings!)
      const haloGeo = new THREE.SphereGeometry(0.018, 16, 16);
      const haloMat = new THREE.MeshBasicMaterial({
        color: isSelected ? 0x34d399 : 0x38bdf8,
        transparent: true,
        opacity: 0.45,
        blending: THREE.AdditiveBlending,
      });
      const haloMesh = new THREE.Mesh(haloGeo, haloMat);
      haloMesh.position.copy(pinPos);
      haloMesh.userData = { city };
      cityGroup.add(haloMesh);

      // 4. Pin Stalk
      const stalkTop = pinPos.clone().multiplyScalar(1.032);
      const stalkGeo = new THREE.BufferGeometry().setFromPoints([pinPos, stalkTop]);
      const stalkMat = new THREE.LineBasicMaterial({
        color: isSelected ? 0x10b981 : 0x38bdf8,
        transparent: true,
        opacity: 0.75,
      });
      cityGroup.add(new THREE.Line(stalkGeo, stalkMat));

      // 5. Clean Burmese Text Badge
      const labelCanvas = document.createElement('canvas');
      labelCanvas.width = 440;
      labelCanvas.height = 96;
      const lCtx = labelCanvas.getContext('2d')!;
      lCtx.clearRect(0, 0, 440, 96);

      lCtx.fillStyle = isSelected ? 'rgba(16, 185, 129, 0.95)' : 'rgba(3, 7, 18, 0.88)';
      lCtx.beginPath();
      lCtx.roundRect(8, 8, 424, 80, 18);
      lCtx.fill();

      lCtx.strokeStyle = isSelected ? '#34d399' : 'rgba(56, 189, 248, 0.65)';
      lCtx.lineWidth = 3;
      lCtx.stroke();

      lCtx.font = 'bold 30px "Noto Sans Myanmar", sans-serif';
      lCtx.fillStyle = '#ffffff';
      lCtx.textAlign = 'center';
      lCtx.textBaseline = 'middle';
      const mmCity = city.mmName || BURMESE_CITIES_MAP[city.name]?.mmName || city.name;
      lCtx.fillText(mmCity, 220, 48);

      const labelTex = new THREE.CanvasTexture(labelCanvas);
      labelTex.colorSpace = THREE.SRGBColorSpace;
      const spriteMat = new THREE.SpriteMaterial({
        map: labelTex,
        depthTest: false,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(0.26, 0.057, 1);
      sprite.position.copy(pinPos.clone().multiplyScalar(1.04));
      sprite.userData = { city };
      cityGroup.add(sprite);

      cityPins.push({ mesh: pinMesh, halo: haloMesh, sprite, city });
    });

    cityPinsRef.current = cityPins;
    scene.add(cityGroup);

    // Interactive Raycaster for Clicking Cities (NEVER ZOOMS OR JOLTS CAMERA)
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onPointerDown = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(cityGroup.children);
      if (intersects.length > 0) {
        for (const hit of intersects) {
          if (hit.object.userData && hit.object.userData.city) {
            const clickedCity = hit.object.userData.city as CityInfo;
            setActivePopupCity(clickedCity);
            onSelectCityRef.current(clickedCity);
            // NOTICE: We deliberately DO NOT move or zoom the camera! View remains steady!
            break;
          }
        }
      }
    };

    const onPointerMove = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(cityGroup.children);
      let found = false;
      for (const hit of intersects) {
        if (hit.object.userData && hit.object.userData.city) {
          found = true;
          break;
        }
      }
      renderer.domElement.style.cursor = found ? 'pointer' : 'grab';
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);

    const handleResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Continuous 60fps Animation Loop (UNINTERRUPTED ROTATION)
    let reqId = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      reqId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      if (controlsRef.current) {
        controlsRef.current.update();
      }

      // Smooth camera transition only on explicit button clicks (Focus Myanmar / Zoom)
      if (targetCamPosRef.current && cameraRef.current) {
        cameraRef.current.position.lerp(targetCamPosRef.current, 0.06);
        if (cameraRef.current.position.distanceTo(targetCamPosRef.current) < 0.008) {
          targetCamPosRef.current = null;
        }
      }

      // Responsive zoom scaling: As user zooms in (camera approaches globe surface),
      // scale city names and beacon dots gracefully down so they remain refined, sharp,
      // and never clutter or block neighboring regions!
      if (cameraRef.current && cityPinsRef.current.length > 0) {
        const camPos = cameraRef.current.position;
        cityPinsRef.current.forEach((pin) => {
          const distToPin = camPos.distanceTo(pin.mesh.position);
          const normDist = Math.max(0.4, Math.min(5.5, distToPin));
          // Proportional scaling ensures the label screen size remains constant, crisp, and readable across all camera distances (like Google Earth)
          const scale = 0.22 * (normDist / 3.2);
          pin.sprite.scale.set(scale, scale * (0.057 / 0.26), 1);

          const dotScale = Math.max(0.5, Math.min(1.15, normDist / 3.2));
          pin.mesh.scale.setScalar(dotScale);
          pin.halo.scale.setScalar(dotScale);
        });
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(reqId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.dispose();
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []); // Run ONCE on mount! Scene never tears down!

  // Render the selected Zarr temperature field on the globe.
  useEffect(() => {
    if (!radarTextureRef.current) return;
    const canvas = radarTextureRef.current.image as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (weatherField) {
      const fieldParts = weatherField.parts?.length ? weatherField.parts : [weatherField];
      const values = fieldParts.flatMap((part) => part.values.flat()).filter(Number.isFinite);
      const min = values.length ? Math.min(...values) : 0;
      const max = values.length ? Math.max(...values) : 1;
      for (const part of fieldParts) {
        const lats = part.lats ?? weatherField.lats;
        const lons = part.lons ?? weatherField.lons;
        if (!lats.length || !lons.length) continue;
        const cellWidth = (Math.abs(lons[1] - lons[0] || 0.25) / 360) * canvas.width + 1;
        const cellHeight = (Math.abs(lats[1] - lats[0] || 0.25) / 180) * canvas.height + 1;
        for (let row = 0; row < Math.min(lats.length, part.values.length); row++) {
          for (let col = 0; col < Math.min(lons.length, part.values[row]?.length ?? 0); col++) {
            const value = part.values[row][col];
            if (!Number.isFinite(value)) continue;
            const ratio = max === min ? 0.5 : (value - min) / (max - min);
            const x = ((lons[col] + 180) / 360) * canvas.width;
            const y = ((90 - lats[row]) / 180) * canvas.height;
            const red = Math.round(255 * Math.max(0, Math.min(1, ratio * 2)));
            const blue = Math.round(255 * Math.max(0, Math.min(1, 2 - ratio * 2)));
            ctx.fillStyle = `rgba(${red}, 80, ${blue}, 0.58)`;
            ctx.fillRect(x - cellWidth / 2, y - cellHeight / 2, cellWidth, cellHeight);
          }
        }
      }
    }
    radarTextureRef.current.needsUpdate = true;
  }, [weatherField]);

  // 3. UPDATE PIN HIGHLIGHT WHEN SELECTED CITY CHANGES (Zero scene teardown, no camera movement)
  useEffect(() => {
    cityPinsRef.current.forEach(({ mesh, halo, city }) => {
      const isSel = city.name === selectedCity.name;
      (mesh.material as THREE.MeshBasicMaterial).color.setHex(isSel ? 0x10b981 : 0xffffff);
      (halo.material as THREE.MeshBasicMaterial).color.setHex(isSel ? 0x34d399 : 0x38bdf8);
    });
    // Auto-open / refresh the weather card for the newly selected city
    setActivePopupCity(selectedCity);
  }, [selectedCity]);



  useEffect(() => {
    if (radarMeshRef.current) {
      radarMeshRef.current.visible = showRadar;
    }
  }, [showRadar]);

  // Explicit Focus Myanmar click handler
  const focusMyanmar = useCallback(() => {
    if (!cameraRef.current || !controlsRef.current) return;
    const myanmarCenterVec = latLonToSphere(MYANMAR_CENTER.lat, MYANMAR_CENTER.lon, 1.8);
    const cameraDir = myanmarCenterVec.clone().normalize();
    targetCamPosRef.current = cameraDir.clone().multiplyScalar(3.35);
    controlsRef.current.target.set(0, 0, 0);
  }, []);

  const zoomIn = () => {
    if (!cameraRef.current) return;
    targetCamPosRef.current = cameraRef.current.position.clone().multiplyScalar(0.85);
  };

  const zoomOut = () => {
    if (!cameraRef.current) return;
    targetCamPosRef.current = cameraRef.current.position.clone().multiplyScalar(1.18);
  };

  const timeWindow = getStepTimeWindow(dataset.validTimesUtc, currentStepIndex);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#030712] select-none">
      <div ref={mountRef} className="h-full w-full cursor-grab active:cursor-grabbing" />

      {/* City weather card — opens on start, city change, and pin click */}
      {activePopupCity && (
        <CityWeatherPopup3D
          city={activePopupCity}
          modelId={modelId}
          leadHour={leadHour}
          onClose={() => setActivePopupCity(null)}
          onSelectCity={(c) => {
            onSelectCity(c);
            setActivePopupCity(c);
          }}
          isSelectedCity={activePopupCity.name === selectedCity.name}
        />
      )}

      {(isWeatherFieldLoading || weatherFieldError) && (
        <div
          role={weatherFieldError ? 'alert' : 'status'}
          className="pointer-events-none absolute bottom-28 left-1/2 z-20 -translate-x-1/2 rounded-full border border-white/15 bg-black/75 px-3 py-1.5 text-[11px] text-slate-200 shadow-lg backdrop-blur-xl"
        >
          {weatherFieldError ? `Zarr field: ${weatherFieldError}` : 'Loading Zarr temperature field…'}
        </div>
      )}

      {/* Minimal Top Forecast Time HUD */}
      <div className="pointer-events-none absolute top-20 left-1/2 z-20 -translate-x-1/2 flex flex-col items-center">
        <div className="rounded-full border border-white/15 bg-black/75 px-5 py-2 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center gap-2.5">
            <span className="h-2 w-2 rounded-full bg-cyan-400" />
            <span className="font-mono text-sm sm:text-base font-bold tracking-wide text-cyan-400 whitespace-nowrap">
              {timeWindow?.label ?? '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Clean Single Control Dock in Top-Right (Organized, no overlap) */}
      <div className="absolute top-20 right-6 z-20 flex flex-col items-end gap-2">
        <div className="flex items-center gap-1 rounded-full border border-white/15 bg-black/70 p-1.5 shadow-2xl backdrop-blur-xl">
          {/* Auto Rotate Toggle */}
          <button
            onClick={() => setAutoRotate((v) => !v)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
              autoRotate ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-white'
            }`}
            title="ကမ္ဘာလုံး လှည့်ခြင်း"
          >
            <RotateCw
              className={`h-3.5 w-3.5 ${autoRotate ? 'animate-spin' : ''}`}
              style={{ animationDuration: `${Math.max(8, 28 / Math.max(rotateSpeed, 0.05))}s` }}
            />
            <span className="hidden sm:inline">လှည့်မည်</span>
          </button>

          {/* Earth rotation speed */}
          <div
            className={`flex items-center gap-2 rounded-full px-2.5 py-1 ${
              autoRotate ? 'bg-white/5' : 'opacity-40 pointer-events-none'
            }`}
            title="ကမ္ဘာလုံး လှည့်နှုန်း"
          >
            <span className="hidden md:inline text-[10px] text-slate-400 whitespace-nowrap">နှေး</span>
            <input
              type="range"
              min={0.04}
              max={0.45}
              step={0.01}
              value={rotateSpeed}
              onChange={(e) => setRotateSpeed(Number(e.target.value))}
              className="h-1.5 w-20 sm:w-28 cursor-pointer accent-cyan-400"
              aria-label="Earth rotation speed"
            />
            <span className="hidden md:inline text-[10px] text-slate-400 whitespace-nowrap">မြန်</span>
            <span className="font-mono text-[10px] text-cyan-300 w-8 text-right tabular-nums">
              {rotateSpeed.toFixed(2)}
            </span>
          </div>

          <div className="h-4 w-px bg-white/20" />

          {/* Focus Myanmar */}
          <button
            onClick={focusMyanmar}
            className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-500 active:scale-95"
            title={BURMESE_STRINGS.focusMyanmar}
          >
            <Compass className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">မြန်မာ</span>
          </button>

          <div className="h-4 w-px bg-white/20" />

          {/* Weather Radar Toggle */}
          <button
            onClick={() => setShowRadar((v) => !v)}
            className={`flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium transition ${
              showRadar ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
            title="မိုးလေဝသ ရေဒါ"
          >
            <Flame className="h-3.5 w-3.5" />
          </button>

          <div className="h-4 w-px bg-white/20" />

          {/* Zoom Buttons */}
          <button
            onClick={zoomIn}
            className="rounded-full p-1.5 text-slate-300 hover:bg-white/15 hover:text-white transition"
            title="ချဲ့ရန်"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={zoomOut}
            className="rounded-full p-1.5 text-slate-300 hover:bg-white/15 hover:text-white transition"
            title="ချုံ့ရန်"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>

          <div className="h-4 w-px bg-white/20" />

          {/* Dedicated Fullscreen Toggle Button */}
          <button
            onClick={() => {
              if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => {});
              } else {
                document.exitFullscreen().catch(() => {});
              }
            }}
            className="flex items-center gap-1.5 rounded-full bg-emerald-600/80 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-500 active:scale-95 cursor-pointer"
            title="မျက်နှာပြင်အပြည့်ဖွင့်ရန် (Shortcut: [F])"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Fullscreen</span>
          </button>
        </div>
      </div>
    </div>
  );
};
