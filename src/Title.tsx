import { Button, Entity, Flex, Menu, Text } from "@tsengine/runtime/jsx";

import { Backdrop } from "./Backdrop.tsx";
import { FruitBall } from "./FruitBall.tsx";
import { useGame } from "./GameState.ts";
import { KeyHint } from "./KeyHint.tsx";
import type { FruitKind } from "./rules/fruits.ts";
import { FRUIT_ART } from "./rules/sizes.ts";
import { BUTTON, BUTTON_GREY, BUTTON_SLICE, COUNTER_Y, DISPLAY, DISPLAY_SIZE, GOLD, INK, LIGHT_SOFT } from "./theme.ts";

/** The fruit standing on the counter, either side of the menu: each kind and where its centre is across the screen. */
const ON_COUNTER: readonly (readonly [FruitKind, number])[] = [
  ["cherry", 40],
  ["watermelon", 92],
  ["orange", 150],
  ["lemon", 490],
  ["melon", 540],
  ["apple", 592],
];

/** The title: the name on the kitchen wall, fruit on the counter either side, and Play / Settings. */
export function Title({ name }: { name: string }) {
  const learned = useGame((g) => g.learned);
  const { start, openSettings } = useGame.actions();
  return (
    <Entity>
      <Backdrop />
      {ON_COUNTER.map((fruit) => (
        <FruitBall key={fruit[0]} kind={fruit[0]} x={fruit[1]} y={COUNTER_Y - FRUIT_ART[fruit[0]].size / 2 + 2} />
      ))}
      <FruitBall kind="grape" x={124} y={COUNTER_Y - 62} />
      <FruitBall kind="banana" x={568} y={COUNTER_Y - 56} />
      <Flex direction="column" width={640} height={320} alignItems="center" justifyContent="center" gap={12}>
        <Text font={DISPLAY} size={DISPLAY_SIZE * 3} color={GOLD} shadow={INK} shadowX={4} shadowY={4}>
          {name}
        </Text>
        <Text color={LIGHT_SOFT}>Fill the jar. Make the rent.</Text>
        <Menu gap={8} alignItems="stretch" width={208} paddingTop={8} paddingBottom={8}>
          <Button autoFocus onPress={start} height={40} backgroundImage={BUTTON_GREY} focusBackgroundImage={BUTTON} hoverBackgroundImage={BUTTON} slice={BUTTON_SLICE} paddingTop={4} alignItems="center" justifyContent="center">
            <Text color={INK}>Play</Text>
          </Button>
          <Button onPress={openSettings} height={40} backgroundImage={BUTTON_GREY} focusBackgroundImage={BUTTON} hoverBackgroundImage={BUTTON} slice={BUTTON_SLICE} paddingTop={4} alignItems="center" justifyContent="center">
            <Text color={INK}>Settings</Text>
          </Button>
        </Menu>
        {/* The keys, until a button has been pressed once. The row keeps its height after that, so the menu does not move. */}
        <Flex direction="row" gap={20} height={26}>
          {!learned.includes("title") && <KeyHint name="updown" label="Choose" color={LIGHT_SOFT} />}
          {!learned.includes("title") && <KeyHint name="Enter" label="Select" color={LIGHT_SOFT} />}
        </Flex>
      </Flex>
    </Entity>
  );
}
