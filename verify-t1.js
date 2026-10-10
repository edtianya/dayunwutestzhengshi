// T1 逻辑验证脚本（Node，无 DOM 依赖）
// 用法: node verify-t1.js
// 覆盖: countInTotal 零时长占位语义、timeLeft 钳制、formatTime 防御，
//       以及编辑器校验修复后（锁定"考试结束"行 duration=0）的数据管线
const path = require("path");
const {
  buildCustomExamSections,
  clampTimeLeft,
  formatTime,
  getSectionDurationLabel,
} = require(path.join(__dirname, "js", "script.js"));

// 报告输出走 stdout（避免仓库中出现 console.log）
function print(...args) {
  process.stdout.write(args.join(" ") + "\n");
}

let passCount = 0;
let failCount = 0;

function check(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passCount++;
    print(`  PASS  ${label}`);
  } else {
    failCount++;
    print(`  FAIL  ${label}`);
    print(`        期望: ${e}`);
    print(`        实际: ${a}`);
  }
}

function span(sections, name) {
  const s = sections.find((x) => x.name === name);
  return s ? [s.start, s.end] : null;
}

function sectionOf(sections, name) {
  return sections.find((x) => x.name === name);
}

function countedTotal(sections) {
  return sections.reduce((sum, s) => sum + s.duration, 0);
}

// [1] 本缺陷场景：编辑器修复后产出（3个普通环节 + 锁定"考试结束"行）
print("\n[1] 编辑器修复后输出 -> 首页环节数组");
const fixedEditorOutput = buildCustomExamSections({
  startTime: "09:00",
  sections: [
    { name: "环节一", duration: 10, description: "环节一", countInTotal: true },
    { name: "环节二", duration: 20, description: "环节二", countInTotal: true },
    { name: "环节三", duration: 30, description: "环节三", countInTotal: true },
    {
      name: "考试结束",
      duration: 0,
      description: "收答题卡和试题册",
      countInTotal: false,
    },
  ],
});
check("环节数量为 4（锁定行保留，未重复追加结束环节）", fixedEditorOutput.length, 4);
check("环节一 [0,10]", span(fixedEditorOutput, "环节一"), [0, 10]);
check("环节二 [10,30]", span(fixedEditorOutput, "环节二"), [10, 30]);
check("环节三 [30,60]", span(fixedEditorOutput, "环节三"), [30, 60]);
check("考试结束为末位零时长占位 [60,60]", span(fixedEditorOutput, "考试结束"), [60, 60]);
check(
  "考试结束 duration=0 且 countInTotal=false",
  [sectionOf(fixedEditorOutput, "考试结束").duration, sectionOf(fixedEditorOutput, "考试结束").countInTotal],
  [0, false],
);
check("全部环节坐标有限且 start<=end", fixedEditorOutput.every((s) => Number.isFinite(s.start) && Number.isFinite(s.end) && s.start <= s.end), true);
check("总时长 60 分钟（=3600 秒）", countedTotal(fixedEditorOutput) * 60, 3600);
check("timeLeft 越界钳制到 3600 秒", clampTimeLeft(999999, 3600), 3600);

// [2] 中途"不计时"占位：不占用时间，后续环节起点不被推后
print("\n[2] 中途不计时环节为零时长占位");
const withBreak = buildCustomExamSections({
  startTime: "14:30",
  sections: [
    { name: "签到", duration: 10, description: "签到", countInTotal: true },
    { name: "中场休息", duration: 15, description: "中场休息", countInTotal: false },
    { name: "笔试", duration: 45, description: "笔试", countInTotal: true },
    { name: "考试结束", duration: 0, description: "收答题卡和试题册", countInTotal: false },
  ],
});
check("签到 [0,10]", span(withBreak, "签到"), [0, 10]);
check("中场休息占位 [10,10]（输入15分钟被清零）", span(withBreak, "中场休息"), [10, 10]);
check("中场休息 duration=0", sectionOf(withBreak, "中场休息").duration, 0);
check("笔试起点仍为 10（未被休息推后）", span(withBreak, "笔试"), [10, 55]);
check("考试结束 [55,55]", span(withBreak, "考试结束"), [55, 55]);
check("签到 realTime 14:30-14:40", sectionOf(withBreak, "签到").realTime, "14:30-14:40");
check("中场休息 realTime 14:40（单点时刻）", sectionOf(withBreak, "中场休息").realTime, "14:40");
check("笔试 realTime 14:40-15:25", sectionOf(withBreak, "笔试").realTime, "14:40-15:25");

// [3] 旧数据兼容：无"考试结束"行时自动补齐
print("\n[3] 旧数据（无考试结束行）自动补齐");
const legacy = buildCustomExamSections({
  startTime: "08:00",
  sections: [
    { name: "单元一", duration: 45, description: "单元一", countInTotal: true },
    { name: "单元二", duration: 60, description: "单元二", countInTotal: true },
  ],
});
check("自动追加后共 3 个环节", legacy.length, 3);
check("末位为考试结束占位 [105,105]", span(legacy, "考试结束"), [105, 105]);
check("自动补齐的结束环节 countInTotal=false", sectionOf(legacy, "考试结束").countInTotal, false);
check("结束时刻 09:45", sectionOf(legacy, "考试结束").realTime, "09:45");

// [4] 全部不计入：全零时长，总时长 0
print("\n[4] 全部不计入总时间");
const allPlaceholders = buildCustomExamSections({
  startTime: "10:00",
  sections: [{ name: "仅展示", duration: 30, description: "仅展示", countInTotal: false }],
});
check("共 2 个环节（含自动补齐）", allPlaceholders.length, 2);
check("仅展示 [0,0]", span(allPlaceholders, "仅展示"), [0, 0]);
check("考试结束 [0,0]", span(allPlaceholders, "考试结束"), [0, 0]);
check("总时长 0", countedTotal(allPlaceholders), 0);

// [5] clampTimeLeft 边界
print("\n[5] clampTimeLeft 边界钳制");
check("(-5, 8400) -> 0", clampTimeLeft(-5, 8400), 0);
check("(999999, 8400) -> 8400", clampTimeLeft(999999, 8400), 8400);
check("(100, 8400) -> 100", clampTimeLeft(100, 8400), 100);
check("(8400, 8400) -> 8400", clampTimeLeft(8400, 8400), 8400);
check("(NaN, 8400) -> 0", clampTimeLeft(NaN, 8400), 0);
check("(100, -5) -> 0", clampTimeLeft(100, -5), 0);

// [6] formatTime 非法值防御
print("\n[6] formatTime 防御非法值");
check("(-5) -> 00:00:00", formatTime(-5), "00:00:00");
check("(NaN) -> 00:00:00", formatTime(NaN), "00:00:00");
check("(Infinity) -> 00:00:00", formatTime(Infinity), "00:00:00");
check("(8400) -> 02:20:00", formatTime(8400), "02:20:00");
check("(59.9) -> 00:00:59", formatTime(59.9), "00:00:59");

// [7] 时长标签
print("\n[7] getSectionDurationLabel 标签");
check("不计入 -> 不计时", getSectionDurationLabel({ duration: 15, countInTotal: false }), "不计时");
check("计入 -> 30min", getSectionDurationLabel({ duration: 30, countInTotal: true }), "30min");
check("旧数据缺字段 -> 按计入显示 20min", getSectionDurationLabel({ duration: 20 }), "20min");

print(`\n结果: ${passCount} 通过, ${failCount} 失败`);
if (failCount > 0) {
  process.exitCode = 1;
}
