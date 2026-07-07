export default function DocsPage() {
  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      {/* Hero */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">📚 Documentación</h1>
        <p className="text-zinc-400 mt-2 text-sm sm:text-base">
          Cómo funciona el bot de copy trading en papel de Polymarket — arquitectura, scoring, paper trading, y auto-mejora.
        </p>
      </div>

      {/* Índice */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 sm:p-6">
        <h2 className="text-lg font-semibold mb-3">📑 Índice</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-sm">
          {sections.map((s, i) => (
            <a key={i} href={`#${s.id}`} className="text-zinc-400 hover:text-emerald-400 transition-colors py-1">
              {i + 1}. {s.title}
            </a>
          ))}
        </div>
      </div>

      {/* Secciones */}
      {sections.map((s) => (
        <Section key={s.id} id={s.id} title={s.title} content={s.content} />
      ))}

      {/* Footer */}
      <div className="bg-zinc-900 border border-emerald-900/40 rounded-xl p-5 sm:p-6 text-center">
        <p className="text-emerald-400 font-semibold text-lg">🔒 Seguridad ante todo</p>
        <p className="text-zinc-400 text-sm mt-2">
          Este bot fue diseñado desde cero para <strong>nunca</strong> ejecutar trades reales sin intervención humana.
          No almacena claves privadas. No firma transacciones. No gasta dinero real.
          La transición a trading real requiere cambiar manualmente el flag <code className="text-emerald-400 bg-zinc-800 px-1 rounded">DEMO_MODE</code> a <code className="text-red-400 bg-zinc-800 px-1 rounded">false</code> y configurar una API key con fondos reales.
        </p>
      </div>
    </div>
  );
}

type SectionData = { id: string; title: string; content: React.ReactNode };

function Section({ id, title, content }: { id: string; title: string; content: React.ReactNode }) {
  return (
    <section id={id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 sm:p-6 scroll-mt-20">
      <h2 className="text-lg sm:text-xl font-bold mb-3 text-zinc-100">{title}</h2>
      <div className="text-sm text-zinc-300 space-y-3 leading-relaxed">{content}</div>
    </section>
  );
}

const sections: SectionData[] = [
  {
    id: "que-es", title: "¿Qué es CopyBot?", content: (
      <>
        <p><strong>CopyBot</strong> es un sistema de investigación de copy trading para Polymarket, operado por Hermes Agent.</p>
        <p>Su objetivo es descubrir si copiar a los mejores traders del leaderboard de Polymarket puede generar un edge consistente — <strong>sin arriesgar dinero real</strong>.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3">
            <p className="text-emerald-400 font-semibold text-sm">✅ Lo que hace</p>
            <ul className="text-xs space-y-1 mt-1 text-zinc-400">
              <li>• Escanea el leaderboard de Polymarket cada 2 horas</li>
              <li>• Analiza 500 wallets y las puntúa por ROI, consistencia y copiabilidad</li>
              <li>• Detecta nuevos trades de las wallets seguidas</li>
              <li>• Simula copias en papel con posiciones de $5–$20</li>
              <li>• Actualiza PnL cada hora</li>
              <li>• Aprende de los resultados y ajusta reglas automáticamente</li>
              <li>• Envía reportes diarios a Telegram</li>
            </ul>
          </div>
          <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3">
            <p className="text-red-400 font-semibold text-sm">❌ Lo que NO hace</p>
            <ul className="text-xs space-y-1 mt-1 text-zinc-400">
              <li>• No ejecuta trades reales</li>
              <li>• No almacena claves privadas</li>
              <li>• No firma transacciones</li>
              <li>• No gasta dinero real</li>
              <li>• No es asesoramiento financiero</li>
              <li>• No garantiza ganancias</li>
            </ul>
          </div>
        </div>
      </>
    ),
  },
  {
    id: "arquitectura", title: "🧱 Arquitectura del Sistema", content: (
      <>
        <p>El sistema tiene dos capas principales:</p>
        <div className="bg-zinc-800/50 rounded-lg p-4 font-mono text-xs space-y-1">
          <p className="text-emerald-400">┌─ Capa 1: Pipeline de Datos (cada 2h, cero tokens LLM) ─┐</p>
          <p className="text-zinc-500">│  Playwright → polymarket.com/leaderboard → 20 traders     │</p>
          <p className="text-zinc-500">│  Gamma API → 30 mercados live con precios                  │</p>
          <p className="text-zinc-500">│  CLOB API → order books con bids/asks/spreads              │</p>
          <p className="text-zinc-500">│  Scoring Engine → 500 wallets puntuadas                    │</p>
          <p className="text-zinc-500">│  Trade Scorer → señales paper_copy/watchlist/skip          │</p>
          <p className="text-zinc-500">│  Paper Engine → trades simulados $5-$20                    │</p>
          <p className="text-zinc-500">│  JSON → public/data/ → git push → Vercel deploy            │</p>
          <p className="text-emerald-400">└────────────────────────────────────────────────────────────┘</p>
          <p className="text-blue-400 mt-2">┌─ Capa 2: Dashboard Estático (Next.js + Vercel) ──────────┐</p>
          <p className="text-zinc-500">│  9 páginas 100% estáticas, sin backend, sin SQL           │</p>
          <p className="text-zinc-500">│  Lee JSON de public/data/, renderiza en cliente           │</p>
          <p className="text-zinc-500">│  Mobile-first con menú hamburguesa                        │</p>
          <p className="text-blue-400">└────────────────────────────────────────────────────────────┘</p>
        </div>
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-zinc-700 text-zinc-400"><th className="py-1.5 px-2 text-left">Fuente</th><th className="py-1.5 px-2 text-left">Método</th><th className="py-1.5 px-2 text-left">Datos</th></tr></thead>
            <tbody className="text-zinc-300">
              <tr className="border-b border-zinc-800/50"><td className="py-1.5 px-2">Leaderboard</td><td className="py-1.5 px-2">🕷️ Scraping con Playwright</td><td className="py-1.5 px-2">20 traders con PnL y volumen all-time</td></tr>
              <tr className="border-b border-zinc-800/50"><td className="py-1.5 px-2">Mercados</td><td className="py-1.5 px-2">✅ Gamma API pública</td><td className="py-1.5 px-2">Preguntas, categorías, volumen, precios</td></tr>
              <tr className="border-b border-zinc-800/50"><td className="py-1.5 px-2">Order Books</td><td className="py-1.5 px-2">✅ CLOB API pública</td><td className="py-1.5 px-2">Bids, asks, spreads, liquidez</td></tr>
              <tr><td className="py-1.5 px-2">Wallets adicionales</td><td className="py-1.5 px-2">🔄 Sintéticas</td><td className="py-1.5 px-2">Generadas desde actividad de mercado para completar 500</td></tr>
            </tbody>
          </table>
        </div>
      </>
    ),
  },
  {
    id: "scoring", title: "📊 Sistema de Scoring", content: (
      <>
        <p>Cada wallet recibe un puntaje basado en múltiples dimensiones:</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs mt-2">
            <thead><tr className="border-b border-zinc-700 text-zinc-400"><th className="py-1.5 px-2 text-left">Dimensión</th><th className="py-1.5 px-2 text-left">Peso</th><th className="py-1.5 px-2 text-left">Qué mide</th></tr></thead>
            <tbody className="text-zinc-300">
              <tr className="border-b border-zinc-800/50"><td className="py-1.5 px-2">ROI</td><td className="py-1.5 px-2 font-mono">25%</td><td className="py-1.5 px-2">Retorno sobre inversión en los últimos 30 días</td></tr>
              <tr className="border-b border-zinc-800/50"><td className="py-1.5 px-2">Consistencia</td><td className="py-1.5 px-2 font-mono">25%</td><td className="py-1.5 px-2">Win rate + cantidad de trades resueltos</td></tr>
              <tr className="border-b border-zinc-800/50"><td className="py-1.5 px-2">Copiabilidad</td><td className="py-1.5 px-2 font-mono">20%</td><td className="py-1.5 px-2">Volumen, liquidez, spreads ajustados</td></tr>
              <tr className="border-b border-zinc-800/50"><td className="py-1.5 px-2">Categoría</td><td className="py-1.5 px-2 font-mono">15%</td><td className="py-1.5 px-2">Fortaleza en categorías específicas</td></tr>
              <tr className="border-b border-zinc-800/50"><td className="py-1.5 px-2">Liquidez</td><td className="py-1.5 px-2 font-mono">10%</td><td className="py-1.5 px-2">Profundidad del order book</td></tr>
              <tr><td className="py-1.5 px-2">Entry Timing</td><td className="py-1.5 px-2 font-mono">5%</td><td className="py-1.5 px-2">Qué tan temprano entra en los mercados</td></tr>
            </tbody>
          </table>
        </div>

        <div className="mt-4">
          <p className="font-semibold text-yellow-400 text-sm">⚠️ Penalización One-Hit Wonder</p>
          <p className="text-xs text-zinc-400">Si una wallet tiene ROI alto pero pocos trades, recibe una penalización:</p>
          <ul className="text-xs text-zinc-400 space-y-0.5 mt-1">
            <li>• ROI &gt; 50% y &lt; 20 trades → penalización del 35%</li>
            <li>• ROI &gt; 40% y &lt; 30 trades → penalización del 20%</li>
            <li>• ROI &gt; 30% y win rate &lt; 45% → penalización del 15%</li>
          </ul>
        </div>

        <div className="mt-4">
          <p className="font-semibold text-sm">Clasificación final:</p>
          <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2 text-center">
              <p className="text-emerald-400 font-bold">🟢 Seguir</p>
              <p className="text-zinc-400">Score ≥ 70%</p>
            </div>
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2 text-center">
              <p className="text-yellow-400 font-bold">🟡 Observar</p>
              <p className="text-zinc-400">Score 40-69%</p>
            </div>
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2 text-center">
              <p className="text-red-400 font-bold">🔴 Ignorar</p>
              <p className="text-zinc-400">Score &lt; 40%</p>
            </div>
          </div>
        </div>
      </>
    ),
  },
  {
    id: "trade-scoring", title: "🎯 Scoring de Trades", content: (
      <>
        <p>Cada nuevo trade detectado de una wallet seguida se evalúa con 9 dimensiones:</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs mt-2">
            <thead><tr className="border-b border-zinc-700 text-zinc-400"><th className="py-1.5 px-2 text-left">Dimensión</th><th className="py-1.5 px-2 text-left">Peso</th><th className="py-1.5 px-2 text-left">Descripción</th></tr></thead>
            <tbody className="text-zinc-300">
              <tr className="border-b border-zinc-800/50"><td className="py-1.5 px-2">Wallet Quality</td><td className="py-1.5 px-2 font-mono">15%</td><td className="py-1.5 px-2">Score global de la wallet</td></tr>
              <tr className="border-b border-zinc-800/50"><td className="py-1.5 px-2">Entry Timing</td><td className="py-1.5 px-2 font-mono">15%</td><td className="py-1.5 px-2">Qué tan temprano entró la wallet</td></tr>
              <tr className="border-b border-zinc-800/50"><td className="py-1.5 px-2">Spread</td><td className="py-1.5 px-2 font-mono">15%</td><td className="py-1.5 px-2">Diferencia bid/ask del mercado</td></tr>
              <tr className="border-b border-zinc-800/50"><td className="py-1.5 px-2">ROI</td><td className="py-1.5 px-2 font-mono">10%</td><td className="py-1.5 px-2">ROI de la wallet</td></tr>
              <tr className="border-b border-zinc-800/50"><td className="py-1.5 px-2">Consistencia</td><td className="py-1.5 px-2 font-mono">10%</td><td className="py-1.5 px-2">Consistencia histórica</td></tr>
              <tr className="border-b border-zinc-800/50"><td className="py-1.5 px-2">Copiabilidad</td><td className="py-1.5 px-2 font-mono">10%</td><td className="py-1.5 px-2">Qué tan copiable es</td></tr>
              <tr className="border-b border-zinc-800/50"><td className="py-1.5 px-2">Categoría</td><td className="py-1.5 px-2 font-mono">10%</td><td className="py-1.5 px-2">Fortaleza en la categoría</td></tr>
              <tr className="border-b border-zinc-800/50"><td className="py-1.5 px-2">Liquidez</td><td className="py-1.5 px-2 font-mono">10%</td><td className="py-1.5 px-2">Liquidez del mercado</td></tr>
              <tr><td className="py-1.5 px-2">Tesis</td><td className="py-1.5 px-2 font-mono">5%</td><td className="py-1.5 px-2">Claridad de la tesis de inversión</td></tr>
            </tbody>
          </table>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-4 text-xs">
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2 text-center"><p className="text-emerald-400 font-bold">📋 Paper Copy</p><p className="text-zinc-400">Score ≥ 50%</p><p className="text-zinc-500 mt-1">Se simula una copia con posición de $5–$20</p></div>
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2 text-center"><p className="text-yellow-400 font-bold">👀 Watchlist</p><p className="text-zinc-400">Score 30-49%</p><p className="text-zinc-500 mt-1">Interesante pero no lo suficiente</p></div>
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2 text-center"><p className="text-red-400 font-bold">⏭️ Skip</p><p className="text-zinc-400">Score &lt; 30%</p><p className="text-zinc-500 mt-1">Muy tarde, ilíquido, o mal setup</p></div>
        </div>
      </>
    ),
  },
  {
    id: "paper-trading", title: "📝 Paper Trading", content: (
      <>
        <p>El paper trading simula operaciones reales sin usar fondos:</p>
        <ul className="space-y-2 text-sm">
          <li>• <strong>Capital inicial:</strong> $5,000 USD simulados</li>
          <li>• <strong>Tamaño de posición:</strong> Entre $5 y $20, proporcional al score</li>
          <li>• <strong>Actualización de PnL:</strong> Cada ejecución del pipeline (cada 2 horas)</li>
          <li>• <strong>Resolución:</strong> Cuando un mercado de Polymarket se resuelve, el paper trade se cierra con el resultado real</li>
        </ul>
        <div className="bg-zinc-800/50 rounded-lg p-3 mt-3 font-mono text-xs">
          <p className="text-zinc-500">// Ejemplo: paper copy de Theo4 en mercado "Will BTC hit $100K?"</p>
          <p className="text-emerald-400">PaperTrade {'{'}</p>
          <p className="text-zinc-400">  wallet: "Theo4",</p>
          <p className="text-zinc-400">  market: "Will BTC hit $100K by Dec 31?",</p>
          <p className="text-zinc-400">  outcome: "YES",</p>
          <p className="text-zinc-400">  entryPrice: 0.6520,</p>
          <p className="text-zinc-400">  currentPrice: 0.6740,</p>
          <p className="text-zinc-400">  positionSize: 15.20,        // $15.20 simulados</p>
          <p className="text-zinc-400">  unrealizedPnl: +0.33,        // ganancia no realizada</p>
          <p className="text-zinc-400">  status: "open"</p>
          <p className="text-emerald-400">{'}'}</p>
        </div>
      </>
    ),
  },
  {
    id: "self-improving", title: "🧠 Auto-Mejora de Reglas", content: (
      <>
        <p>El sistema ajusta sus propias reglas automáticamente basado en resultados reales de paper trading. <strong>No pide aprobación</strong> para cambiar reglas de paper trading — pero cada cambio queda registrado.</p>
        <div className="mt-3 space-y-2 text-sm">
          <p className="font-semibold">Ejemplos de cambios automáticos:</p>
          <ul className="space-y-2 text-xs">
            <li className="bg-zinc-800/50 rounded-lg p-3">
              <p className="text-yellow-400 font-semibold">📉 Bajar spread máximo</p>
              <p className="text-zinc-400">Si los trades copiados con spread alto pierden consistentemente, el sistema reduce el umbral máximo de spread permitido.</p>
              <p className="text-zinc-500 mt-1">Antes: max_spread = 0.08 → Después: max_spread = 0.05</p>
            </li>
            <li className="bg-zinc-800/50 rounded-lg p-3">
              <p className="text-yellow-400 font-semibold">📈 Subir liquidez mínima</p>
              <p className="text-zinc-400">Si los trades en mercados poco líquidos pierden, el mínimo de liquidez requerida sube automáticamente.</p>
              <p className="text-zinc-500 mt-1">Antes: min_liquidity = 300 → Después: min_liquidity = 500</p>
            </li>
            <li className="bg-zinc-800/50 rounded-lg p-3">
              <p className="text-yellow-400 font-semibold">⬇️ Degradar wallets</p>
              <p className="text-zinc-400">Si una wallet con alto score tiene mal paper performance, se degrada de "Seguir" a "Observar".</p>
            </li>
          </ul>
        </div>
        <p className="mt-3 text-sm"><strong>Cada cambio de regla</strong> se registra con: qué cambió, por qué, evidencia usada, valor anterior, valor nuevo, timestamp y nueva versión.</p>
      </>
    ),
  },
  {
    id: "benchmarks", title: "📏 Benchmarks y Comparaciones", content: (
      <>
        <p>El sistema compara 4 estrategias para medir si el filtro del bot agrega valor:</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs mt-2">
            <thead><tr className="border-b border-zinc-700 text-zinc-400"><th className="py-1.5 px-2 text-left">Estrategia</th><th className="py-1.5 px-2 text-left">Descripción</th></tr></thead>
            <tbody className="text-zinc-300">
              <tr className="border-b border-zinc-800/50"><td className="py-1.5 px-2">🤖 <strong>Bot-Filtered</strong></td><td className="py-1.5 px-2">Solo trades que pasan el scoring del bot (paper_copy)</td></tr>
              <tr className="border-b border-zinc-800/50"><td className="py-1.5 px-2">🐑 <strong>Blind Copy</strong></td><td className="py-1.5 px-2">Copiar ciegamente todo lo que hacen las wallets del leaderboard</td></tr>
              <tr className="border-b border-zinc-800/50"><td className="py-1.5 px-2">👀 <strong>Watchlist</strong></td><td className="py-1.5 px-2">Trades que quedaron en watchlist (interesantes pero no copiados)</td></tr>
              <tr><td className="py-1.5 px-2">⏭️ <strong>Skipped</strong></td><td className="py-1.5 px-2">Trades que el bot decidió saltar</td></tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm">Se trackean:</p>
        <ul className="text-xs text-zinc-400 space-y-0.5 mt-1">
          <li>• <strong>Missed Winners:</strong> Trades saltados que terminaron siendo ganadores</li>
          <li>• <strong>Avoided Losers:</strong> Trades saltados que terminaron siendo perdedores</li>
          <li>• <strong>Bad Copies:</strong> Trades copiados que perdieron</li>
          <li>• <strong>Good Skips:</strong> Trades correctamente saltados</li>
        </ul>
      </>
    ),
  },
  {
    id: "reportes", title: "📬 Reportes y Alertas", content: (
      <>
        <p>El sistema genera reportes automáticos que Hermes envía a Telegram:</p>
        <div className="space-y-2 mt-2">
          <div className="bg-zinc-800/50 rounded-lg p-3">
            <p className="text-blue-400 font-semibold text-sm">📋 Reporte Diario (cada 2 horas)</p>
            <ul className="text-xs text-zinc-400 space-y-0.5 mt-1">
              <li>• Paper PnL del día y total</li>
              <li>• Win rate y posiciones abiertas</li>
              <li>• Mejores y peores wallets</li>
              <li>• Cambios de reglas automáticos</li>
              <li>• Comparación bot-filtered vs blind copy</li>
            </ul>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-3">
            <p className="text-purple-400 font-semibold text-sm">⚠️ Alertas mínimas (solo eventos importantes)</p>
            <ul className="text-xs text-zinc-400 space-y-0.5 mt-1">
              <li>• Trade de muy alta confianza detectado</li>
              <li>• Cambio mayor de reglas</li>
              <li>• Wallet sube o baja de categoría significativamente</li>
              <li>• Advertencia de drawdown en el paper PnL</li>
            </ul>
          </div>
        </div>
      </>
    ),
  },
  {
    id: "comandos", title: "🔧 Comandos", content: (
      <>
        <div className="bg-zinc-800 rounded-lg p-4 font-mono text-xs space-y-2 overflow-x-auto">
          <p><span className="text-zinc-500"># Desarrollo local</span></p>
          <p><span className="text-emerald-400">npm run dev</span>              <span className="text-zinc-600">→ Dashboard en localhost:3000</span></p>
          <p><span className="text-emerald-400">npm run build</span>            <span className="text-zinc-600">→ Build de producción</span></p>
          <p className="mt-3"><span className="text-zinc-500"># Pipeline de datos</span></p>
          <p><span className="text-emerald-400">npm run scrape:leaderboard</span> <span className="text-zinc-600">→ Scraping del leaderboard</span></p>
          <p><span className="text-emerald-400">npm run compute</span>          <span className="text-zinc-600">→ Pipeline completo (sin deploy)</span></p>
          <p><span className="text-emerald-400">npm run compute:deploy</span>   <span className="text-zinc-600">→ Pipeline + git push + Vercel</span></p>
          <p><span className="text-emerald-400">npm run pipeline</span>         <span className="text-zinc-600">→ Scraper + compute + deploy</span></p>
          <p className="mt-3"><span className="text-zinc-500"># Tests</span></p>
          <p><span className="text-emerald-400">npm run test</span>             <span className="text-zinc-600">→ Tests de scoring y seguridad</span></p>
        </div>
        <p className="mt-3 text-sm">El cron de Hermes ejecuta <code className="text-emerald-400 bg-zinc-800 px-1 rounded">npm run pipeline</code> cada 2 horas con <strong>cero tokens LLM</strong> (modo no_agent).</p>
      </>
    ),
  },
  {
    id: "seguridad", title: "🔒 Modelo de Seguridad", content: (
      <>
        <p className="font-semibold">Principios de diseño:</p>
        <ul className="space-y-2 text-sm mt-2">
          <li className="flex items-start gap-2"><span className="text-emerald-400 font-bold shrink-0">1.</span> <span><strong>Paper-first:</strong> El sistema arranca en modo paper trading. La ejecución real requiere cambiar manualmente el código.</span></li>
          <li className="flex items-start gap-2"><span className="text-emerald-400 font-bold shrink-0">2.</span> <span><strong>Sin claves:</strong> El bot nunca solicita, almacena ni transmite claves privadas.</span></li>
          <li className="flex items-start gap-2"><span className="text-emerald-400 font-bold shrink-0">3.</span> <span><strong>Sin firmas:</strong> No hay lógica de firma de transacciones en el código.</span></li>
          <li className="flex items-start gap-2"><span className="text-emerald-400 font-bold shrink-0">4.</span> <span><strong>Read-only APIs:</strong> Solo se usan endpoints públicos de solo lectura (Gamma, CLOB).</span></li>
          <li className="flex items-start gap-2"><span className="text-emerald-400 font-bold shrink-0">5.</span> <span><strong>Dashboard estático:</strong> Sin backend, sin base de datos, sin API routes. Los datos son archivos JSON públicos.</span></li>
          <li className="flex items-start gap-2"><span className="text-emerald-400 font-bold shrink-0">6.</span> <span><strong>Transición manual:</strong> Para habilitar trading real, hay que: cambiar DEMO_MODE a false, configurar POLYMARKET_API_KEY, agregar lógica de firma.</span></li>
        </ul>
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mt-4">
          <p className="text-amber-400 font-semibold text-sm">⚠️ Riesgos del copy trading (incluso en papel)</p>
          <ul className="text-xs text-amber-400/80 space-y-0.5 mt-1">
            <li>• Las wallets del leaderboard pueden tener datos incompletos</li>
            <li>• El rendimiento pasado no garantiza resultados futuros</li>
            <li>• Los spreads en Polymarket pueden ser engañosos</li>
            <li>• Copiar tarde puede significar entrar en el peor momento</li>
            <li>• Una wallet puede ser buena en una categoría y mala en otras</li>
          </ul>
        </div>
      </>
    ),
  },
];
