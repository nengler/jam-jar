import { Entity, Flex, Shape, Text, Tooltip } from "@tsengine/runtime/jsx";

import { Letters } from "./Board.tsx";
import { Coach } from "./Coach.tsx";
import { FruitBall } from "./FruitBall.tsx";
import { TapButton } from "./KeyHint.tsx";
import { placed } from "./layout.ts";
import { RuleText } from "./RuleText.tsx";
import { Terms } from "./Terms.tsx";
import { FRUITS } from "./rules/fruits.ts";
import { OFFERED, type Run } from "./rules/jar.ts";
import type { Lesson } from "./rules/tutorial.ts";
import { biggestFruit, CARD_SLICE, cardFor, DISPLAY, DISPLAY_SIZE, fruitImageSize, INK, INK_SOFT, KEYWORD, SHADE } from "./theme.ts";

/** The pick: three cards across the middle. */
const OFFER_W = 184;
const OFFER_H = 232;
const OFFER_GAP = 12;
const OFFER_LIFT = 8;
/**
 * Under the chosen card, its Take button and the gap over it; the button is tucked up over the card's foot by TAKE_TUCK, so it
 * stays clear of the tutorial's lesson along the foot of the screen, and the chosen card's text stops that much higher.
 */
const TAKE_ROOM = 34;
const TAKE_TUCK = 20;
/** The room left under a pick card's text, inside its frame: a longer text scrolls rather than running over it. */
const OFFER_FOOT = 10;
/** The picture at the top of a pick card: square, as big as the biggest fruit a pick can offer, each fruit standing on its foot. */
const OFFER_PICTURE = biggestFruit(OFFERED);

interface PickBoardProps {
  run: Run;
  paused: boolean;
  /** Whether the keys are named on the buttons: at a keyboard, until the player has been through a pick once. */
  hints: boolean;
  keys: boolean;
  /** The tutorial's lesson, if it is its moment: the first pick of the first game. */
  coached: Lesson | null;
  /** A card was tapped or clicked: it is chosen (by its place). */
  onChoose: (at: number) => void;
  /** A tap landed on none of the cards: nothing is chosen any more. */
  onAway: () => void;
  onTake: () => void;
  onSkip: () => void;
  onLessonNext: () => void;
  onLessonSkip: () => void;
}

/**
 * The pick: three cards in a row in the middle of a dimmed kitchen, under their heading. Each place is a little taller than its
 * card, and the chosen card stands at the top of its place with its Take button under it.
 */
export function PickBoard({ run, paused, hints, keys, coached, onChoose, onAway, onTake, onSkip, onLessonNext, onLessonSkip }: PickBoardProps) {
  return (
    <Entity>
      <Shape kind="rect" x={0} y={0} width={640} height={360} color={SHADE} />
      <Flex left={0} right={0} top={12} bottom={0} direction="column" alignItems="center" gap={8}>
        <Flex direction="row" justifyContent="center" height={32}>
          <Letters text="Pick a fruit" seed={5} />
        </Flex>
        <Flex direction="row" alignItems="start" gap={OFFER_GAP} onPressOutside={onAway}>
          {placed(run.offers).map((offer) => (
            <Flex key={offer.at} height={OFFER_H + OFFER_LIFT + TAKE_ROOM} direction="column" alignItems="center" gap={4} paddingTop={offer.at === run.offerCursor ? 0 : OFFER_LIFT}>
              {/* What a card's keywords mean shows beside it while it is the chosen one, and only then. A tap or a click
                  chooses a card, and the Take button under it takes it. The pointer coming over a card does not choose it: on
                  a touchscreen the pointer stays where the last tap was, which would choose a card before the player had. */}
              <Flex width={OFFER_W} height={OFFER_H} direction="column" alignItems="center" paddingTop={18} paddingBottom={offer.at === run.offerCursor ? OFFER_FOOT + TAKE_TUCK : OFFER_FOOT} gap={4} backgroundImage={cardFor(offer.at === run.offerCursor)} slice={CARD_SLICE} focusable={false} onPress={() => onChoose(offer.at)}>
                <Tooltip show={!paused && offer.at === run.offerCursor} anchor={offer.at < 2 ? "top-left" : "top-right"} to={offer.at < 2 ? "top-right" : "top-left"} offsetX={offer.at < 2 ? 4 : -4} offsetY={-44} background="#00000000" borderWidth={0} paddingX={0} paddingY={0}>
                  <Terms text={FRUITS[offer.card].text} />
                </Tooltip>
                <Flex width={OFFER_PICTURE} height={OFFER_PICTURE}>
                  <FruitBall kind={offer.card} x={OFFER_PICTURE / 2} y={OFFER_PICTURE - fruitImageSize(offer.card) / 2} />
                </Flex>
                <Text width={OFFER_W} maxWidth={OFFER_W} align="center" font={DISPLAY} size={DISPLAY_SIZE} color={INK}>
                  {FRUITS[offer.card].name}
                </Text>
                {/* What it does takes what is left of the card, and scrolls when it is longer than that. */}
                <Flex width={OFFER_W - 16} height="grow" direction="column" alignItems="center" overflow="scroll" scrollbarColor={INK_SOFT}>
                  <RuleText x={0} y={0} width={OFFER_W - 24} text={FRUITS[offer.card].text} color={INK_SOFT} accent={KEYWORD} />
                </Flex>
              </Flex>
              {/* What takes the chosen card, on its foot (its keywords open beside it, never over this): a tap or a click
                  on a card only chooses it, so it can be read and its text scrolled first. Enter does the same. */}
              {offer.at === run.offerCursor && (
                <Flex y={-TAKE_TUCK}>
                  <TapButton label="Take" keyName={hints ? "Enter" : ""} onPress={onTake} />
                </Flex>
              )}
            </Flex>
          ))}
        </Flex>
      </Flex>
      {/* The first pick of the first game: the tutorial's lesson says it, along the foot of the screen. */}
      {coached !== null && (
        <Flex right={8} bottom={2}>
          <Coach wide lesson={coached} keys={keys} width={440} onNext={onLessonNext} onSkip={onLessonSkip} />
        </Flex>
      )}
      {/* The way out, always there, in the bottom left corner: a card's keywords open to its side, never over this. */}
      <Flex left={16} bottom={2} direction="row" alignItems="center" gap={20}>
        <TapButton label="Skip for 1 coin" keyName={hints ? "Space" : ""} onPress={onSkip} />
      </Flex>
    </Entity>
  );
}
