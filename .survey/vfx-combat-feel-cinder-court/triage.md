# Triage
- Problem: 루트 라우트(`/` = `sprite-2-5d.js`, 잿불 법정 2.5D 아레나)의 스킬·피격 이펙트가 "게임스럽지 못하다". 현재 전투 피드백은 전부 얇은 canvas 타원/호 stroke 하나뿐이라 타격에 무게·반응·스펙터클이 없다. 유사 2.5D/탑다운 액션 게임이 실제로 쓰는 VFX 기법을 조사해, 결정론과 canvas2d 제약을 지키면서 적용 가능한 수정안을 도출한다.
- Audience: 한 손 조작 모바일/브라우저 플레이어(음소거·감소된 모션 포함), 그리고 이 슬라이스의 연출·구현·QA 담당.
- Why now: 게임플레이는 성립했으나(코어 루프·웨이브·스킬), 타격감(game feel)이 빈약해 "게임 같지 않다"는 직접 피드백이 나왔다. 자산·시스템 대공사 없이 렌더러 레이어에서 즉시 개선 가능한 지점을 먼저 규명해야 한다.

## Evidence Contract
- **모드:** market-landscape, medium, indexed-snippets-allowed, 한국어, platform-map 불필요.
- **4개 조사 레인:** context/workarounds는 `context.md`, studied solutions·actual behavior·JTBD alternatives는 `solutions.md`에 분리 보존.
- **[OBSERVED]** 이 리포지토리 코드에서 직접 읽은 현재 이펙트 구현·상수·계약 테스트.
- **[INFERENCE]** 업계 game-feel 문헌의 반복 패턴을 Abyssal 제약(결정론·canvas2d·40 아님/자체 계약)에 맞춰 해석한 결론.
- **[TARGET]** 아직 측정되지 않은 수치(프레임·틱·강도)는 설계 가설이며 관측치로 승격하지 않는다.
- **[BOUNDARY]** 이 조사는 루트 라우트(`sprite-2-5d.js`)에 한정한다. 캠페인 라우트(`battle-realtime-three.js`, 40슬롯 VFX 풀·시뮬레이션 digest)는 별개 계약이므로 여기서 코드 변경 대상이 아니다. 시뮬레이션 규칙(데미지·스폰·자원)은 불변, VFX/오디오/카메라는 확정 이벤트의 관찰자일 뿐이다.
