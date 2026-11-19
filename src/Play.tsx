import { Collider, Entity, Flex, Line, Shape, Sprite, Text, useInput, useMutable, useSound, useUpdate } from "@tsengine/runtime/jsx";

import { Fruit } from "./Fruit.tsx";
import { FruitBall } from "./FruitBall.tsx";
import { useGame } from "./GameState.ts";
import { Pause } from "./Pause.tsx";
import { FRUITS } from "./rules/fruits.ts";
import { advance, BOOM_LIFE, chosenRow, JAR, newRun, offerText, rentFor, RENT, RIM, TURNS_PER_CYCLE, type FruitReport, type Run } from "./rules/jar.ts";
import {
  BAD,
  CARD_SLICE,
  cardFor,
  GOLD,
  GOOD,
  INK,
  INK_SOFT,
  LIGHT,
  PANEL,
  PANEL_SLICE,
  RIM_LINE,
  SHADE,
} from "./theme.ts";

/** The pixel explosion's frames (Kenney Explosion Pack), each centred on a 96-pixel square, drawn at 2x like all the art. */
const BOOM_FRAMES = 9;
const BOOM_SIZE = 96;
/** The jar's glass reaches this far outside its walls. */
const GLASS = 8;

/**
 * Layout, on an 8-pixel grid: a banner across the top, the hand (or the pick) on the left, the jar in the middle, the rent on
 * the right. Panels are 200 wide with 16 pixels of padding; rows are 40 high, 8 apart.
 */
const SIDE_W = 200;
const LEFT_X = 8;
const RIGHT_X = 432;
const TOP = 56;
const PANEL_H = 296;
const PAD = 16;
const ROW_H = 40;
const ROW_GAP = 8;

/**
 * A run. The rules live in rules/jar.ts; each step this hands them the time, the keys and the fruit's reports, and keeps the run
 * they return. Everything here is drawing.
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
  const glassTop = RIM - 40;
  const filled = Math.max(0, Math.min(1, run.cycleScore / rent));
  const picking = run.phase === "pick";
  /** The fruit still to drop: the hand while ordering, then what is left of it while dropping. */
  const shown = run.phase === "order" ? run.hand : run.queue;
  const innerX = LEFT_X + PAD;
  const rowW = SIDE_W - PAD * 2;
  const statX = RIGHT_X + PAD;

  return (
    <Entity>
      <Sprite image="background.png" />

      {/* The banner: what the offer under the cursor does while picking; otherwise what just happened, or what to do. */}
      <Flex x={8} y={8} width={624} height={40} backgroundImage={PANEL} slice={PANEL_SLICE} />
      <Text x={320} y={20} align="center" color={INK}>
        {picking ? offerText(run) : run.message === "" ? "Watch them fall" : run.message}
      </Text>

      {/* The jar: Kenney's pixel glass, see-through, behind the fruit; the rim the fruit must stay under. */}
      <Entity opacity={0.6}>
        <Flex
          x={JAR.left - GLASS}
          y={glassTop - GLASS}
          width={jarWidth + GLASS * 2}
          height={JAR.floor - glassTop + GLASS * 2}
          backgroundImage="jar.png"
          slice={12}
        />
      </Entity>
      <Line x={JAR.left} y={RIM} x2={JAR.right} y2={RIM} width={2} color={RIM_LINE} />
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
        <Text key={p.id} x={p.x} y={p.y} align="center" color={GOLD} shadow={INK} shadowX={2} shadowY={2}>
          {p.text}
        </Text>
      ))}

      {/* Left: the hand to order, or the pick. */}
      <Flex x={LEFT_X} y={TOP} width={SIDE_W} height={PANEL_H} backgroundImage={PANEL} slice={PANEL_SLICE} />
      <Text x={innerX} y={TOP + PAD} color={INK}>
        {picking ? "Pick one" : "Hand"}
      </Text>
      {picking ? (
        <Entity>
          {run.offers.map((kind, i) => (
            <Entity key={`${kind}${i}`} x={innerX} y={TOP + 48 + i * (ROW_H + ROW_GAP)}>
              <Flex width={rowW} height={ROW_H} backgroundImage={cardFor(i === run.offerCursor)} slice={CARD_SLICE} />
              <FruitBall kind={kind} x={24} y={20} icon />
              <Text x={48} y={12} color={INK}>
                {FRUITS[kind].name}
              </Text>
            </Entity>
          ))}
        </Entity>
      ) : (
        <Entity>
          {shown.map((kind, i) => (
            <Entity key={`${kind}${i}`} x={innerX} y={TOP + 48 + i * (ROW_H + ROW_GAP)}>
              <Flex width={rowW} height={ROW_H} backgroundImage={cardFor(i === chosenRow(run))} slice={CARD_SLICE} />
              <FruitBall kind={kind} x={24} y={20} icon />
              <Text x={48} y={12} color={INK}>
                {FRUITS[kind].name}
              </Text>
              {run.holding && i === chosenRow(run) && (
                <Text x={rowW - 28} y={12} color={INK}>
                  ^v
                </Text>
              )}
            </Entity>
          ))}
        </Entity>
      )}
      {/* The keys for this moment, at the bottom of the left panel. */}
      <Text x={innerX} y={TOP + PANEL_H - 56} color={INK_SOFT}>
        {picking ? "Enter take" : run.phase === "order" ? (run.holding ? "Up/Down move" : "Enter move") : ""}
      </Text>
      <Text x={innerX} y={TOP + PANEL_H - 32} color={INK_SOFT}>
        {picking ? "Space skip" : run.phase === "order" ? (run.holding ? "Enter place" : "Space drop") : ""}
      </Text>

      {/* Right: the cycle, the rent and what you have. */}
      <Flex x={RIGHT_X} y={TOP} width={SIDE_W} height={PANEL_H} backgroundImage={PANEL} slice={PANEL_SLICE} />
      <Text x={statX} y={TOP + PAD} color={INK}>{`Cycle ${run.cycle}/${RENT.length}`}</Text>
      <Text x={statX} y={TOP + 40} color={INK_SOFT}>{`Turn ${Math.min(run.turn, TURNS_PER_CYCLE)}/${TURNS_PER_CYCLE}`}</Text>
      <Text x={statX} y={TOP + 80} color={INK}>
        Rent
      </Text>
      <Text x={statX} y={TOP + 104} color={run.cycleScore >= rent ? GOOD : INK_SOFT}>{`${run.cycleScore} / ${rent}`}</Text>
      <Flex x={statX} y={TOP + 128} width={rowW} height={24} backgroundImage="bar.png" slice={12} />
      {filled > 0 && (
        <Flex x={statX + 4} y={TOP + 130} width={Math.max(20, Math.round((rowW - 8) * filled))} height={20} backgroundImage="bar-fill.png" slice={8} />
      )}
      <Text x={statX} y={TOP + 176} color={INK}>
        Total
      </Text>
      <Text x={statX} y={TOP + 200} color={INK_SOFT}>{`${run.total}`}</Text>
      <Sprite image="coin.png" x={statX} y={TOP + 236} />
      <Text x={statX + 32} y={TOP + 240} color={INK}>{`${run.coins}`}</Text>

      {(run.phase === "rent" || run.phase === "over" || run.phase === "won") && (
        <Entity>
          <Shape kind="rect" x={0} y={0} width={640} height={360} color={SHADE} />
          <Flex x={176} y={120} width={288} height={120} backgroundImage={PANEL} slice={PANEL_SLICE} />
          <Text x={320} y={144} align="center" color={run.phase === "over" ? BAD : GOOD}>
            {run.phase === "rent" ? "Rent paid" : run.phase === "won" ? "You win" : "Run over"}
          </Text>
          <Text x={320} y={176} align="center" color={INK}>{`Total ${run.total}  Coins ${run.coins}`}</Text>
          <Text x={320} y={208} align="center" color={INK_SOFT}>
            {run.phase === "rent" ? "Enter: next cycle" : "Enter: title"}
          </Text>
        </Entity>
      )}
      {paused && <Pause />}
      <Text x={632} y={340} align="right" color={LIGHT}>
        Esc
      </Text>
    </Entity>
  );
}
