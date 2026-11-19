import { Button, Entity, Flex, Menu, Text } from "@tsengine/runtime/jsx";

import { Backdrop } from "./Backdrop.tsx";
import { FruitBall } from "./FruitBall.tsx";
import { useGame } from "./GameState.ts";
import { BUTTON, BUTTON_GREY, BUTTON_SLICE, GOLD, INK, LIGHT_SOFT } from "./theme.ts";

/** The title: the name over the dusk hills, a pile of fruit either side, and Play / Settings. */
export function Title({ name }: { name: string }) {
  const { start, openSettings } = useGame.actions();
  return (
    <Entity>
      <Backdrop />
      <FruitBall kind="watermelon" x={112} y={280} />
      <FruitBall kind="orange" x={160} y={296} />
      <FruitBall kind="cherry" x={72} y={304} />
      <FruitBall kind="grape" x={136} y={244} />
      <FruitBall kind="melon" x={520} y={284} />
      <FruitBall kind="apple" x={568} y={300} />
      <FruitBall kind="lemon" x={480} y={304} />
      <FruitBall kind="banana" x={536} y={244} />
      <Flex direction="column" width={640} height={360} alignItems="center" justifyContent="center" gap={24}>
        <Text size={48} color={GOLD} shadow={INK} shadowX={4} shadowY={4}>
          {name}
        </Text>
        <Menu gap={8} alignItems="stretch" width={208}>
          <Button autoFocus onPress={start} height={40} backgroundImage={BUTTON_GREY} focusBackgroundImage={BUTTON} hoverBackgroundImage={BUTTON} slice={BUTTON_SLICE} alignItems="center" justifyContent="center">
            <Text color={INK}>Play</Text>
          </Button>
          <Button onPress={openSettings} height={40} backgroundImage={BUTTON_GREY} focusBackgroundImage={BUTTON} hoverBackgroundImage={BUTTON} slice={BUTTON_SLICE} alignItems="center" justifyContent="center">
            <Text color={INK}>Settings</Text>
          </Button>
        </Menu>
        <Text color={LIGHT_SOFT}>Arrows and Enter</Text>
      </Flex>
    </Entity>
  );
}
