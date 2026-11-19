import { Entity, Flex, Shape, Sprite, Text, Tooltip } from "@tsengine/runtime/jsx";

import { Board, Heading } from "./Board.tsx";
import { FruitBall } from "./FruitBall.tsx";
import { KeyHint } from "./KeyHint.tsx";
import { fruitGlossary, itemGlossary, placed, poolRows } from "./layout.ts";
import { FRUITS } from "./rules/fruits.ts";
import { ITEMS } from "./rules/items.ts";
import { RuleText } from "./RuleText.tsx";
import { Terms } from "./Terms.tsx";
import { FRUIT_PRICE, REMOVAL_PRICE, rerollPrice, SHOP_ITEM, SHOP_LEAVE, SHOP_REMOVE, SHOP_REROLL, type Run, type Shop as ShopState } from "./rules/jar.ts";
import { BAD, cardFor, CARD_SLICE, INK, INK_SOFT, KEYWORD, KEYWORD_LIGHT, LIGHT, SELECT, SHADE, WELL } from "./theme.ts";

/** The shelf: four cards across the middle. */
const CARD_W = 148;
const CARD_H = 204;
const CARD_GAP = 6;
const CARDS_X = (640 - (4 * CARD_W + 3 * CARD_GAP)) / 2;
const CARDS_Y = 48;
/** The actions: three buttons under the shelf. */
const ACTION_W = 196;
const ACTION_H = 36;
const ACTION_GAP = 6;
const ACTIONS_X = (640 - (3 * ACTION_W + 2 * ACTION_GAP)) / 2;
const ACTIONS_Y = 254;
/** Choosing a fruit to take out: the pool's kinds in a row of cells on a board. */
const CELL = 56;

interface ShopProps {
  run: Run;
  shop: ShopState;
  /** Whether the keys are shown: the first visit, and the first time a fruit is taken out. */
  hints: boolean;
  /** The mouse came over a card or an action (its place in the shop's cursor order), or pressed it. */
  onPoint: (place: number) => void;
  onClick: (place: number) => void;
}

interface PriceProps {
  x: number;
  y: number;
  price: number;
  /** Whether the run has the coins: the price is red when it does not. */
  afford: boolean;
}

/** A price: the coin and the number, centred on `x`. A card's is in its top left corner, an action's at its right end. */
function Price({ x, y, price, afford }: PriceProps) {
  return (
    <Entity x={x - 22} y={y}>
      <Sprite image="coin.png" />
      <Text x={30} y={2} color={afford ? INK : BAD}>{`${price}`}</Text>
    </Entity>
  );
}

/**
 * The shop between two cycles, over the dimmed kitchen: three fruit and an item on cards, then removal, a reroll and the way out.
 * The rules (rules/jar.ts, `Shop`) hold what is for sale and where the cursor is; this draws them. `hints` is whether the keys are
 * shown: the first visit, and the first time a fruit is taken out.
 */
export function Shop({ run, shop, hints, onPoint, onClick }: ShopProps) {
  const kinds = poolRows(run.pool);
  const boardW = Math.max(240, kinds.length * CELL + 32);
  const boardX = 320 - boardW / 2;
  const most = hints ? 2 : 3;
  const terms = shop.removing ? [] : shop.cursor === SHOP_ITEM ? itemGlossary(shop.item, most) : fruitGlossary(shop.fruits[shop.cursor], most);
  return (
    <Entity>
      <Shape kind="rect" x={0} y={0} width={640} height={360} color={SHADE} />
      <Heading x={320} y={10} width={184} text="Shop" />
      <Board x={512} y={12} width={104} height={32} />
      <Sprite image="coin.png" x={522} y={16} />
      <Text x={606} y={18} align="right" color={INK}>{`${run.coins}`}</Text>

      {placed(shop.fruits).map((slot) => (
        <Entity key={slot.at} x={CARDS_X + slot.at * (CARD_W + CARD_GAP)} y={CARDS_Y - (!shop.removing && shop.cursor === slot.at ? 8 : 0)}>
          <Flex width={CARD_W} height={CARD_H} backgroundImage={cardFor(!shop.removing && shop.cursor === slot.at)} slice={CARD_SLICE} focusable={false} onPointerEnter={() => onPoint(slot.at)} onPress={() => onClick(slot.at)}>
            {slot.card !== null && (
              <Tooltip anchor={slot.at < 2 ? "top-left" : "top-right"} to={slot.at < 2 ? "top-right" : "top-left"} offsetX={slot.at < 2 ? 4 : -4} offsetY={0} background="#00000000" borderWidth={0} paddingX={0} paddingY={0}>
                <Terms text={FRUITS[slot.card].text} />
              </Tooltip>
            )}
          </Flex>
          {slot.card !== null && <FruitBall kind={slot.card} x={CARD_W / 2 + 14} y={40} look="big" />}
          {slot.card !== null && (
            <Text x={CARD_W / 2} y={72} align="center" color={INK}>
              {FRUITS[slot.card].name}
            </Text>
          )}
          {slot.card !== null && <RuleText x={6} y={98} width={CARD_W - 12} text={FRUITS[slot.card].text} color={INK_SOFT} accent={KEYWORD} />}
          {slot.card !== null && <Price x={30} y={6} price={FRUIT_PRICE} afford={run.coins >= FRUIT_PRICE} />}
          {slot.card === null && (
            <Text x={CARD_W / 2} y={84} align="center" color={WELL}>
              Sold
            </Text>
          )}
        </Entity>
      ))}
      <Entity x={CARDS_X + SHOP_ITEM * (CARD_W + CARD_GAP)} y={CARDS_Y - (!shop.removing && shop.cursor === SHOP_ITEM ? 8 : 0)}>
        <Flex width={CARD_W} height={CARD_H} backgroundImage={cardFor(!shop.removing && shop.cursor === SHOP_ITEM)} slice={CARD_SLICE} focusable={false} onPointerEnter={() => onPoint(SHOP_ITEM)} onPress={() => onClick(SHOP_ITEM)}>
          {shop.item !== null && (
            <Tooltip anchor="top-right" to="top-left" offsetX={-4} offsetY={0} background="#00000000" borderWidth={0} paddingX={0} paddingY={0}>
              <Terms text={ITEMS[shop.item].text} />
            </Tooltip>
          )}
        </Flex>
        {shop.item !== null && <Sprite image={`item-${shop.item}.png`} x={CARD_W / 2 - 10} y={22} />}
        {shop.item !== null && (
          <Text x={CARD_W / 2} y={74} align="center" color={INK}>
            {ITEMS[shop.item].name}
          </Text>
        )}
        {shop.item !== null && <RuleText x={6} y={96} width={CARD_W - 12} text={ITEMS[shop.item].text} color={INK_SOFT} accent={KEYWORD} />}
        {shop.item !== null && <Price x={30} y={6} price={ITEMS[shop.item].price} afford={run.coins >= ITEMS[shop.item].price} />}
        {shop.item === null && (
          <Text x={CARD_W / 2} y={84} align="center" color={WELL}>
            No item
          </Text>
        )}
      </Entity>

      <Entity x={ACTIONS_X} y={ACTIONS_Y}>
        <Flex width={ACTION_W} height={ACTION_H} backgroundImage={cardFor(!shop.removing && shop.cursor === SHOP_REMOVE)} slice={CARD_SLICE} focusable={false} onPointerEnter={() => onPoint(SHOP_REMOVE)} onPress={() => onClick(SHOP_REMOVE)} />
        <Text x={14} y={10} color={INK}>
          Remove one
        </Text>
        <Price x={ACTION_W - 32} y={6} price={REMOVAL_PRICE} afford={run.coins >= REMOVAL_PRICE} />
      </Entity>
      <Entity x={ACTIONS_X + ACTION_W + ACTION_GAP} y={ACTIONS_Y}>
        <Flex width={ACTION_W} height={ACTION_H} backgroundImage={cardFor(!shop.removing && shop.cursor === SHOP_REROLL)} slice={CARD_SLICE} focusable={false} onPointerEnter={() => onPoint(SHOP_REROLL)} onPress={() => onClick(SHOP_REROLL)} />
        <Text x={14} y={10} color={INK}>
          New shelf
        </Text>
        <Price x={ACTION_W - 32} y={6} price={rerollPrice(shop)} afford={run.coins >= rerollPrice(shop)} />
      </Entity>
      <Entity x={ACTIONS_X + 2 * (ACTION_W + ACTION_GAP)} y={ACTIONS_Y}>
        <Flex width={ACTION_W} height={ACTION_H} backgroundImage={cardFor(!shop.removing && shop.cursor === SHOP_LEAVE)} slice={CARD_SLICE} focusable={false} onPointerEnter={() => onPoint(SHOP_LEAVE)} onPress={() => onClick(SHOP_LEAVE)} />
        <Text x={ACTION_W / 2} y={10} align="center" color={INK}>
          Next cycle
        </Text>
      </Entity>

      {/* What just happened, top left; what the chosen card's keywords mean, under the actions. */}
      <Text x={16} y={8} width={196} maxWidth={196} color={LIGHT}>
        {run.message}
      </Text>
      {terms.map((line, i) => (
        <RuleText key={line} x={0} y={ACTIONS_Y + 40 + i * 20} width={640} text={line} color={LIGHT} accent={KEYWORD_LIGHT} />
      ))}
      {!shop.removing && hints && (
        <Flex y={334} width={640} direction="row" justifyContent="center" gap={20}>
          <KeyHint name="arrows" label="Choose" />
          <KeyHint name="Enter" label="Buy" />
          <KeyHint name="Space" label="Next cycle" />
        </Flex>
      )}

      {/* Taking a fruit out: the pool by kind on a board over the shelf. */}
      {shop.removing && (
        <Entity>
          <Shape kind="rect" x={0} y={0} width={640} height={360} color={SHADE} />
          <Board x={boardX} y={120} width={boardW} height={96} title="Take out one" />
          {kinds.map((row, i) => (
            <Entity key={row.kind} x={boardX + (boardW - kinds.length * CELL) / 2 + i * CELL} y={150}>
              {i === shop.removeCursor && <Flex x={0} y={-4} width={40} height={40} backgroundImage={SELECT} slice={CARD_SLICE} />}
              <FruitBall kind={row.kind} x={20} y={16} look="icon" />
              <Text x={20} y={38} align="center" color={INK}>{`${row.count}`}</Text>
            </Entity>
          ))}
          {hints && (
            <Flex y={334} width={640} direction="row" justifyContent="center" gap={20}>
              <KeyHint name="arrows" label="Choose" />
              <KeyHint name="Enter" label="Take out" />
              <KeyHint name="Space" label="Back" />
            </Flex>
          )}
        </Entity>
      )}
    </Entity>
  );
}
