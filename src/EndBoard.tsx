import { Flex, Text, useTime } from "@tsengine/runtime/jsx";

import { Panel } from "./Board.tsx";
import { FruitBall } from "./FruitBall.tsx";
import { TapButton } from "./KeyHint.tsx";
import { Bloops } from "./Sounds.tsx";
import { countUp, earnerKind } from "./layout.ts";
import { RENT, topEarners, type Run } from "./rules/jar.ts";
import { BAR_GOLD, BAR_WELL, DISPLAY, DISPLAY_SIZE, GOOD, INK, INK_SOFT, WELL } from "./theme.ts";

/** The board's width, and the width of each of the three tiles in a row across it (the board's padding and two gaps taken off). */
const END_W = 360;
const TILE_GAP = 8;
const TILE_W = (END_W - 32 - TILE_GAP * 2) / 3;
/** Seconds the total takes to count up, and when the rows under it come in, one after another. */
const COUNT_TIME = 0.9;
const TILES_AT = 1.0;
const EARNERS_AT = 1.4;

/** A number with what it is under it, on a tan tile: one of the three across the end board. */
function Stat({ value, label, shown }: { value: string; label: string; shown: boolean }) {
  return (
    <Flex width={TILE_W} height={52} direction="column" alignItems="center" justifyContent="center" background={WELL} opacity={shown ? 1 : 0}>
      <Flex height={26} direction="row" alignItems="center">
        <Text font={DISPLAY} size={DISPLAY_SIZE} color={INK}>
          {value}
        </Text>
      </Flex>
      <Text color={INK_SOFT}>{label}</Text>
    </Flex>
  );
}

/**
 * The end of a run, evicted or the jar won: what the run came to. The total counts up, big; under it how near the last rent
 * was, then how far the run got, its best turn and the pool it ended with, and the three things that scored most (a fruit by
 * its picture, a keyword by its name). The buttons are there from the start: the board is not to be waited for.
 */
export function EndBoard({ run, rent, keys, onAgain, onTitle }: { run: Run; rent: number; keys: boolean; onAgain: () => void; onTitle: () => void }) {
  const time = useTime();
  const won = run.phase === "won";
  const earners = topEarners(run, 3).map((e) => ({ ...e, kind: earnerKind(e.label) }));
  const near = Math.max(0, Math.min(1, rent === 0 ? 1 : run.cycleScore / rent));
  return (
    <Flex width={END_W} direction="column" alignItems="stretch">
      {/* A bloop for each of the three tiles as it shows, and one for what scored most. */}
      <Bloops start={TILES_AT} gap={0.12} count={3} />
      <Panel title={won ? "The jar is yours" : "Evicted"}>
        <Flex height={58} direction="row" justifyContent="center" alignItems="end">
          <Text font={DISPLAY} size={DISPLAY_SIZE * 2} color={won ? GOOD : INK}>{`${countUp(run.total, time, COUNT_TIME)}`}</Text>
        </Flex>
        <Flex direction="row" justifyContent="center" paddingBottom={4}>
          <Text color={won ? GOOD : INK_SOFT}>{won ? "points, and every rent paid" : "points"}</Text>
        </Flex>
        {/* How near the rent that ended it was. */}
        {!won && (
          <Flex direction="row" justifyContent="space-between">
            <Text color={INK_SOFT}>The last rent</Text>
            <Text color={INK}>{`${run.cycleScore} of ${rent}`}</Text>
          </Flex>
        )}
        {!won && (
          <Flex height={10} background={BAR_WELL}>
            {near > 0 && <Flex left={2} top={2} bottom={2} width={Math.round(((END_W - 36) * near) / 2) * 2} background={BAR_GOLD} />}
          </Flex>
        )}
        <Flex direction="row" gap={TILE_GAP} paddingTop={8}>
          <Stat value={`${run.cycle} of ${RENT.length}`} label="cycle" shown={time >= TILES_AT} />
          <Stat value={`${run.bestTurn}`} label="best turn" shown={time >= TILES_AT + 0.12} />
          <Stat value={`${run.pool.length}`} label="in pool" shown={time >= TILES_AT + 0.24} />
        </Flex>
        {earners.length > 0 && (
          <Flex direction="row" justifyContent="center" paddingTop={4} opacity={time >= EARNERS_AT ? 1 : 0}>
            <Text color={INK_SOFT}>What scored most</Text>
          </Flex>
        )}
        <Flex direction="row" gap={TILE_GAP} justifyContent="center">
          {earners.map((e) => (
            <Flex key={e.label} width={TILE_W} height={52} direction="column" alignItems="center" justifyContent="center" opacity={time >= EARNERS_AT ? 1 : 0}>
              {/* A fruit by its picture; a keyword (Merge, Explode) by its name. */}
              <Flex width={32} height={32} direction="row" alignItems="center" justifyContent="center">
                {e.kind !== null && <FruitBall kind={e.kind} x={16} y={16} look="icon" />}
                {e.kind === null && <Text color={INK_SOFT}>{e.label}</Text>}
              </Flex>
              <Flex height={26} direction="row" alignItems="center">
                <Text font={DISPLAY} size={DISPLAY_SIZE} color={INK}>{`${e.points}`}</Text>
              </Flex>
            </Flex>
          ))}
        </Flex>
        <Flex direction="row" justifyContent="center" gap={12} paddingTop={8}>
          <TapButton keyName={keys ? "Enter" : ""} label="Play again" onPress={onAgain} />
          <TapButton keyName={keys ? "Esc" : ""} label="Title" onPress={onTitle} />
        </Flex>
      </Panel>
    </Flex>
  );
}
