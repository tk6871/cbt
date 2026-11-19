import { useEffect, useRef, useState } from 'react';
import './rounds-loading.css';
export default function RoundsLoading({ percent }: { percent: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [rendered, setRendered] = useState(false);
  useEffect(() => {
    let disposed = false,
      painted = false;
    let cleanup: (() => void) | undefined;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const connection = (
      navigator as Navigator & { connection?: { saveData?: boolean } }
    ).connection;
    if (
      reducedMotion.matches ||
      connection?.saveData ||
      matchMedia('(pointer: coarse), (max-width: 820px)').matches
    )
      return;
    // Short requests do not start WebGL or fetch the optional renderer.
    const timer = window.setTimeout(async () => {
      try {
        const T = await import('three');
        if (disposed || !canvas.current || reducedMotion.matches) return;
        const renderer = new T.WebGLRenderer({
          canvas: canvas.current,
          alpha: true,
          antialias: true,
        });
        const scene = new T.Scene();
        const camera = new T.PerspectiveCamera(38, 1, 0.1, 20);
        camera.position.z = 4;
        const geometry = new T.IcosahedronGeometry(0.86, 0);
        const material = new T.MeshBasicMaterial({
          color: '#36a68f',
          wireframe: true,
        });
        const mesh = new T.Mesh(geometry, material);
        cleanup = () => {
          renderer.setAnimationLoop(null);
          geometry.dispose();
          material.dispose();
          renderer.dispose();
          renderer.forceContextLoss();
        };
        scene.add(mesh);
        renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
        renderer.setSize(52, 52, false);
        renderer.setAnimationLoop((ms) => {
          if (document.hidden || reducedMotion.matches) return;
          mesh.rotation.set(ms * 0.001, ms * 0.0015, 0);
          renderer.render(scene, camera);
          if (!painted) {
            painted = true;
            setRendered(true);
          }
        });
      } catch {
        cleanup?.();
        cleanup = undefined;
      }
    }, 300);

    return () => {
      disposed = true;
      window.clearTimeout(timer);
      cleanup?.();
    };
  }, []);
  return (
    <section className="rounds-loading" aria-label="종목 자료 로딩">
      <span className="rounds-loading-art" aria-hidden="true">
        {!rendered && <span>◇</span>}
        <canvas ref={canvas} hidden={!rendered} />
      </span>
      <div className="rounds-loading-copy">
        <strong role="status">
          {percent === 0
            ? '문제 자료를 읽는 중…'
            : percent < 100
              ? '회차 목록을 준비하는 중…'
              : '준비 완료'}
        </strong>
        <small>로딩 단계 {percent}%</small>
        <progress value={percent} max={100} aria-label="회차 준비 진행률" />
      </div>
    </section>
  );
}
