import { Entity, Flex, Sprite, Text, useInput, useInputDevice, useMutable, useSound, useUpdate } from "@tsengine/runtime/jsx";

import { Backdrop } from "./Backdrop.tsx";
import { Panel } from "./Board.tsx";
import { Coach, Dim, Raise } from "./Coach.tsx";
import { CycleEnd } from "./CycleEnd.tsx";
import { Jar } from "./Jar.tsx";
import { JarMarks } from "./JarMarks.tsx";
import { dropRun, keepRun, useGame } from "./GameState.ts";
import { PauseButton } from "./KeyHint.tsx";
import { LastTurn } from "./LastTurn.tsx";
import { atRest, crossed, LANDS, rolledIn, SWEEP_TIME, blastJolt, INTRO, jarDrop, popIn, leaned, moment, shelfSlot, startingRun } from "./layout.ts";
import { Pause } from "./Pause.tsx";
import { PickBoard } from "./PickBoard.tsx";
import { BOARD_W, HUD_X, JAR_MID, SHELF_Y, shelfOf, SLOT } from "./places.ts";
import { PoolBasket, PoolBasketBack } from "./PoolBasket.tsx";
import { PoolBoard } from "./PoolBoard.tsx";
import { PreserveBoard } from "./PreserveBoard.tsx";
import { RentBoard } from "./RentBoard.tsx";
import { lessonAt, lessonDone, lessonNow, lessonShows, LESSONS } from "./rules/tutorial.ts";
import { Lit } from "./lit.ts";
import { learn } from "./settings.ts";
import { Shelf, ShelfTips } from "./Shelf.tsx";
import { Shop } from "./Shop.tsx";
import { advance, bossNow, newRun, dramatic, lean, shownScore, JAR, rentFor, RIM, TURNS_PER_CYCLE, type FruitReport } from "./rules/jar.ts";
import { BAD, COUNTER_Y, DISPLAY, DISPLAY_SIZE, GOLD, INK, LIGHT, PLAQUE, POP_VOLUME, THUD_VOLUME, TOCK_VOLUME } from "./theme.ts";

/** The pause button stands on the counter in the bottom right corner, its foot where the jar's is. */
const PAUSE_FOOT = 360 - COUNTER_Y;
/** The note of what just happened: a slate at the right, its foot this far above the foot of the screen (just above the pause button). */
const NOTE_FOOT = PAUSE_FOOT + 30 + 6;
/** How loud a note of the tally is, of the sounds' volume. */
const SCORE_VOLUME = 0.7;
/** Seconds between the ticks of a fruit dragged along the shelf, at the least. */
const MOVE_QUIET = 0.12;
/** Slow motion: how fast the game runs in it, and how long it lasts after the Blast that set it off, in the game's slowed seconds. */
const SLOW_SPEED = 0.35;
const SLOW_TIME = 0.4;
/** Fast-forward: how fast the jar plays with the Speed setting on Fast, and while F is held. */
const FAST_SPEED = 2;
const HURRY_SPEED = 3;

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
    // Escape pauses by pressing the pause button (its `pressKey`), so the button pushes in on screen; here it only closes the pool or ends the run.
    if (input.pressed("Escape")) {
      if (s.whole) s.whole = false;
      else if (over) toTitle();
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
        // A press on the shop's Buy button is off the shelf, but it must not put back the card it buys: it is the one confirm
        // with no place pointed at. (The pick's Take button stands among the cards, so it is not off them.)
        away: !looking && s.away && !(s.click && s.point < 0),
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

  // The mouse: over a place (a shop's action) the cursor goes to it, and a click is Enter on it. On a card (a pick's offer, a
  // place on the shop's shelf) a click only chooses it: the Take or Buy button, or Enter, takes it.
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
    const shelf = shelfOf(s.run);
    return shelfSlot(x, shelf.left, SLOT, shelf.spans);
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
  // What Enter does, with no place pointed at: the pick's Take button, the shop's Buy, and the take-out dialog's button.
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
  // The score on screen runs behind the run's while the tally's popups are still to come, and catches up as each shows.
  const scored = shownScore(run);
  const popups = leaned(run.popups.filter((p) => p.delay <= 0), lean(run), JAR.right, JAR.floor);
  const ordering = run.phase === "order";
  const picking = run.phase === "pick";
  /** Whether this moment's keys are shown: to a player at a keyboard, and only until they have been through it once. */
  const hints = keys && !learned.includes(moment(run));
  const preserving = run.phase === "preserve";
  const ended = run.phase === "rent" || run.phase === "over" || run.phase === "won";
  /** How far above their places the shelf, the basket and the boards still are, as a run opens. */
  const shelfDrop = 80 * (1 - popIn(s.intro, INTRO.shelf, INTRO.pop));
  /** The tutorial's lesson, while it is its moment and nothing is over the play screen. */
  const coached = paused || s.whole || s.intro < INTRO.end ? null : lessonNow(tutorial, run);
  /** The slate that says what just happened shows when there is something to say and no lesson in its place. */
  const noted = coached === null && run.message !== "" && run.phase !== "shop";
  /** What is picked out (Coach.tsx): what the lesson is about, or the jar while a Preserves Jar's fruit are chosen. */
  const lit = coached !== null ? coached.target : preserving ? "jar" : null;

  return (
    <Lit.Provider value={lit}>
    <Entity>
      <Backdrop />

      {/* The jar, what is drawn on it and its points: all raised together when it is picked out. */}
      <Raise id="jar">
      <Jar run={run} onReport={report} lift={(s.intro < INTRO.jar ? 400 : jarDrop(s.intro - INTRO.jar, 400)) + blastJolt(run.effects.filter((e) => e.kind === "boom"))} />
      <JarMarks run={run} onPoint={point} onChoose={click} />
      {/* The points stay upright over a leaning jar. */}
      {popups.map((p) => (
        <Text key={p.id} x={p.x} y={p.y} align="center" font={DISPLAY} size={p.big === true ? DISPLAY_SIZE * 2 : DISPLAY_SIZE} color={p.points < 0 ? BAD : GOLD} shadow={INK} shadowX={p.big === true ? 4 : 2} shadowY={p.big === true ? 4 : 2}>
          {p.text}
        </Text>
      ))}
      </Raise>

      {/* The items owned stand on the counter, left of the jar. */}
      {run.items.map((item, i) => (
        <Sprite key={item} image={`item-${item}.png`} x={16 + i * 50} y={COUNTER_Y - 38} />
      ))}

      {/* The shelf, the basket behind the fruit rolling out of it, the hand, the basket's front over them, and what the fruit do. */}
      <Raise id="shelf">
        <Sprite image="shelf.png" x={JAR_MID - 104} y={SHELF_Y - shelfDrop} />
      </Raise>
      <Raise id="pool">
        <PoolBasketBack drop={shelfDrop} />
      </Raise>
      <Raise id="shelf">
        <Shelf run={run} roll={s.roll} dragging={s.drag && ordering && run.holding} dragX={s.dragX} framed={keys || s.tip} listening={ordering && !s.whole} onDragStart={dragStart} onDrag={dragMove} onDragEnd={dragEnd} onPressOutside={untip} />
      </Raise>
      <Raise id="pool">
        <PoolBasket run={run} drop={shelfDrop} keys={keys} onOpen={openPool} />
      </Raise>
      {/* What a fruit does, for the one tapped or the mouse is over; not under the Blind jar's cloth. */}
      {bossNow(run) !== "blind" && (
        <Raise id="shelf">
          <ShelfTips run={run} shown={!paused && !s.whole && ordering && (keys || s.tip)} coached={coached !== null} />
        </Raise>
      )}

      {/* While ordering, a tap or a click on the jar drops the hand into it. */}
      {ordering && <Flex x={JAR.left} y={RIM} width={JAR.right - JAR.left} height={JAR.floor - RIM} focusable={false} onPress={() => tapDrop()} />}

      {/* Left: the rent board. (The coins are beside the pool's basket, at the shelf's end.) Nothing else is on this side: how to
          move a fruit and drop the hand is said on the fruit's card under the shelf. */}
      <Raise id="rent">
        <RentBoard run={run} scored={scored} left={HUD_X - 240 * (1 - popIn(s.intro, INTRO.left, INTRO.pop))} />
      </Raise>

      {/* While something is picked out (`lit`), the rest of the screen is dimmed: what is raised stands above the dark, and what
          comes after this (the lesson's card, the Preserves Jar's board, the pause button) stays lit too. */}
      <Dim />
      {/* The first game's tutorial takes the slate's place: one lesson at a time, about what is on screen now. */}
      {coached !== null && !picking && run.phase !== "shop" && (
        <Flex right={HUD_X} bottom={NOTE_FOOT}>
          <Coach lesson={coached} keys={keys} width={BOARD_W} onNext={lessonNext} onSkip={lessonSkip} />
        </Flex>
      )}
      {preserving && <PreserveBoard run={run} bottom={NOTE_FOOT} onDone={tapDrop} />}
      {/* What just happened, on a slate pinned to the right edge, its foot just above the counter: as tall as its words. */}
      {noted && !preserving && (
        <Flex right={HUD_X} bottom={NOTE_FOOT} width={BOARD_W} direction="column" alignItems="stretch">
          <Panel image={PLAQUE}>
            <Text width={BOARD_W - 32} maxWidth={BOARD_W - 32} color={LIGHT}>
              {run.message}
            </Text>
          </Panel>
        </Flex>
      )}

      {/* Pause (Esc, for a finger): on the counter in the bottom right corner, out of the way of the boards. */}
      <Flex right={HUD_X} bottom={PAUSE_FOOT - 240 * (1 - popIn(s.intro, INTRO.right, INTRO.pop))}>
        <PauseButton pressKey={s.whole || s.run.phase === "over" || s.run.phase === "won" ? undefined : "Escape"} onPress={tapPause} />
      </Flex>

      {picking && <PickBoard run={run} paused={paused} hints={hints} keys={keys} coached={coached} onChoose={click} onAway={away} onTake={tapConfirm} onSkip={tapDrop} onLessonNext={lessonNext} onLessonSkip={lessonSkip} />}
      {ended && <CycleEnd run={run} keys={keys} onGoOn={tapEnd} onAgain={tapAgain} onTitle={tapTitle} />}
      {run.phase === "shop" && run.shop !== null && <Shop run={run} shop={run.shop} onPoint={point} onClick={click} onAway={away} onConfirm={tapConfirm} onSpace={tapDrop} onPool={openPool} />}
      {/* After the shop, so the pool board opened from it (its basket, or D) is over it. */}
      {s.whole && <PoolBoard run={run} chosenAt={s.poolAt} onLook={lookAt} onLookAway={lookAway} onClose={closePool} />}
      {/* The first shop of the first game: the lesson lies along the foot of the screen, under the shop's actions, until the player does something there. */}
      {run.phase === "shop" && coached !== null && (
        <Flex left={0} right={0} bottom={0} direction="row" justifyContent="center">
          <Coach wide lesson={coached} keys={keys} width={620} onNext={lessonNext} onSkip={lessonSkip} />
        </Flex>
      )}
      <LastTurn since={s.last} owed={rentFor(run.cycle) - scored} />
      {paused && <Pause />}
    </Entity>
    </Lit.Provider>
  );
}
