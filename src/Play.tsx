import { Collider, Entity, Flex, Line, Shape, Sprite, Text, useInput, useMutable, useSound, useUpdate } from "@tsengine/runtime/jsx";

import { Fruit } from "./Fruit.tsx";
import { FruitBall } from "./FruitBall.tsx";
import { useGame } from "./GameState.ts";
import { Pause } from "./Pause.tsx";
import { FRUITS } from "./rules/fruits.ts";
import { advance, BOOM_LIFE, chosenRow, JAR, newRun, rentFor, RENT, RIM, TURNS_PER_CYCLE, type FruitReport, type Run } from "./rules/jar.ts";
import { BAD, CARD_SLICE, cardFor, GOOD, INK, INK_SOFT, LIGHT, PANEL, PANEL_SLICE, SHADOW } from "./theme.ts";

/** The pixel explosion's frames (Kenney Explosion Pack), each centred on a 96-pixel square, drawn at 2x like all the art. */
const BOOM_FRAMES = 9;
const BOOM_SIZE = 96;
/** The jar's glass (Kenney UI Pixel Pack) reaches this far outside its walls. */
const GLASS = 8;

/**
 * A run. The rules live in rules/jar.ts; each step this hands them the time, the keys and the fruit's reports, and keeps the run
 * they return. Everything here is drawing: the hills, the glass jar and its fruit in the middle, the hand (or the pick) on the
 * left, the rent and score on the right, all on Kenney panels.
 */
export function Play() {
  const paused = useGame((g) => g.paused);
  const seed = useGame((g) => g.seed);
  const { pause, toTitle } = useGame.actions();
  // The fruit report where they are after the engine moves them; the run reads the reports at its next step.
  const s = useMutable({ run: newRun(seed) as Run, reports: [] as FruitReport[] });
  const playLand = useSound("land.wav");
  const playMerge = useSound("merge.wav");
  const playBoom = useSound("boom.wav");
  const playPick = useSound("pick.wav");
  const playRent = useSound("rent.wav");
  const playLose = useSound("lose.wav");
  const playTick = useSound("tick.wav");

  useInput((input) => {
    if (input.pressed("Escape")) pause();
    if ((s.run.phase === "over" || s.run.phase === "won") && input.pressed("Enter")) toTitle();
  });

  useUpdate((dt, input) => {
    s.run = advance(
      s.run,
      dt,
      {
        up: input.pressed("ArrowUp"),
        down: input.pressed("ArrowDown"),
        left: input.pressed("ArrowLeft"),
        right: input.pressed("ArrowRight"),
        confirm: input.pressed("Enter"),
        drop: input.pressed("Space"),
      },
      s.reports
    );
    s.reports = [];
    const heard = s.run.sounds;
    if (heard.includes("land")) playLand(0.4);
    if (heard.includes("merge")) playMerge();
    if (heard.includes("boom")) playBoom();
    if (heard.includes("pick")) playPick();
    if (heard.includes("rent")) playRent();
    if (heard.includes("lose")) playLose();
    if (heard.includes("tick")) playTick(0.6);
  });

  const report = (r: FruitReport) => {
    s.reports = [...s.reports, r];
  };
  const run = s.run;
  const rent = rentFor(run.cycle);
  const jarWidth = JAR.right - JAR.left;
  const glassTop = RIM - 44;
  const filled = Math.max(0, Math.min(1, run.cycleScore / rent));
  const ordering = run.phase === "order";
  /** The fruit still to drop: the hand while ordering, then what is left of it while dropping. */
  const shown = ordering ? run.hand : run.queue;

  return (
    <Entity>
      <Sprite image="background.png" />

      {/* The jar: Kenney's pixel glass panel, see-through, behind the fruit; the rim the fruit must stay under. */}
      <Entity opacity={0.55}>
        <Flex
          x={JAR.left - GLASS}
          y={glassTop - GLASS}
          width={jarWidth + GLASS * 2}
          height={JAR.floor - glassTop + GLASS * 2}
          backgroundImage="jar.png"
          slice={12}
        />
      </Entity>
      <Line x={JAR.left} y={RIM} x2={JAR.right} y2={RIM} width={2} color="#d6336c" />
      {/* What the fruit's balls are stopped by: the floor and two walls, tall enough that nothing pops over them. */}
      <Collider x={JAR.left - 8} y={JAR.floor} width={jarWidth + 16} height={16} solid />
      <Collider x={JAR.left - 16} y={0} width={16} height={JAR.floor + 16} solid />
      <Collider x={JAR.right} y={0} width={16} height={JAR.floor + 16} solid />
      {run.fruits.map((f) => (
        <Fruit
          key={f.id}
          id={f.id}
          kind={f.kind}
          x0={f.x0}
          y0={f.y0}
          rotten={f.rotten}
          lit={f.lit && Math.floor(f.fuse * 20) % 2 === 0}
          kicks={f.kicks}
          kickX={f.kickX}
          kickY={f.kickY}
          onReport={report}
        />
      ))}
      {/* Blasts go off: the Explosion Pack's pixel explosion. */}
      {run.effects.map((e) => (
        <Sprite
          key={e.id}
          image={`boom-${Math.min(BOOM_FRAMES - 1, Math.floor((e.age / BOOM_LIFE) * BOOM_FRAMES))}.png`}
          x={e.x}
          y={e.y}
          originX={BOOM_SIZE / 2}
          originY={BOOM_SIZE / 2}
          scaleX={2}
          scaleY={2}
        />
      ))}
      {run.popups.map((p) => (
        <Text key={p.id} x={p.x} y={p.y} align="center" color={p.color} shadow={INK} shadowX={2} shadowY={2}>
          {p.text}
        </Text>
      ))}

      {/* The message line, over the jar. */}
      <Text x={320} y={12} align="center" color={LIGHT} shadow={SHADOW} shadowX={2} shadowY={2}>
        {run.message}
      </Text>

      {/* Left: the hand to order, or the pick. */}
      <Flex x={12} y={40} width={196} height={308} backgroundImage={PANEL} slice={PANEL_SLICE} />
      {run.phase === "pick" ? (
        <Entity>
          <Text x={28} y={54} color={INK}>
            Pick one
          </Text>
          {run.offers.map((kind, i) => (
            <Entity key={`${kind}${i}`} x={22} y={78 + i * 80}>
              <Flex width={176} height={74} backgroundImage={cardFor(i === run.offerCursor)} slice={CARD_SLICE} />
              <FruitBall kind={kind} x={22} y={20} icon />
              <Text x={42} y={13} color={INK}>
                {FRUITS[kind].name}
              </Text>
              <Text x={10} y={38} maxWidth={160} size={8} lineGap={2} color={INK_SOFT}>
                {FRUITS[kind].text}
              </Text>
            </Entity>
          ))}
          <Text x={28} y={322} size={8} color={INK_SOFT}>
            Enter take   Space skip (+1 coin)
          </Text>
        </Entity>
      ) : (
        <Entity>
          <Text x={28} y={54} color={INK}>
            {run.phase === "order" ? "Your hand" : "Dropping"}
          </Text>
          <Text x={28} y={76} size={8} color={INK_SOFT}>
            The top fruit drops first
          </Text>
          {shown.map((kind, i) => (
            <Entity key={`${kind}${i}`} x={22} y={92 + i * 48}>
              <Flex
                width={176}
                height={42}
                backgroundImage={cardFor(i === chosenRow(run))}
                slice={CARD_SLICE}
              />
              <Text x={12} y={12} color={INK_SOFT}>
                {`${i + 1}`}
              </Text>
              <FruitBall kind={kind} x={46} y={19} icon />
              <Text x={66} y={12} color={INK}>
                {FRUITS[kind].name}
              </Text>
              {run.phase === "order" && run.holding && i === run.cursor && (
                <Text x={152} y={12} color={INK}>
                  ^v
                </Text>
              )}
            </Entity>
          ))}
          {run.phase === "order" && (
            <Text x={28} y={290} maxWidth={170} size={8} lineGap={4} color={INK_SOFT}>
              {run.holding ? "Up/Down move it\nEnter put it down" : "Up/Down choose\nEnter pick up to move\nSpace drop the hand"}
            </Text>
          )}
        </Entity>
      )}

      {/* Right: rent, score and the pool. */}
      <Flex x={432} y={40} width={196} height={308} backgroundImage={PANEL} slice={PANEL_SLICE} />
      <Text x={448} y={54} color={INK}>{`Cycle ${run.cycle} of ${RENT.length}`}</Text>
      <Text x={448} y={76} color={INK_SOFT}>{`Turn ${Math.min(run.turn, TURNS_PER_CYCLE)} of ${TURNS_PER_CYCLE}`}</Text>
      <Text x={448} y={110} color={INK_SOFT}>
        Rent due
      </Text>
      <Text x={448} y={130} color={run.cycleScore >= rent ? GOOD : INK}>{`${run.cycleScore} / ${rent}`}</Text>
      <Flex x={448} y={152} width={164} height={28} backgroundImage="bar.png" slice={12} />
      {filled > 0 && <Flex x={452} y={156} width={Math.max(20, Math.round(156 * filled))} height={20} backgroundImage="bar-fill.png" slice={8} />}
      <Text x={448} y={190} color={INK_SOFT}>
        Total
      </Text>
      <Text x={448} y={210} color={INK}>{`${run.total}`}</Text>
      <Sprite image="coin.png" x={446} y={236} />
      <Text x={478} y={240} color={INK}>{`${run.coins} coins`}</Text>
      <Text x={448} y={276} size={8} color={INK_SOFT}>{`Pool ${run.pool.length}   To deal ${run.draw.length}`}</Text>
      <Text x={448} y={322} size={8} color={INK_SOFT}>
        Esc pause
      </Text>

      {(run.phase === "rent" || run.phase === "over" || run.phase === "won") && (
        <Entity>
          <Shape kind="rect" x={0} y={0} width={640} height={360} color="#10131c70" />
          <Flex x={170} y={120} width={300} height={120} backgroundImage={PANEL} slice={PANEL_SLICE} />
          <Text x={320} y={140} size={32} align="center" color={run.phase === "over" ? BAD : GOOD}>
            {run.phase === "rent" ? "Rent paid" : run.phase === "won" ? "You win" : "Run over"}
          </Text>
          <Text x={320} y={182} align="center" color={INK}>{`Total ${run.total}   Coins ${run.coins}`}</Text>
          <Text x={320} y={210} size={8} align="center" color={INK_SOFT}>
            {run.phase === "rent" ? "Enter: next cycle" : "Enter: back to title"}
          </Text>
        </Entity>
      )}
      {paused && <Pause />}
    </Entity>
  );
}
