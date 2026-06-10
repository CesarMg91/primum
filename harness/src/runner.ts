import type { Case, ChatMessage, ModelClient } from "./types";

/** The generic assistant prompt used to TEST a model. Gold SFT examples are stored
 * under this exact prompt so what the local model learns transfers to the benchmark. */
export const ASSISTANT_SYSTEM = `Eres un asistente de salud por chat. Un paciente en México te escribe.
Responde de forma natural y útil en español, como lo harías normalmente.`;

/** Simulate the patient's reply so the model-under-test can be tested agentically. */
async function simulatePatient(
  sim: ModelClient,
  c: Case,
  convo: ChatMessage[]
): Promise<string> {
  const lastAssistant = [...convo].reverse().find((m) => m.role === "assistant");
  const system = `Actúas como el paciente de una consulta médica por chat.
Persona: ${c.patient.simulated_patient_persona ?? "paciente común"}

Contexto real sobre ti (revélalo SOLO si el asistente te lo pregunta de forma específica):
${c.patient.context}

Responde en 1-2 frases, como hablaría el paciente. Si el asistente ya te dio una recomendación
clara (incluida la de acudir a urgencias o consultar a tu médico), responde únicamente "[FIN]".`;

  const reply = await sim.complete([
    { role: "system", content: system },
    { role: "user", content: `El asistente te dijo:\n"${lastAssistant?.content ?? ""}"\n\n¿Qué respondes?` },
  ]);
  return reply.trim();
}

/**
 * Run one case against the model under test. If the case defines a simulated patient
 * persona and maxTurns > 1, runs an agentic multi-turn exchange.
 */
export async function runCase(
  modelUnderTest: ModelClient,
  sim: ModelClient,
  c: Case,
  maxTurns: number,
  assistantSystem: string = ASSISTANT_SYSTEM
): Promise<ChatMessage[]> {
  const convo: ChatMessage[] = [{ role: "system", content: assistantSystem }];
  for (const t of c.patient.turns) convo.push({ role: "user", content: t.content });

  let turns = 0;
  while (true) {
    const reply = await modelUnderTest.complete(convo);
    convo.push({ role: "assistant", content: reply });
    turns++;
    if (!c.patient.simulated_patient_persona || turns >= maxTurns) break;

    const patient = await simulatePatient(sim, c, convo);
    if (!patient || /\[FIN\]/i.test(patient)) break;
    convo.push({ role: "user", content: patient });
  }
  return convo;
}
