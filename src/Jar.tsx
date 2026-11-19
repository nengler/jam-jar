import { Collider, Entity, Shape, Sprite } from "@tsengine/runtime/jsx";

import { Fruit } from "./Fruit.tsx";
import { Peg } from "./Peg.tsx";
import { JAR, PULSE, RIM, TILT_PULL, bossNow, lean, surface, type FruitReport, type Run } from "./rules/jar.ts";
import { JUICE } from "./theme.ts";

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
  const top = surface(run);
  const angle = lean(run);
  const pull = bossNow(run) === "tilt" ? TILT_PULL : 0;
  const liquid = run.lime && run.milk ? "both" : run.milk ? "milk" : "lime";
  return (
    <Entity>
      {/* The jar's pictures turn about its low corner when it leans (the Tilted jar). Its walls, floor and fruit do not: they
          are moved in the jar's own frame, where the walls stand straight, and each fruit is drawn where the lean puts it. */}
      <Entity x={JAR.right} y={JAR.floor} rotation={angle}>
        <Entity x={-JAR.right} y={-JAR.floor}>
          <Sprite image="jar-back.png" x={x} y={y} />
          {/* The liquid pooled at the bottom, behind the fruit, with a lighter line along its surface. */}
          {run.juice > 0 && <Shape kind="rect" x={JAR.left} y={top} width={width} height={run.juice} color={JUICE[liquid].body} />}
          {run.juice > 0 && <Shape kind="rect" x={JAR.left} y={top} width={width} height={2} color={JUICE[liquid].top} />}
        </Entity>
      </Entity>
      {/* The floor and two walls, tall enough that nothing pops over them. */}
      <Collider x={JAR.left - 8} y={JAR.floor} width={width + 16} height={16} solid />
      <Collider x={JAR.left - 16} y={0} width={16} height={JAR.floor + 16} solid />
      <Collider x={JAR.right} y={0} width={16} height={JAR.floor + 16} solid />
      {bossNow(run) === "peg" && <Peg />}
      {/* The Flip jar's lid: a plank across the rim that the pile falls to when its gravity turns over. */}
      {bossNow(run) === "flip" && <Collider x={JAR.left - 8} y={RIM - 16} width={width + 16} height={16} solid />}
      {bossNow(run) === "flip" && <Sprite image="shelf.png" x={(JAR.left + JAR.right) / 2 - 104} y={RIM - 12} />}
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
          frozen={f.frozen}
          surface={run.lime ? top : JAR.floor + 100}
          pull={pull}
          flipped={run.flipped}
          lean={angle}
          lit={f.lit && Math.floor(f.fuse * 20) % 2 === 0}
          glow={f.pulseDelay > 0 ? 0 : f.pulse / PULSE}
          kicks={f.kicks}
          kickX={f.kickX}
          kickY={f.kickY}
          onReport={onReport}
        />
      ))}
      <Entity x={JAR.right} y={JAR.floor} rotation={angle}>
        <Sprite image="jar-front.png" x={x - JAR.right} y={y - JAR.floor} />
      </Entity>
    </Entity>
  );
}
