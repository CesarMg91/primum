import board from "../data/leaderboard.json";

const pct = (n: number | null) => (n === null ? "n/a" : `${(n * 100).toFixed(1)}%`);
const width = (n: number | null) => (n === null ? "0%" : `${(n * 100).toFixed(0)}%`);
const isLocal = (m: string) => m.startsWith("ollama:");
const modelName = (m: string) => (m.includes(":") ? m.slice(m.indexOf(":") + 1) : m);
const judgeLabel = (j: string) => (j.includes("+") ? "panel de jueces" : modelName(j));
const cls = (n: number | null) => (n === null ? "" : n >= 0.9 ? "good" : n >= 0.7 ? "warn" : "bad");
const medal = (i: number) => (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : String(i + 1));

export default function Page() {
  const entries = [...board.entries].sort(
    (a, b) => b.safetyScore - a.safetyScore || b.effectivenessScore - a.effectivenessScore
  );
  const maxCases = entries.length ? Math.max(...entries.map((e) => e.totalCases)) : board.totalCases;

  const locals = entries.filter((e) => isLocal(e.model));
  const frontier = entries.filter((e) => !isLocal(e.model));
  const showFinding = locals.length > 0 && frontier.length > 0;
  const bestFrontier = frontier.length ? Math.max(...frontier.map((e) => e.safetyScore)) : 0;
  const worstLocal = locals.length ? Math.min(...locals.map((e) => e.safetyScore)) : 0;

  return (
    <main className="wrap">
      <p className="eyebrow">Primum · primum non nocere</p>
      <h1>Benchmark de seguridad clínica</h1>
      <p className="tagline">¿Es seguro este modelo en una clínica real de habla hispana?</p>
      <p className="lede">
        Medimos <strong>seguridad antes que efectividad</strong> en escenarios clínicos en
        español mexicano —incluyendo modelos <strong>locales y gratis</strong> como MedGemma y
        Gemma. Una sola respuesta peligrosa basta para reprobar un caso.
      </p>

      <div className="stats">
        <div className="stat"><b>{maxCases}</b><span>casos clínicos</span></div>
        <div className="stat"><b>{entries.length}</b><span>modelos evaluados</span></div>
        <div className="stat"><b>{board.generatedAt.slice(0, 10)}</b><span>actualizado</span></div>
      </div>

      {showFinding && (
        <div className="finding">
          <div className="col">
            <div className="big good">{pct(bestFrontier)}</div>
            <div className="lbl">Mejor modelo de frontera</div>
          </div>
          <div className="vs">vs</div>
          <div className="col">
            <div className="big bad">{pct(worstLocal)}</div>
            <div className="lbl">Modelo local "gratis" más inseguro</div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th className="rank">#</th>
                <th>Modelo</th>
                <th>🛡️ Safety</th>
                <th>⚠️ Alto riesgo</th>
                <th>✓ Efectividad</th>
                <th>Casos</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={e.model}>
                  <td className="rank">{medal(i)}</td>
                  <td className="model">
                    {modelName(e.model)}
                    <span className={`badge ${isLocal(e.model) ? "local" : "frontier"}`}>
                      {isLocal(e.model) ? "LOCAL" : "FRONTERA"}
                    </span>
                    <span className="judge">
                      juez: {judgeLabel(e.judge)}
                      {e.model === e.judge && " · ⚠ auto-juez"}
                    </span>
                  </td>
                  <td>
                    <span className={`score ${cls(e.safetyScore)}`}>{pct(e.safetyScore)}</span>
                    <div className="bar"><span className={cls(e.safetyScore)} style={{ width: width(e.safetyScore) }} /></div>
                  </td>
                  <td>
                    <span className={`score ${cls(e.highRiskSafetyScore)}`}>{pct(e.highRiskSafetyScore)}</span>
                    <div className="bar"><span className={cls(e.highRiskSafetyScore)} style={{ width: width(e.highRiskSafetyScore) }} /></div>
                  </td>
                  <td>
                    <span className={`score ${cls(e.effectivenessScore)}`}>{pct(e.effectivenessScore)}</span>
                    <div className="bar"><span className={cls(e.effectivenessScore)} style={{ width: width(e.effectivenessScore) }} /></div>
                  </td>
                  <td className="cases" style={{ opacity: e.totalCases < maxCases ? 0.5 : 1 }}>{e.totalCases}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="how">
        <div className="item">
          <h3>🛡️ Safety Score</h3>
          <p>% de casos sin ninguna violación crítica. Una sola respuesta peligrosa reprueba el caso.</p>
        </div>
        <div className="item">
          <h3>⚠️ Alto riesgo</h3>
          <p>Safety calculado solo sobre los casos etiquetados como de alto riesgo clínico.</p>
        </div>
        <div className="item">
          <h3>✓ Efectividad</h3>
          <p>Qué tan completa y correcta es la respuesta más allá de evitar el daño.</p>
        </div>
        <div className="item">
          <h3>⚖️ Juez imparcial</h3>
          <p>Un LLM-as-judge estricto evalúa cada respuesta citando evidencia textual.</p>
        </div>
      </div>

      <footer>
        <p>
          {maxCases} casos · español mexicano (es-MX) · metodología abierta en el{" "}
          <a href="https://github.com/CesarMg91/primum">repositorio</a>. Las filas atenuadas en "Casos" se
          corrieron sobre un set menor (no comparables). Esto no constituye consejo médico.
        </p>
      </footer>
    </main>
  );
}
