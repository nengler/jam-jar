import { Button, Entity, Flex, Menu, Sprite, Text } from "@tsengine/runtime/jsx";

import { FruitBall } from "./FruitBall.tsx";
import { useGame } from "./GameState.ts";
import { BUTTON, BUTTON_GREY, BUTTON_SLICE, GOLD, INK, LIGHT, SHADOW } from "./theme.ts";

/** The title: the name over the hills, a few fruit, and Play / Settings on Kenney buttons. */
export function Title({ name }: { name: string }) {
  const { start, openSettings } = useGame.actions();
  return (
    <Entity>
      <Sprite image="background.png" />
      <FruitBall kind="watermelon" x={120} y={250} />
      <FruitBall kind="cherry" x={164} y={286} />
      <FruitBall kind="grape" x={86} y={292} />
      <FruitBall kind="melon" x={520} y={258} />
      <FruitBall kind="lemon" x={474} y={292} />
      <FruitBall kind="orange" x={560} y={300} />
      <Flex direction="column" width={640} height={360} alignItems="center" justifyContent="center" gap={28}>
        <Text size={48} color={GOLD} shadow={INK} shadowX={3} shadowY={3}>
          {name}
        </Text>
        <Menu gap={10} alignItems="stretch" width={220}>
          <Button
            autoFocus
            onPress={start}
            height={48}
            backgroundImage={BUTTON_GREY}
            focusBackgroundImage={BUTTON}
            hoverBackgroundImage={BUTTON}
            slice={BUTTON_SLICE}
            alignItems="center"
            justifyContent="center"
          >
            <Text color={INK}>Play</Text>
          </Button>
          <Button
            onPress={openSettings}
            height={48}
            backgroundImage={BUTTON_GREY}
            focusBackgroundImage={BUTTON}
            hoverBackgroundImage={BUTTON}
            slice={BUTTON_SLICE}
            alignItems="center"
            justifyContent="center"
          >
            <Text color={INK}>Settings</Text>
          </Button>
        </Menu>
        <Text color={LIGHT} shadow={SHADOW} shadowX={2} shadowY={2}>
          Arrows and Enter
        </Text>
      </Flex>
    </Entity>
  );
}
