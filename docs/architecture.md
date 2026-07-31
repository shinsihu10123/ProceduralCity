# Procedural City 아키텍처 v0.1

## 생성 파이프라인

```text
사용자 설정
→ 문자열 시드 해싱
→ 결정론적 난수 생성기
→ 지형 메시 생성
→ 도로 셀 배치
→ 개발 가능 셀 판정
→ 용도지역 배정
→ 건물 형태·높이 생성
→ 도시 지표 계산
→ WebGL 버퍼 업로드
→ 실시간 3D 렌더링
```

## 현재 모듈

- `UI`: 도시 생성 조건과 지표 표시
- `Generator`: 시드, 지형, 도로, 용도, 건물 생성
- `Geometry Builder`: 지형 삼각형 및 건물·도로 박스 메시 생성
- `Renderer`: WebGL2 셰이더, 조명, 안개, 카메라
- `Exporter`: 생성 결과 JSON 내보내기

## 다음 분리 대상

v0.2부터 `main.js`를 다음 모듈로 분리한다.

```text
src/
├── app.js
├── core/random.js
├── generation/terrain.js
├── generation/roads.js
├── generation/parcels.js
├── generation/zoning.js
├── generation/buildings.js
├── render/geometry.js
├── render/camera.js
├── render/webgl.js
└── ui/controls.js
```

## 데이터 모델 초안

```js
City {
  settings,
  extent,
  buildings[],
  roads[],
  metrics
}

Building {
  id,
  x, y, z,
  width, depth, height,
  rotation,
  zone
}
```
