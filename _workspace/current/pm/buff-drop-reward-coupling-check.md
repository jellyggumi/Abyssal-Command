# PM Reward-Coupling Check — 버프 드랍 정착 지연 (G5)

harness: game-studio-harness Stage 2. owner: game-pm. 입력: designer
`buff-drop-collection-model.md`.

## 판정: G5 영향 없음 — 협상 기록 신규 항목 불요

`DROP_SETTLE_TICKS` 도입은 아래 세 이유로 G5(매출·밸런스 시너지) 밴드를
건드리지 않는다:

1. **일발역전(comeback) 무관.** 버프는 시한부(`durationTicks`)이며 구매·마일스톤
   보상 경로가 아니다. 드랍 수집 시점이 1초 밀려도 역전 확률/캡/쿨다운
   (`reward-bands.md` comeback 블록)에 입력되지 않는다.
2. **유료/무료 패리티 무관.** 정착 지연은 결제 상태와 독립적이고 모든 런에 동일
   적용된다. paid/free 승률 델타(≤5%p)에 새 입력이 없다.
3. **보상 총량 불변.** 드랍률(`DROP_CHANCE_BP`), 희귀도 가중(`RARITY_WEIGHTS_BP`),
   버프 효과·지속(`BUFF_ITEMS`)이 그대로다. 1초 지연은 1800틱(30초) TTL의
   **3.3%**로, 미회수 위험이 실질적으로 늘지 않는다(정착 후 12000 흡수 유지).

## 사이드 노트 (밸런스 관찰, G2 소관)

버프의 유효 가동 시간이 처치 시점 기준 최대 1초 늦게 시작된다. `[TARGET]`
값이라 이번 사이클 게이트에 영향 없음. G2 재측정 시 `DROP_SETTLE_TICKS`를
가동시간 산식 입력으로 포함할 것(designer 사이드 노트와 동일 지점).

signed: [game-pm]
