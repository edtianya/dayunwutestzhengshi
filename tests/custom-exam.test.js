const { test } = require("node:test");
const assert = require("node:assert/strict");

// custom-exam.js 顶层有 DOM 监听注册，Node 下用最小桩即可安全加载（不改变浏览器行为）
globalThis.document = { addEventListener() {} };

const { validateAndFormatTime } = require("../js/custom-exam.js");

test("validateAndFormatTime：标准格式与可修复格式", () => {
  assert.equal(validateAndFormatTime("09:30"), "09:30");
  assert.equal(validateAndFormatTime("9:30"), "09:30");
  assert.equal(validateAndFormatTime("0930"), "09:30");
});

test("validateAndFormatTime：非法输入返回 null", () => {
  assert.equal(validateAndFormatTime("25:99"), null);
  assert.equal(validateAndFormatTime("abc"), null);
  assert.equal(validateAndFormatTime(""), null);
  assert.equal(validateAndFormatTime(null), null);
});
