const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  buildCustomExamSections,
  calculateEndTime,
  formatTime,
} = require("../js/script.js");

test("formatTime：0 与非零秒数", () => {
  assert.equal(formatTime(0), "00:00:00");
  assert.equal(formatTime(7325), "02:02:05");
});

test("formatTime：负数钳制为 00:00:00", () => {
  assert.equal(formatTime(-1), "00:00:00");
  assert.equal(formatTime(-9999), "00:00:00");
});

test("calculateEndTime：同日", () => {
  assert.equal(calculateEndTime("09:00", 120), "11:00");
});

test("calculateEndTime：跨日", () => {
  assert.equal(calculateEndTime("23:30", 120), "01:30 (次日)");
});

test("calculateEndTime：零时长", () => {
  assert.equal(calculateEndTime("00:00", 0), "00:00");
});

test("T1 回归：90 / 不计10 / 30 总时长 120，休息为零时长占位", () => {
  const sections = buildCustomExamSections({
    startTime: "09:00",
    sections: [
      { name: "环节一", duration: 90, description: "环节一", countInTotal: true },
      { name: "休息", duration: 10, description: "休息", countInTotal: false },
      { name: "环节二", duration: 30, description: "环节二", countInTotal: true },
    ],
  });

  const totalMinutes = sections.reduce((sum, s) => sum + s.duration, 0);
  assert.equal(totalMinutes, 120);

  const rest = sections.find((s) => s.name === "休息");
  assert.equal(rest.start, rest.end);

  const next = sections.find((s) => s.name === "环节二");
  assert.deepEqual([next.start, next.end], [90, 120]);
});

test("防御：全部环节不计入时总时长为 0 且不抛错", () => {
  let sections;
  assert.doesNotThrow(() => {
    sections = buildCustomExamSections({
      startTime: "10:00",
      sections: [
        { name: "环节A", duration: 30, description: "环节A", countInTotal: false },
        { name: "环节B", duration: 45, description: "环节B", countInTotal: false },
      ],
    });
  });

  const totalMinutes = sections.reduce((sum, s) => sum + s.duration, 0);
  assert.equal(totalMinutes, 0);
  assert.ok(sections.every((s) => s.start === s.end));
});
