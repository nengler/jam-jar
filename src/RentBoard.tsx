import { Flex, Text } from "@tsengine/runtime/jsx";

import { Panel } from "./Board.tsx";
import { Frame } from "./Coach.tsx";
import { cycleTitle } from "./layout.ts";
import { BOARD_W, BOARD_Y } from "./places.ts";
import { RentScore } from "./RentScore.tsx";
import { CLEAR_TIME, rentFor, TURNS_PER_CYCLE, type Run } from "./rules/jar.ts";
import { BAD, INK_SOFT } from "./theme.ts";

/**
 * The rent board, in a column pinned to the screen's left edge (`left`, which slides it in as a run opens): as tall as what is
 * on it. This cycle's score, big, and under it the rent it is counted against ("64 of 120 rent"); a bar of how much of the rent
 * that is; and the turn. `scored` is the score on screen, which runs behind the run's while the tally's popups are still to come.
 */
export function RentBoard({ run, scored, left }: { run: Run; scored: number; left: number }) {
  const rent = rentFor(run.cycle);
  const paid = scored >= rent;
  const clearing = run.phase === "clear";
  // Resolve has already counted the next turn; the pips wait for the tally to finish before showing it.
  const turn = Math.min(run.turn - (run.phase === "tally" && run.afterTally !== "rent" && run.afterTally !== "over" ? 1 : 0), TURNS_PER_CYCLE);
  const last = turn >= TURNS_PER_CYCLE;
  return (
    <Flex left={left} top={BOARD_Y} width={BOARD_W} direction="column" alignItems="stretch" gap={12}>
      <Frame id="rent" pad={6} padBottom={10} />
      <Panel title={cycleTitle(run)}>
        {/* Between cycles (the clear-out) it counts the score down to 0 and the rent up to the next cycle's, at the clear-out's pace. */}
        <RentScore key={run.cycle} scored={clearing ? 0 : scored} rent={clearing ? rentFor(run.cycle + 1) : rent} width={BOARD_W - 36} time={clearing ? CLEAR_TIME * 0.8 : undefined} />
        <Flex direction="row" justifyContent="space-between" paddingTop={6}>
          <Text color={last && !paid ? BAD : INK_SOFT}>{last ? "Last turn" : "Turn"}</Text>
          <Text color={last && !paid ? BAD : INK_SOFT}>{last ? `${turn}/${TURNS_PER_CYCLE}` : `${turn} of ${TURNS_PER_CYCLE}`}</Text>
        </Flex>
      </Panel>
    </Flex>
  );
}
