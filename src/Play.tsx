import { Collider, Entity, Flex, Line, Shape, Text, useInput, useMutable, useSound, useUpdate } from "@tsengine/runtime/jsx";

import { Fruit } from "./Fruit.tsx";
import { FruitBall } from "./FruitBall.tsx";
import { useGame } from "./GameState.ts";
import { Pause } from "./Pause.tsx";
import { FRUITS } from "./rules/fruits.ts";
import { advance, JAR, newRun, rentFor, RENT, RIM, TURNS_PER_CYCLE, type FruitReport, type Run } from "./rules/jar.ts";

/** Kenney UI Pixel Pack frames, drawn as 9-slices (tools/make-assets.py). */
const WOOD = "panel-wood.png";
const CREAM = "panel-cream.png";
const SLICE = 6;
const DIM = "#e8d2a8";
const GOLD = "#ffd166";

/**
 * A run. The rules live in rules/jar.ts; each step this hands them the time and the keys and keeps the run they return. Everything
 * here is drawing: the jar and its fruit in the middle, the hand (or the pick) on the left, the rent and score on the right.
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
    s.run = advance(s.run, dt, {
      up: input.pressed("ArrowUp"),
      down: input.pressed("ArrowDown"),
      left: input.pressed("ArrowLeft"),
      right: input.pressed("ArrowRight"),
      confirm: input.pressed("Enter"),
      drop: input.pressed("Space"),
    }, s.reports);
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
  const jarHeight = JAR.floor - RIM + 10;

  return (
    <Entity>
      {/* The jar: glass, walls, floor and the rim line. */}
      <Shape kind="rect" x={JAR.left} y={RIM - 10} width={jarWidth} height={jarHeight} color="#1b2438" />
      <Shape kind="rect" x={JAR.left - 4} y={RIM - 12} width={4} height={jarHeight + 6} color="#6c7aa0" />
      <Shape kind="rect" x={JAR.right} y={RIM - 12} width={4} height={jarHeight + 6} color="#6c7aa0" />
      <Shape kind="rect" x={JAR.left - 4} y={JAR.floor} width={jarWidth + 8} height={4} color="#6c7aa0" />
      <Line x={JAR.left} y={RIM} x2={JAR.right} y2={RIM} color="#ff6b6b70" />
      {/* What the fruit's balls are stopped by: the floor and two walls, tall enough that nothing pops over them. */}
      <Collider x={JAR.left - 4} y={JAR.floor} width={jarWidth + 8} height={8} solid />
      <Collider x={JAR.left - 8} y={0} width={8} height={JAR.floor + 8} solid />
      <Collider x={JAR.right} y={0} width={8} height={JAR.floor + 8} solid />
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
      {run.popups.map((p) => (
        <Text key={p.id} x={p.x} y={p.y} align="center" color={p.color}>
          {p.text}
        </Text>
      ))}

      {/* The message line, over the jar. */}
      <Text x={160} y={4} align="center" color={GOLD}>
        {run.message}
      </Text>

      {/* Left: the hand to order, or the pick. */}
      <Flex x={4} y={16} width={100} height={160} backgroundImage={WOOD} slice={SLICE} />
      {run.phase === "pick" ? (
        <Entity>
          <Text x={8} y={20} color={GOLD}>
            PICK ONE
          </Text>
          {run.offers.map((kind, i) => (
            <Entity key={`${kind}${i}`} x={8} y={34 + i * 42}>
              {i === run.offerCursor && <Shape kind="rect" x={-2} y={-2} width={96} height={40} color="#00000040" />}
              <FruitBall kind={kind} x={7} y={7} icon />
              <Text x={18} y={3} color={i === run.offerCursor ? GOLD : "#f4ecd8"}>
                {FRUITS[kind].name}
              </Text>
              <Text x={0} y={16} maxWidth={92} color={DIM}>
                {FRUITS[kind].text}
              </Text>
            </Entity>
          ))}
          <Text x={8} y={162} color={DIM}>
            Enter take  Space skip
          </Text>
        </Entity>
      ) : (
        <Entity>
          <Text x={8} y={20} color={GOLD}>
            {run.phase === "order" ? "YOUR HAND" : "DROPPING"}
          </Text>
          <Text x={8} y={30} color={DIM}>
            first drops first
          </Text>
          {(run.phase === "order" ? run.hand : run.queue).map((kind, i) => (
            <Entity key={`${kind}${i}`} x={8} y={44 + i * 20}>
              {run.phase === "order" && i === run.cursor && (
                <Shape kind="rect" x={-2} y={-3} width={96} height={18} color={run.holding ? "#ffd16650" : "#00000040"} />
              )}
              <Text x={0} y={2} color={DIM}>
                {`${i + 1}`}
              </Text>
              <FruitBall kind={kind} x={16} y={6} icon />
              <Text x={28} y={2} color="#f4ecd8">
                {FRUITS[kind].name}
              </Text>
            </Entity>
          ))}
          {run.phase === "order" && (
            <Text x={8} y={130} maxWidth={92} color={DIM}>
              {run.holding ? "Up/Down move it\nEnter put down" : "Up/Down choose\nEnter pick up\nSpace drop"}
            </Text>
          )}
        </Entity>
      )}

      {/* Right: rent, score and the pool. */}
      <Flex x={216} y={16} width={100} height={160} backgroundImage={WOOD} slice={SLICE} />
      <Text x={222} y={20} color={GOLD}>{`CYCLE ${run.cycle}/${RENT.length}`}</Text>
      <Text x={222} y={32} color="#f4ecd8">{`Turn ${Math.min(run.turn, TURNS_PER_CYCLE)}/${TURNS_PER_CYCLE}`}</Text>
      <Text x={222} y={50} color={DIM}>
        Rent due
      </Text>
      <Text x={222} y={60} color={run.cycleScore >= rent ? "#7bd88f" : "#f4ecd8"}>{`${run.cycleScore} / ${rent}`}</Text>
      <Shape kind="rect" x={222} y={72} width={88} height={4} color="#3b2a1a" />
      <Shape kind="rect" x={222} y={72} width={Math.round(88 * Math.max(0, Math.min(1, run.cycleScore / rent)))} height={4} color="#7bd88f" />
      <Text x={222} y={86} color={DIM}>
        Total
      </Text>
      <Text x={222} y={96} color="#f4ecd8">{`${run.total}`}</Text>
      <Text x={222} y={112} color={DIM}>
        Coins
      </Text>
      <Text x={222} y={122} color={GOLD}>{`${run.coins}`}</Text>
      <Text x={222} y={140} color={DIM}>{`Pool ${run.pool.length}`}</Text>
      <Text x={222} y={150} color={DIM}>{`To deal ${run.draw.length}`}</Text>
      <Text x={222} y={162} color={DIM}>
        Esc pause
      </Text>

      {(run.phase === "rent" || run.phase === "over" || run.phase === "won") && (
        <Entity>
          <Flex x={60} y={66} width={200} height={52} backgroundImage={CREAM} slice={SLICE} />
          <Text x={160} y={74} align="center" color={run.phase === "over" ? "#b3261e" : "#2f7d3a"}>
            {run.phase === "rent" ? "RENT PAID" : run.phase === "won" ? "YOU WIN" : "RUN OVER"}
          </Text>
          <Text x={160} y={88} align="center" color="#3b2a1a">{`Total ${run.total}  Coins ${run.coins}`}</Text>
          <Text x={160} y={102} align="center" color="#7a5a3a">
            {run.phase === "rent" ? "Enter: next cycle" : "Enter: back to title"}
          </Text>
        </Entity>
      )}
      {paused && <Pause />}
    </Entity>
  );
}
