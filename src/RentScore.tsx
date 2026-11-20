import { Flex, Text, useSpring, useTween } from "@tsengine/runtime/jsx";

import { BAR_GOLD, BAR_PAID, BAR_WELL, DISPLAY, DISPLAY_SIZE, GOOD, INK, INK_SOFT } from "./theme.ts";

interface RentScoreProps {
  /** The score on screen (`shownScore`): it rises as each of the tally's scores shows. */
  scored: number;
  rent: number;
  /** How wide the bar's well is, inside its 2 px rim on each side. */
  width: number;
}

/** Seconds the number takes to count up to a new score, and the bar to grow to it (it overshoots a touch, then settles). */
const COUNT_TIME = 0.35;
const BAR_TIME = 0.45;
const BAR_BOUNCE = 0.25;

/**
 * The rent board's score: the cycle's score, big, counting up to each new score rather than jumping to it; the rent under it; and a
 * bar of how much of the rent that is, growing as it counts. "Made" and the green go with the count on screen, so they arrive as it
 * passes the rent. Play gives it a new key each cycle, so it starts at the new cycle's score instead of counting down to it.
 */
export function RentScore({ scored, rent, width }: RentScoreProps) {
  const count = useTween(scored, { duration: COUNT_TIME, ease: "outCubic" });
  const bar = useSpring(Math.min(1, scored / rent), { duration: BAR_TIME, bounce: BAR_BOUNCE });
  const counted = Math.round(count);
  const filled = Math.max(0, Math.min(1, bar));
  const paid = counted >= rent;
  return (
    <Flex direction="column" alignItems="stretch">
      <Flex height={50} direction="row" justifyContent="center" alignItems="center">
        <Text font={DISPLAY} size={DISPLAY_SIZE * 2} color={paid ? GOOD : INK}>{`${counted}`}</Text>
      </Flex>
      <Flex direction="row" justifyContent="center">
        <Text color={paid ? GOOD : INK_SOFT}>{paid ? `Rent ${rent} made` : `of ${rent} rent`}</Text>
      </Flex>
      <Flex height={10} background={BAR_WELL}>
        {filled > 0.005 && <Flex left={2} top={2} bottom={2} width={Math.round((width * filled) / 2) * 2} background={paid ? BAR_PAID : BAR_GOLD} />}
      </Flex>
    </Flex>
  );
}
