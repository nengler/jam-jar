import { Entity, Flex, Shape, Text } from "@tsengine/runtime/jsx";

import { Dialog, Rule } from "./Board.tsx";
import { EndBoard } from "./EndBoard.tsx";
import { TapButton } from "./KeyHint.tsx";
import { RENT, rentFor, type Run } from "./rules/jar.ts";
import { GOOD, INK, INK_SOFT, SHADE } from "./theme.ts";

interface CycleEndProps {
  run: Run;
  keys: boolean;
  /** On from a paid rent: to the shop, or on after the last. */
  onGoOn: () => void;
  onAgain: () => void;
  onTitle: () => void;
}

/** The end of a cycle (the rent paid) or of the run (`EndBoard`): a board in the middle of the screen, as tall as what it says. */
export function CycleEnd({ run, keys, onGoOn, onAgain, onTitle }: CycleEndProps) {
  const rent = rentFor(run.cycle);
  const finished = run.phase === "over" || run.phase === "won";
  return (
    <Entity>
      <Shape kind="rect" x={0} y={0} width={640} height={360} color={SHADE} />
      <Flex left={0} right={0} top={0} bottom={0} direction="column" alignItems="center" justifyContent="center">
        {finished && <EndBoard run={run} rent={rent} keys={keys} onAgain={onAgain} onTitle={onTitle} />}
        {!finished && (
          <Flex width={288} direction="column" alignItems="stretch">
            <Dialog title="Rent paid" gap={4}>
              <Flex direction="row" justifyContent="space-between">
                <Text color={INK_SOFT}>This cycle</Text>
                <Text color={GOOD}>{`${run.cycleScore} of ${rent}`}</Text>
              </Flex>
              <Flex direction="row" justifyContent="space-between">
                <Text color={INK_SOFT}>The run so far</Text>
                <Text color={INK}>{`${run.total}`}</Text>
              </Flex>
              <Rule />
              <Flex direction="row" justifyContent="center" paddingTop={4}>
                <TapButton label={run.cycle >= RENT.length ? "Go on" : "Shop"} onPress={onGoOn} />
              </Flex>
            </Dialog>
          </Flex>
        )}
      </Flex>
    </Entity>
  );
}
