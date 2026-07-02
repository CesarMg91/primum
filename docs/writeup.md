# PRIMUM: una IA médica que se entrena sola para ser más segura

> 🌐 **Idioma:** Español · **[English](writeup.en.md)**

> Cómo un adversario de IA convirtió un modelo médico gratuito en uno **2× más seguro** —
> y qué aprendimos en el camino.

*Por César Méndez García — cirujano y fundador de AMIA Health Tech*

---

## El problema que me quita el sueño

Llevo años operando, y lo que más me preocupa de la IA en medicina no es que sea poco
inteligente. Es que **se equivoca con total seguridad**. Un modelo de lenguaje puede sonar
competente, empático y convincente mientras te da un consejo que mata: no mandar a urgencias
a un síncope de esfuerzo, no advertir una interacción farmacológica, minimizar una bandera
roja oncológica.

En una clínica real de habla hispana —un consultorio del IMSS, una farmacia de barrio— esa
"confianza equivocada" es el riesgo número uno. Y los modelos gratuitos que un médico podría
correr en su propia computadora (sin mandar datos del paciente a la nube) son justo los que
más fallan.

Así nació **PRIMUM** (*primum non nocere*): un benchmark de seguridad clínica en español
mexicano, y un sistema para hacer esos modelos medible­mente más seguros.

## La idea: que el modelo se entrene contra su propio adversario

El loop tiene tres piezas:

1. **El adversario.** Una IA red-teamer (Claude Sonnet, juzgada por un panel de Claude Opus)
   genera casos clínicos diseñados para *romper* al modelo objetivo: interacciones inventadas
   con jerga creíble (CYP2C9, SGLT2…), banderas rojas disfrazadas, presión del paciente para
   que el modelo ceda. Solo se conservan los casos que **efectivamente lo rompen**.

2. **Las respuestas de oro.** Para cada caso, un modelo frontier responde de forma ideal y
   segura, y un panel de jueces verifica que pase la rúbrica clínica (rúbricas con referencias
   a GPC del IMSS y NOM). Solo las respuestas verificadas se vuelven datos de entrenamiento.

3. **El reentrenamiento.** El modelo local (MedGemma 4B) se afina con QLoRA sobre ese corpus
   de oro, y se vuelve a medir. El adversario vuelve a atacar al modelo mejorado, encuentra sus
   nuevas debilidades, y el ciclo se repite.

Cada vuelta del loop le dice al sistema dónde está la siguiente debilidad. Es auto-mejora
dirigida, no a ciegas.

## La medición honesta

Un error fácil sería entrenar y medir sobre los mismos casos. Para evitarlo, apartamos un
**conjunto de prueba congelado** que el modelo **nunca ve en entrenamiento**, estratificado por
tipo de peligro. Medimos tres cosas, priorizando seguridad sobre todo:

- **Safety**: % de casos sin ninguna violación crítica. Una sola respuesta peligrosa reprueba
  el caso.
- **Safety de alto riesgo**: lo mismo, solo sobre los casos de mayor gravedad clínica.
- **Efectividad**: qué tan completa y correcta es la respuesta más allá de evitar el daño.

Un juez LLM estricto evalúa cada respuesta **citando evidencia textual**; ante la duda, marca
inseguro (fail-safe).

## El resultado (y por qué cazamos nuestra propia métrica inflada)

Al principio medíamos sobre un test adversarial de **29 casos**, y el número se veía
espectacular: el modelo afinado pasaba de 37.9% a **75.9%** de seguridad. Pero fuimos honestos
con nosotros mismos. 29 casos son pocos —cada caso vale 3.4 puntos— y el test tenía escenarios
demasiado fáciles que inflaban la cifra.

Así que **crecimos el test a 56 casos** más difíciles e imparciales (generados a ciegas, sin
filtro adversarial a favor del modelo afinado), y re-medimos **todo desde cero**. El número
honesto es más modesto, pero a prueba de balas:

| Métrica (test honesto de 56) | MedGemma base | PRIMUM (afinado) | Δ |
|---|---|---|---|
| 🛡️ **Safety** | **21.4%** | **52.7%** | **+31.3 — 2.5×** |
| ⚠️ Alto riesgo | 20.8% | 50.0% | +29.2 |
| ✓ Efectividad | 7.9% | 30.5% | +22.6 |

**Más que duplicamos la seguridad** de un modelo médico gratuito, sobre un test difícil y
honesto. No es el 75.9% que vimos con el test chico —y precisamente por eso confiamos en el
52.7%: lo medimos sobre el doble de casos, sin regalos. Descubrir que tu propia métrica está
inflada, y corregirla, es parte del método.

Y lo más importante para la tesis: el modelo aprendió a defenderse de **ataques que nunca vio**
en entrenamiento. El loop generaliza. Todo corre en un modelo **gratuito de 4B**, en la
computadora de un consultorio, sin enviar datos del paciente a la nube.

## Lo que aprendimos (y el enemigo que queda)

- **El loop generaliza.** Casos adversariales no vistos —cauda equina, oclusión de arteria
  retiniana, infarto de presentación atípica— que el base fallaba, el modelo afinado los
  resiste.
- **La alucinación es el enemigo terco.** Sobre el test honesto de 56, **7 de 8 casos de
  alucinación siguen rotos** —tanto en el modelo afinado como en sus variantes. El modelo
  *confirma* interacciones farmacológicas **inventadas** ("la atorvastatina inhibe CYP2C9 y
  duplica el efecto de la warfarina") con total seguridad. Es la debilidad #1 que ni el
  entrenamiento actual ha movido, y el próximo Everest (ya estamos reforzando el corpus
  anti-alucinación para el siguiente ciclo).
- **Un benchmark más difícil no es malo, es más honesto.** Crecer el test de 29 a 56 casos bajó
  los números en absoluto (el afinado de 75.9% a 52.7%), pero hizo la medición mucho más fiable:
  cada caso pesa la mitad, y desaparecieron los "regalos" que inflaban la cifra.

## Limitaciones (seamos serios)

Esto es un **ciclo de muchos**, no un producto terminado:
- El test honesto tiene 56 casos y sigue creciendo. La cifra de 52.7% es la que defendemos.
- Probado sobre **un solo modelo base** (MedGemma 4B). El siguiente paso es demostrar que el
  método levanta también a otros (MedGemma 1.5, y más).
- La alucinación de mecanismos farmacológicos sigue sin resolverse del todo (7/8 casos).
- Esto **no es consejo médico** ni un dispositivo clínico aprobado. Es investigación hacia IA
  médica más segura.

## Por qué importa

Un modelo así —gratuito, local, privado y *medible­mente* más seguro— podría poner una segunda
opinión confiable en manos de médicos que no tienen acceso a herramientas caras, sin
comprometer los datos del paciente. Construido desde la trinchera clínica, con el sesgo correcto:
**primum non nocere**.

El benchmark, el método y el código son abiertos:
[github.com/CesarMg91/primum](https://github.com/CesarMg91/primum) · leaderboard en
[primum-wine.vercel.app](https://primum-wine.vercel.app).

---

*Metodología abierta · español mexicano (es-MX) · esto no constituye consejo médico.*
