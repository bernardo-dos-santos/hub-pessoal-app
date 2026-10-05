import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { jarvisService } from './jarvisService';

type OrbProps = {
  /** Lado do canvas em px. */
  size?: number;
  className?: string;
};

// Simplex noise 3D (Ashima) — usado no vertex shader para deslocamento orgânico.
const SIMPLEX_GLSL = `
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x,289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+1.0*C.xxx;vec3 x2=x0-i2+2.0*C.xxx;vec3 x3=x0-1.0+3.0*C.xxx;
  i=mod(i,289.0);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=1.0/7.0;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

// Sempre girando devagar em repouso — só acelera e "estica" quando o Jarvis fala.
const IDLE_ROTATION_SPEED = 0.055;
const ACTIVE_ROTATION_SPEED = 0.6;
const IDLE_INTENSITY = 0.035;
const ACTIVE_INTENSITY_RANGE = 0.34;
const IDLE_DETAIL = 1.8;
const ACTIVE_DETAIL_RANGE = 1.6;

/**
 * Orb 3D do Jarvis — nuvem de pontos numa esfera de Fibonacci com deslocamento
 * orgânico via simplex noise. Tons terracota. Reutilizado no modo voz e no hub
 * radial da Home. Se assina diretamente ao jarvisService: gira sempre devagar
 * em repouso e reage em tempo real ao volume/frequência da fala do Jarvis —
 * o orb É o Jarvis, não um indicador ao lado dele.
 */
export function Orb({ size = 180, className = '' }: OrbProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // Estado ao vivo do áudio — atualizado via subscription, fora do ciclo de
    // render do React, pra não recriar a cena Three.js a cada frame de fala.
    const volumeRef = { current: 0 };
    const trebleRef = { current: 0 };
    const unsubLevel = jarvisService.onAudioLevel((v, t) => {
      volumeRef.current = v;
      trebleRef.current = t;
    });

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.z = 3.2;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0);
    const pixelRatio = Math.min(window.devicePixelRatio, 2);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(size, size);
    mount.appendChild(renderer.domElement);

    // Escala de projeção real (px de tela por unidade de mundo, à distância da câmera) —
    // deriva do tamanho real do canvas, não um valor fixo, pra não "explodir" em canvases pequenos.
    const fovRad = (camera.fov * Math.PI) / 180;
    const projScale = (size * pixelRatio) / 2 / Math.tan(fovRad / 2);

    // Pontos numa esfera de Fibonacci.
    const COUNT = 2600;
    const positions = new Float32Array(COUNT * 3);
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < COUNT; i++) {
      const y = 1 - (i / (COUNT - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const theta = golden * i;
      positions[i * 3] = Math.cos(theta) * r;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(theta) * r;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: IDLE_INTENSITY },
        uDetail: { value: IDLE_DETAIL },
        uProjScale: { value: projScale },
        uColorHot: { value: new THREE.Color('#E39A6E') },
        uColorCore: { value: new THREE.Color('#8A4A2E') },
      },
      vertexShader: `
        uniform float uTime;
        uniform float uIntensity;
        uniform float uDetail;
        uniform float uProjScale;
        varying float vGlow;
        ${SIMPLEX_GLSL}
        void main(){
          vec3 p = position;
          float n = snoise(p * uDetail + uTime * 0.35);
          float disp = 1.0 + n * uIntensity;
          p *= disp;
          vGlow = smoothstep(-1.0, 1.0, n);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          // Raio do ponto em unidades de mundo, projetado pra pixels reais da tela —
          // clamp defensivo: nunca deixa os pontos crescerem a ponto de virar um blob sólido.
          float sizePx = 0.03 * uProjScale / -mv.z;
          gl_PointSize = clamp(sizePx * (1.0 + vGlow * 0.6), 1.5, 7.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 uColorHot;
        uniform vec3 uColorCore;
        varying float vGlow;
        void main(){
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          if (d > 0.5) discard;
          float alpha = smoothstep(0.5, 0.0, d);
          vec3 col = mix(uColorCore, uColorHot, vGlow);
          gl_FragColor = vec4(col, alpha * (0.55 + vGlow * 0.45));
        }`,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    let raf = 0;
    let elapsed = 0;
    let smoothVolume = 0;
    let smoothTreble = 0;
    const clock = new THREE.Clock();
    const animate = () => {
      const dt = clock.getDelta();
      // O orb nunca para: tempo sempre avança, e ele gira devagar mesmo em
      // repouso. Volume/agudos da fala do Jarvis (via jarvisService) só somam
      // intensidade, detalhe e velocidade em cima dessa base — suavizados pra
      // não tremer frame a frame.
      elapsed += dt;
      smoothVolume += (volumeRef.current - smoothVolume) * 0.15;
      smoothTreble += (trebleRef.current - smoothTreble) * 0.15;

      material.uniforms.uTime.value = elapsed;

      const targetIntensity = IDLE_INTENSITY + smoothVolume * ACTIVE_INTENSITY_RANGE;
      const curIntensity = material.uniforms.uIntensity.value as number;
      material.uniforms.uIntensity.value = curIntensity + (targetIntensity - curIntensity) * 0.12;

      material.uniforms.uDetail.value = IDLE_DETAIL + smoothTreble * ACTIVE_DETAIL_RANGE;

      const rotSpeed = IDLE_ROTATION_SPEED + smoothVolume * (ACTIVE_ROTATION_SPEED - IDLE_ROTATION_SPEED);
      points.rotation.y += rotSpeed * dt;
      points.rotation.x = Math.sin(elapsed * 0.12) * 0.12;

      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      unsubLevel();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, [size]);

  return <div ref={mountRef} className={className} style={{ width: size, height: size }} />;
}
