"use client";
import board from "../data/leaderboard.json";
import improvement from "../data/improvement.json";
import Coliseo from "./Coliseo";
import { useLang, LangToggle } from "./i18n";

const pc1 = (n: number) => `${(n * 100).toFixed(1)}%`;
const pct = (n: number | null) => (n === null ? "n/a" : `${(n * 100).toFixed(1)}%`);
const width = (n: number | null) => (n === null ? "0%" : `${(n * 100).toFixed(0)}%`);
const isLocal = (m: string) => m.startsWith("ollama:");
const modelName = (m: string) => (m.includes(":") ? m.slice(m.indexOf(":") + 1) : m);
const cls = (n: number | null) => (n === null ? "" : n >= 0.9 ? "good" : n >= 0.7 ? "warn" : "bad");
const medal = (i: number) => (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : String(i + 1));

export default function Page() {
  const { t } = useLang();
  const judgeLabel = (j: string) => (j.includes("+") ? t.judgePanel : modelName(j));

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
      <LangToggle />
      <p className="eyebrow">{t.eyebrow}</p>
      <h1>{t.h1}</h1>
      <p className="tagline">{t.tagline}</p>
      <p className="lede" dangerouslySetInnerHTML={{ __html: t.lede }} />

      <div className="stats">
        <div className="stat"><b>{improvement.corpus}</b><span>{t.statCases}</span></div>
        <div className="stat"><b>{improvement.cycles}</b><span>{t.statCycles}</span></div>
        <div className="stat"><b>2×</b><span>{t.statSafety}</span></div>
        <div className="stat"><b>{improvement.updated}</b><span>{t.statUpdated}</span></div>
      </div>

      {showFinding && (
        <>
          <div className="improve-head" style={{ marginTop: 28 }}>
            <h2>{t.problemH2}</h2>
            <p dangerouslySetInnerHTML={{ __html: t.problemBody }} />
          </div>
          <div className="finding">
            <div className="col">
              <div className="big good">{pct(bestFrontier)}</div>
              <div className="lbl">{t.bestFrontier}</div>
            </div>
            <div className="vs">vs</div>
            <div className="col">
              <div className="big bad">{pct(worstLocal)}</div>
              <div className="lbl">{t.worstLocal}</div>
            </div>
          </div>
        </>
      )}

      <div className="improve-head">
        <h2>{t.loopH2}</h2>
        <p dangerouslySetInnerHTML={{ __html: t.loopBody(improvement.cycles, improvement.testCases) }} />
      </div>

      <div className="improve-finding">
        <div className="col">
          <div className="big base">{pc1(improvement.base.safety)}</div>
          <div className="lbl">{t.baseLabel}</div>
        </div>
        <div className="arrow"><b>2×</b><span>+38 pts</span></div>
        <div className="col">
          <div className="big primum">{pc1(improvement.primum.safety)}</div>
          <div className="lbl">{t.primumLabel}</div>
        </div>
      </div>

      <Coliseo />

      <div className="improve-head" style={{ marginTop: 36 }}>
        <h2>{t.casesH2(improvement.testCases)}</h2>
        <p dangerouslySetInnerHTML={{ __html: t.casesBody }} />
      </div>

      <div className="casegrid">
        {improvement.cases.map((c) => {
          const win = c.base === 0 && c.primum === 1;
          return (
            <div key={c.id} className={`casecell${win ? " win" : ""}`}>
              <div className="casetop">
                <span className="caseid">{c.id}</span>
                <span className="casemarks">
                  <span className={`dot ${c.base ? "ok" : "bad"}`} title="base" />
                  <span className="arrow">→</span>
                  <span className={`dot ${c.primum ? "ok" : "bad"}`} title="PRIMUM" />
                </span>
              </div>
              <div className="casetitle">{c.t}</div>
            </div>
          );
        })}
      </div>

      <div className="improve-head" style={{ marginTop: 36 }}>
        <h2>{t.generalH2}</h2>
        <p dangerouslySetInnerHTML={{ __html: t.generalBody(board.totalCases, board.generatedAt.slice(0, 10)) }} />
      </div>

      <div className="card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th className="rank">#</th>
                <th>{t.thModel}</th>
                <th>{t.thSafety}</th>
                <th>{t.thHighRisk}</th>
                <th>{t.thEffect}</th>
                <th>{t.thCases}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={e.model}>
                  <td className="rank">{medal(i)}</td>
                  <td className="model">
                    {modelName(e.model)}
                    <span className={`badge ${isLocal(e.model) ? "local" : "frontier"}`}>
                      {isLocal(e.model) ? t.badgeLocal : t.badgeFrontier}
                    </span>
                    <span className="judge">
                      {t.judge}: {judgeLabel(e.judge)}
                      {e.model === e.judge && t.selfJudge}
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
        <div className="item"><h3>{t.howSafetyH}</h3><p>{t.howSafetyP}</p></div>
        <div className="item"><h3>{t.howHighH}</h3><p>{t.howHighP}</p></div>
        <div className="item"><h3>{t.howEffectH}</h3><p>{t.howEffectP}</p></div>
        <div className="item"><h3>{t.howJudgeH}</h3><p>{t.howJudgeP}</p></div>
      </div>

      <footer>
        <p dangerouslySetInnerHTML={{ __html: t.footer(maxCases) }} />
      </footer>
    </main>
  );
}
