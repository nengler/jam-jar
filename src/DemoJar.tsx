import { Entity, useMutable, useUpdate } from "@tsengine/runtime/jsx";

import { Jar } from "./Jar.tsx";
import { demoOver, demoStep } from "./rules/demo.ts";
import { newRun, type FruitReport, type Run } from "./rules/jar.ts";

/**
 * A jar filling up by itself, for the title: a run the rules play (rules/demo.ts), drawn `x` pixels to the right of where the
 * play screen's jar is. `lift` draws it that far above its place and `wait` holds the run that long, for the title's
 * entrance, when the jar falls in. It makes no sound, keeps nothing and scores for nobody.
 */
export function DemoJar({ x, lift = 0, wait = 0 }: { x: number; lift?: number; wait?: number }) {
  const s = useMutable({ run: newRun(20261119) as Run, reports: [] as FruitReport[], held: 0, time: 0 });
  useUpdate((dt) => {
    // Nothing drops until the jar has landed (`wait` seconds: the title's entrance).
    s.time += dt;
    if (s.time < wait) return;
    s.held = demoOver(s.run) ? s.held + dt : 0;
    s.run = demoStep(s.run, dt, s.reports, s.held);
    s.reports = [];
  });
  const report = (r: FruitReport) => {
    s.reports = [...s.reports, r];
  };
  return (
    <Entity x={x}>
      <Jar run={s.run} onReport={report} lift={lift} />
    </Entity>
  );
}
