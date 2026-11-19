import { Entity, Line, Shape, Text, useInput, useMutable, useUpdate } from "@tsengine/runtime/jsx";

import { FruitBall } from "./FruitBall.tsx";
import { useGame } from "./GameState.ts";
import { Pause } from "./Pause.tsx";
import { FRUITS } from "./rules/fruits.ts";
import { advance, JAR, newRun, rentFor, RENT, RIM, TURNS_PER_CYCLE, type Run } from "./rules/jar.ts";

const PANEL = "#1c2235";
const DIM = "#8f93b8";
const GOLD = "#ffd166";

/**
 * A run. The rules live in rules/jar.ts; each step this hands them the time and the keys and keeps the run they return. Everything
 * here is drawing: the jar and its fruit in the middle, the hand (or the pick) on the left, the rent and score on the right.
 */
export function Play() {
  const paused = useGame((g) => g.paused);
  const seed = useGame((g) => g.seed);
  const { pause, toTitle } = useGame.actions();
  const s = useMutable({ run: newRun(seed) as Run });

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
    });
  });

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
      {run.fruits.map((f) => (
        <FruitBall key={f.id} kind={f.kind} x={f.x} y={f.y} rotten={f.rotten} lit={f.lit && Math.floor(f.fuse * 20) % 2 === 0} />
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
      <Shape kind="rect" x={4} y={16} width={100} height={160} color={PANEL} />
      {run.phase === "pick" ? (
        <Entity>
          <Text x={8} y={20} color={GOLD}>
            PICK ONE
          </Text>
          {run.offers.map((kind, i) => (
            <Entity key={`${kind}${i}`} x={8} y={34 + i * 42}>
              {i === run.offerCursor && <Shape kind="rect" x={-2} y={-2} width={96} height={40} color="#2e3a5c" />}
              <FruitBall kind={kind} x={7} y={7} radius={6} />
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
                <Shape kind="rect" x={-2} y={-3} width={96} height={18} color={run.holding ? "#5c3a2e" : "#2e3a5c"} />
              )}
              <Text x={0} y={2} color={DIM}>
                {`${i + 1}`}
              </Text>
              <FruitBall kind={kind} x={16} y={6} radius={Math.min(7, FRUITS[kind].radius)} />
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
      <Shape kind="rect" x={216} y={16} width={100} height={160} color={PANEL} />
      <Text x={222} y={20} color={GOLD}>{`CYCLE ${run.cycle}/${RENT.length}`}</Text>
      <Text x={222} y={32} color="#f4ecd8">{`Turn ${Math.min(run.turn, TURNS_PER_CYCLE)}/${TURNS_PER_CYCLE}`}</Text>
      <Text x={222} y={50} color={DIM}>
        Rent due
      </Text>
      <Text x={222} y={60} color={run.cycleScore >= rent ? "#7bd88f" : "#f4ecd8"}>{`${run.cycleScore} / ${rent}`}</Text>
      <Shape kind="rect" x={222} y={72} width={88} height={4} color="#10131c" />
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
          <Shape kind="rect" x={60} y={70} width={200} height={44} color="#10131ce8" />
          <Text x={160} y={76} align="center" color={run.phase === "over" ? "#ff6b6b" : "#7bd88f"}>
            {run.phase === "rent" ? "RENT PAID" : run.phase === "won" ? "YOU WIN" : "RUN OVER"}
          </Text>
          <Text x={160} y={88} align="center" color="#f4ecd8">{`Total ${run.total}  Coins ${run.coins}`}</Text>
          <Text x={160} y={100} align="center" color={DIM}>
            {run.phase === "rent" ? "Enter: next cycle" : "Enter: back to title"}
          </Text>
        </Entity>
      )}
      {paused && <Pause />}
    </Entity>
  );
}
