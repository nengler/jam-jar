import { Flex, Text, useTime } from "@tsengine/runtime/jsx";

import { Dialog } from "./Board.tsx";
import { FruitBall } from "./FruitBall.tsx";
import { TapButton } from "./KeyHint.tsx";
import { Bloops } from "./Sounds.tsx";
import { countUp, fruitResults, keywordResults } from "./layout.ts";
import type { FruitKind } from "./rules/fruits.ts";
import { RENT, type Run } from "./rules/jar.ts";
import { fruitImageSize, BAD, BAR_GOLD, BAR_WELL, DISPLAY, DISPLAY_SIZE, GOOD, INK, INK_SOFT, WELL } from "./theme.ts";

/**
 * The board's width; the total's place in the strip across its top; how tall the fruit get before they scroll (a run seldom ends
 * with more than two rows of them, across the whole board).
 */
const END_W = 616;
const TOTAL_W = 150;
const FRUIT_MAX_H = 188;
/** Seconds the total takes to count up; when the fruit come in, and how far apart. */
const COUNT_TIME = 0.9;
const FRUIT_AT = 0.5;
const FRUIT_GAP = 0.06;

/** One thing about the run, in the summary: what it is, and how much. */
function Stat({ label, value, color = INK }: { label: string; value: string; color?: string }) {
  return (
    <Flex direction="row" gap={6}>
      <Text color={INK_SOFT}>{label}</Text>
      <Text color={color}>{value}</Text>
    </Flex>
  );
}

/** A fruit's cell: the fruit at its own size, standing on its foot, what it scored, and a bar of that against the best. */
function FruitScore({ kind, points, best, shown }: { kind: FruitKind; points: number; best: number; shown: boolean }) {
  const size = fruitImageSize(kind);
  const width = Math.max(40, size) + 12;
  const bar = width - 12;
  const fill = points <= 0 || best <= 0 ? 0 : Math.max(2, Math.round((bar * points) / best / 2) * 2);
  return (
    <Flex width={width} direction="column" alignItems="center" gap={2} opacity={shown ? (points === 0 ? 0.5 : 1) : 0}>
      <Flex width={size} height={size}>
        <FruitBall kind={kind} x={size / 2} y={size / 2} />
      </Flex>
      <Text color={points < 0 ? BAD : points === 0 ? INK_SOFT : INK}>{`${points}`}</Text>
      <Flex width={bar} height={4} background={BAR_WELL}>
        {fill > 0 && <Flex left={0} top={0} bottom={0} width={fill} background={BAR_GOLD} />}
      </Flex>
    </Flex>
  );
}

/**
 * The end of a run, evicted or the jar won: what the run came to. Across the top the total counts up, big, beside how the run went
 * (the cycle it got to, its best turn, its pool, evicted how near the last rent was, and what scored that was no fruit's own:
 * Merge, Explode, a Spill). Under it every fruit in the pool, and any other that scored, with what it scored itself and a bar
 * against the best, best first; then the buttons, which are there from the start: the board is not to be waited for.
 */
export function EndBoard({ run, rent, keys, onAgain, onTitle }: { run: Run; rent: number; keys: boolean; onAgain: () => void; onTitle: () => void }) {
  const time = useTime();
  const won = run.phase === "won";
  // Best first, so the first is the best (0 when nothing scored).
  const fruit = fruitResults(run);
  const keywords = keywordResults(run);
  const best = fruit[0]?.points ?? 0;
  const near = Math.max(0, Math.min(1, rent === 0 ? 1 : run.cycleScore / rent));
  return (
    <Flex width={END_W} direction="column" alignItems="stretch">
      {/* A bloop for each of the first few fruit as they come in. */}
      <Bloops start={FRUIT_AT} gap={FRUIT_GAP * 2} count={Math.min(5, fruit.length)} />
      <Dialog title={won ? "The jar is yours" : "Evicted"} gap={4}>
        {/* The strip across the top: the total and how the run went. */}
        <Flex direction="row" alignItems="center" gap={14}>
          <Flex width={TOTAL_W} direction="column" alignItems="center">
            <Flex height={46} direction="row" alignItems="end">
              <Text font={DISPLAY} size={DISPLAY_SIZE * 2} color={won ? GOOD : INK}>{`${countUp(run.total, time, COUNT_TIME)}`}</Text>
            </Flex>
            <Text color={won ? GOOD : INK_SOFT}>{won ? "Every rent paid" : "points"}</Text>
          </Flex>
          <Flex width={2} height={64} background={WELL} />
          {/* How the run went, then what scored that was no fruit's own: as many lines as they take (three at most, as tall as the total). */}
          <Flex width="grow" direction="row" wrap rowGap={2} columnGap={18}>
            <Stat label="Cycle" value={`${run.cycle} of ${RENT.length}`} />
            <Stat label="Best turn" value={`${run.bestTurn}`} />
            <Stat label="Pool" value={`${run.pool.length} fruit`} />
            {!won && <Stat label="Last rent" value={`${run.cycleScore} of ${rent}`} color={BAD} />}
            {keywords.map((k) => (
              <Stat key={k.label} label={k.label} value={`${k.points}`} color={k.points < 0 ? BAD : INK} />
            ))}
          </Flex>
        </Flex>
        {/* Every fruit, best first, across the whole board. */}
        <Flex maxHeight={FRUIT_MAX_H} direction="row" wrap justifyContent="center" alignItems="end" rowGap={4} columnGap={0} overflow="scroll" scrollbarColor={INK_SOFT}>
          {fruit.map((f, i) => (
            <FruitScore key={f.kind} kind={f.kind} points={f.points} best={best} shown={time >= FRUIT_AT + i * FRUIT_GAP} />
          ))}
        </Flex>
        <Flex direction="row" justifyContent="center" gap={16}>
          <TapButton keyName={keys ? "Enter" : ""} label="Play again" onPress={onAgain} />
          <TapButton keyName={keys ? "Esc" : ""} label="Title" onPress={onTitle} />
        </Flex>
      </Dialog>
    </Flex>
  );
}
