import { Collider, Entity, Flex, Shape, Sprite, Text, useInput, useMutable, useSound, useUpdate } from "@tsengine/runtime/jsx";

import { Backdrop } from "./Backdrop.tsx";
import { Board, Heading } from "./Board.tsx";
import { Fruit } from "./Fruit.tsx";
import { FruitBall } from "./FruitBall.tsx";
import { useGame } from "./GameState.ts";
import { KeyHint } from "./KeyHint.tsx";
import { offerText, poolRows } from "./layout.ts";
import { Pause } from "./Pause.tsx";
import { Shop } from "./Shop.tsx";
import { FRUITS } from "./rules/fruits.ts";
import { advance, BOOM_LIFE, JAR, newRun, rentFor, RENT, RIM, TURNS_PER_CYCLE, type FruitReport, type Run } from "./rules/jar.ts";
import {
  BAD,
  BAR_FILL,
  BODY_SIZE,
  cardFor,
  CARD_SLICE,
  COUNTER_Y,
  DISPLAY,
  DISPLAY_SIZE,
  GOLD,
  GOOD,
  INK,
  INK_SOFT,
  LIGHT,
  PLAQUE,
  SCORING,
  SELECT,
  SHADE,
  WELL,
} from "./theme.ts";

/** The pixel explosion's frames (Kenney Explosion Pack), each centred on a 96-pixel square, drawn at 2x like all the art. */
const BOOM_FRAMES = 9;
const BOOM_SIZE = 96;
/** The jar's pictures reach this far outside its walls and above its glass, which starts this far above the rim. */
const JAR_MARGIN = 12;
const JAR_NECK = 32;
/** The shelf above the jar: its plank's top, and how far apart the hand's fruit stand on it, left to right in the order they drop. */
const SHELF_Y = 48;
const SLOT = 48;
/** The boards either side of the jar: 192 wide, 12 from the screen's edges, hung under their ribbons. */
const BOARD_W = 192;
const HUD_X = 12;
const POOL_X = 640 - 12 - BOARD_W;
const BOARD_Y = 28;
const HUD_H = 160;
/** The pool: three kinds across, each a 32-pixel icon and how many of it. */
const POOL_COLUMNS = 3;
const POOL_CELL = 56;
const POOL_ROW = 32;
/** The note of what just happened: a slate under the pool, its foot just above the counter. */
const NOTE_H = 72;
const NOTE_Y = 324 - NOTE_H;
/** The pick: three cards across the middle. */
const OFFER_W = 184;
const OFFER_H = 232;
const OFFER_GAP = 12;

/**
 * A run. The rules live in rules/jar.ts; each step this hands them the time, the keys and the fruit's reports, and keeps the run
 * they return. Everything here is drawing: the jar on the counter with the hand on a shelf above it, the rent on a board to its
 * left with the keys under it, the pool on a board to its right with a note of what just happened, and the pick as three cards
 * over everything.
 */
export function Play() {
  const paused = useGame((g) => g.paused);
  const seed = useGame((g) => g.seed);
  const volume = useGame((g) => g.volume);
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
    // The volume setting, 0 to 10, scales every sound.
    const loud = volume / 10;
    if (heard.includes("land")) playLand(0.4 * loud);
    if (heard.includes("merge")) playMerge(loud);
    if (heard.includes("boom")) playBoom(loud);
    if (heard.includes("pick")) playPick(loud);
    if (heard.includes("rent")) playRent(loud);
    if (heard.includes("lose")) playLose(loud);
    if (heard.includes("tick")) playTick(0.6 * loud);
  });

  const report = (r: FruitReport) => {
    s.reports = [...s.reports, r];
  };
  const run = s.run;
  const rent = rentFor(run.cycle);
  const jarWidth = JAR.right - JAR.left;
  const jarMid = (JAR.left + JAR.right) / 2;
  const jarX = JAR.left - JAR_MARGIN;
  const jarY = RIM - JAR_NECK - JAR_MARGIN;
  const paid = run.cycleScore >= rent;
  const filled = Math.max(0, Math.min(1, run.cycleScore / rent));
  const ordering = run.phase === "order";
  const picking = run.phase === "pick";
  /** On the shelf: the hand while ordering, then what is left of it while dropping. */
  const shelf = ordering ? run.hand : run.queue;
  const shelfLeft = jarMid - (shelf.length * SLOT) / 2;
  const turn = Math.min(run.turn, TURNS_PER_CYCLE);
  const pool = poolRows(run.pool);
  const poolH = 30 + Math.ceil(pool.length / POOL_COLUMNS) * POOL_ROW + 30;
  const offersLeft = 320 - (3 * OFFER_W + 2 * OFFER_GAP) / 2;
  const ended = run.phase === "rent" || run.phase === "over" || run.phase === "won";

  return (
    <Entity>
      <Backdrop />

      {/* The jar: its back (the tinted inside and the glass walls) behind the fruit, its front (shine and fill line) over them. */}
      <Sprite image="jar-back.png" x={jarX} y={jarY} />
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
      <Sprite image="jar-front.png" x={jarX} y={jarY} />
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
        <Text key={p.id} x={p.x} y={p.y} align="center" font={DISPLAY} size={DISPLAY_SIZE} color={p.text.startsWith("-") ? BAD : GOLD} shadow={INK} shadowX={2} shadowY={2}>
          {p.text}
        </Text>
      ))}

      {/* The items owned stand on the counter, left of the jar. */}
      {run.items.map((item, i) => (
        <Sprite key={item} image={`item-${item}.png`} x={20 + i * 56} y={COUNTER_Y - 26} />
      ))}

      {/* The shelf: the hand, in the order it drops. The chosen fruit is framed in amber; a held one is lifted. */}
      <Sprite image="shelf.png" x={jarMid - 104} y={SHELF_Y} />
      {shelf.map((kind, i) => (
        <Entity key={`${kind}${i}`} x={shelfLeft + i * SLOT + SLOT / 2} y={SHELF_Y - 18}>
          {ordering && i === run.cursor && <Flex x={-20} y={run.holding ? -28 : -20} width={40} height={40} backgroundImage={SELECT} slice={CARD_SLICE} />}
          <FruitBall kind={kind} x={0} y={ordering && run.holding && i === run.cursor ? -8 : 0} look="icon" />
        </Entity>
      ))}

      {/* Left: the rent board. The score against the rent, the turn, and the coins. */}
      <Board x={HUD_X} y={BOARD_Y} width={BOARD_W} height={HUD_H} title={`Cycle ${run.cycle} of ${RENT.length}`} />
      <Text x={HUD_X + 16} y={BOARD_Y + 22} color={INK_SOFT}>
        Score
      </Text>
      <Text x={HUD_X + BOARD_W - 16} y={BOARD_Y + 22} align="right" color={INK_SOFT}>{`Rent ${rent}`}</Text>
      <Text x={HUD_X + BOARD_W / 2} y={BOARD_Y + 34} font={DISPLAY} size={DISPLAY_SIZE * 2} align="center" color={paid ? GOOD : INK}>{`${run.cycleScore}`}</Text>
      <Shape kind="rect" x={HUD_X + 16} y={BOARD_Y + 92} width={BOARD_W - 32} height={8} color={WELL} />
      {filled > 0 && <Shape kind="rect" x={HUD_X + 16} y={BOARD_Y + 92} width={Math.round(((BOARD_W - 32) * filled) / 2) * 2} height={8} color={paid ? GOOD : BAR_FILL} />}
      <Text x={HUD_X + 16} y={BOARD_Y + 106} color={INK_SOFT}>
        Turn
      </Text>
      {[1, 2, 3, 4, 5].map((t) => (
        <Shape key={t} kind="rect" x={HUD_X + BOARD_W - 16 - (TURNS_PER_CYCLE - t + 1) * 18 + 6} y={BOARD_Y + 112} width={12} height={12} color={t <= turn ? BAD : WELL} />
      ))}
      <Sprite image="coin.png" x={HUD_X + 14} y={BOARD_Y + 128} />
      <Text x={HUD_X + 46} y={BOARD_Y + 130} color={INK}>{`${run.coins}`}</Text>
      <Text x={HUD_X + BOARD_W - 16} y={BOARD_Y + 130} align="right" color={INK_SOFT}>{`Total ${run.total}`}</Text>

      {/* Under it: the keys for this moment. */}
      <Flex x={HUD_X + 4} y={BOARD_Y + HUD_H + 12} direction="column" gap={4}>
        {ordering && <KeyHint name="arrows" label={run.holding ? "Move it" : "Choose"} />}
        {ordering && <KeyHint name="Enter" label={run.holding ? "Put down" : "Pick up"} />}
        {ordering && <KeyHint name="Space" label="Drop" />}
        <KeyHint name="Esc" label="Pause" />
      </Flex>

      {/* Right: the pool by kind, how many of each, and how many are still to be dealt this shuffle. */}
      <Board x={POOL_X} y={BOARD_Y} width={BOARD_W} height={poolH} title="Pool" />
      {pool.map((row, i) => (
        <Entity key={row.kind} x={POOL_X + 12 + (i % POOL_COLUMNS) * POOL_CELL} y={BOARD_Y + 24 + Math.floor(i / POOL_COLUMNS) * POOL_ROW}>
          <FruitBall kind={row.kind} x={16} y={16} look="icon" />
          <Text x={36} y={8} color={INK}>{`${row.count}`}</Text>
        </Entity>
      ))}
      <Text x={POOL_X + BOARD_W / 2} y={BOARD_Y + poolH - 30} align="center" color={INK_SOFT}>{`${run.draw.length} of ${run.pool.length} left`}</Text>

      {/* Under it: what just happened, on a slate. */}
      {run.message !== "" && (
        <Entity>
          <Board x={POOL_X} y={NOTE_Y} width={BOARD_W} height={NOTE_H} image={PLAQUE} />
          <Text x={POOL_X + 12} y={NOTE_Y + 6} width={BOARD_W - 24} maxWidth={BOARD_W - 24} color={LIGHT}>
            {run.message}
          </Text>
        </Entity>
      )}

      {/* The pick: three cards over a dimmed kitchen. */}
      {picking && (
        <Entity>
          <Shape kind="rect" x={0} y={0} width={640} height={360} color={SHADE} />
          <Heading x={320} y={12} width={240} text="Pick a fruit" />
          {run.offers.map((kind, i) => (
            <Entity key={`${kind}${i}`} x={offersLeft + i * (OFFER_W + OFFER_GAP)} y={i === run.offerCursor ? 52 : 60}>
              <Flex width={OFFER_W} height={OFFER_H} backgroundImage={cardFor(i === run.offerCursor)} slice={CARD_SLICE} />
              <FruitBall kind={kind} x={OFFER_W / 2} y={50} look="big" />
              <Text x={OFFER_W / 2} y={84} align="center" font={DISPLAY} size={DISPLAY_SIZE} color={INK}>
                {FRUITS[kind].name}
              </Text>
              <Flex y={116} width={OFFER_W} justifyContent="center">
                <Flex height={22} paddingX={8} paddingTop={4} background={SCORING[FRUITS[kind].scoring].color} alignItems="center">
                  <Text color={LIGHT}>{SCORING[FRUITS[kind].scoring].name}</Text>
                </Flex>
              </Flex>
              <Text x={12} y={146} width={OFFER_W - 24} maxWidth={OFFER_W - 24} align="center" color={INK_SOFT}>
                {offerText(FRUITS[kind].text)}
              </Text>
            </Entity>
          ))}
          <Flex y={308} width={640} direction="row" justifyContent="center" gap={20}>
            <KeyHint name="arrows" label="Choose" />
            <KeyHint name="Enter" label="Take" />
            <KeyHint name="Space" label="Skip for 1 coin" />
          </Flex>
        </Entity>
      )}

      {ended && (
        <Entity>
          <Shape kind="rect" x={0} y={0} width={640} height={360} color={SHADE} />
          <Board x={192} y={124} width={256} height={124} title={run.phase === "rent" ? "Rent paid" : run.phase === "won" ? "The jar is yours" : "Evicted"} />
          <Text x={320} y={148} align="center" color={INK_SOFT}>
            {run.phase === "over" ? `Rent was ${rent}, you scored ${run.cycleScore}` : `Scored ${run.cycleScore} of ${rent}`}
          </Text>
          <Text x={320} y={166} font={DISPLAY} size={DISPLAY_SIZE} align="center" color={INK}>{`Total ${run.total}`}</Text>
          <Flex x={192} y={202} width={256} direction="row" justifyContent="center">
            <KeyHint name="Enter" label={run.phase === "rent" ? (run.cycle >= RENT.length ? "Go on" : "Shop") : "Title"} color={INK} />
          </Flex>
        </Entity>
      )}
      {run.phase === "shop" && run.shop !== null && <Shop run={run} shop={run.shop} />}
      {paused && <Pause />}
    </Entity>
  );
}
