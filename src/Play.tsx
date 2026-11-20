import { Entity, Flex, Line, Shape, Sprite, Text, Tooltip, useInput, useInputDevice, useMutable, useSound, useUpdate } from "@tsengine/runtime/jsx";

import { Backdrop } from "./Backdrop.tsx";
import { Letters, Panel } from "./Board.tsx";
import { Coach, Spotlight } from "./Coach.tsx";
import { EndBoard } from "./EndBoard.tsx";
import { FruitBall } from "./FruitBall.tsx";
import { FruitTip } from "./FruitTip.tsx";
import { Jar } from "./Jar.tsx";
import { dropRun, keepRun, useGame } from "./GameState.ts";
import { TapButton } from "./KeyHint.tsx";
import { atRest, crossed, LANDS, rolledIn, sweep, SWEEP_TIME, blastBits, blastFlash, blastJolt, cycleTitle, INTRO, jarDrop, kindAt, popIn, rollIn, rollStarted, grownOf, leaned, moment, shelfSlot, shelfX, placed, startingRun, poolRows } from "./layout.ts";
import { Pause } from "./Pause.tsx";
import { RentScore } from "./RentScore.tsx";
import { RuleText } from "./RuleText.tsx";
import { lessonAt, lessonDone, lessonNow, lessonShows, LESSONS } from "./rules/tutorial.ts";
import { learn } from "./settings.ts";
import { Shop } from "./Shop.tsx";
import { Terms } from "./Terms.tsx";
import { FRUITS } from "./rules/fruits.ts";
import { advance, newRun, BOOM_LIFE, bossNow, dramatic, lean, shownScore, preservable, JAR, rentFor, RENT, RIM, TURNS_PER_CYCLE, type FruitReport, type Run } from "./rules/jar.ts";
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
  POP_VOLUME,
  THUD_VOLUME,
  TOCK_VOLUME,
  TERM_W,
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
/** A blast's sparks, from the hottest to the last embers: Apollo's light, gold, orange and red. */
const SPARK = [LIGHT, GOLD, BAR_FILL, BAD];
/** The shelf above the jar: its plank's top, and how far apart the hand's fruit stand on it, left to right, a slot over each of the jar's lanes. */
const SHELF_Y = 48;
const SLOT = 48;
/** The boards either side of the jar: 192 wide, 12 from the screen's edges, each under its heading. */
const BOARD_W = 192;
const HUD_X = 12;
const BOARD_Y = 28;
/** The pool: each kind a 32-pixel icon and how many of it, three across; four across, closer, once there are more than four
 * rows of them, so all 17 kinds a pool can hold fit above the note. */
const POOL_ROOMY = { columns: 3, cell: 53 };
const POOL_TIGHT = { columns: 4, cell: 40 };
const POOL_ROW = 32;
/** The note of what just happened: a slate at the right, its foot this far above the foot of the screen (just above the counter). */
const NOTE_FOOT = 36;
/** The band behind the last turn's banner: the darkest Apollo colour, nearly solid. */
const SWEEP_BAND = "#090a14e6";
/** How loud a note of the tally is, of the sounds' volume. */
const SCORE_VOLUME = 0.7;
/** Seconds between the ticks of a fruit dragged along the shelf, at the least. */
const MOVE_QUIET = 0.12;
/** Where across the screen a newly dealt fruit starts its roll along the shelf: at the shelf's right end. */
const ROLL_FROM = 432;
/** Where the card of a fruit on the shelf stands: in the top left corner, over the rent board for as long as it is up, so it
 * never lies over the jar, which is what the player is deciding about. */
const TIP_X = 4;
const TIP_TOP = 4;
/** Slow motion: how fast the game runs in it, and how long it lasts after the Blast that set it off, in the game's slowed seconds. */
const SLOW_SPEED = 0.35;
const SLOW_TIME = 0.4;
/** Fast-forward: how fast the jar plays with the Speed setting on Fast, and while F is held. */
const FAST_SPEED = 2;
const HURRY_SPEED = 3;
/** The pick: three cards across the middle. */
const OFFER_W = 184;
const OFFER_H = 232;
const OFFER_GAP = 12;
const OFFER_LIFT = 8;

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
  const fast = useGame((g) => g.fast);
  // Whether the player is at a keyboard: the prompts name keys only then, and speak of tapping and dragging otherwise.
  const device = useInputDevice();
  const keys = device === "keyboard";
  const speed = useGame((g) => g.speed);
  const { pause, toTitle, setSpeed, start, toLesson } = useGame.actions();
  // The first game's tutorial: which lesson the player is at (rules/tutorial.ts).
  const tutorial = useGame((g) => g.tutorial);
  // The fruit report where they are after the engine moves them; the run reads the reports at its next step.
  // `slow` is the seconds of slow motion left, in the game's own (slowed) time.
  // A run read from the player's files goes on where it was kept; otherwise a new one.
  const savedRun = useGame((g) => g.savedRun);
  const s = useMutable({ run: startingRun(savedRun, seed), reports: [] as FruitReport[], slow: 0, point: -1, click: false, drop: false, whole: false, tip: false, away: false, poolAt: -1, intro: savedRun === null ? 0 : 99, roll: 99, dealt: "", last: 99, moveQuiet: 0, wasShown: false, lessonSeen: -1, lessonHand: "", lessonCursor: 0, lessonMessage: "", drag: false, dragMoved: false, dragX: 0 });
  const playLand = useSound("land.wav");
  const playMerge = useSound("merge.wav");
  const playBoom = useSound("boom.wav");
  const playPick = useSound("pick.wav");
  const playRent = useSound("rent.wav");
  const playLose = useSound("lose.wav");
  const playTick = useSound("tick.wav");
  const playLast = useSound("last.wav");
  // Things arriving: the boards and the shelf popping in as a run opens, the jar landing, and each fruit rolling to its place.
  const playPop0 = useSound("pop-0.wav");
  const playPop1 = useSound("pop-1.wav");
  const playPop2 = useSound("pop-2.wav");
  const playThud = useSound("thud.wav");
  const playTock = useSound("tock.wav");
  // The tally's notes, low to high: each score rings one step up from the last (tools/make-assets.py makes them).
  const playScore0 = useSound("score-0.wav");
  const playScore1 = useSound("score-1.wav");
  const playScore2 = useSound("score-2.wav");
  const playScore3 = useSound("score-3.wav");
  const playScore4 = useSound("score-4.wav");
  const playScore5 = useSound("score-5.wav");
  const playScore6 = useSound("score-6.wav");
  const playScore7 = useSound("score-7.wav");

  useInput((input) => {
    const over = s.run.phase === "over" || s.run.phase === "won";
    if (input.pressed("Escape")) {
      if (s.whole) s.whole = false;
      else if (over) toTitle();
      else pause();
    }
    // The run is over: Enter plays another, from a new seed.
    if (over && input.pressed("Enter")) {
      start();
      s.run = newRun(seed + 1);
      s.intro = 0;
    }
  });

  useUpdate((dt, input) => {
    const before = moment(s.run);
    const phase = s.run.phase;
    // While the whole pool is up, the run hears no keys: Enter, Space or D put the board away, and the jar plays on behind it.
    const looking = s.whole;
    if (looking && (input.pressed("Enter") || input.pressed("Space") || input.pressed("D"))) s.whole = false;
    else if (!looking && input.pressed("D")) s.whole = true;
    if (s.run.phase !== "order" || looking) s.drag = false;
    if (s.run.phase !== "order") s.tip = false;
    // The opening plays out, and each newly dealt hand rolls onto the shelf: the first once the jar has landed.
    if (s.intro < INTRO.end) {
      const before = s.intro;
      s.intro += dt;
      // The opening's sounds: a bloop as each board and the shelf arrive, a thud as the jar lands.
      if (crossed(before, s.intro, INTRO.left + INTRO.pop * 0.6)) playPop0(POP_VOLUME);
      if (crossed(before, s.intro, INTRO.right + INTRO.pop * 0.6)) playPop1(POP_VOLUME);
      if (crossed(before, s.intro, INTRO.shelf + INTRO.pop * 0.6)) playPop2(POP_VOLUME);
      if (crossed(before, s.intro, INTRO.jar + LANDS)) playThud(THUD_VOLUME);
    }
    const deal = `${s.run.cycle} ${s.run.turn}`;
    if (s.run.phase === "order" && deal !== s.dealt) {
      s.dealt = deal;
      s.roll = Math.min(0, s.intro - INTRO.hand);
      // The last turn of a cycle is announced: a banner crosses the screen as its hand comes up.
      if (s.run.turn >= TURNS_PER_CYCLE) {
        s.last = 0;
        playLast(0.8);
      }
    } else if (s.roll < 2) {
      // Each fruit of a new hand knocks softly as it rolls to its place on the shelf.
      const before = s.roll;
      s.roll += dt;
      if (s.run.phase === "order" && rolledIn(before, s.roll, s.run.hand.length)) playTock(TOCK_VOLUME);
    }
    if (s.last < SWEEP_TIME) s.last += dt;
    s.run = advance(
      s.run,
      dt,
      {
        up: !looking && input.pressed("ArrowUp"),
        down: !looking && input.pressed("ArrowDown"),
        left: !looking && input.pressed("ArrowLeft"),
        right: !looking && input.pressed("ArrowRight"),
        confirm: !looking && (input.pressed("Enter") || s.click),
        drop: !looking && (input.pressed("Space") || s.drop),
        point: looking ? -1 : s.point,
        away: !looking && s.away,
      },
      s.reports
    );
    s.reports = [];
    s.point = -1;
    s.click = false;
    s.drop = false;
    s.away = false;
    // The tutorial: a lesson comes up at its moment, and once it has, it is over when the player has done what it says or
    // the moment has passed.
    const lesson = lessonAt(tutorial);
    if (lesson !== null) {
      if (s.lessonSeen !== tutorial) {
        if (lessonShows(lesson, s.run)) {
          s.lessonSeen = tutorial;
          s.lessonHand = s.run.hand.join();
          s.lessonCursor = s.run.cursor;
          s.lessonMessage = s.run.message;
        }
      } else if (lessonDone(lesson, s.run, { looked: s.tip || s.run.cursor !== s.lessonCursor, moved: s.run.hand.join() !== s.lessonHand, acted: s.run.message !== s.lessonMessage })) toLesson(tutorial + 1);
    }
    // Through a moment once (a hand dropped, a pick made, the shop left), its keys are known: they are not shown again.
    if (moment(s.run) !== before) learn(before);
    // Each time the run comes to rest where the player acts, it is kept for "Continue"; once it is over there is nothing to keep.
    if (s.run.phase !== phase) {
      if (atRest(s.run)) keepRun(s.run);
      else if (s.run.phase === "over" || s.run.phase === "won") dropRun();
    }
    // A chain of Blasts, or a big one, plays in slow motion: long enough to see what it threw and what it set off.
    if (dramatic(s.run)) s.slow = SLOW_TIME;
    else if (s.slow > 0) s.slow -= dt;
    // Otherwise the jar's own business (dropping, settling, the tally) can be hurried: twice as fast with the Speed setting,
    // three times while F is held. What the player decides at (ordering, the pick, the shop) is never hurried.
    const busy = s.run.phase === "drop" || s.run.phase === "settle" || s.run.phase === "tally";
    const pace = s.slow > 0 ? SLOW_SPEED : !busy ? 1 : input.down("F") ? HURRY_SPEED : fast ? FAST_SPEED : 1;
    if (pace !== speed) setSpeed(pace);
    const heard = s.run.sounds;
    // Each at its own level; the engine scales them all by the player's sounds setting.
    if (heard.includes("land")) playLand(0.4);
    if (heard.includes("merge")) playMerge();
    if (heard.includes("boom")) playBoom();
    if (heard.includes("pick")) playPick();
    if (heard.includes("rent")) playRent();
    // A score of the tally: the next note up, and the top one again for any past the eighth.
    if (heard.includes("score")) {
      const note = Math.min(7, s.run.scoreNote - 1);
      if (note <= 0) playScore0(SCORE_VOLUME);
      else if (note === 1) playScore1(SCORE_VOLUME);
      else if (note === 2) playScore2(SCORE_VOLUME);
      else if (note === 3) playScore3(SCORE_VOLUME);
      else if (note === 4) playScore4(SCORE_VOLUME);
      else if (note === 5) playScore5(SCORE_VOLUME);
      else if (note === 6) playScore6(SCORE_VOLUME);
      else playScore7(SCORE_VOLUME);
    }
    if (heard.includes("lose")) playLose();
    // The shelf is quiet under a finger or the mouse: looking at a fruit or picking it up says nothing there (the fruit is in the
    // player's hand, which is feedback enough), and a fruit dragged past its neighbours ticks softly, and not in a rattle. At a
    // keyboard, and for a card chosen in the pick or the shop, the cursor still ticks.
    if (s.moveQuiet > 0) s.moveQuiet -= dt;
    if (heard.includes("tick") && (keys || phase !== "order")) playTick(0.5);
    if (heard.includes("move") && s.moveQuiet <= 0) {
      playTick(keys ? 0.5 : 0.3);
      s.moveQuiet = MOVE_QUIET;
    }
  });

  // The mouse: over a card (a pick's offer, or a place in the shop) the cursor goes to it, and a click is Enter on it.
  const point = (card: number) => {
    s.point = card;
  };
  const click = (card: number) => {
    s.point = card;
    s.click = true;
  };
  // A tap that landed on none of a pick's cards, or of the shop's: nothing is chosen any more (the boxes around the cards hear it).
  const away = () => {
    s.away = true;
  };
  // And one that landed off the shelf puts away the tooltip of the fruit that was tapped.
  const untip = () => {
    s.tip = false;
  };
  // Dragging a fruit along the shelf (the box over the shelf hears it). A press on a fruit picks it up; while the button or finger
  // stays down it goes where the pointer goes, the others making room; letting go puts it down. A press and release in one place
  // is a tap: nothing moves, and the fruit shows what it does until something else is tapped. The rules know none of this: they are told a place
  // and a confirm.
  const shelfAt = (x: number) => {
    const count = s.run.hand.length;
    return shelfSlot(x, (JAR.left + JAR.right) / 2 - (count * SLOT) / 2, SLOT, count);
  };
  const dragStart = (x: number) => {
    // A tap on the fruit that is already showing what it does puts that away again (see `dragEnd`).
    s.wasShown = s.tip && shelfAt(x) === s.run.cursor;
    s.point = shelfAt(x);
    s.click = true;
    s.tip = true;
    s.drag = !s.run.holding;
    s.dragMoved = false;
    s.dragX = x;
  };
  const dragMove = (x: number) => {
    if (!s.drag) return;
    s.dragX = x;
    const to = shelfAt(x);
    if (to === s.run.cursor) return;
    s.point = to;
    s.dragMoved = true;
  };
  const dragEnd = () => {
    // Let go: the fruit is put down where it is. One that was not moved was only tapped, and now shows what it does.
    if (s.drag) s.click = true;
    if (s.drag && !s.dragMoved && s.wasShown) s.tip = false;
    s.drag = false;
  };
  // The buttons on screen, for playing with no keyboard: what Space, Esc and (on the end board) Enter do.
  const tapDrop = () => {
    s.drop = true;
  };
  // What Enter does, with no place pointed at: the take-out dialog's button.
  const tapConfirm = () => {
    s.click = true;
  };
  const tapPause = () => {
    pause();
  };
  // The whole pool, on a board over everything: opened from the Pool board or with D, closed by any key or its button.
  const openPool = () => {
    s.whole = true;
    s.poolAt = -1;
  };
  // On the whole-pool board a tap on a kind shows all it does, beside the board; a tap anywhere else puts that away.
  const lookAt = (at: number) => {
    s.poolAt = at;
  };
  const lookAway = () => {
    s.poolAt = -1;
  };
  const closePool = () => {
    s.whole = false;
  };
  // The end board's button: on from a paid rent, or back to the title when the run is over.
  const tapEnd = () => {
    if (s.run.phase === "rent") s.click = true;
    else toTitle();
  };
  // The tutorial card's buttons: on from a lesson that only tells, or no more lessons at all.
  const lessonNext = () => {
    toLesson(tutorial + 1);
  };
  const lessonSkip = () => {
    toLesson(LESSONS.length);
  };
  const tapAgain = () => {
    start();
    s.run = newRun(seed + 1);
    s.intro = 0;
  };
  const tapTitle = () => {
    toTitle();
  };
  const report = (r: FruitReport) => {
    s.reports = [...s.reports, r];
  };
  const run = s.run;
  const rent = rentFor(run.cycle);
  const jarWidth = JAR.right - JAR.left;
  const jarMid = (JAR.left + JAR.right) / 2;
  // The score on screen runs behind the run's while the tally's popups are still to come, and catches up as each shows.
  const scored = shownScore(run);
  const popups = leaned(run.popups.filter((p) => p.delay <= 0), lean(run), JAR.right, JAR.floor);
  const links = run.links.filter((l) => l.delay <= 0);
  const paid = scored >= rent;
  const ordering = run.phase === "order";
  const picking = run.phase === "pick";
  /** Whether this moment's keys are shown: to a player at a keyboard, and only until they have been through it once. */
  const hints = keys && !learned.includes(moment(run));
  const boss = bossNow(run);
  const blind = boss === "blind";
  const preserving = run.phase === "preserve";
  const chosen = preserving ? preservable(run)[run.preserveCursor] : undefined;
  const keptFruit = preserving ? run.fruits.filter((f) => run.kept.includes(f.id)) : [];
  /** On the shelf: the hand while ordering, then what is left of it while dropping. */
  const shelf = ordering ? run.hand : run.queue;
  const shelfLeft = jarMid - (shelf.length * SLOT) / 2;
  /** A fruit is being dragged along the shelf: it is drawn under the pointer, not in its place. */
  const dragging = s.drag && ordering && run.holding;
  // Resolve has already counted the next turn; the pips wait for the tally to finish before showing it.
  const turn = Math.min(run.turn - (run.phase === "tally" && run.afterTally !== "rent" && run.afterTally !== "over" ? 1 : 0), TURNS_PER_CYCLE);
  // The board shows what is still to be dealt this shuffle: the hand is on the shelf, and the rest has been played.
  const pool = poolRows(run.draw);
  /** The whole pool by kind, for the board that shows all of it. */
  const whole = poolRows(run.pool);
  /** The kind chosen on the whole-pool board, if any. */
  const looked = kindAt(whole, s.poolAt);
  const grid = pool.length > 4 * POOL_ROOMY.columns ? POOL_TIGHT : POOL_ROOMY;
  const ended = run.phase === "rent" || run.phase === "over" || run.phase === "won";
  const finished = run.phase === "over" || run.phase === "won";
  /** The last turn's banner, while it crosses the screen. */
  const banner = sweep(s.last);
  /** How bright the jar is lit by a blast this instant. */
  const flash = blastFlash(run.effects);
  /** The tutorial's lesson, while it is its moment and nothing is over the play screen. */
  const coached = paused || s.whole || s.intro < INTRO.end ? null : lessonNow(tutorial, run);
  /** The slate that says what just happened shows when there is something to say and no lesson in its place. */
  const noted = coached === null && run.message !== "" && run.phase !== "shop";

  return (
    <Entity>
      <Backdrop />

      <Jar run={run} onReport={report} lift={(s.intro < INTRO.jar ? 400 : jarDrop(s.intro - INTRO.jar, 400)) + blastJolt(run.effects)} />
      {/* What is drawn on the jar turns with it, about its low corner, when it leans (the Tilted jar). */}
      <Entity x={JAR.right} y={JAR.floor} rotation={lean(run)}>
        <Entity x={-JAR.right} y={-JAR.floor}>
          {/* The Preserves Jar: an amber frame round each fruit kept, and an arrow over the one the cursor is on. */}
          {keptFruit.map((f) => (
            <Flex key={f.id} x={f.x - f.r - 4} y={f.y - f.r - 4} width={f.r * 2 + 8} height={f.r * 2 + 8} backgroundImage={SELECT} slice={CARD_SLICE} />
          ))}
          {/* Each fruit the Preserves Jar can keep can be clicked or tapped: it is kept, or let go. */}
          {preserving && (
            <>
              {placed(preservable(run)).map((slot) => (
                <Flex key={slot.card.id} x={slot.card.x - slot.card.r} y={slot.card.y - slot.card.r} width={slot.card.r * 2} height={slot.card.r * 2} focusable={false} onPointerEnter={() => point(slot.at)} onPress={() => click(slot.at)} />
              ))}
            </>
          )}
          {preserving && chosen !== undefined && <Sprite image="pointer.png" x={Math.round(chosen.x) - 9} y={Math.round(chosen.y - chosen.r) - 20} />}
          {/* A blast: the whole jar is lit for an instant, then its picture, a ring running out from it and sparks thrown every way. */}
          {flash > 0 && <Shape kind="rect" x={JAR.left} y={RIM - 24} width={JAR.right - JAR.left} height={JAR.floor - RIM + 24} color={LIGHT} opacity={0.45 * flash} />}
          {blastBits(run.effects, BOOM_LIFE).map((bit) => (
            <Shape key={bit.id} kind="rect" x={bit.x - bit.size / 2} y={bit.y - bit.size / 2} width={bit.size} height={bit.size} color={SPARK[bit.shade] ?? LIGHT} />
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
          {/* A line between two fruit while one does something to the other: a dark one under a coloured one, so it shows on any fruit. */}
          {links.map((l) => (
            <Entity key={l.id}>
              <Line x={l.x1} y={l.y1} x2={l.x2} y2={l.y2} width={6} color={INK} />
              <Line x={l.x1} y={l.y1} x2={l.x2} y2={l.y2} width={2} color={LINK[l.kind]} />
            </Entity>
          ))}
        </Entity>
      </Entity>
      {/* The points stay upright over a leaning jar. */}
      {popups.map((p) => (
        <Text key={p.id} x={p.x} y={p.y} align="center" font={DISPLAY} size={DISPLAY_SIZE} color={p.points < 0 ? BAD : GOLD} shadow={INK} shadowX={2} shadowY={2}>
          {p.text}
        </Text>
      ))}

      {/* The items owned stand on the counter, left of the jar. */}
      {run.items.map((item, i) => (
        <Sprite key={item} image={`item-${item}.png`} x={16 + i * 50} y={COUNTER_Y - 38} />
      ))}

      {/* The shelf: the hand, each fruit over the lane it drops down. The chosen fruit is framed in amber; a held one is lifted. In the Blind
          jar each is under a cloth. */}
      <Sprite image="shelf.png" x={jarMid - 104} y={SHELF_Y - 80 * (1 - popIn(s.intro, INTRO.shelf, INTRO.pop))} />
      {/* The box that hears the hand being dragged and tapped: over the fruit on the shelf, and under their tooltips' boxes. */}
      {ordering && !s.whole && <Flex x={shelfLeft} y={SHELF_Y - 44} width={shelf.length * SLOT} height={52} onDragStart={dragStart} onDrag={dragMove} onDragEnd={dragEnd} onPressOutside={untip} />}
      {placed(shelf).map((slot) => (
        <Entity key={`${slot.card}${slot.at}`} x={shelfX(slot.at, shelfLeft, SLOT, shelf.length, dragging && slot.at === run.cursor, s.dragX) + (ordering ? rollIn(s.roll, slot.at, ROLL_FROM - (shelfLeft + slot.at * SLOT + SLOT / 2)) : 0)} y={SHELF_Y - 18}>
          {ordering && !blind && slot.at === run.cursor && (keys || s.tip) && <Flex x={-20} y={run.holding ? -28 : -20} width={40} height={40} backgroundImage={SELECT} slice={CARD_SLICE} />}
          {!blind && (!ordering || rollStarted(s.roll, slot.at)) && <FruitBall kind={slot.card} x={0} y={ordering && run.holding && slot.at === run.cursor ? -8 : 0} turn={ordering ? rollIn(s.roll, slot.at, ROLL_FROM - (shelfLeft + slot.at * SLOT + SLOT / 2)) / 16 : 0} look="icon" />}
          {/* A fruit is dragged along the shelf (see the handlers above); a held one is drawn under the pointer. What a fruit does
              shows for the one that was tapped (or the cursor is on, at a keyboard), and for one the mouse is over: in the top
              left corner whichever fruit it is for, so it never lies over the jar. */}
          {!blind && (
            <Flex x={-20} y={-20} width={40} height={40}>
              <Tooltip show={!paused && !s.whole && ordering && slot.at === run.cursor && (keys || s.tip) ? true : undefined} anchor="top-left" to="top-left" offsetX={TIP_X + 20 - shelfX(slot.at, shelfLeft, SLOT, shelf.length, dragging && slot.at === run.cursor, s.dragX)} offsetY={TIP_TOP + 38 - SHELF_Y} background="#00000000" borderWidth={0} paddingX={0} paddingY={0}>
                <FruitTip kind={slot.card} grown={grownOf(run, slot.card)} />
              </Tooltip>
            </Flex>
          )}
          {blind && (!ordering || rollStarted(s.roll, slot.at)) && <Sprite image="covered.png" x={-16} y={-16} />}
        </Entity>
      ))}

      {/* While ordering, a tap or a click on the jar drops the hand into it. */}
      {ordering && <Flex x={JAR.left} y={RIM} width={jarWidth} height={JAR.floor - RIM} focusable={false} onPress={() => tapDrop()} />}
      {/* The Preserves Jar's way on, where the hand was: the shelf is empty then. */}
      {preserving && (
        <Flex left={0} right={0} top={6} direction="row" justifyContent="center">
          <TapButton label="Done" keyName={hints ? "Space" : ""} onPress={tapDrop} />
        </Flex>
      )}

      {/* Left: a column pinned to the screen's left edge. The rent board is as tall as what is on it: this cycle's score, big, and
          under it the rent it is counted against ("64 of 120 rent"); a bar of how much of the rent that is; the turn; and the
          coins. Nothing else is on this side: how to move a fruit and drop the hand is said on the fruit's card under the shelf. */}
      <Flex left={HUD_X - 240 * (1 - popIn(s.intro, INTRO.left, INTRO.pop))} top={BOARD_Y} width={BOARD_W} direction="column" alignItems="stretch" gap={12}>
        <Panel title={cycleTitle(run)}>
          <RentScore key={run.cycle} scored={scored} rent={rent} width={BOARD_W - 36} />
          <Flex direction="row" justifyContent="space-between" paddingTop={6}>
            <Text color={turn >= TURNS_PER_CYCLE && !paid ? BAD : INK_SOFT}>{turn >= TURNS_PER_CYCLE ? "Last turn" : "Turn"}</Text>
            <Text color={turn >= TURNS_PER_CYCLE && !paid ? BAD : INK_SOFT}>{turn >= TURNS_PER_CYCLE ? `${turn}/${TURNS_PER_CYCLE}` : `${turn} of ${TURNS_PER_CYCLE}`}</Text>
          </Flex>
          <Flex direction="row" alignItems="center" gap={6}>
            <Sprite image="coin.png" />
            <Text color={INK}>{`${run.coins} ${run.coins === 1 ? "coin" : "coins"}`}</Text>
          </Flex>
        </Panel>
      </Flex>

      {/* Right: pinned to the screen's right edge, what is left of the pool to deal this shuffle, by kind, and how many that is of
          the whole pool. The kinds wrap, three to a row, or four, closer, once there are more than twelve. */}
      <Flex right={HUD_X - 240 * (1 - popIn(s.intro, INTRO.right, INTRO.pop))} top={BOARD_Y} width={BOARD_W} direction="column" alignItems="stretch">
        <Panel title="Pool">
          <Flex direction="row" wrap rowGap={0} columnGap={0}>
            {pool.map((row) => (
              <Flex key={row.kind} width={grid.cell} height={POOL_ROW} direction="row" alignItems="center">
                <Flex width={32} height={32}>
                  <FruitBall kind={row.kind} x={16} y={16} look="icon" />
                  {/* The mouse over a kind in the Pool shows what it does, to the board's left. */}
                  <Tooltip anchor="top-right" to="top-left" offsetX={-12} offsetY={0} background="#00000000" borderWidth={0} paddingX={0} paddingY={0}>
                    <FruitTip kind={row.kind} grown={grownOf(run, row.kind)} />
                  </Tooltip>
                </Flex>
                <Text color={INK}>{`${row.count}`}</Text>
              </Flex>
            ))}
          </Flex>
          {/* The board shows what is still to be dealt; the whole pool, dealt or not, opens from here (or with D). Pause is
              beside it: the two buttons of the play screen that are always there. */}
          <Flex direction="row" justifyContent="space-between" paddingTop={4}>
            <TapButton label="See all" onPress={openPool} />
            {/* Esc for a finger. In words: two bars in this font read as a Roman numeral. */}
            <TapButton label="Pause" onPress={tapPause} />
          </Flex>
        </Panel>
      </Flex>

      {/* What the lesson is about, framed, and the rest of the screen dimmed: after both boards, so they dim too, and before the
          lesson's card, so it does not. */}
      {coached?.target === "shelf" && <Spotlight x={shelfLeft - 8} y={SHELF_Y - 46} width={shelf.length * SLOT + 16} height={56} />}
      {coached?.target === "jar" && <Spotlight x={JAR.left - 10} y={RIM - 28} width={JAR.right - JAR.left + 20} height={JAR.floor - RIM + 38} />}
      {coached?.target === "rent" && <Spotlight x={HUD_X - 6} y={BOARD_Y + 6} width={BOARD_W + 12} height={152} />}
      {coached?.target === "pool" && <Spotlight x={640 - HUD_X - BOARD_W - 6} y={BOARD_Y + 6} width={BOARD_W + 12} height={98} />}
      {/* The first game's tutorial takes the slate's place: one lesson at a time, about what is on screen now. */}
      {coached !== null && !picking && run.phase !== "shop" && (
        <Flex right={HUD_X} bottom={NOTE_FOOT}>
          <Coach lesson={coached} keys={keys} width={BOARD_W} onNext={lessonNext} onSkip={lessonSkip} />
        </Flex>
      )}
      {/* What just happened, on a slate pinned to the right edge, its foot just above the counter: as tall as its words. */}
      {noted && (
        <Flex right={HUD_X} bottom={NOTE_FOOT} width={BOARD_W} direction="column" alignItems="stretch">
          <Panel image={PLAQUE}>
            <Text width={BOARD_W - 32} maxWidth={BOARD_W - 32} color={LIGHT}>
              {run.message}
            </Text>
          </Panel>
        </Flex>
      )}

      {/* The pick: three cards in a row in the middle of a dimmed kitchen, under their heading. Each place is a little taller
          than its card, and the chosen card stands at the top of its place. */}
      {picking && (
        <Entity>
          <Shape kind="rect" x={0} y={0} width={640} height={360} color={SHADE} />
          <Flex left={0} right={0} top={12} bottom={0} direction="column" alignItems="center" gap={8}>
            <Flex direction="row" justifyContent="center" height={32}>
              <Letters text="Pick a fruit" seed={5} />
            </Flex>
            <Flex direction="row" gap={OFFER_GAP} onPressOutside={away}>
              {placed(run.offers).map((offer) => (
                <Flex key={offer.at} height={OFFER_H + OFFER_LIFT} direction="column" justifyContent={offer.at === run.offerCursor ? "start" : "end"}>
                  {/* What a card's keywords mean shows beside it while it is the chosen one, and only then. A tap or a click
                      chooses a card and a second takes it. The pointer coming over a card does not choose it: on a touchscreen
                      the pointer stays where the last tap was, which would choose a card before the player had. */}
                  <Flex width={OFFER_W} height={OFFER_H} direction="column" alignItems="center" paddingTop={18} gap={4} backgroundImage={cardFor(offer.at === run.offerCursor)} slice={CARD_SLICE} focusable={false} onPress={() => click(offer.at)}>
                    <Tooltip show={!paused && offer.at === run.offerCursor} anchor={offer.at < 2 ? "top-left" : "top-right"} to={offer.at < 2 ? "top-right" : "top-left"} offsetX={offer.at < 2 ? 4 : -4} offsetY={-44} background="#00000000" borderWidth={0} paddingX={0} paddingY={0}>
                      <Terms text={FRUITS[offer.card].text} />
                    </Tooltip>
                    <Flex width={64} height={64}>
                      <FruitBall kind={offer.card} x={32} y={32} look="big" />
                    </Flex>
                    <Text width={OFFER_W} maxWidth={OFFER_W} align="center" font={DISPLAY} size={DISPLAY_SIZE} color={INK}>
                      {FRUITS[offer.card].name}
                    </Text>
                    <RuleText x={0} y={0} width={OFFER_W - 24} text={FRUITS[offer.card].text} color={INK_SOFT} accent={KEYWORD} />
                  </Flex>
                </Flex>
              ))}
            </Flex>
          </Flex>
          {/* The first pick of the first game: the tutorial's lesson says it, along the foot of the screen. */}
          {coached !== null && (
            <Flex right={8} bottom={2}>
              <Coach wide lesson={coached} keys={keys} width={440} onNext={lessonNext} onSkip={lessonSkip} />
            </Flex>
          )}
          {/* The way out, always there, in the bottom left corner: a card's keywords open to its side, never over this. */}
          <Flex left={16} bottom={2} direction="row" alignItems="center" gap={20}>
            <TapButton label="Skip for 1 coin" keyName={hints ? "Space" : ""} onPress={tapDrop} />
          </Flex>
        </Entity>
      )}

      {/* The end of a cycle or of the run: a board in the middle of the screen, as tall as what it says. */}
      {ended && (
        <Entity>
          <Shape kind="rect" x={0} y={0} width={640} height={360} color={SHADE} />
          <Flex left={0} right={0} top={0} bottom={0} direction="column" alignItems="center" justifyContent="center">
            {finished && <EndBoard run={run} rent={rent} keys={keys} onAgain={tapAgain} onTitle={tapTitle} />}
            {!finished && (
            <Flex width={256} direction="column" alignItems="stretch">
              <Panel heading="Rent paid" gap={2}>
                <Text width={224} maxWidth={224} align="center" color={INK_SOFT}>
                  {`Scored ${run.cycleScore} of ${rent}`}
                </Text>
                <Flex direction="row" justifyContent="center">
                  <Text font={DISPLAY} size={DISPLAY_SIZE} color={INK}>{`Total ${run.total}`}</Text>
                </Flex>
                <Flex direction="row" justifyContent="center" paddingTop={6}>
                  <TapButton keyName={keys ? "Enter" : ""} label={run.cycle >= RENT.length ? "Go on" : "Shop"} onPress={tapEnd} />
                </Flex>
              </Panel>
            </Flex>
            )}
          </Flex>
        </Entity>
      )}
      {/* The whole pool: every kind in it and how many, dealt or not. */}
      {s.whole && (
        <Entity>
          <Shape kind="rect" x={0} y={0} width={640} height={360} color={SHADE} />
          {/* The board, and to its left what the tapped kind does, in full: its card and what each of its keywords means. A tooltip
              under the fruit would run off the foot of the screen. */}
          <Flex left={0} right={0} top={0} bottom={0} direction="row" alignItems="center" justifyContent="center" gap={8}>
            <Flex width={TERM_W} direction="column" alignItems="stretch">
              {looked !== null && <FruitTip kind={looked ?? "cherry"} grown={grownOf(run, looked ?? "cherry")} />}
            </Flex>
            <Flex width={Math.max(240, Math.min(whole.length, 6) * 56 + 32)} direction="column" alignItems="stretch">
              <Panel heading={`Your pool: ${run.pool.length} fruit`} gap={4}>
                <Flex direction="row" wrap justifyContent="center" rowGap={4} columnGap={0} onPressOutside={lookAway}>
                  {placed(whole).map((slot) => (
                    <Flex key={slot.card.kind} width={56} direction="column" alignItems="center" backgroundImage={s.poolAt === slot.at ? SELECT : undefined} slice={CARD_SLICE} focusable={false} onPress={() => lookAt(slot.at)}>
                      <Flex width={40} height={40}>
                        <FruitBall kind={slot.card.kind} x={20} y={20} look="icon" />
                      </Flex>
                      <Text color={INK}>{`${slot.card.count}`}</Text>
                    </Flex>
                  ))}
                </Flex>
                <Flex direction="row" justifyContent="center" paddingTop={4}>
                  <TapButton label="Close" onPress={closePool} />
                </Flex>
              </Panel>
            </Flex>
          </Flex>
        </Entity>
      )}
      {run.phase === "shop" && run.shop !== null && <Shop run={run} shop={run.shop} hints={hints} onPoint={point} onClick={click} onAway={away} onConfirm={tapConfirm} onSpace={tapDrop} />}
      {/* The first shop of the first game: the lesson lies along the foot of the screen, under the shop's actions, until the player does something there. */}
      {run.phase === "shop" && coached !== null && (
        <Flex left={0} right={0} bottom={0} direction="row" justifyContent="center">
          <Coach wide lesson={coached} keys={keys} width={620} onNext={lessonNext} onSkip={lessonSkip} />
        </Flex>
      )}
      {/* The last turn of a cycle: a dark band snaps open across the screen and "Last turn" shoots through it, with what is
          still owed. It is only drawn, so the hand can be ordered under it. */}
      {banner.shown && (
        <Entity>
          <Shape kind="rect" x={0} y={180 - 34 * banner.open} width={640} height={68 * banner.open} color={SWEEP_BAND} />
          <Shape kind="rect" x={0} y={180 - 34 * banner.open - 2} width={640} height={2} color={GOLD} />
          <Shape kind="rect" x={0} y={180 + 34 * banner.open} width={640} height={2} color={GOLD} />
          {/* Each line is centred across the screen and moved within its row: the words one way, what is owed the other. */}
          <Flex left={0} right={0} top={146} direction="row" justifyContent="center">
            <Flex x={banner.x}>
              <Text font={DISPLAY} size={DISPLAY_SIZE * 2} color={GOLD} shadow={INK} shadowX={4} shadowY={4}>
                Last turn
              </Text>
            </Flex>
          </Flex>
          <Flex left={0} right={0} top={194} direction="row" justifyContent="center">
            <Flex x={-banner.x}>
              <Text color={LIGHT}>{paid ? "The rent is made" : `${rent - scored} more to make the rent`}</Text>
            </Flex>
          </Flex>
        </Entity>
      )}
      {paused && <Pause />}
    </Entity>
  );
}
