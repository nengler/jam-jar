import { Collider, Entity, Sprite } from "@tsengine/runtime/jsx";

import { Fruit } from "./Fruit.tsx";
import { Peg } from "./Peg.tsx";
import { JAR, PULSE, RIM, bossCycle, type FruitReport, type Run } from "./rules/jar.ts";

/** The jar's pictures reach this far outside its walls and above its glass, which starts this far above the rim. */
const JAR_MARGIN = 12;
const JAR_NECK = 32;

interface JarProps {
  run: Run;
  /** What each fruit says of itself each step (where it is, how fast, what it touches), for the run's next step. */
  onReport: (report: FruitReport) => void;
}

/**
 * The jar and the fruit in it, where the rules say the jar is (`JAR`): its back (the tinted inside and the glass walls) behind
 * the fruit, its front (shine and fill line) over them, and the solid walls and floor the fruit's balls are stopped by. The
 * play screen draws a run in it, and the title a run that plays itself.
 */
export function Jar({ run, onReport }: JarProps) {
  const x = JAR.left - JAR_MARGIN;
  const y = RIM - JAR_NECK - JAR_MARGIN;
  const width = JAR.right - JAR.left;
  return (
    <Entity>
      <Sprite image="jar-back.png" x={x} y={y} />
      {/* The floor and two walls, tall enough that nothing pops over them. */}
      <Collider x={JAR.left - 8} y={JAR.floor} width={width + 16} height={16} solid />
      <Collider x={JAR.left - 16} y={0} width={16} height={JAR.floor + 16} solid />
      <Collider x={JAR.right} y={0} width={16} height={JAR.floor + 16} solid />
      {bossCycle(run.cycle) && <Peg />}
      {run.fruits.map((f) => (
        <Fruit
          key={f.id}
          id={f.id}
          kind={f.kind}
          x0={f.x0}
          y0={f.y0}
          rotten={f.rotten}
          honeyed={f.honeyed}
          pickled={f.pickled}
          lit={f.lit && Math.floor(f.fuse * 20) % 2 === 0}
          glow={f.pulseDelay > 0 ? 0 : f.pulse / PULSE}
          kicks={f.kicks}
          kickX={f.kickX}
          kickY={f.kickY}
          onReport={onReport}
        />
      ))}
      <Sprite image="jar-front.png" x={x} y={y} />
    </Entity>
  );
}
