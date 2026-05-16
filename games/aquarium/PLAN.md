# ライフシム「ガラス水槽の微生物」初期実装案

## Context

ユーザーは「単純な能力を持つ生き物の生態を観察するシミュレーションゲーム」を作りたい。クラリファイの結果:

- **テーマ**: ガラス水槽の微生物 (3D 透明タンクの中で動く小さな生き物)
- **プレイヤー関与**: 神視点で軽く干渉
- **描画**: Three.js で3D

最終形は **2種 (草食 + 捕食) の生態系シム** を目指すが、ユーザーの要望により **初手は「1種類・1個体」だけに絞った MVP** から始める。1匹の生き物が水槽の中をふらふら漂って栄養を食べて生きる、という最小ループを完成させてから種を増やす。

既存ゲーム `games/fire-garden/` が Three.js + importmap + 単一 game.js の前例。骨格をそれに合わせる。

---

## ゴール (今回の実装範囲)

ガラスの水槽の中に **1匹だけ** の微生物が漂い、プレイヤーが上から栄養を撒くとそれを探して食べに行く。エネルギーが減ると弱り、増えると元気になる。それを眺める。

**今回作るのはここまで**。繁殖・捕食・複数種は後続フェーズに回す。ただしデータ構造は配列ベースで作っておき、後で個体数を増やす拡張が自然になるようにする。

### 観察できる楽しさ (MVP段階)
- 水槽内をブラウン運動的に漂う動き
- 栄養を撒くと方向転換して食べに行く
- 食べると少し光る/大きくなる等のフィードバック
- 何もないとエネルギーが減って動きが鈍る

---

## ファイル構成

```
games/aquarium/
  index.html       # importmap + canvas + HUD
  style.css        # HUD レイアウト
  game.js          # シーン + 1匹のシミュレーション
```

ルート `/home/nekoking/ai-games/index.html` に1行追加 (例: `<li><a href="games/aquarium/">Aquarium</a></li>`)。

---

## シーン (Three.js)

`games/fire-garden/game.js:1-46` の renderer/scene/camera/OrbitControls 部をテンプレ流用。

- **Renderer**: `WebGLRenderer({ antialias: true })`, pixelRatio キャップ2
- **Camera**: PerspectiveCamera 50°, 水槽を斜め俯瞰する位置
- **Controls**: OrbitControls、ターゲットを水槽中心、距離2.5–10、ダンピング有効
- **Lighting**: AmbientLight 0.4 + DirectionalLight 上方 1.0
- **水槽 (ガラス)**:
  - 床+4側面を `MeshPhysicalMaterial` で `transmission: 1.0, roughness: 0.05, thickness: 0.3, ior: 1.5, transparent: true`
  - サイズ例: 4 × 3 × 4 (W × H × D)。上面は開放
  - 任意で水ボリュームを表す薄青のうっすらキューブを内側に
- **床外**: 軽く暗めの背景色のみ。地面は無くてよい (水槽だけ浮いてる演出)

---

## エンティティ設計

### Creature (1匹)
状態を持つ単純なオブジェクト。**配列で管理する** ことで後で増やす際の修正を最小化。

```js
const creatures = [];
function spawnCreature(pos) {
  creatures.push({
    pos: pos.clone(),
    vel: new THREE.Vector3(),
    energy: 1.0,
    age: 0,
    phase: Math.random() * Math.PI * 2,   // ゆらぎ用
    mesh: <個別Mesh または InstancedMeshインデックス>,
  });
}
```

- 描画は **個別 Mesh で十分** (1匹なので InstancedMesh は過剰)。半透明の緑〜黄の球 (`MeshStandardMaterial`, emissive 弱め)
- 後で多数化するときに InstancedMesh に差し替えやすいよう、更新処理を `creatures.forEach` のループにまとめておく

#### 挙動 (毎フレーム)
1. **Drift**: `phase` を進めつつサイン波 + ランダム微小ベクトルで `vel` に小さな力を加える (ブラウン運動風)
2. **Seek**: 視野半径内に栄養があれば最寄りに向かう加速度を加える
3. **Eat**: 栄養と距離 < 半径 で吸収、`energy += k`、栄養を消す。Mesh のスケールや emissive を一時的に強める
4. **Move**: `pos += vel * dt`, ダンピング適用 (`vel *= 0.95` 程度)
5. **Bounds**: 水槽壁に近づいたら法線方向の反発力 (簡易バネ)
6. **Decay**: `energy -= dt * 一定値`, `age += dt`
7. **Death**: energy ≤ 0 で消す (MVP段階では「再生成」ボタンを押すまで空のまま、で十分)

### Nutrient (栄養粒子, 環境資源)
こちらも配列で管理。少量しか出ないので InstancedMesh はまだ不要、個別 Mesh で OK。後で増やすなら InstancedMesh に差し替え。

```js
const nutrients = [];
function spawnNutrient(pos) {
  nutrients.push({
    pos: pos.clone(),
    vel: new THREE.Vector3(0, -0.1, 0), // 落下
    mesh: <発光する小さな球>,
  });
}
```

- 上から落下、水流で軽く揺れる、底に着いたら止まる
- プレイヤーがクリックすると数粒落ちる
- (任意) 一定時間後に自然消滅

---

## ループ

```js
function tick(now) {
  const dt = Math.min((now - last) / 1000, 0.05) * speedMultiplier;
  if (!paused) {
    updateNutrients(dt);
    updateCreatures(dt);
  }
  controls.update();
  renderer.render(scene, camera);
  updateHUD();
  last = now;
  requestAnimationFrame(tick);
}
```

`dt` を 50ms でクランプ。`speedMultiplier` は HUD で ×1/×2 (MVP は2段階で十分)。

---

## プレイヤー操作

### マウス
- **左ドラッグ**: OrbitControls
- **シーン上をクリック**: Raycaster で水槽の内部Y平面 (上の方) と交差させ、その地点に栄養を1〜3粒落とす

### HUD (画面下部、fire-garden の palette を踏襲)
- **+1 Creature**: 生き物を1匹追加 (死んだ後の再投入や、後でテスト的に複数化する用)
- **Sprinkle**: ボタン押すたびに栄養を5粒ランダム位置に降らす
- **Speed**: ×1 / ×2 トグル
- **Pause / Resume**
- **Reset**: 状態を初期化
- **情報**: `Creatures: N`, `Energy: x.xx` (1匹のときだけ表示), `Time: s`

style.css は fire-garden を踏襲 (右下絶対配置、暗背景の四角いボタン)。

---

## 主要ファイル

| ファイル | 役割 |
|---------|------|
| `games/aquarium/index.html` (新規) | importmap + canvas + HUD ボタン |
| `games/aquarium/style.css` (新規) | HUD CSS |
| `games/aquarium/game.js` (新規) | シーン + 1匹のシミュレーション + 入力 |
| `index.html` (修正) | ゲーム一覧に1行 |

参考: `games/fire-garden/index.html:1-44` (importmap + HUD構造), `games/fire-garden/game.js:1-75` (シーン初期化)。

---

## 実装ステップ

1. `games/aquarium/` を作り、fire-garden の3ファイルを下敷きにスケルトン作成
2. ガラス水槽を描画 (生き物なし、OrbitControls で回せること)
3. Nutrient: 配列・spawn 関数・落下・クリック投入
4. Creature: **1匹だけ** spawn、drift + seek + eat + decay + bounds + death を実装
5. HUD ボタン (Sprinkle / +1 Creature / Speed / Pause / Reset) と表示
6. ルート `index.html` にリンク追加
7. パラメータ調整 (寿命・速度・視野・エネルギー減衰) してそれっぽい挙動に
8. 動作確認

---

## 検証方法

```bash
python3 -m http.server 8080
```

`http://localhost:8080/games/aquarium/` を開いて:

- 水槽が透明感をもって描画され、OrbitControls で回せる
- 初期で1匹の生き物が水槽内を漂っている
- HUD の Sprinkle を押すと栄養が降ってくる、または水槽内をクリックして栄養を撒ける
- 生き物が栄養に近づいて食べる、`Energy` 表示が増える
- 何もしないと `Energy` がじわじわ減り、最終的に消える (HUDで状態が反映される)
- Pause / Speed / Reset / +1 Creature が機能する
- ルート index.html から遷移できる
- ブラウザコンソールにエラーが出ない

---

## 後続フェーズ (今回はやらない、設計の方向性のみ)

このMVPが固まったら段階的に拡張:

1. **多数化**: 個別 Mesh を InstancedMesh に差し替え、Creature を数十匹に
2. **繁殖**: energy 閾値で分裂、age で死亡
3. **捕食者 (種B)**: 配列をもう一系統用意し、plankton をターゲットにする hunt 挙動を追加
4. **環境干渉**: 光の ON/OFF, 水温スライダー等

Creature/Nutrient を最初から配列で管理しておくことで、これらの拡張は「ループの中身を増やす」程度で済むようにしておく。
