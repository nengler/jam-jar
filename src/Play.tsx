import { Entity, Flex, Line, Shape, Sprite, Text, useInput, useMutable, useSound, useUpdate } from "@tsengine/runtime/jsx";

import { Backdrop } from "./Backdrop.tsx";
import { Board, Heading } from "./Board.tsx";
import { FruitBall } from "./FruitBall.tsx";
import { Jar } from "./Jar.tsx";
import { dropRun, keepRun, useGame } from "./GameState.ts";
import { KeyHint } from "./KeyHint.tsx";
import { atRest, chipColor, fruitGlossary, moment, startingRun, poolRows, scoringLabel } from "./layout.ts";
import { Pause } from "./Pause.tsx";
import { RuleText } from "./RuleText.tsx";
import { learn } from "./settings.ts";
import { Shop } from "./Shop.tsx";
import { FRUITS } from "./rules/fruits.ts";
import { advance, BOOM_LIFE, bossCycle, dramatic, shownScore, preservable, JAR, rentFor, RENT, TURNS_PER_CYCLE, type FruitReport, type Run } from "./rules/jar.ts";
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
  KEYWORD,
  KEYWORD_LIGHT,
  LIGHT,
  LINK,
  PLAQUE,
  SELECT,
  SHADE,
  WELL,
} from "./theme.ts";

/** The pixel explosion's frames (Kenney Explosion Pack), each centred on a 96-pixel square, drawn at 2x like all the art. */
const BOOM_FRAMES = 9;
const BOOM_SIZE = 96;
/** The shelf above the jar: its plank's top, and how far apart the hand's fruit stand on it, left to right in the order they drop. */
const SHELF_Y = 48;
const SLOT = 48;
/** The boards either side of the jar: 192 wide, 12 from the screen's edges, hung under their ribbons. */
const BOARD_W = 192;
const HUD_X = 12;
const POOL_X = 640 - 12 - BOARD_W;
const BOARD_Y = 28;
const HUD_H = 160;
/** The pool: each kind a 32-pixel icon and how many of it, three across; four across, closer, once there are more than four
 * rows of them, so all 17 kinds a pool can hold fit above the note. */
const POOL_ROOMY = { columns: 3, cell: 56 };
const POOL_TIGHT = { columns: 4, cell: 43 };
const POOL_ROW = 32;
/** The note of what just happened: a slate under the pool, its foot just above the counter. */
const NOTE_H = 72;
const NOTE_Y = 324 - NOTE_H;
/** Slow motion: how fast the game runs in it, and how long it lasts after the Blast that set it off, in the game's slowed seconds. */
const SLOW_SPEED = 0.35;
const SLOW_TIME = 0.4;
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
  const learned = useGame((g) => g.learned);
  const { pause, toTitle, setSpeed } = useGame.actions();
  // The fruit report where they are after the engine moves them; the run reads the reports at its next step.
  // `slow` is the seconds of slow motion left, in the game's own (slowed) time.
  // A run read from the player's files goes on where it was kept; otherwise a new one.
  const savedRun = useGame((g) => g.savedRun);
  const s = useMutable({ run: startingRun(savedRun, seed), reports: [] as FruitReport[], slow: 0 });
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
    const before = moment(s.run);
    const phase = s.run.phase;
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
    // Through a moment once (a hand dropped, a pick made, the shop left), its keys are known: they are not shown again.
    if (moment(s.run) !== before) learn(before);
    // Each time the run comes to rest where the player acts, it is kept for "Continue"; once it is over there is nothing to keep.
    if (s.run.phase !== phase) {
      if (atRest(s.run)) keepRun(s.run);
      else if (s.run.phase === "over" || s.run.phase === "won") dropRun();
    }
    // A chain of Blasts, or a big one, plays in slow motion: long enough to see what it threw and what it set off.
    if (dramatic(s.run)) {
      if (s.slow <= 0) setSpeed(SLOW_SPEED);
      s.slow = SLOW_TIME;
    } else if (s.slow > 0) {
      s.slow -= dt;
      if (s.slow <= 0) setSpeed(1);
    }
    const heard = s.run.sounds;
    // Each at its own level; the engine scales them all by the player's sounds setting.
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
  // The score on screen runs behind the run's while the tally's popups are still to come, and catches up as each shows.
  const scored = shownScore(run);
  const popups = run.popups.filter((p) => p.delay <= 0);
  const links = run.links.filter((l) => l.delay <= 0);
  const paid = scored >= rent;
  const filled = Math.max(0, Math.min(1, scored / rent));
  const ordering = run.phase === "order";
  const picking = run.phase === "pick";
  /** Whether this moment's keys are shown: only until the player has been through it once. */
  const hints = !learned.includes(moment(run));
  const boss = bossCycle(run.cycle);
  const preserving = run.phase === "preserve";
  const chosen = preserving ? preservable(run)[run.preserveCursor] : undefined;
  const keptFruit = preserving ? run.fruits.filter((f) => run.kept.includes(f.id)) : [];
  /** On the shelf: the hand while ordering, then what is left of it while dropping. */
  const shelf = ordering ? run.hand : run.queue;
  const shelfLeft = jarMid - (shelf.length * SLOT) / 2;
  // Resolve has already counted the next turn; the pips wait for the tally to finish before showing it.
  const turn = Math.min(run.turn - (run.phase === "tally" && run.afterTally === "pick" ? 1 : 0), TURNS_PER_CYCLE);
  const pool = poolRows(run.pool);
  const grid = pool.length > 4 * POOL_ROOMY.columns ? POOL_TIGHT : POOL_ROOMY;
  const poolH = 30 + Math.ceil(pool.length / grid.columns) * POOL_ROW + 30;
  const offerGlossary = fruitGlossary(picking ? run.offers[run.offerCursor] : null, 2);
  const offersLeft = 320 - (3 * OFFER_W + 2 * OFFER_GAP) / 2;
  const ended = run.phase === "rent" || run.phase === "over" || run.phase === "won";

  return (
    <Entity>
      <Backdrop />

      <Jar run={run} onReport={report} />
      {/* The Preserves Jar: an amber frame round each fruit kept, and an arrow over the one the cursor is on. */}
      {keptFruit.map((f) => (
        <Flex key={f.id} x={f.x - f.r - 4} y={f.y - f.r - 4} width={f.r * 2 + 8} height={f.r * 2 + 8} backgroundImage={SELECT} slice={CARD_SLICE} />
      ))}
      {preserving && chosen !== undefined && <Sprite image="pointer.png" x={Math.round(chosen.x) - 9} y={Math.round(chosen.y - chosen.r) - 20} />}
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
      {/* A line between two fruit while one does something to the other: a dark one under a coloured one, so it shows on any fruit. */}
      {links.map((l) => (
        <Entity key={l.id}>
          <Line x={l.x1} y={l.y1} x2={l.x2} y2={l.y2} width={6} color={INK} />
          <Line x={l.x1} y={l.y1} x2={l.x2} y2={l.y2} width={2} color={LINK[l.kind]} />
        </Entity>
      ))}
      {popups.map((p) => (
        <Text key={p.id} x={p.x} y={p.y} align="center" font={DISPLAY} size={DISPLAY_SIZE} color={p.points < 0 ? BAD : GOLD} shadow={INK} shadowX={2} shadowY={2}>
          {p.text}
        </Text>
      ))}

      {/* The items owned stand on the counter, left of the jar. */}
      {run.items.map((item, i) => (
        <Sprite key={item} image={`item-${item}.png`} x={16 + i * 50} y={COUNTER_Y - 38} />
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
      <Board x={HUD_X} y={BOARD_Y} width={BOARD_W} height={HUD_H} title={boss ? `Peg jar ${run.cycle} of ${RENT.length}` : `Cycle ${run.cycle} of ${RENT.length}`} />
      <Text x={HUD_X + 16} y={BOARD_Y + 22} color={INK_SOFT}>
        Score
      </Text>
      <Text x={HUD_X + BOARD_W - 16} y={BOARD_Y + 22} align="right" color={INK_SOFT}>{`Rent ${rent}`}</Text>
      <Text x={HUD_X + BOARD_W / 2} y={BOARD_Y + 34} font={DISPLAY} size={DISPLAY_SIZE * 2} align="center" color={paid ? GOOD : INK}>{`${scored}`}</Text>
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
      <Text x={HUD_X + BOARD_W - 16} y={BOARD_Y + 130} align="right" color={INK_SOFT}>{`Total ${run.total - (run.cycleScore - scored)}`}</Text>

      {/* Under it: the keys for this moment, the first time it comes up (the pause menu has them after that). */}
      <Flex x={HUD_X + 4} y={BOARD_Y + HUD_H + 12} direction="column" gap={4}>
        {ordering && hints && <KeyHint name="arrows" label={run.holding ? "Move it" : "Choose"} />}
        {ordering && hints && <KeyHint name="Enter" label={run.holding ? "Put down" : "Pick up"} />}
        {ordering && hints && <KeyHint name="Space" label="Drop" />}
        {preserving && hints && <KeyHint name="arrows" label="Choose" />}
        {preserving && hints && <KeyHint name="Enter" label="Keep" />}
        {preserving && hints && <KeyHint name="Space" label="Done" />}
        {!learned.includes("order") && <KeyHint name="Esc" label="Pause" />}
      </Flex>

      {/* Right: the pool by kind, how many of each, and how many are still to be dealt this shuffle. */}
      <Board x={POOL_X} y={BOARD_Y} width={BOARD_W} height={poolH} title="Pool" />
      {pool.map((row, i) => (
        <Entity key={row.kind} x={POOL_X + 10 + (i % grid.columns) * grid.cell} y={BOARD_Y + 24 + Math.floor(i / grid.columns) * POOL_ROW}>
          <FruitBall kind={row.kind} x={16} y={16} look="icon" />
          <Text x={33} y={8} color={INK}>{`${row.count}`}</Text>
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
                <Flex height={22} paddingX={8} paddingTop={4} background={chipColor(kind)} alignItems="center">
                  <Text color={LIGHT}>{scoringLabel(kind)}</Text>
                </Flex>
              </Flex>
              <RuleText x={12} y={146} width={OFFER_W - 24} text={FRUITS[kind].text} color={INK_SOFT} accent={KEYWORD} />
            </Entity>
          ))}
          {/* What the chosen card's keywords mean. */}
          {offerGlossary.map((line, i) => (
            <RuleText key={line} x={0} y={294 + i * 20} width={640} text={line} color={LIGHT} accent={KEYWORD_LIGHT} />
          ))}
          {hints && (
            <Flex y={334} width={640} direction="row" justifyContent="center" gap={20}>
              <KeyHint name="arrows" label="Choose" />
              <KeyHint name="Enter" label="Take" />
              <KeyHint name="Space" label="Skip for 1 coin" />
            </Flex>
          )}
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
      {run.phase === "shop" && run.shop !== null && <Shop run={run} shop={run.shop} hints={hints} />}
      {paused && <Pause />}
    </Entity>
  );
}
