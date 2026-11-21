---
domain:
  - game
tags:
  - browser-game
  - puzzle
  - generated-art
deployspec:
  entry_file: index.html
---

# 月蛾邮局 · Mothlight Post

![一只浅绿色的月蛾带着邮包，从月光下的水乡屋顶上飞过。](web/art/mothlight.webp)

你是水乡的夜班邮差。飞过屋顶，把信送到亮着灯的窗前，再在天亮前回到邮局。追雾会记住你刚离开的格子。留下一盏诱灯，就能让它追错方向。

## 立即游玩

在 GitHub 点击 **Code → Download ZIP**，解压后双击根目录的 `index.html`。手机可直接打开发布后的创空间链接。游戏在浏览器内运行，包含简体中文和英文。

如需在本地模拟静态托管，进入项目目录并运行以下命令，再访问 [http://127.0.0.1:8000](http://127.0.0.1:8000)。

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

## 玩法

1. 点击相邻屋顶格，或用方向键、WASD、界面方向键飞一格。落在信封格上即可投递。
2. 红色的雾是它现在的位置，红色虚线框是它接下来要去的格子。飞进这两格都会被捉住。
3. 按 **L** 或点「准备诱灯」，下一步离开时就会在原地留灯。追雾会连续三回合优先追灯，包括放灯当回合。新灯会替换旧灯。
4. 投完所有信件后飞回邮局，通关后继续下一个街区。被追上或耗尽步数时，可以重试当前街区。通关四个街区即完成夜班。

每封信得 100 分。完成街区再加 200 分，每个剩余步数加 20 分，每盏未用的诱灯加 30 分。最高总分在完成整个夜班后记录在当前浏览器中。音效默认为关闭。

## AI 如何参与

- **运行时对手。** 浏览器为每张地图用广度优先搜索（BFS）预计算屋顶间的最短步数。每回合，追雾选择离目标更近的一格，目标通常是邮差刚离开的格子，有诱灯时则被灯吸引。同距离时按上、左、下、右的固定顺序选路。红框直接显示相同算法算出的下一格，方便玩家预判和设计诱导路线。
- **生成式内容。** Devin 的图像生成工具（`gpt-image-2.6-flare`）为游戏生成了月蛾与水乡的主插画。游戏内置优化后的 WebP，并在首页和任务板复用。Devin 也协助设计玩法、编写中英文本与实现代码。
- **关卡调试。** 离线求解器遍历「邮差位置、雾位置、已投递信件、诱灯余额及位置和寿命」等状态，验证每关可解，并检查后两关分别确实需要一盏与两盏诱灯。运行时所有计算都在本机完成，无需模型 API、账户或 GPU。

## 部署到魔搭创空间

1. 在魔搭选择 **创空间 → 创建创空间**，设为**公开**，SDK 选择 **Static / Static HTML**。
2. 在「空间文件」中上传 GitHub ZIP 解压后的项目文件。保持 `index.html` 和本 README 在空间仓库根目录，并保留完整的 `web/` 目录（含 `web/art/`）。根目录的创空间卡片已声明 `deployspec.entry_file: index.html`。
3. 也可克隆创空间页面给出的仓库，把上述文件复制到根目录，提交并推送到该空间的默认分支。用页面提供的 Git 凭据提示完成身份验证。
4. 空间上线后，用未登录窗口打开「空间展示」。从首页点击开始，确认键盘和触屏可以操作、主插画正常加载，并核对通关与重试流程。提交时使用公开的创空间试玩链接。

运行时由静态文件提供，不需要安装依赖。参见 [创空间卡片说明](https://modelscope.cn/docs/%E5%88%9B%E7%A9%BA%E9%97%B4%E5%8D%A1%E7%89%87)和 [比赛介绍](https://modelscope.cn/events/394/%E6%AF%94%E8%B5%9B%E4%BB%8B%E7%BB%8D)。

## 创作手记草稿

### 1. 从投递开始

想做一款能在点开后马上操作的解谜游戏，把规则收在一句话里：「投完信，避开雾，回邮局。」邮差和追雾共享同一张屋顶地图。追雾会循着邮差留下的痕迹移动，7×7 棋盘上的每个路口都可能影响回程。

### 2. 让追雾可读

用 Devin 实现本地搜索对手，将它的实际行动计划直接绘制成红色虚线框。玩家看到预告后可以选择绕道，也可以留诱灯，让雾在下几个回合去追旧位置。关卡的难度从第一关的路线练习，推进到用有限诱灯解决回程困局。

### 3. 用求解结果改关卡

用 JavaScript 状态搜索枚举合法路线。筛选时要求每个屋顶都能从邮局到达，并比较使用和放弃诱灯的最短解。纸灯巷保留了不用灯的 20 步路线，但适时使用诱灯可缩到 16 步。倒月坊和无眠渡则分别以一盏、两盏灯为解题条件。通过求解得到的最短步数依次为 10、16、18、20。

### 4. 生成插画和制作界面

让 Devin 的图像生成工具绘制带邮包的淡绿色月蛾，飞过古代中国水乡的河道、石桥和屋顶。提示词指定横幅构图、水粉与墨线、靛蓝雾气、暖色窗灯，以及可以叠放文字的暗色左侧。将选用图压缩为 WebP，游戏界面由原生 HTML、CSS 和 JavaScript 实现，音效由 Web Audio 合成。

游戏字体随项目提供。Noto Sans SC 根据当前界面文字做了子集，Instrument Serif 用于拉丁标题字。两者的 SIL Open Font License 收录在 `web/fonts/`。

### 5. 逐条验证

用 Node.js 检查碰撞、诱灯寿命、计分和关卡可解性，再在本地浏览器走完整个夜班，覆盖失败、重试、通关、最高分和窄屏触控。正式发布创作手记时，可配上首页、诱灯改变雾路线的棋盘截图，以及从一次投递到结算的演示视频。

## 开发验证

```sh
node --test tests/game.test.cjs
```

## English quick start

Download and extract the repository ZIP, then open `index.html`. Click **English** at the top. Start the night shift, move with the arrow keys, WASD, or a nearby tile, and land on every letter before flying home. Avoid the pink fog and its dashed forecast tile. Press **L** or tap **Ready a decoy**, then move to leave a light that draws the fog for three turns. Clear all four districts to set your best score. For ModelScope, create a public **Static HTML** Space and upload the root `index.html`, this README, and the full `web/` directory.
