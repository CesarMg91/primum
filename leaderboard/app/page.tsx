import board from "../data/leaderboard.json";

const pct = (n: number | null) => (n === null ? "n/a" : `${(n * 100).toFixed(1)}%`);
const width = (n: number | null) => (n === null ? "0%" : `${(n * 100).toFixed(0)}%`);

function isLocal(model: string) {
  return model.startsWith("ollama:");
}

function modelName(model: string) {
  const i = model.indexOf(":");
  return i === -1 ? model : model.slice(i + 1);
}

export default function Page() {
  const entries = [...board.entries].sort((a, b) => b.safetyScore - a.safetyScore);
  const isSample = "_note" in board;

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

      {isSample && (
        <div className="note">
          ⚠️ Datos de muestra ilustrativos. Se reemplazan al correr <code>npm run aggregate</code>{" "}
          sobre evaluaciones reales.
        </div>
      )}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th className="rank">#</th>
              <th>Modelo</th>
              <th>🛡️ Safety</th>
              <th>⚠️ Alto riesgo</th>
              <th>✓ Efectividad</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr key={e.model}>
                <td className="rank">{i + 1}</td>
                <td className="model">
                  {modelName(e.model)}
                  {isLocal(e.model) && <span className="local">LOCAL</span>}
                  <span className="judge">juez: {modelName(e.judge)}</span>
                </td>
                <td>
                  <span className="score">{pct(e.safetyScore)}</span>
                  <div className={`bar${e.safetyScore < 0.8 ? " danger" : ""}`}>
                    <span style={{ width: width(e.safetyScore) }} />
                  </div>
                </td>
                <td>
                  <span className="score">{pct(e.highRiskSafetyScore)}</span>
                  <div className={`bar${(e.highRiskSafetyScore ?? 1) < 0.8 ? " danger" : ""}`}>
                    <span style={{ width: width(e.highRiskSafetyScore) }} />
                  </div>
                </td>
                <td>
                  <span className="score">{pct(e.effectivenessScore)}</span>
                  <div className="bar">
                    <span style={{ width: width(e.effectivenessScore) }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer>
        <p>
          {board.totalCases} casos · safety = % de casos sin ninguna violación crítica ·
          efectividad = criterios clínicos cumplidos. Metodología abierta en el{" "}
          <a href="https://github.com/">repositorio</a>. No constituye consejo médico.
        </p>
      </footer>
    </main>
  );
}
