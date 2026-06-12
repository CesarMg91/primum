"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import improvement from "../data/improvement.json";

const TEAL = 0x00a896, SOFT = 0xe1f5ee, ROSE = 0xf43f5e, DEEP = 0x028090;

export default function Coliseo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tickerRef = useRef<HTMLDivElement>(null);
  const tallyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cases = improvement.cases;

    let W = canvas.clientWidth || 640;
    let H = canvas.clientHeight || 460;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(W, H, false);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(52, W / H, 0.1, 200);
    camera.position.set(0, 6.5, 22);

    const guardian = new THREE.Mesh(new THREE.IcosahedronGeometry(2.0, 1), new THREE.MeshBasicMaterial({ color: TEAL }));
    scene.add(guardian);
    const gwire = new THREE.Mesh(new THREE.IcosahedronGeometry(2.35, 1), new THREE.MeshBasicMaterial({ color: SOFT, wireframe: true, transparent: true, opacity: 0.25 }));
    scene.add(gwire);
    [2.7, 3.2].forEach((r, i) =>
      scene.add(new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), new THREE.MeshBasicMaterial({ color: TEAL, transparent: true, opacity: i ? 0.05 : 0.12, blending: THREE.AdditiveBlending, depthWrite: false })))
    );
    const shield = new THREE.Mesh(new THREE.SphereGeometry(3.4, 28, 18), new THREE.MeshBasicMaterial({ color: TEAL, wireframe: true, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(shield);
    const rings: THREE.Mesh[] = [];
    [5.2, 7, 9].forEach((r, i) => {
      const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.03, 8, 120), new THREE.MeshBasicMaterial({ color: i === 1 ? TEAL : DEEP, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.rotation.x = Math.PI / 2;
      scene.add(m);
      rings.push(m);
    });

    const starN = 420, sp = new Float32Array(starN * 3);
    for (let i = 0; i < starN; i++) {
      const a = Math.random() * 6.283, rr = 6 + Math.random() * 22;
      sp[i * 3] = Math.cos(a) * rr; sp[i * 3 + 1] = (Math.random() - 0.4) * 16; sp[i * 3 + 2] = Math.sin(a) * rr;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.BufferAttribute(sp, 3));
    const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: SOFT, size: 0.06, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(stars);

    const attackGeo = new THREE.SphereGeometry(0.2, 12, 12);
    type Ember = { mesh: THREE.Mesh; ang: number; r: number; y: number; safe: boolean; c: { id: string; t: string } };
    type Burst = { pts: THREE.Points; vel: THREE.Vector3[]; life: number };
    const embers: Ember[] = [];
    const bursts: Burst[] = [];
    let idx = 0, spawnT = 0, flash = 0, resisted = 0, total = 0;
    const tmp = new THREE.Vector3();

    function spawnBurst(p: THREE.Vector3, broke: boolean) {
      const n = broke ? 40 : 26, g = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), vel: THREE.Vector3[] = [];
      for (let i = 0; i < n; i++) {
        pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
        vel.push(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(1.8 + Math.random() * 3));
      }
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: broke ? ROSE : SOFT, size: 0.16, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }));
      scene.add(pts);
      bursts.push({ pts, vel, life: 0 });
    }
    function spawn() {
      const c = cases[idx % cases.length]; idx++;
      const m = new THREE.Mesh(attackGeo, new THREE.MeshBasicMaterial({ color: ROSE }));
      const ang = Math.random() * 6.283;
      m.position.set(Math.cos(ang) * 14, (Math.random() - 0.5) * 7, Math.sin(ang) * 14);
      scene.add(m);
      embers.push({ mesh: m, ang, r: 14, y: m.position.y, safe: c.primum === 1, c });
    }
    function setTicker(c: { id: string; t: string }, ok: boolean) {
      if (tickerRef.current)
        tickerRef.current.innerHTML = `<span style="color:${ok ? "#5DCAA5" : "#f5949a"}">${ok ? "⛨ resistió" : "✕ rompió"}</span> &nbsp;<span style="color:#9FE1CB">${c.id}</span> &nbsp;${c.t}`;
      if (tallyRef.current) tallyRef.current.textContent = `resistidos ${resisted}/${total}`;
    }

    const clock = new THREE.Clock();
    let raf = 0;
    function loop() {
      raf = requestAnimationFrame(loop);
      const t = clock.getElapsedTime(), dt = Math.min(clock.getDelta() + 0.016, 0.05);
      const hb = Math.pow(Math.sin(t * 1.4) * 0.5 + 0.5, 2);
      guardian.scale.setScalar(1 + hb * 0.07);
      (guardian.material as THREE.MeshBasicMaterial).color.setHex(flash > 0 ? ROSE : TEAL);
      guardian.rotation.y += dt * 0.3; guardian.rotation.x += dt * 0.12;
      gwire.rotation.y -= dt * 0.5; gwire.scale.copy(guardian.scale);
      shield.scale.setScalar(1 + flash * 0.06 + Math.sin(t * 2) * 0.01);
      (shield.material as THREE.MeshBasicMaterial).opacity = 0.1 + flash * 0.25;
      flash = Math.max(0, flash - dt * 1.5);
      rings.forEach((rg, i) => { rg.rotation.z += dt * (0.05 - i * 0.015); });
      stars.rotation.y += dt * 0.015;

      spawnT -= dt;
      if (spawnT <= 0 && embers.length < 5) { spawn(); spawnT = 0.95; }

      for (let i = embers.length - 1; i >= 0; i--) {
        const e = embers[i]; e.r -= dt * 3.2; e.ang += dt * 0.5;
        const f = Math.max(e.r / 14, 0);
        tmp.set(Math.cos(e.ang) * e.r, e.y * f, Math.sin(e.ang) * e.r);
        e.mesh.position.copy(tmp);
        (e.mesh.material as THREE.MeshBasicMaterial).opacity = 0.7 + Math.sin(t * 6 + i) * 0.3;
        const d = tmp.length();
        if (e.safe && d <= 3.5) {
          spawnBurst(tmp, false); resisted++; total++; setTicker(e.c, true);
          scene.remove(e.mesh); embers.splice(i, 1);
        } else if (!e.safe && d <= 1.3) {
          spawnBurst(e.mesh.position, true); flash = 1; total++; setTicker(e.c, false);
          scene.remove(e.mesh); embers.splice(i, 1);
        } else if (e.r <= 0.2) { scene.remove(e.mesh); embers.splice(i, 1); }
      }
      for (let b = bursts.length - 1; b >= 0; b--) {
        const bu = bursts[b]; bu.life += dt;
        const arr = bu.pts.geometry.attributes.position.array as Float32Array;
        for (let j = 0; j < bu.vel.length; j++) {
          bu.vel[j].multiplyScalar(1 - 2 * dt);
          arr[j * 3] += bu.vel[j].x * dt; arr[j * 3 + 1] += bu.vel[j].y * dt; arr[j * 3 + 2] += bu.vel[j].z * dt;
        }
        bu.pts.geometry.attributes.position.needsUpdate = true;
        (bu.pts.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - bu.life / 0.8);
        if (bu.life >= 0.8) { scene.remove(bu.pts); bursts.splice(b, 1); }
      }
      const ca = t * 0.06;
      camera.position.set(Math.sin(ca) * 22, 6.5 + Math.sin(t * 0.3) * 1.2, Math.cos(ca) * 22);
      camera.lookAt(0, 0.5, 0);
      renderer.render(scene, camera);
    }
    loop();

    function onResize() {
      if (!canvas) return;
      W = canvas.clientWidth || 640; H = canvas.clientHeight || 460;
      camera.aspect = W / H; camera.updateProjectionMatrix();
      renderer.setSize(W, H, false);
    }
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
    };
  }, []);

  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

  return (
    <div className="coliseo">
      <canvas ref={canvasRef} className="coliseo-canvas" />
      <div className="coliseo-head">
        <div>
          <div className="coliseo-kicker">PRIMUM · EL COLISEO</div>
          <div className="coliseo-title">El guardián vs su adversario</div>
          <div className="coliseo-sub">{improvement.testCases} ataques clínicos reales · {improvement.cycles} ciclos</div>
        </div>
        <div className="coliseo-score">
          <div className="coliseo-score-lbl">Seguridad</div>
          <div className="coliseo-bar-row">
            <span className="coliseo-bar-name">PRIMUM</span>
            <div className="coliseo-bar"><span style={{ width: pct(improvement.primum.safety), background: "#1D9E75" }} /></div>
            <span className="coliseo-bar-val teal">{pct(improvement.primum.safety)}</span>
          </div>
          <div className="coliseo-bar-row">
            <span className="coliseo-bar-name">Base</span>
            <div className="coliseo-bar"><span style={{ width: pct(improvement.base.safety), background: "#888780" }} /></div>
            <span className="coliseo-bar-val gray">{pct(improvement.base.safety)}</span>
          </div>
        </div>
      </div>
      <div className="coliseo-foot">
        <div ref={tickerRef} className="coliseo-ticker">Preparando la arena…</div>
        <div ref={tallyRef} className="coliseo-tally">resistidos 0</div>
      </div>
    </div>
  );
}
