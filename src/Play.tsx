import { Collider, Entity, Flex, Line, Shape, Sprite, Text, useInput, useMutable, useSound, useUpdate } from "@tsengine/runtime/jsx";

import { Backdrop } from "./Backdrop.tsx";
import { Fruit } from "./Fruit.tsx";
import { FruitBall } from "./FruitBall.tsx";
import { useGame } from "./GameState.ts";
import { HudBox } from "./HudBox.tsx";
import { poolLine } from "./layout.ts";
import { Pause } from "./Pause.tsx";
import { FRUITS } from "./rules/fruits.ts";
import { advance, BOOM_LIFE, chosenRow, JAR, newRun, rentFor, RENT, RIM, TURNS_PER_CYCLE, type FruitReport, type Run } from "./rules/jar.ts";
import {
  BAD,
  CARD,
  CARD_SLICE,
  cardFor,
  DARK,
  GOLD,
  GOOD,
  INK,
  INK_SOFT,
  LIGHT,
  LIGHT_SOFT,
  BAR_FILL,
  GOOD_BRIGHT,
  HUD_INSET,
  HUD_LABEL,
  PANEL,
  PANEL_SLICE,
  RIBBON,
  RIM_LINE,
  SHADE,
} from "./theme.ts";

/** The pixel explosion's frames (Kenney Explosion Pack), each centred on a 96-pixel square, drawn at 2x like all the art. */
const BOOM_FRAMES = 9;
const BOOM_SIZE = 96;
/** The jar's glass reaches this far outside its walls. */
const GLASS = 8;
/** The shelf above the jar: where the hand waits, left to right in the order it drops. */
const SHELF_Y = 44;
const SLOT = 48;
/** The HUD on the left and the pool on the right: blocks 184 wide, 16 from the edges. */
const HUD_W = 184;
const HUD_X = 16;
/** The pool: a column, centred in the space right of the jar, running from the top of the screen to the bottom. */
const POOL_W = 72;
const POOL_X = Math.round((416 + 640) / 2 - POOL_W / 2);
const POOL_TOP = 16;
const POOL_H = 312;
/** The pick: three cards across the middle. */
const OFFER_W = 168;
const OFFER_H = 232;
const OFFER_GAP = 16;

/**
 * A run. The rules live in rules/jar.ts; each step this hands them the time, the keys and the fruit's reports, and keeps the run
 * they return. Everything here is drawing: the jar in the middle with the hand on a shelf above it, the rent on the left, the
 * pool on the right, and the pick as three cards over everything.
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
  const jarMid = (JAR.left + JAR.right) / 2;
  const glassTop = RIM - 32;
  const filled = Math.max(0, Math.min(1, run.cycleScore / rent));
  const ordering = run.phase === "order";
  const picking = run.phase === "pick";
  /** On the shelf: the hand while ordering, then what is left of it while dropping. */
  const shelf = ordering ? run.hand : run.queue;
  const shelfLeft = jarMid - (shelf.length * SLOT) / 2;
  const turn = Math.min(run.turn, TURNS_PER_CYCLE);
  const offersLeft = 320 - (3 * OFFER_W + 2 * OFFER_GAP) / 2;

  return (
    <Entity>
      <Backdrop />

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
      {/* What just happened, floating in the top of the jar. */}
      <Text x={JAR.left + 8} y={glassTop + 4} width={jarWidth - 16} maxWidth={jarWidth - 16} lineGap={4} align="center" color={LIGHT} shadow={INK} shadowX={2} shadowY={2}>
        {run.message}
      </Text>

      {/* The shelf: the hand, in the order it drops. The chosen fruit sits on amber; a held one is lifted. */}
      <HudBox x={JAR.left - 24} y={SHELF_Y} width={jarWidth + 48} height={16} />
      {shelf.map((kind, i) => (
        <Entity key={`${kind}${i}`} x={shelfLeft + i * SLOT + SLOT / 2} y={SHELF_Y - 20}>
          {i === chosenRow(run) && <Flex x={-20} y={-20} width={40} height={40} backgroundImage={cardFor(true)} slice={CARD_SLICE} />}
          <FruitBall kind={kind} x={0} y={run.holding && i === chosenRow(run) ? -8 : 0} look="icon" />
        </Entity>
      ))}

      {/* Left: the HUD. Dark blocks, each a label and its value on an inset. */}
      <HudBox x={HUD_X} y={16} width={HUD_W} height={40} />
      <Text x={HUD_X + 12} y={28} color={HUD_LABEL}>
        Cycle
      </Text>
      <HudBox x={HUD_X + 96} y={22} width={HUD_W - 104} height={28} inset={HUD_INSET} />
      <Text x={HUD_X + HUD_W - 12} y={28} align="right" color={LIGHT}>{`${run.cycle}/${RENT.length}`}</Text>

      <HudBox x={HUD_X} y={64} width={HUD_W} height={120} />
      <Text x={HUD_X + 12} y={76} color={HUD_LABEL}>
        Score
      </Text>
      <HudBox x={HUD_X + 8} y={96} width={HUD_W - 16} height={44} inset={HUD_INSET} />
      <Text x={HUD_X + HUD_W / 2} y={102} size={32} align="center" color={run.cycleScore >= rent ? GOOD_BRIGHT : GOLD}>{`${run.cycleScore}`}</Text>
      <Text x={HUD_X + 12} y={152} color={HUD_LABEL}>
        Rent
      </Text>
      <Text x={HUD_X + HUD_W - 12} y={152} align="right" color={LIGHT}>{`${rent}`}</Text>
      <Shape kind="rect" x={HUD_X + 8} y={172} width={HUD_W - 16} height={4} color={HUD_INSET} />
      {filled > 0 && <Shape kind="rect" x={HUD_X + 8} y={172} width={Math.round((HUD_W - 16) * filled)} height={4} color={BAR_FILL} />}

      <HudBox x={HUD_X} y={192} width={HUD_W} height={40} />
      <Text x={HUD_X + 12} y={204} color={HUD_LABEL}>
        Turn
      </Text>
      {[1, 2, 3, 4, 5].map((t) => (
        <Shape key={t} kind="rect" x={HUD_X + 80 + (t - 1) * 18} y={206} width={12} height={12} color={t <= turn ? GOLD : HUD_INSET} />
      ))}

      <HudBox x={HUD_X} y={240} width={HUD_W} height={40} />
      <Sprite image="coin.png" x={HUD_X + 10} y={248} />
      <Text x={HUD_X + 44} y={252} color={GOLD}>{`${run.coins}`}</Text>
      <Text x={HUD_X + HUD_W - 12} y={252} align="right" color={HUD_LABEL}>{`total ${run.total}`}</Text>

      {/* Right: the pool, one vertical line grouped by kind (copies stacked, kinds apart); how many are still to deal. */}
      <HudBox x={POOL_X} y={POOL_TOP} width={POOL_W} height={POOL_H} />
      <Text x={POOL_X + POOL_W / 2} y={POOL_TOP + 12} align="center" color={HUD_LABEL}>
        Pool
      </Text>
      <Text x={POOL_X + POOL_W / 2} y={POOL_TOP + 32} align="center" color={LIGHT}>{`${run.draw.length}/${run.pool.length}`}</Text>
      {poolLine(run.pool, POOL_H - 96).map((p, i) => (
        <FruitBall key={`${p.kind}${i}`} kind={p.kind} x={POOL_X + POOL_W / 2} y={POOL_TOP + 76 + p.x} look="icon" />
      ))}

      {/* The keys for this moment. */}
      <Text x={320} y={336} align="center" color={LIGHT_SOFT}>
        {ordering ? (run.holding ? "Arrows move  Enter place" : "Enter move  Space drop") : ""}
      </Text>
      <Text x={624} y={336} align="right" color={LIGHT_SOFT}>
        Esc
      </Text>

      {/* The pick: three cards over a dimmed jar. */}
      {picking && (
        <Entity>
          <Shape kind="rect" x={0} y={0} width={640} height={360} color={SHADE} />
          <Flex x={200} y={20} width={240} height={32} backgroundImage={RIBBON} slice={16} />
          <Text x={320} y={28} align="center" color={LIGHT} shadow={INK} shadowX={2} shadowY={2}>
            Pick a fruit
          </Text>
          {run.offers.map((kind, i) => (
            <Entity key={`${kind}${i}`} x={offersLeft + i * (OFFER_W + OFFER_GAP)} y={i === run.offerCursor ? 64 : 72}>
              <Flex width={OFFER_W} height={OFFER_H} backgroundImage={cardFor(i === run.offerCursor)} slice={CARD_SLICE} />
              <FruitBall kind={kind} x={OFFER_W / 2} y={56} look="big" />
              <Text x={OFFER_W / 2} y={100} align="center" color={INK}>
                {FRUITS[kind].name}
              </Text>
              <Text x={12} y={128} width={OFFER_W - 24} maxWidth={OFFER_W - 24} align="center" lineGap={4} color={INK_SOFT}>
                {FRUITS[kind].text}
              </Text>
            </Entity>
          ))}
          <Text x={320} y={320} align="center" color={LIGHT}>
            Enter take   Space skip +1 coin
          </Text>
        </Entity>
      )}

      {(run.phase === "rent" || run.phase === "over" || run.phase === "won") && (
        <Entity>
          <Shape kind="rect" x={0} y={0} width={640} height={360} color={SHADE} />
          <Flex x={192} y={112} width={256} height={136} backgroundImage={PANEL} slice={PANEL_SLICE} />
          <Text x={320} y={132} size={32} align="center" color={run.phase === "over" ? BAD : GOOD}>
            {run.phase === "rent" ? "Paid" : run.phase === "won" ? "You win" : "Evicted"}
          </Text>
          <Text x={320} y={180} align="center" color={INK}>{`Total ${run.total}`}</Text>
          <Text x={320} y={212} align="center" color={INK_SOFT}>
            {run.phase === "rent" ? "Enter: next cycle" : "Enter: title"}
          </Text>
        </Entity>
      )}
      {paused && <Pause />}
    </Entity>
  );
}
